const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3001;
const db = new Database(path.join(__dirname, "estudai.db"));

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

  CREATE TABLE IF NOT EXISTS disciplinas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome       TEXT NOT NULL,
    cor        TEXT NOT NULL DEFAULT '#3B6D11',
    criado_em  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS assuntos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    progresso    INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'nao_iniciado',
    criado_em    TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    assunto_id    INTEGER NOT NULL REFERENCES assuntos(id) ON DELETE CASCADE,
    disciplina_id INTEGER NOT NULL,
    duracao_min   INTEGER NOT NULL DEFAULT 0,
    progresso_antes INTEGER NOT NULL DEFAULT 0,
    progresso_depois INTEGER NOT NULL DEFAULT 0,
    anotacao      TEXT DEFAULT '',
    data          TEXT DEFAULT (datetime('now','localtime'))
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
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    edital_disciplina_id INTEGER NOT NULL REFERENCES edital_disciplinas(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    criado_em    TEXT DEFAULT (datetime('now','localtime'))
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

// ── Disciplinas ───────────────────────────────────────────────────────────────
app.get("/api/usuarios/:uid/disciplinas", (req, res) => {
  const disciplinas = db.prepare("SELECT * FROM disciplinas WHERE usuario_id = ? ORDER BY nome").all(req.params.uid);
  const result = disciplinas.map(d => {
    const assuntos = db.prepare("SELECT * FROM assuntos WHERE disciplina_id = ? ORDER BY nome").all(d.id);
    return { ...d, assuntos };
  });
  ok(res, result);
});

app.post("/api/usuarios/:uid/disciplinas", (req, res) => {
  const { nome, cor = "#3B6D11" } = req.body;
  if (!nome?.trim()) return err(res, "Nome obrigatório");
  const r = db.prepare("INSERT INTO disciplinas (usuario_id, nome, cor) VALUES (?, ?, ?)").run(req.params.uid, nome.trim(), cor);
  ok(res, db.prepare("SELECT * FROM disciplinas WHERE id = ?").get(r.lastInsertRowid));
});

app.delete("/api/usuarios/:uid/disciplinas/:id", (req, res) => {
  db.prepare("DELETE FROM disciplinas WHERE id = ? AND usuario_id = ?").run(req.params.id, req.params.uid);
  ok(res, null);
});

// ── Assuntos ──────────────────────────────────────────────────────────────────
app.post("/api/disciplinas/:did/assuntos", (req, res) => {
  const { nome, assuntos } = req.body;

  // Se é um array de assuntos (criação em massa)
  if (Array.isArray(assuntos)) {
    const stmt = db.prepare("INSERT INTO assuntos (disciplina_id, nome) VALUES (?, ?)");
    const resultado = [];
    try {
      for (const assunto of assuntos.filter(a => a?.trim())) {
        const r = stmt.run(req.params.did, assunto.trim());
        resultado.push({ id: r.lastInsertRowid, nome: assunto.trim() });
      }
      ok(res, resultado);
    } catch (e) {
      err(res, e.message);
    }
    return;
  }

  // Se é um único assunto
  if (!nome?.trim()) return err(res, "Nome obrigatório");
  const r = db.prepare("INSERT INTO assuntos (disciplina_id, nome) VALUES (?, ?)").run(req.params.did, nome.trim());
  ok(res, db.prepare("SELECT * FROM assuntos WHERE id = ?").get(r.lastInsertRowid));
});

app.patch("/api/assuntos/:id", (req, res) => {
  const { progresso } = req.body;
  const p = Math.max(0, Math.min(100, Number(progresso)));
  const status = p === 0 ? "nao_iniciado" : p === 100 ? "concluido" : "em_andamento";
  db.prepare("UPDATE assuntos SET progresso = ?, status = ? WHERE id = ?").run(p, status, req.params.id);
  ok(res, db.prepare("SELECT * FROM assuntos WHERE id = ?").get(req.params.id));
});

app.delete("/api/assuntos/:id", (req, res) => {
  db.prepare("DELETE FROM assuntos WHERE id = ?").run(req.params.id);
  ok(res, null);
});

// ── Editais ───────────────────────────────────────────────────────────────────
// Todos os editais globais (com checkbox de inscrição do usuário)
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

  const resultado = editais.map(e => {
    const disciplinas = db.prepare(`
      SELECT ed.* FROM edital_disciplinas ed WHERE ed.edital_id = ? ORDER BY ed.nome
    `).all(e.id);

    // Enriquecer cada disciplina com seus assuntos
    const disciplinasEnriquecidas = disciplinas.map(d => {
      const assuntos = db.prepare(`
        SELECT * FROM edital_assuntos WHERE edital_disciplina_id = ? ORDER BY nome
      `).all(d.id);
      return { ...d, assuntos };
    });

    return { ...e, disciplinas: disciplinasEnriquecidas };
  });

  ok(res, resultado);
});

