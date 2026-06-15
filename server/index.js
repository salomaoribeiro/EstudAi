const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../data/estudai.db");
const db = new Database(DB_PATH);

app.use(cors());
app.use(express.json());

// ── Banco de dados ────────────────────────────────────────────────────────────
db.exec(`
  PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS usuarios (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    cor  TEXT NOT NULL DEFAULT '#3B6D11',
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS assuntos_catalogo (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nome      TEXT NOT NULL UNIQUE,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS usuario_progresso (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    assunto_id INTEGER NOT NULL REFERENCES assuntos_catalogo(id) ON DELETE CASCADE,
    progresso  INTEGER NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'nao_iniciado',
    atualizado_em TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (usuario_id, assunto_id)
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id           INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    assunto_id           INTEGER NOT NULL REFERENCES assuntos_catalogo(id) ON DELETE CASCADE,
    edital_disciplina_id INTEGER REFERENCES edital_disciplinas(id) ON DELETE SET NULL,
    duracao_min          INTEGER NOT NULL DEFAULT 0,
    progresso_antes      INTEGER NOT NULL DEFAULT 0,
    progresso_depois     INTEGER NOT NULL DEFAULT 0,
    anotacao             TEXT DEFAULT '',
    data                 TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS config (
    usuario_id  INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    nome_prova  TEXT DEFAULT '',
    data_prova  TEXT DEFAULT '',
    meta_min_dia INTEGER DEFAULT 60,
    edital_selecionado INTEGER DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS editais (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    nome       TEXT NOT NULL,
    instituicao TEXT DEFAULT '',
    data_prova TEXT DEFAULT '',
    descricao  TEXT DEFAULT '',
    criado_em  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS edital_disciplinas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    edital_id  INTEGER NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
    nome       TEXT NOT NULL,
    criado_em  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS edital_assuntos (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    edital_disciplina_id INTEGER NOT NULL REFERENCES edital_disciplinas(id) ON DELETE CASCADE,
    assunto_id           INTEGER NOT NULL REFERENCES assuntos_catalogo(id) ON DELETE CASCADE,
    nome_no_edital       TEXT NOT NULL,
    criado_em            TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS usuario_editais (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    edital_id  INTEGER NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, edital_id)
  );
`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function ok(res, data) { res.json({ ok: true, data }); }
function err(res, msg, status = 400) { res.status(status).json({ ok: false, error: msg }); }

const CORES = ["#3B6D11","#185FA5","#854F0B","#534AB7","#993556","#0F6E56","#A32D2D","#5F5F58"];

function upsertProgresso(uid, assuntoId, p) {
  const status = p === 0 ? "nao_iniciado" : p === 100 ? "concluido" : "em_andamento";
  db.prepare(`
    INSERT INTO usuario_progresso (usuario_id, assunto_id, progresso, status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(usuario_id, assunto_id) DO UPDATE SET
      progresso = excluded.progresso,
      status = excluded.status,
      atualizado_em = datetime('now','localtime')
  `).run(uid, assuntoId, p, status);
  return status;
}

// ── Usuários ──────────────────────────────────────────────────────────────────
app.get("/api/usuarios", (req, res) => {
  ok(res, db.prepare("SELECT * FROM usuarios ORDER BY nome").all());
});

app.post("/api/usuarios", (req, res) => {
  const { nome, cor = "#3B6D11" } = req.body;
  if (!nome?.trim()) return err(res, "Nome obrigatório");
  try {
    const r = db.prepare("INSERT INTO usuarios (nome, cor) VALUES (?, ?)").run(nome.trim(), cor);
    db.prepare("INSERT INTO config (usuario_id) VALUES (?)").run(r.lastInsertRowid);
    ok(res, db.prepare("SELECT * FROM usuarios WHERE id = ?").get(r.lastInsertRowid));
  } catch { err(res, "Nome já existe"); }
});

app.delete("/api/usuarios/:id", (req, res) => {
  db.prepare("DELETE FROM usuarios WHERE id = ?").run(req.params.id);
  ok(res, null);
});

// ── Disciplinas (contexto edital) ─────────────────────────────────────────────
app.get("/api/usuarios/:uid/disciplinas", (req, res) => {
  const uid = req.params.uid;
  const config = db.prepare("SELECT edital_selecionado FROM config WHERE usuario_id = ?").get(uid);
  if (!config?.edital_selecionado) return ok(res, []);

  const disciplinas = db.prepare(`
    SELECT ed.id, ed.nome
    FROM edital_disciplinas ed
    WHERE ed.edital_id = ?
    ORDER BY ed.nome
  `).all(config.edital_selecionado);

  const getAssuntos = db.prepare(`
    SELECT ac.id, ea.nome_no_edital AS nome,
           COALESCE(up.progresso, 0) AS progresso,
           COALESCE(up.status, 'nao_iniciado') AS status
    FROM edital_assuntos ea
    JOIN assuntos_catalogo ac ON ac.id = ea.assunto_id
    LEFT JOIN usuario_progresso up ON up.assunto_id = ac.id AND up.usuario_id = ?
    WHERE ea.edital_disciplina_id = ?
    ORDER BY ea.nome_no_edital
  `);

  const result = disciplinas.map((d, i) => ({
    ...d,
    cor: CORES[i % CORES.length],
    assuntos: getAssuntos.all(uid, d.id)
  }));

  ok(res, result);
});

// ── Progresso de assunto ──────────────────────────────────────────────────────
app.patch("/api/usuarios/:uid/assuntos/:id", (req, res) => {
  const { progresso } = req.body;
  const p = Math.max(0, Math.min(100, Number(progresso)));
  const status = upsertProgresso(req.params.uid, req.params.id, p);
  ok(res, { id: Number(req.params.id), progresso: p, status });
});

// ── Editais ───────────────────────────────────────────────────────────────────
app.get("/api/editais", (req, res) => {
  const uid = req.query.uid;
  const editais = db.prepare(`
    SELECT e.*,
           COUNT(ed.id) AS total_disciplinas,
           CASE WHEN ue.usuario_id IS NOT NULL THEN 1 ELSE 0 END AS inscrito
    FROM editais e
    LEFT JOIN edital_disciplinas ed ON ed.edital_id = e.id
    LEFT JOIN usuario_editais ue ON ue.edital_id = e.id AND ue.usuario_id = ?
    GROUP BY e.id
    ORDER BY e.data_prova, e.nome
  `).all(uid || null);

  const getDiscs = db.prepare("SELECT ed.* FROM edital_disciplinas ed WHERE ed.edital_id = ? ORDER BY ed.nome");
  const getAssuntos = db.prepare("SELECT *, nome_no_edital AS nome FROM edital_assuntos WHERE edital_disciplina_id = ? ORDER BY nome_no_edital");

  const resultado = editais.map(e => ({
    ...e,
    disciplinas: getDiscs.all(e.id).map(d => ({
      ...d,
      assuntos: getAssuntos.all(d.id)
    }))
  }));

  ok(res, resultado);
});

app.get("/api/usuarios/:uid/editais", (req, res) => {
  const editais = db.prepare(`
    SELECT e.*, COUNT(ed.id) AS total_disciplinas
    FROM editais e
    LEFT JOIN edital_disciplinas ed ON ed.edital_id = e.id
    INNER JOIN usuario_editais ue ON ue.edital_id = e.id
    WHERE ue.usuario_id = ?
    GROUP BY e.id
    ORDER BY e.data_prova, e.nome
  `).all(req.params.uid);

  const getDiscs = db.prepare("SELECT ed.* FROM edital_disciplinas ed WHERE ed.edital_id = ? ORDER BY ed.nome");
  const getAssuntos = db.prepare("SELECT *, nome_no_edital AS nome FROM edital_assuntos WHERE edital_disciplina_id = ? ORDER BY nome_no_edital");

  const resultado = editais.map(e => ({
    ...e,
    disciplinas: getDiscs.all(e.id).map(d => ({
      ...d,
      assuntos: getAssuntos.all(d.id)
    }))
  }));

  ok(res, resultado);
});

app.post("/api/editais", (req, res) => {
  const { nome, instituicao, data_prova, descricao, disciplinas } = req.body;
  if (!nome?.trim()) return err(res, "Nome obrigatório");

  const r = db.prepare(`
    INSERT INTO editais (nome, instituicao, data_prova, descricao)
    VALUES (?, ?, ?, ?)
  `).run(nome.trim(), instituicao || "", data_prova || "", descricao || "");

  const editalId = r.lastInsertRowid;

  if (Array.isArray(disciplinas)) {
    const stmt = db.prepare("INSERT INTO edital_disciplinas (edital_id, nome) VALUES (?, ?)");
    for (const disc of disciplinas.filter(d => d?.trim())) {
      stmt.run(editalId, disc.trim());
    }
  }

  const edital = db.prepare("SELECT * FROM editais WHERE id = ?").get(editalId);
  const disList = db.prepare("SELECT * FROM edital_disciplinas WHERE edital_id = ?").all(editalId);
  ok(res, { ...edital, disciplinas: disList, inscrito: 0 });
});

app.post("/api/usuarios/:uid/editais/:eid/subscrever", (req, res) => {
  try {
    db.prepare("INSERT INTO usuario_editais (usuario_id, edital_id) VALUES (?, ?)")
      .run(req.params.uid, req.params.eid);
    ok(res, { inscrito: 1 });
  } catch {
    err(res, "Já inscrito neste edital");
  }
});

app.delete("/api/usuarios/:uid/editais/:eid/subscrever", (req, res) => {
  db.prepare("DELETE FROM usuario_editais WHERE usuario_id = ? AND edital_id = ?")
    .run(req.params.uid, req.params.eid);
  ok(res, { inscrito: 0 });
});

app.get("/api/editais/:eid/progresso", (req, res) => {
  const uid = req.query.uid;
  if (!uid) return err(res, "uid obrigatório", 400);

  const edital = db.prepare("SELECT * FROM editais WHERE id = ?").get(req.params.eid);
  if (!edital) return err(res, "Edital não encontrado", 404);

  const disciplinas = db.prepare(`
    SELECT ed.* FROM edital_disciplinas ed WHERE ed.edital_id = ? ORDER BY ed.nome
  `).all(req.params.eid);

  const getAssuntos = db.prepare(`
    SELECT ac.id, ea.nome_no_edital AS nome,
           COALESCE(up.progresso, 0) AS progresso,
           COALESCE(up.status, 'nao_iniciado') AS status,
           CASE WHEN COALESCE(up.progresso, 0) > 0 THEN 1 ELSE 0 END AS estudado
    FROM edital_assuntos ea
    JOIN assuntos_catalogo ac ON ac.id = ea.assunto_id
    LEFT JOIN usuario_progresso up ON up.assunto_id = ac.id AND up.usuario_id = ?
    WHERE ea.edital_disciplina_id = ?
    ORDER BY ea.nome_no_edital
  `);

  const getHoras = db.prepare(`
    SELECT COALESCE(SUM(duracao_min), 0) AS total
    FROM sessoes WHERE edital_disciplina_id = ? AND usuario_id = ?
  `);

  const resultado = disciplinas.map(disc => {
    const assuntos = getAssuntos.all(uid, disc.id);
    const assuntosEstudados = assuntos.filter(a => a.estudado).length;
    const totalAssuntos = assuntos.length;
    const horasEstudadas = getHoras.get(disc.id, uid).total / 60;
    const progresso = totalAssuntos > 0 ? Math.round((assuntosEstudados / totalAssuntos) * 100) : 0;

    let status = "urgente";
    if (progresso >= 75) status = "completa";
    else if (progresso >= 25) status = "em_progresso";
    else if (progresso > 0) status = "iniciada";

    return {
      id: disc.id,
      nome: disc.nome,
      progresso,
      horasEstudadas: Math.round(horasEstudadas * 10) / 10,
      status,
      faltaEstudar: 100 - progresso,
      assuntos_totais: totalAssuntos,
      assuntos_estudados: assuntosEstudados,
      assuntos_concluidos: assuntosEstudados,
      assuntos_pendentes: totalAssuntos - assuntosEstudados,
      assuntos
    };
  });

  const progressoGeral = resultado.length > 0
    ? Math.round(resultado.reduce((sum, d) => sum + d.progresso, 0) / resultado.length)
    : 0;

  ok(res, {
    edital,
    disciplinas: resultado,
    resumo: {
      progressoGeral,
      completadas: resultado.filter(d => d.status === "completa").length,
      urgentes: resultado.filter(d => d.status === "urgente").length,
      total: resultado.length,
      totalAssuntos: resultado.reduce((sum, d) => sum + d.assuntos_totais, 0),
      assuntosEstudados: resultado.reduce((sum, d) => sum + d.assuntos_estudados, 0)
    }
  });
});

// Comparar editais - assuntos em comum entre 2 ou mais editais
app.get("/api/editais/comparar", (req, res) => {
  const uid = req.query.uid;
  const ids = (req.query.ids || "").split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length < 2) return err(res, "Selecione ao menos 2 editais");

  const placeholders = ids.map(() => "?").join(",");

  const editaisInfo = db.prepare(`SELECT id, nome, instituicao FROM editais WHERE id IN (${placeholders})`).all(...ids);
  if (editaisInfo.length !== ids.length) return err(res, "Edital não encontrado", 404);

  const rows = db.prepare(`
    SELECT ac.id AS assunto_id, ac.nome AS assunto_nome,
           e.id AS edital_id, e.nome AS edital_nome,
           ed.nome AS disciplina_nome
    FROM edital_assuntos ea
    JOIN edital_disciplinas ed ON ed.id = ea.edital_disciplina_id
    JOIN editais e ON e.id = ed.edital_id
    JOIN assuntos_catalogo ac ON ac.id = ea.assunto_id
    WHERE ed.edital_id IN (${placeholders})
    ORDER BY ac.nome
  `).all(...ids);

  const getProgresso = db.prepare(`
    SELECT progresso, status FROM usuario_progresso WHERE usuario_id = ? AND assunto_id = ?
  `);

  // monta, para cada assunto, a presença (disciplina) em cada edital selecionado
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.assunto_id)) {
      map.set(r.assunto_id, { assunto_id: r.assunto_id, nome: r.assunto_nome, porEdital: {} });
    }
    map.get(r.assunto_id).porEdital[r.edital_id] = { edital_nome: r.edital_nome, disciplina: r.disciplina_nome };
  }

  const getProgressoMemo = (assuntoId) => {
    const prog = uid ? getProgresso.get(uid, assuntoId) : null;
    return { progresso: prog?.progresso ?? 0, status: prog?.status ?? "nao_iniciado" };
  };

  const assuntos = [...map.values()].map(a => {
    const presentes = ids.filter(id => a.porEdital[id]);
    const idDisciplinaPrincipal = ids.find(id => a.porEdital[id]);
    return {
      assunto_id: a.assunto_id,
      nome: a.nome,
      porEdital: a.porEdital,
      qtdEditais: presentes.length,
      emTodos: presentes.length === ids.length,
      disciplina_principal: a.porEdital[idDisciplinaPrincipal].disciplina,
      ...getProgressoMemo(a.assunto_id),
    };
  });

  assuntos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // agrupa por disciplina (do primeiro edital, na ordem selecionada, que contém o assunto)
  const gruposMap = new Map();
  for (const a of assuntos) {
    if (!gruposMap.has(a.disciplina_principal)) gruposMap.set(a.disciplina_principal, []);
    gruposMap.get(a.disciplina_principal).push(a);
  }
  const disciplinas = [...gruposMap.entries()]
    .map(([disciplina, assuntos]) => ({ disciplina, assuntos }))
    .sort((a, b) => a.disciplina.localeCompare(b.disciplina, "pt-BR"));

  const comuns = assuntos.filter(a => a.emTodos);
  const proximoSugerido = comuns.find(a => a.status !== "concluido") || null;

  ok(res, {
    editais: editaisInfo,
    disciplinas,
    totalAssuntos: assuntos.length,
    totalComuns: comuns.length,
    proximoSugerido,
  });
});

