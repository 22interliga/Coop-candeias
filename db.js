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
        await batch.commit(); return arr;
      }
      local.save(col,arr); return arr;
    },
  };

  /* -------------------- helpers de tempo -------------------- */
  window.T = {
    toMin(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; },
    toHHMM(min){ min=((min%1440)+1440)%1440; return String(Math.floor(min/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0"); },
    now(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); },
    today(){ return new Date().toISOString().slice(0,10); },
    weekday(dateStr){ return new Date(dateStr+"T12:00:00").getDay(); },
  };

  /* -------------------- lógica da fila -------------------- */
  window.FILA = {
    colFila(dateStr){ return "fila_"+dateStr; },

    // monta a fila do dia a partir das escalas dos veículos ativos
    async build(dateStr){
      const wd = T.weekday(dateStr);
      const veic = await DB.all("veiculos");
      const eleg = veic
        .filter(v => v.situacao==="Ativo" && (v.escalaDias||[]).includes(wd))
        .sort((a,b)=> (a.ordemBase||0)-(b.ordemBase||0));
      const base = T.toMin(C.PRIMEIRA_SAIDA);
      const fila = eleg.map((v,i)=>({
        id:DB.uid(), veiculoId:v.id, ordem:i+1,
        previsto:T.toHHMM(base + i*C.INTERVALO_MIN),
        real:"", status:"aguardando", fiscalId:"", supervisorId:""
      }));
      await DB.setAll(this.colFila(dateStr), fila);
      return fila;
    },

    async get(dateStr){ return DB.all(this.colFila(dateStr)); },

    async saveRow(dateStr,row){ return DB.put(this.colFila(dateStr), row); },

    // reordena e recalcula ordem + horário previsto
    async reindex(dateStr, arr){
      const base = T.toMin(C.PRIMEIRA_SAIDA);
      arr.forEach((f,i)=>{ f.ordem=i+1; f.previsto=T.toHHMM(base+i*C.INTERVALO_MIN); });
      await DB.setAll(this.colFila(dateStr), arr);
      return arr;
    },

    // penalidade: desce o veículo N posições e reorganiza a fila
    async aplicarPenalidade(dateStr, veiculoId, posicoes){
      let arr = (await this.get(dateStr)).sort((a,b)=>a.ordem-b.ordem);
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

    const pessoas = [
      ["João Prop","Proprietário","71 99100-0001"],["Carla Prop","Proprietário","71 99100-0002"],
      ["Marcos Prop","Proprietário","71 99100-0003"],["Rita Prop","Proprietário","71 99100-0004"],
      ["Pedro Mot","Motorista","71 98800-0001"],["Luís Mot","Motorista","71 98800-0002"],
      ["Sérgio Mot","Motorista","71 98800-0003"],["Ana Mot","Motorista","71 98800-0004"],
      ["Diego Mot","Motorista","71 98800-0005"],
      ["Cláudio Sup","Supervisor","71 97700-0001"],["Fábio Fisc","Fiscal","71 97700-0002"],
    ].map((p,i)=>({id:"p"+i, nome:p[0], tipo:p[1], telefone:p[2], doc:""}));
    await DB.setAll("pessoas", pessoas);
    const prop = pessoas.filter(p=>p.tipo==="Proprietário");
    const mot  = pessoas.filter(p=>p.tipo==="Motorista");

    const allDays=[1,2,3,4,5], seg_qua_sex=[1,3,5], ter_qui_sab=[2,4,6];
    const escalas=[allDays,seg_qua_sex,ter_qui_sab,allDays,seg_qua_sex,ter_qui_sab];
    const veic = [
      ["101","JKL-1A23","Sprinter","Mercedes",2021,20,"Ativo"],
      ["102","MNO-2B34","Master","Renault",2020,16,"Ativo"],
      ["103","PQR-3C45","Ducato","Fiat",2019,18,"Ativo"],
      ["104","STU-4D56","Daily","Iveco",2022,20,"Ativo"],
      ["105","VWX-5E67","Marcopolo","Volksbus",2018,32,"Manutenção"],
      ["106","YZA-6F78","Sprinter","Mercedes",2023,20,"Ativo"],
    ].map((v,i)=>({
      id:"v"+i, prefixo:v[0], placa:v[1], modelo:v[2], marca:v[3], ano:v[4],
      capacidade:v[5], situacao:v[6], ordemBase:i,
      proprietarioId:prop[i%prop.length].id, motoristaId:mot[i%mot.length].id,
      reservas:[], telefone:"71 99000-00"+i, documentacao:"OK",
      escalaTipo:"personalizada", escalaDias:escalas[i], docVenc:"",
    }));
    await DB.setAll("veiculos", veic);

    await DB.setAll("financeiro",[
      {id:"f1",tipo:"Mensalidade",descricao:"Mensalidade cooperados (jul)",valor:1800,data:T.today()},
      {id:"f2",tipo:"Despesa",descricao:"Aluguel do ponto de apoio",valor:-650,data:T.today()},
      {id:"f3",tipo:"Taxa",descricao:"Taxa semanal",valor:420,data:T.today()},
    ]);

    localStorage.setItem(flag,"1");
  };
})();