// Editais inscritos do usuário
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

  const resultado = editais.map(e => {
    const disciplinas = db.prepare(`
      SELECT ed.* FROM edital_disciplinas ed WHERE ed.edital_id = ? ORDER BY ed.nome
    `).all(e.id);

    // Enriquecer cada disciplina com seus assuntos
    const disciplinasEnriquecidas = disciplinas.map(d => {
      const assuntos = db.prepare(`
        SELECT * FROM edital_assuntos WHERE edital_disciplina_id = ? ORDER BY nome
      `).all(d.id);
      return { ...d, assuntos };
    });

    return { ...e, disciplinas: disciplinasEnriquecidas };
  });

  ok(res, resultado);
});

// Criar edital global
app.post("/api/editais", (req, res) => {
  const { nome, instituicao, data_prova, descricao, disciplinas } = req.body;
  if (!nome?.trim()) return err(res, "Nome obrigatório");

  const r = db.prepare(`
    INSERT INTO editais (nome, instituicao, data_prova, descricao)
    VALUES (?, ?, ?, ?)
  `).run(nome.trim(), instituicao || "", data_prova || "", descricao || "");

  const editalId = r.lastInsertRowid;

  // Inserir disciplinas
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

// Inscrever usuário em edital
app.post("/api/usuarios/:uid/editais/:eid/subscrever", (req, res) => {
  try {
    db.prepare("INSERT INTO usuario_editais (usuario_id, edital_id) VALUES (?, ?)")
      .run(req.params.uid, req.params.eid);
    ok(res, { inscrito: 1 });
  } catch {
    err(res, "Já inscrito neste edital");
  }
});

// Desinscrever usuário de edital
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

  // Buscar disciplinas do edital com seus assuntos
  const disciplinasEdital = db.prepare(`
    SELECT ed.* FROM edital_disciplinas ed WHERE ed.edital_id = ?
  `).all(req.params.eid);

  const resultado = disciplinasEdital.map(discEdital => {
    // Buscar assuntos do edital para esta disciplina
    const assuntosEdital = db.prepare(`
      SELECT * FROM edital_assuntos WHERE edital_disciplina_id = ?
    `).all(discEdital.id);

    if (assuntosEdital.length === 0) {
      return {
        id: discEdital.id,
        nome: discEdital.nome,
        progresso: 0,
        horasEstudadas: 0,
        status: "nao_iniciada",
        faltaEstudar: 100,
        assuntos_totais: 0,
        assuntos_estudados: 0
      };
    }

    // Buscar disciplina do usuário com mesmo nome
    const userDisciplina = db.prepare(`
      SELECT * FROM disciplinas WHERE usuario_id = ? AND LOWER(nome) LIKE ?
      LIMIT 1
    `).get(uid, `%${discEdital.nome.toLowerCase()}%`);

    let assuntosEstudados = 0;
    let horasEstudadas = 0;

    if (userDisciplina) {
      // Buscar assuntos do usuário para esta disciplina
      const assuntosUser = db.prepare(`
        SELECT * FROM assuntos WHERE disciplina_id = ?
      `).all(userDisciplina.id);

      // Contar quantos assuntos o usuário estudou (progresso > 0)
      assuntosEstudados = assuntosUser.filter(a => a.progresso > 0).length;

      // Buscar horas estudadas
      horasEstudadas = db.prepare(`
        SELECT COALESCE(SUM(duracao_min), 0) AS total
        FROM sessoes WHERE disciplina_id = ?
      `).get(userDisciplina.id).total / 60;
    }

    const totalAssuntos = assuntosEdital.length;
    const progresso = totalAssuntos > 0
      ? Math.round((assuntosEstudados / totalAssuntos) * 100)
      : 0;

    let status = "nao_iniciada";
    if (progresso >= 75) status = "completa";
    else if (progresso >= 25) status = "em_progresso";
    else if (progresso > 0) status = "iniciada";
    else status = "urgente";

    return {
      id: discEdital.id,
      nome: discEdital.nome,
      progresso,
      horasEstudadas: Math.round(horasEstudadas * 10) / 10,
      status,
      faltaEstudar: 100 - progresso,
      assuntos_totais: totalAssuntos,
      assuntos_estudados: assuntosEstudados
    };
  });

  // Calcula progresso geral
  const progressoGeral = resultado.length > 0
    ? Math.round(resultado.reduce((sum, d) => sum + d.progresso, 0) / resultado.length)
    : 0;

  const completadas = resultado.filter(d => d.status === "completa").length;
  const urgentes = resultado.filter(d => d.status === "urgente").length;
  const totalAssuntosGeral = resultado.reduce((sum, d) => sum + d.assuntos_totais, 0);
  const assuntosEstudadosGeral = resultado.reduce((sum, d) => sum + d.assuntos_estudados, 0);

  ok(res, {
    edital,
    disciplinas: resultado,
    resumo: {
      progressoGeral,
      completadas,
      urgentes,
      total: resultado.length,
      totalAssuntos: totalAssuntosGeral,
      assuntosEstudados: assuntosEstudadosGeral
    }
  });
});

