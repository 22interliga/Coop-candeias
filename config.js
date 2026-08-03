/* ============================================================
   CONFIG — Cooperativa de Transporte Alternativo
   ------------------------------------------------------------
   Para gravar no Firestore (projeto interliga-app), cole abaixo
   o config do seu projeto e mude USE_FIRESTORE para true.
   Enquanto estiver false, o sistema grava em localStorage
   (dados de teste) — dá pra abrir e testar sem configurar nada.
   O prefixo COL isola os dados desta cooperativa das demais.
   ============================================================ */
window.COOP = {
  USE_FIRESTORE: false,               // troque para true depois de colar o firebaseConfig
  COL: "coop_candeias_",              // prefixo das coleções deste cliente
  firebaseConfig: {
    // apiKey: "...", authDomain: "interliga-app.firebaseapp.com",
    // projectId: "interliga-app", ...
  },

  COOPERATIVA: "Cooperativa Candeias ↔ Madre de Deus",
  ROTA: "Candeias (BA) → Madre de Deus (BA)",

  // Operação
  INTERVALO_MIN: 10,                  // intervalo padrão entre saídas
  PRIMEIRA_SAIDA: "05:00",            // horário da 1ª saída
  TOLERANCIA_MIN: 3,                  // atraso tolerado antes de marcar "atrasado"

  PERFIS: ["Administrador","Presidente","Supervisor","Fiscal","Proprietário","Motorista"],
  TIPOS_PESSOA: ["Proprietário","Motorista","Supervisor","Fiscal","Presidente","Administrador"],
  SITUACOES: ["Ativo","Manutenção","Suspenso","Inativo"],
  DIAS: ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"],
  OCORRENCIAS: ["Pane","Acidente","Atraso","Multa interna","Falta","Revisão","Documentação","Outra"],
  MOTIVOS_SUB: ["Quebra","Manutenção","Problema mecânico","Documentação","Acidente","Falta do motorista","Outro"],
};