app.put("/api/editais/:id", (req, res) => {
  const { nome, instituicao, data_prova, descricao, disciplinas } = req.body;
  const id = req.params.id;

  db.prepare(`
    UPDATE editais SET nome = ?, instituicao = ?, data_prova = ?, descricao = ?
    WHERE id = ?
  `).run(nome || "", instituicao || "", data_prova || "", descricao || "", id);

  if (Array.isArray(disciplinas)) {
    db.prepare("DELETE FROM edital_disciplinas WHERE edital_id = ?").run(id);
    const stmt = db.prepare("INSERT INTO edital_disciplinas (edital_id, nome) VALUES (?, ?)");
    for (const disc of disciplinas.filter(d => d?.trim())) {
      stmt.run(id, disc.trim());
    }
  }

  const edital = db.prepare("SELECT * FROM editais WHERE id = ?").get(id);
  const disList = db.prepare("SELECT * FROM edital_disciplinas WHERE edital_id = ?").all(id);
  ok(res, { ...edital, disciplinas: disList });
});

app.delete("/api/editais/:id", (req, res) => {
  db.prepare("DELETE FROM editais WHERE id = ?").run(req.params.id);
  ok(res, null);
});

// Adicionar disciplina a um edital
app.post("/api/editais/:eid/disciplinas", (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return err(res, "Nome obrigatório");
  try {
    const r = db.prepare("INSERT INTO edital_disciplinas (edital_id, nome) VALUES (?, ?)")
      .run(req.params.eid, nome.trim());
    ok(res, { id: r.lastInsertRowid, nome: nome.trim() });
  } catch (e) { err(res, e.message); }
});