app.put("/api/editais/:id", (req, res) => {
  const { nome, instituicao, data_prova, descricao, disciplinas } = req.body;
  const id = req.params.id;

  // Atualizar edital
  db.prepare(`
    UPDATE editais SET nome = ?, instituicao = ?, data_prova = ?, descricao = ?
    WHERE id = ?
  `).run(nome || "", instituicao || "", data_prova || "", descricao || "", id);

  // Se disciplinas foram passadas, atualizar
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

// Deletar edital global
app.delete("/api/editais/:id", (req, res) => {
  db.prepare("DELETE FROM editais WHERE id = ?").run(req.params.id);
  ok(res, null);
});

// Adicionar assuntos a uma disciplina de edital
app.post("/api/edital-disciplinas/:did/assuntos", (req, res) => {
  const { assuntos } = req.body;
  if (!Array.isArray(assuntos)) return err(res, "assuntos deve ser um array");

  const stmt = db.prepare("INSERT INTO edital_assuntos (edital_disciplina_id, nome) VALUES (?, ?)");
  const resultado = [];

  try {
    for (const assunto of assuntos.filter(a => a?.trim())) {
      const r = stmt.run(req.params.did, assunto.trim());
      resultado.push({ id: r.lastInsertRowid, nome: assunto.trim() });
    }
    ok(res, resultado);
  } catch (e) {
    err(res, e.message);
  }
});

// ── Sessões ───────────────────────────────────────────────────────────────────
app.get("/api/usuarios/:uid/sessoes", (req, res) => {
  ok(res, db.prepare(`
    SELECT s.*, a.nome AS assunto_nome, d.nome AS disciplina_nome, d.cor AS disciplina_cor
    FROM sessoes s
    JOIN assuntos a ON a.id = s.assunto_id
    JOIN disciplinas d ON d.id = s.disciplina_id
    WHERE s.usuario_id = ?
    ORDER BY s.data DESC
    LIMIT 50
  `).all(req.params.uid));
});

app.post("/api/usuarios/:uid/sessoes", (req, res) => {
  const { assunto_id, disciplina_id, duracao_min, progresso_antes, progresso_depois, anotacao } = req.body;
  const r = db.prepare(`
    INSERT INTO sessoes (usuario_id, assunto_id, disciplina_id, duracao_min, progresso_antes, progresso_depois, anotacao)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.uid, assunto_id, disciplina_id, duracao_min, progresso_antes, progresso_depois, anotacao || "");

  // Atualiza progresso do assunto
  const p = Math.max(0, Math.min(100, Number(progresso_depois)));
  const status = p === 0 ? "nao_iniciado" : p === 100 ? "concluido" : "em_andamento";
  db.prepare("UPDATE assuntos SET progresso = ?, status = ? WHERE id = ?").run(p, status, assunto_id);

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
  const resultado = usuarios.map(u => {
    const assuntos = db.prepare(`
      SELECT a.* FROM assuntos a
      JOIN disciplinas d ON d.id = a.disciplina_id
      WHERE d.usuario_id = ?
    `).all(u.id);
    const total = assuntos.length;
    const concluidos = assuntos.filter(a => a.status === "concluido").length;
    const progresso = total ? Math.round((concluidos / total) * 100) : 0;

    const hojeStr = new Date().toISOString().slice(0, 10);
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
