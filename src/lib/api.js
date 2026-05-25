const BASE = "";

async function req(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Erro desconhecido");
  return json.data;
}

export const api = {
  // Usuários
  getUsuarios: () => req("GET", "/usuarios"),
  addUsuario: (data) => req("POST", "/usuarios", data),
  deleteUsuario: (id) => req("DELETE", `/usuarios/${id}`),

  // Disciplinas
  getDisciplinas: (uid) => req("GET", `/usuarios/${uid}/disciplinas`),
  addDisciplina: (uid, data) => req("POST", `/usuarios/${uid}/disciplinas`, data),
  deleteDisciplina: (uid, id) => req("DELETE", `/usuarios/${uid}/disciplinas/${id}`),

  // Assuntos
  addAssunto: (did, data) => req("POST", `/disciplinas/${did}/assuntos`, data),
  updateAssunto: (id, data) => req("PATCH", `/assuntos/${id}`, data),
  deleteAssunto: (id) => req("DELETE", `/assuntos/${id}`),

  // Sessões
  getSessoes: (uid) => req("GET", `/usuarios/${uid}/sessoes`),
  addSessao: (uid, data) => req("POST", `/usuarios/${uid}/sessoes`, data),

  // Config
  getConfig: (uid) => req("GET", `/usuarios/${uid}/config`),
  setConfig: (uid, data) => req("PUT", `/usuarios/${uid}/config`, data),
  setEditalSelecionado: (uid, edital_id) => req("PUT", `/usuarios/${uid}/config`, { edital_selecionado: edital_id }),

  // Stats
  getStats: (uid) => req("GET", `/usuarios/${uid}/stats`),

  // Grupo
  getGrupo: () => req("GET", "/grupo"),

  // Editais
  getTodosEditais: (uid) => req("GET", `/editais?uid=${uid}`),  // Todos com checkbox
  getEditais: (uid) => req("GET", `/usuarios/${uid}/editais`),  // Apenas inscritos
  addEdital: (data) => req("POST", `/editais`, data),           // Cria global
  updateEdital: (id, data) => req("PUT", `/editais/${id}`, data),
  getEditalProgresso: (eid, uid) => req("GET", `/editais/${eid}/progresso?uid=${uid}`),
  deleteEdital: (id) => req("DELETE", `/editais/${id}`),
  inscreverEdital: (uid, eid) => req("POST", `/usuarios/${uid}/editais/${eid}/subscrever`, {}),
  desinscreverEdital: (uid, eid) => req("DELETE", `/usuarios/${uid}/editais/${eid}/subscrever`),
};