// Renomear disciplina
app.put("/api/edital-disciplinas/:id", (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return err(res, "Nome obrigatório");
  db.prepare("UPDATE edital_disciplinas SET nome = ? WHERE id = ?").run(nome.trim(), req.params.id);
  ok(res, { id: Number(req.params.id), nome: nome.trim() });
});

// Remover disciplina
app.delete("/api/edital-disciplinas/:id", (req, res) => {
  db.prepare("DELETE FROM edital_disciplinas WHERE id = ?").run(req.params.id);
  ok(res, null);
});

// Editar assunto de uma disciplina (pelo catalog id)
app.put("/api/edital-disciplinas/:did/assuntos/:aid", (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return err(res, "Nome obrigatório");
  db.prepare("UPDATE edital_assuntos SET nome_no_edital = ? WHERE edital_disciplina_id = ? AND assunto_id = ?")
    .run(nome.trim(), req.params.did, req.params.aid);
  ok(res, { nome: nome.trim() });
});

// Remover assunto de uma disciplina (pelo catalog id)
app.delete("/api/edital-disciplinas/:did/assuntos/:aid", (req, res) => {
  db.prepare("DELETE FROM edital_assuntos WHERE edital_disciplina_id = ? AND assunto_id = ?")
    .run(req.params.did, req.params.aid);
  ok(res, null);
});

