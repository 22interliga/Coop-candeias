/* ============================================================
   APP — shell compartilhado (nav, perfil, toast, modal, utils)
   ============================================================ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money = n => (n<0?"-":"")+"R$ "+Math.abs(Number(n||0)).toLocaleString("pt-BR",{minimumFractionDigits:2});

/* perfil ativo */
function getRole(){ return localStorage.getItem(COOP.COL+"role") || "Administrador"; }
function setRole(r){ localStorage.setItem(COOP.COL+"role", r); }

const NAV = [
  ["index.html","Painel"],
  ["operacao.html","Operação"],
  ["cadastros.html","Cadastros"],
  ["financeiro.html","Financeiro"],
];

function renderTop(active){
  const opts = COOP.PERFIS.map(p=>`<option ${p===getRole()?"selected":""}>${p}</option>`).join("");
  const nav = NAV.map(([h,t])=>`<a href="${h}" class="${h===active?"active":""}">${t}</a>`).join("");
  document.body.insertAdjacentHTML("afterbegin", `
    <div class="topbar">
      <div class="brand"><span class="dot"></span>
        <div>COOP<small>${esc(COOP.ROTA)}</small></div>
      </div>
      <nav class="nav">${nav}</nav>
      <span class="spacer"></span>
      <span class="route-chip">Intervalo ${COOP.INTERVALO_MIN}min · 1ª ${COOP.PRIMEIRA_SAIDA}</span>
      <select class="rolepick" id="rolepick" title="Perfil ativo">${opts}</select>
    </div>`);
  $("#rolepick").onchange = e => { setRole(e.target.value); toast("Perfil: "+e.target.value); };
}

/* toast */
function toast(msg,type=""){
  let w = $(".toast-wrap");
  if(!w){ w=document.createElement("div"); w.className="toast-wrap"; document.body.appendChild(w); }
  const t=document.createElement("div"); t.className="toast "+type; t.textContent=msg;
  w.appendChild(t); setTimeout(()=>t.remove(),2600);
}

/* modal simples: monta a partir de um id */
function openModal(id){ $("#"+id)?.classList.add("open"); }
function closeModal(id){ $("#"+id)?.classList.remove("open"); }
document.addEventListener("click",e=>{ if(e.target.classList?.contains("modal-bg")) e.target.classList.remove("open"); });

/* status → chip */
function sitChip(s){
  const m={Ativo:"go","Manutenção":"warn",Suspenso:"stop",Inativo:"mut"};
  return `<span class="chip ${m[s]||"mut"}"><i></i>${esc(s)}</span>`;
}
function nameOf(list,id){ const p=list.find(x=>x.id===id); return p?p.nome:"—"; }
function diasLabel(dias){ return (dias||[]).map(d=>COOP.DIAS[d]).join(" · ")||"—"; }

/* boot padrão das páginas */
async function boot(active, fn){
  await seedIfEmpty();
  renderTop(active);
  if(!COOP.USE_FIRESTORE){
    document.body.insertAdjacentHTML("beforeend","");
  }
  try{ await fn(); }catch(e){ console.error(e); toast("Erro ao carregar","stop"); }
}
