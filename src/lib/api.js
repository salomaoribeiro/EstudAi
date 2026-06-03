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

  // Disciplinas (retorna do edital selecionado)
  getDisciplinas: (uid) => req("GET", `/usuarios/${uid}/disciplinas`),

  // Progresso de assunto (id = catalog assunto_id)
  updateAssunto: (uid, id, data) => req("PATCH", `/usuarios/${uid}/assuntos/${id}`, data),

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
  getTodosEditais: (uid) => req("GET", `/editais?uid=${uid}`),
  getEditais: (uid) => req("GET", `/usuarios/${uid}/editais`),
  addEdital: (data) => req("POST", `/editais`, data),
  updateEdital: (id, data) => req("PUT", `/editais/${id}`, data),
  getEditalProgresso: (eid, uid) => req("GET", `/editais/${eid}/progresso?uid=${uid}`),
  deleteEdital: (id) => req("DELETE", `/editais/${id}`),
  inscreverEdital: (uid, eid) => req("POST", `/usuarios/${uid}/editais/${eid}/subscrever`, {}),
  desinscreverEdital: (uid, eid) => req("DELETE", `/usuarios/${uid}/editais/${eid}/subscrever`),
};