// Adicionar assuntos a uma disciplina de edital
app.post("/api/edital-disciplinas/:did/assuntos", (req, res) => {
  const { assuntos } = req.body;
  if (!Array.isArray(assuntos)) return err(res, "assuntos deve ser um array");

  const insertCatalog = db.prepare("INSERT OR IGNORE INTO assuntos_catalogo (nome) VALUES (?)");
  const getCatalogId = db.prepare("SELECT id FROM assuntos_catalogo WHERE nome = ?");
  const insertEdital = db.prepare(
    "INSERT INTO edital_assuntos (edital_disciplina_id, assunto_id, nome_no_edital) VALUES (?, ?, ?)"
  );
  const resultado = [];

  try {
    for (const nome of assuntos.filter(a => a?.trim())) {
      const trimmed = nome.trim();
      insertCatalog.run(trimmed);
      const { id: assuntoId } = getCatalogId.get(trimmed);
      const r = insertEdital.run(req.params.did, assuntoId, trimmed);
      resultado.push({ id: r.lastInsertRowid, nome: trimmed, assunto_id: assuntoId });
    }
    ok(res, resultado);
  } catch (e) {
    err(res, e.message);
  }
});

// ── Sessões ───────────────────────────────────────────────────────────────────
app.get("/api/usuarios/:uid/sessoes", (req, res) => {
  ok(res, db.prepare(`
    SELECT s.*, ac.nome AS assunto_nome,
           COALESCE(ed.nome, '') AS disciplina_nome,
           '#3B6D11' AS disciplina_cor
    FROM sessoes s
    JOIN assuntos_catalogo ac ON ac.id = s.assunto_id
    LEFT JOIN edital_disciplinas ed ON ed.id = s.edital_disciplina_id
    WHERE s.usuario_id = ?
    ORDER BY s.data DESC
    LIMIT 50
  `).all(req.params.uid));
});

