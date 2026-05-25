const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "estudai.db");
const db = new Database(dbPath);

// Criar schema se não existir (mesmo do server/index.js)
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

/**
 * Exporta os dados atuais do banco para seed-data.json
 */
function exportSeed() {
  console.log("📦 Exportando dados do banco de dados...");

  const seed = {
    usuarios: db.prepare("SELECT * FROM usuarios").all(),
    disciplinas: db.prepare("SELECT * FROM disciplinas").all(),
    assuntos: db.prepare("SELECT * FROM assuntos").all(),
    sessoes: db.prepare("SELECT * FROM sessoes").all(),
    config: db.prepare("SELECT * FROM config").all(),
    editais: db.prepare("SELECT * FROM editais").all(),
    edital_disciplinas: db.prepare("SELECT * FROM edital_disciplinas").all(),
    edital_assuntos: db.prepare("SELECT * FROM edital_assuntos").all(),
    usuario_editais: db.prepare("SELECT * FROM usuario_editais").all(),
  };

  const seedPath = path.join(__dirname, "seed-data.json");
  fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));

  console.log("✅ Seed exportado com sucesso!");
  console.log(`   📁 Arquivo: seed-data.json`);
  console.log(`   📊 Usuários: ${seed.usuarios.length}`);
  console.log(`   📚 Disciplinas: ${seed.disciplinas.length}`);
  console.log(`   📄 Assuntos: ${seed.assuntos.length}`);
  console.log(`   📋 Editais: ${seed.editais.length}`);
  console.log(`   📍 Edital Disciplinas: ${seed.edital_disciplinas.length}`);
  console.log(`   📍 Edital Assuntos: ${seed.edital_assuntos.length}`);
  console.log(`   💾 Sessões: ${seed.sessoes.length}`);
}

/**
 * Carrega os dados do seed-data.json no banco
 */
function loadSeed() {
  const seedPath = path.join(__dirname, "seed-data.json");

  if (!fs.existsSync(seedPath)) {
    console.log("⚠️  Arquivo seed-data.json não encontrado");
    return;
  }

  console.log("🔄 Carregando dados do seed...");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  try {
    // Limpar dados existentes (manter ordem de FK)
    db.prepare("DELETE FROM usuario_editais").run();
    db.prepare("DELETE FROM edital_assuntos").run();
    db.prepare("DELETE FROM edital_disciplinas").run();
    db.prepare("DELETE FROM editais").run();
    db.prepare("DELETE FROM sessoes").run();
    db.prepare("DELETE FROM assuntos").run();
    db.prepare("DELETE FROM disciplinas").run();
    db.prepare("DELETE FROM config").run();
    db.prepare("DELETE FROM usuarios").run();

    // Inserir dados
    const stmtUsuarios = db.prepare(
      "INSERT INTO usuarios (id, nome, cor, criado_em) VALUES (?, ?, ?, ?)"
    );
    for (const u of seed.usuarios) {
      stmtUsuarios.run(u.id, u.nome, u.cor, u.criado_em);
    }

    const stmtDisciplinas = db.prepare(
      "INSERT INTO disciplinas (id, usuario_id, nome, cor, criado_em) VALUES (?, ?, ?, ?, ?)"
    );
    for (const d of seed.disciplinas) {
      stmtDisciplinas.run(d.id, d.usuario_id, d.nome, d.cor, d.criado_em);
    }

    const stmtAssuntos = db.prepare(
      "INSERT INTO assuntos (id, disciplina_id, nome, progresso, status, criado_em) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const a of seed.assuntos) {
      stmtAssuntos.run(
        a.id,
        a.disciplina_id,
        a.nome,
        a.progresso,
        a.status,
        a.criado_em
      );
    }

    const stmtSessoes = db.prepare(
      "INSERT INTO sessoes (id, usuario_id, assunto_id, disciplina_id, duracao_min, progresso_antes, progresso_depois, anotacao, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const s of seed.sessoes) {
      stmtSessoes.run(
        s.id,
        s.usuario_id,
        s.assunto_id,
        s.disciplina_id,
        s.duracao_min,
        s.progresso_antes,
        s.progresso_depois,
        s.anotacao,
        s.data
      );
    }

    const stmtConfig = db.prepare(
      "INSERT INTO config (usuario_id, nome_prova, data_prova, meta_min_dia, edital_selecionado) VALUES (?, ?, ?, ?, ?)"
    );
    for (const c of seed.config) {
      stmtConfig.run(
        c.usuario_id,
        c.nome_prova,
        c.data_prova,
        c.meta_min_dia,
        c.edital_selecionado
      );
    }

    const stmtEditais = db.prepare(
      "INSERT INTO editais (id, usuario_id, nome, instituicao, data_prova, descricao, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const e of seed.editais) {
      stmtEditais.run(
        e.id,
        e.usuario_id,
        e.nome,
        e.instituicao,
        e.data_prova,
        e.descricao,
        e.criado_em
      );
    }

    const stmtEditalDisciplinas = db.prepare(
      "INSERT INTO edital_disciplinas (id, edital_id, nome, criado_em) VALUES (?, ?, ?, ?)"
    );
    for (const ed of seed.edital_disciplinas) {
      stmtEditalDisciplinas.run(
        ed.id,
        ed.edital_id,
        ed.nome,
        ed.criado_em
      );
    }

    const stmtEditalAssuntos = db.prepare(
      "INSERT INTO edital_assuntos (id, edital_disciplina_id, nome, criado_em) VALUES (?, ?, ?, ?)"
    );
    for (const ea of seed.edital_assuntos) {
      stmtEditalAssuntos.run(
        ea.id,
        ea.edital_disciplina_id,
        ea.nome,
        ea.criado_em
      );
    }

    const stmtUsuarioEditais = db.prepare(
      "INSERT INTO usuario_editais (usuario_id, edital_id) VALUES (?, ?)"
    );
    for (const ue of seed.usuario_editais) {
      stmtUsuarioEditais.run(ue.usuario_id, ue.edital_id);
    }

    console.log("✅ Seed carregado com sucesso!");
    console.log(`   📊 Usuários: ${seed.usuarios.length}`);
    console.log(`   📚 Disciplinas: ${seed.disciplinas.length}`);
    console.log(`   📄 Assuntos: ${seed.assuntos.length}`);
    console.log(`   📋 Editais: ${seed.editais.length}`);
  } catch (e) {
    console.error("❌ Erro ao carregar seed:", e.message);
  }
}

// Executar baseado no argumento
const command = process.argv[2];

if (command === "export") {
  exportSeed();
} else if (command === "load") {
  loadSeed();
} else {
  console.log("Uso:");
  console.log("  npm run seed:export  - Exportar dados atuais para seed-data.json");
  console.log("  npm run seed:load    - Carregar dados do seed-data.json no banco");
}

db.close();
