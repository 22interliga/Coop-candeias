/* ============================================================
   DB — camada de dados
   Async por padrão: hoje grava em localStorage; ao ativar
   USE_FIRESTORE, os mesmos métodos passam a usar o Firestore
   (mesma assinatura, nada muda nas telas).
   ============================================================ */
(function(){
  const C = window.COOP;
  const key = col => C.COL + col;
  const useFS = () => C.USE_FIRESTORE && window.firebase && firebase.apps.length;

  function fs(){ return firebase.firestore(); }

  const local = {
    all(col){ try{ return JSON.parse(localStorage.getItem(key(col))||"[]"); }catch(e){ return []; } },
    save(col,arr){ localStorage.setItem(key(col), JSON.stringify(arr)); },
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

  window.DB = {
    uid,
    async all(col){
      if(useFS()){
        const s = await fs().collection(key(col)).get();
        return s.docs.map(d => ({id:d.id, ...d.data()}));
      }
      return local.all(col);
    },
    async get(col,id){
      const list = await this.all(col);
      return list.find(x => x.id === id) || null;
    },
    async put(col,obj){
      obj = {...obj};
      if(!obj.id) obj.id = uid();
      if(useFS()){ await fs().collection(key(col)).doc(obj.id).set(obj,{merge:true}); return obj; }
      const list = local.all(col);
      const i = list.findIndex(x => x.id === obj.id);
      if(i>=0) list[i] = obj; else list.push(obj);
      local.save(col,list); return obj;
    },
    async del(col,id){
      if(useFS()){ await fs().collection(key(col)).doc(id).delete(); return; }
      local.save(col, local.all(col).filter(x => x.id !== id));
    },
    async setAll(col,arr){
      if(useFS()){
        const batch = fs().batch();
        arr.forEach(o => batch.set(fs().collection(key(col)).doc(o.id), o));
        await batch.commit();
        return;
      }
      local.save(col,arr);
    }
  };

  window.T = {
    toMin(hhmm){ const [h,m]=String(hhmm||"00:00").split(":").map(Number); return h*60+m; },
    toHHMM(min){ min=((min%1440)+1440)%1440; return String(Math.floor(min/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0"); },
    now(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); },
    today(){ return new Date().toISOString().slice(0,10); },
    weekday(dateStr){ return new Date(dateStr+"T12:00:00").getDay(); },
  };

  /* -------------------- lógica da fila com paradas -------------------- */
  window.FILA = {
    colFila(dateStr){ return "fila_"+dateStr; },

    // monta a fila do dia a partir das escalas dos veículos ativos
    async build(dateStr, rotaId){
      const wd = T.weekday(dateStr);
      const veic = await DB.all("veiculos");
      const rota = await DB.get("rotas", rotaId || C.ROTA_PADRAO);
      if(!rota) return [];

      const paradas = (rota.paradas || []).sort((a,b) => a.ordem - b.ordem);
      const eleg = veic
        .filter(v => v.situacao==="Ativo" && (v.escalaDias||[]).includes(wd))
        .sort((a,b)=> (a.ordemBase||0)-(b.ordemBase||0));
      
      const base = T.toMin(C.PRIMEIRA_SAIDA);
      const fila = eleg.map((v,i)=>{
        // Cria entrada na fila com todas as paradas
        const filaParadas = paradas.map((p,pi) => ({
          parada: p.id,
          nome: p.nome,
          ordem: pi+1,
          previsto: T.toHHMM(base + i*C.INTERVALO_MIN + pi*C.INTERVALO_PARADA_MIN),
          real: "",
          registros: [] // fiscalizações dessa parada
        }));
        return {
          id: DB.uid(),
          veiculoId: v.id,
          filaPosicao: i+1,
          rotaId: rota.id,
          paradas: filaParadas,
          status: "aguardando",
          supervisorId: "",
          ts: Date.now()
        };
      });
      await DB.setAll(this.colFila(dateStr), fila);
      return fila;
    },

    async get(dateStr){ return DB.all(this.colFila(dateStr)); },

    async saveRow(dateStr,row){ return DB.put(this.colFila(dateStr), row); },

    // reordena e recalcula ordem + horário previsto de TODAS as paradas
    async reindex(dateStr, arr, intervaloMin){
      const base = T.toMin(C.PRIMEIRA_SAIDA);
      arr.forEach((f,i)=>{
        f.filaPosicao = i+1;
        f.paradas.forEach((p,pi) => {
          p.previsto = T.toHHMM(base + i*(intervaloMin||C.INTERVALO_MIN) + pi*C.INTERVALO_PARADA_MIN);
        });
      });
      await DB.setAll(this.colFila(dateStr), arr);
      return arr;
    },

    // penalidade: desce o veículo N posições e reorganiza a fila
    async aplicarPenalidade(dateStr, veiculoId, posicoes){
      let arr = (await this.get(dateStr)).sort((a,b)=>a.filaPosicao-b.filaPosicao);
      const from = arr.findIndex(f=>f.veiculoId===veiculoId);
      if(from<0) return arr;
      const to = Math.min(arr.length-1, from+Number(posicoes));
      const [item] = arr.splice(from,1);
      arr.splice(to,0,item);
      return this.reindex(dateStr, arr);
    },
  };

  /* -------------------- seed (dados de teste) -------------------- */
  window.seedIfEmpty = async function(){
    const flag = C.COL+"seeded";
    if(localStorage.getItem(flag)) return;
    if(C.USE_FIRESTORE){ localStorage.setItem(flag,"1"); return; }

    await DB.put("cooperativa",{id:"coop", nome:C.COOPERATIVA, rota:C.ROTA,
      cnpj:"", presidente:"Antônio Ferreira", caixa:0});

    const rotas = [
      {
        id: "rota_candeias_madre",
        nome: "Candeias → Madre de Deus",
        origem: "Candeias",
        destino: "Madre de Deus",
        paradas: [
          { id: "p1", nome: "Candeias (Origem)", ordem: 1 },
          { id: "p2", nome: "Centro Candeias", ordem: 2 },
          { id: "p3", nome: "Rodoviária Candeias", ordem: 3 },
          { id: "p4", nome: "Entrada Madre de Deus", ordem: 4 },
          { id: "p5", nome: "Madre de Deus (Destino)", ordem: 5 }
        ]
      }
    ];
    await DB.setAll("rotas", rotas);

    const pessoas = [
      { id:"mot1", tipo:"Motorista", nome:"João da Silva", telefone:"71987654321", doc:"123.456.789-00", situacao:"Ativo" },
      { id:"mot2", tipo:"Motorista", nome:"Carlos Oliveira", telefone:"71987654322", doc:"234.567.890-11", situacao:"Ativo" },
      { id:"fis1", tipo:"Fiscal", nome:"Fábio Santos", telefone:"71987654323", doc:"345.678.901-22", situacao:"Ativo" },
      { id:"fis2", tipo:"Fiscal", nome:"Marcos Costa", telefone:"71987654324", doc:"456.789.012-33", situacao:"Ativo" },
      { id:"prop1", tipo:"Proprietário", nome:"Roberto Lima", telefone:"71987654325", doc:"567.890.123-44", situacao:"Ativo" },
      { id:"prop2", tipo:"Proprietário", nome:"Fernando Gomes", telefone:"71987654326", doc:"678.901.234-55", situacao:"Ativo" },
      { id:"sup1", tipo:"Supervisor", nome:"Antônio Pereira", telefone:"71987654327", doc:"789.012.345-66", situacao:"Ativo" },
      { id:"pres1", tipo:"Presidente", nome:"Antônio Ferreira", telefone:"71987654328", doc:"890.123.456-77", situacao:"Ativo" }
    ];
    await DB.setAll("pessoas", pessoas);

    const veiculos = [
      { id:"v1", prefixo:"001", placa:"BA-0001", modelo:"Kombi", marca:"VW", ano:2015, capacidade:8, proprietarioId:"prop1", motoristaId:"mot1", situacao:"Ativo", escalaDias:[1,2,3,4,5], documentacao:"OK", ordemBase:1 },
      { id:"v2", prefixo:"002", placa:"BA-0002", modelo:"Kombi", marca:"VW", ano:2016, capacidade:8, proprietarioId:"prop2", motoristaId:"mot2", situacao:"Ativo", escalaDias:[1,2,3,4,5], documentacao:"OK", ordemBase:2 },
      { id:"v3", prefixo:"003", placa:"BA-0003", modelo:"Kombi", marca:"VW", ano:2017, capacidade:8, proprietarioId:"prop1", motoristaId:"", situacao:"Ativo", escalaDias:[1,2,3,4,5], documentacao:"OK", ordemBase:3 }
    ];
    await DB.setAll("veiculos", veiculos);

    const cobrancas = [
      { id:"cob1", cooperadoId:"prop1", tipo:"Mensalidade", valor:800, referencia:"Jan/2026", vencimento:"2026-01-15", situacao:"Quitado", pagoEm:"2026-01-10", ts:Date.now() }
    ];
    await DB.setAll("cobrancas", cobrancas);

    const financeiro = [
      { id:"fin1", tipo:"Mensalidade", valor:800, descricao:"Cota proprietário Jan", data:"2026-01-10", ts:Date.now() }
    ];
    await DB.setAll("financeiro", financeiro);

    const penalidades = [];
    const substituicoes = [];
    const fiscalizacoes = [];

    await DB.setAll("penalidades", penalidades);
    await DB.setAll("substituicoes", substituicoes);
    await DB.setAll("fiscalizacoes", fiscalizacoes);

    localStorage.setItem(flag,"1");
  };

})();