app.post("/api/usuarios/:uid/sessoes", (req, res) => {
  const uid = req.params.uid;
  const { assunto_id, disciplina_id, duracao_min, progresso_antes, progresso_depois, anotacao } = req.body;

  const r = db.prepare(`
    INSERT INTO sessoes (usuario_id, assunto_id, edital_disciplina_id, duracao_min, progresso_antes, progresso_depois, anotacao)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uid, assunto_id, disciplina_id || null, duracao_min, progresso_antes, progresso_depois, anotacao || "");

  const p = Math.max(0, Math.min(100, Number(progresso_depois)));
  upsertProgresso(uid, assunto_id, p);

  ok(res, db.prepare("SELECT * FROM sessoes WHERE id = ?").get(r.lastInsertRowid));
});

// ── Config ────────────────────────────────────────────────────────────────────
app.get("/api/usuarios/:uid/config", (req, res) => {
  ok(res, db.prepare("SELECT * FROM config WHERE usuario_id = ?").get(req.params.uid) || {});
});

app.put("/api/usuarios/:uid/config", (req, res) => {
  const { nome_prova, data_prova, meta_min_dia, edital_selecionado } = req.body;
  db.prepare(`
    INSERT INTO config (usuario_id, nome_prova, data_prova, meta_min_dia, edital_selecionado)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(usuario_id) DO UPDATE SET
      nome_prova = excluded.nome_prova,
      data_prova = excluded.data_prova,
      meta_min_dia = excluded.meta_min_dia,
      edital_selecionado = excluded.edital_selecionado
  `).run(req.params.uid, nome_prova || "", data_prova || "", meta_min_dia || 60, edital_selecionado || null);
  ok(res, db.prepare("SELECT * FROM config WHERE usuario_id = ?").get(req.params.uid));
});

// ── Grupo ─────────────────────────────────────────────────────────────────────
app.get("/api/grupo", (req, res) => {
  const usuarios = db.prepare("SELECT * FROM usuarios ORDER BY nome").all();

  const getProgresso = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) AS concluidos
    FROM usuario_progresso WHERE usuario_id = ?
  `);

  const hojeStr = new Date().toISOString().slice(0, 10);

  const resultado = usuarios.map(u => {
    const { total, concluidos } = getProgresso.get(u.id);
    const progresso = total ? Math.round((concluidos / total) * 100) : 0;

    const minHoje = db.prepare(`
      SELECT COALESCE(SUM(duracao_min),0) AS total
      FROM sessoes WHERE usuario_id = ? AND date(data) = ?
    `).get(u.id, hojeStr).total;

    const streak = calcStreak(u.id);
    const config = db.prepare("SELECT * FROM config WHERE usuario_id = ?").get(u.id) || {};

    return { ...u, total, concluidos, progresso, minHoje, streak, config };
  });

  ok(res, resultado);
});

