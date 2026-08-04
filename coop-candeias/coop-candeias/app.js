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

/* Session / Login */
function setUser(user){ localStorage.setItem(COOP.COL+"user", JSON.stringify(user)); }
function getUser(){ try{ return JSON.parse(localStorage.getItem(COOP.COL+"user"))||null; }catch(e){ return null; } }
function logout(){ localStorage.removeItem(COOP.COL+"user"); location.href="login.html"; }
function requireLogin(){ if(!getUser()) { location.href="login.html"; throw new Error("Not logged in"); } }

const NAV = [
  ["index.html","Painel"],
  ["operacao.html","Operação"],
  ["fiscal.html","Fiscal"],
  ["cadastros.html","Cadastros"],
  ["cobrancas.html","Cobranças"],
  ["financeiro.html","Financeiro"],
];

function renderTop(active){
  const user = getUser();
  const opts = COOP.PERFIS.map(p=>`<option ${p===getRole()?"selected":""}>${p}</option>`).join("");
  const nav = NAV.map(([h,t])=>`<a href="${h}" class="${h===active?"active":""}">${t}</a>`).join("");
  const rightSide = user 
    ? `<span class="route-chip">${esc(user.nome)}</span><button class="btn sm" id="logoutBtn">Sair</button>`
    : `<span class="route-chip">Intervalo ${COOP.INTERVALO_MIN}min · 1ª ${COOP.PRIMEIRA_SAIDA}</span><select class="rolepick" id="rolepick" title="Perfil ativo">${opts}</select>`;
  document.body.insertAdjacentHTML("afterbegin", `
    <div class="topbar">
      <div class="brand"><span class="dot"></span>
        <div>COOP<small>${esc(COOP.ROTA)}</small></div>
      </div>
      <nav class="nav">${nav}</nav>
      <span class="spacer"></span>
      ${rightSide}
    </div>`);
  if(user){ $("#logoutBtn").onclick = logout; }
  else $("#rolepick").onchange = e => { setRole(e.target.value); toast("Perfil: "+e.target.value); };
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

// ===== AUDITORIA =====
async function logAuditAction(acao, detalhe = "") {
  const user = getUser();
  if(!user) return;
  
  const log = {
    id: `audit_${Date.now()}`,
    usuario: user.nome,
    tipo: user.tipo,
    acao: acao,
    detalhe: detalhe,
    ts: new Date().toISOString()
  };
  
  await DB.put("auditlog", log);
}