function calcStreak(uid) {
  const dias = db.prepare(`
    SELECT DISTINCT date(data) AS dia FROM sessoes
    WHERE usuario_id = ? ORDER BY dia DESC
  `).all(uid).map(r => r.dia);
  if (!dias.length) return 0;
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0,0,0,0);
  for (const dia of dias) {
    const d = new Date(dia + "T00:00:00");
    const diff = Math.round((cursor - d) / 86400000);
    if (diff <= 1) { streak++; cursor = d; }
    else break;
  }
  return streak;
}

// ── Estatísticas ──────────────────────────────────────────────────────────────
app.get("/api/usuarios/:uid/stats", (req, res) => {
  const uid = req.params.uid;
  const hojeStr = new Date().toISOString().slice(0, 10);

  const minHoje = db.prepare(`
    SELECT COALESCE(SUM(duracao_min),0) AS total FROM sessoes
    WHERE usuario_id = ? AND date(data) = ?
  `).get(uid, hojeStr).total;

  const minTotal = db.prepare(`
    SELECT COALESCE(SUM(duracao_min),0) AS total FROM sessoes WHERE usuario_id = ?
  `).get(uid).total;

  const ultimos7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dia = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const min = db.prepare(`
      SELECT COALESCE(SUM(duracao_min),0) AS total FROM sessoes
      WHERE usuario_id = ? AND date(data) = ?
    `).get(uid, dia).total;
    ultimos7.push({ label, min, dia });
  }

  ok(res, { minHoje, minTotal, streak: calcStreak(uid), ultimos7 });
});

// ── Servir React em produção ──────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../build")));
  app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../build/index.html")));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ estudaí rodando em http://localhost:${PORT}`);
  console.log(`📱 Acesse de outros dispositivos pelo IP da sua máquina\n`);
});
