const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "data/estudai.db");
const BACKUP_PATH = path.join(__dirname, "data/estudai.db.backup");

if (!fs.existsSync(DB_PATH)) {
  console.error(`Banco não encontrado: ${DB_PATH}`);
  process.exit(1);
}

fs.copyFileSync(DB_PATH, BACKUP_PATH);
console.log(`Backup criado em ${BACKUP_PATH}`);

const db = new Database(DB_PATH);
db.pragma("journal_mode=WAL");
db.pragma("foreign_keys=OFF");

const migrate = db.transaction(() => {
  // ── 1. Criar assuntos_catalogo ────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS assuntos_catalogo (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nome      TEXT NOT NULL UNIQUE,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // ── 2. Criar usuario_progresso ────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuario_progresso (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      assunto_id INTEGER NOT NULL REFERENCES assuntos_catalogo(id) ON DELETE CASCADE,
      progresso  INTEGER NOT NULL DEFAULT 0,
      status     TEXT NOT NULL DEFAULT 'nao_iniciado',
      atualizado_em TEXT DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (usuario_id, assunto_id)
    );
  `);

  // ── 3. Popular catálogo com nomes únicos de edital_assuntos ───────────────
  db.exec(`
    INSERT OR IGNORE INTO assuntos_catalogo (nome)
    SELECT DISTINCT TRIM(nome) FROM edital_assuntos ORDER BY TRIM(nome);
  `);

  // ── 4. Adicionar assuntos pessoais exclusivos ao catálogo ─────────────────
  db.exec(`
    INSERT OR IGNORE INTO assuntos_catalogo (nome)
    SELECT DISTINCT TRIM(a.nome) FROM assuntos a
    WHERE NOT EXISTS (
      SELECT 1 FROM assuntos_catalogo ac WHERE TRIM(ac.nome) = TRIM(a.nome)
    );
  `);

  // ── 5. Adicionar colunas a edital_assuntos ────────────────────────────────
  const eaCols = db.prepare("PRAGMA table_info(edital_assuntos)").all().map(c => c.name);
  if (!eaCols.includes("assunto_id")) {
    db.exec("ALTER TABLE edital_assuntos ADD COLUMN assunto_id INTEGER REFERENCES assuntos_catalogo(id);");
  }
  if (!eaCols.includes("nome_no_edital")) {
    db.exec("ALTER TABLE edital_assuntos ADD COLUMN nome_no_edital TEXT;");
  }

  // ── 6. Linkar edital_assuntos ao catálogo ─────────────────────────────────
  db.exec(`
    UPDATE edital_assuntos SET
      assunto_id     = (SELECT ac.id FROM assuntos_catalogo ac WHERE TRIM(ac.nome) = TRIM(edital_assuntos.nome)),
      nome_no_edital = TRIM(nome)
    WHERE assunto_id IS NULL;
  `);

  const unlinked = db.prepare("SELECT COUNT(*) AS c FROM edital_assuntos WHERE assunto_id IS NULL").get();
  if (unlinked.c > 0) {
    throw new Error(`${unlinked.c} edital_assuntos sem link no catálogo — abortando`);
  }
  console.log(`  edital_assuntos linkados ao catálogo`);

  // ── 7. Migrar progresso pessoal para usuario_progresso ───────────────────
  const progressoMigrado = db.prepare(`
    INSERT OR IGNORE INTO usuario_progresso (usuario_id, assunto_id, progresso, status)
    SELECT d.usuario_id, ac.id, a.progresso, a.status
    FROM assuntos a
    JOIN disciplinas d ON d.id = a.disciplina_id
    JOIN assuntos_catalogo ac ON TRIM(ac.nome) = TRIM(a.nome)
    WHERE a.progresso > 0;
  `).run();
  console.log(`  ${progressoMigrado.changes} registros de progresso migrados`);

  // ── 8. Adicionar colunas temporárias a sessoes ────────────────────────────
  const sessCols = db.prepare("PRAGMA table_info(sessoes)").all().map(c => c.name);
  if (!sessCols.includes("catalogo_assunto_id")) {
    db.exec("ALTER TABLE sessoes ADD COLUMN catalogo_assunto_id INTEGER;");
  }
  if (!sessCols.includes("edital_disciplina_id_new")) {
    db.exec("ALTER TABLE sessoes ADD COLUMN edital_disciplina_id_new INTEGER;");
  }

  // Mapear sessoes para IDs do catálogo
  db.exec(`
    UPDATE sessoes SET
      catalogo_assunto_id = (
        SELECT ac.id FROM assuntos_catalogo ac
        JOIN assuntos a ON TRIM(a.nome) = TRIM(ac.nome)
        WHERE a.id = sessoes.assunto_id
      ),
      edital_disciplina_id_new = (
        SELECT ed.id FROM edital_disciplinas ed
        JOIN disciplinas d ON TRIM(d.nome) = TRIM(ed.nome)
        WHERE d.id = sessoes.disciplina_id
        LIMIT 1
      );
  `);

  const sessoesNaoMapeadas = db.prepare("SELECT COUNT(*) AS c FROM sessoes WHERE catalogo_assunto_id IS NULL").get();
  if (sessoesNaoMapeadas.c > 0) {
    console.warn(`  Aviso: ${sessoesNaoMapeadas.c} sessão(ões) sem assunto no catálogo — serão descartadas`);
  }

  // ── 9. Recriar sessoes com novo schema ────────────────────────────────────
  db.exec(`
    CREATE TABLE sessoes_new (
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

    INSERT INTO sessoes_new (id, usuario_id, assunto_id, edital_disciplina_id, duracao_min, progresso_antes, progresso_depois, anotacao, data)
    SELECT id, usuario_id, catalogo_assunto_id, edital_disciplina_id_new, duracao_min, progresso_antes, progresso_depois, anotacao, data
    FROM sessoes
    WHERE catalogo_assunto_id IS NOT NULL;

    DROP TABLE sessoes;
    ALTER TABLE sessoes_new RENAME TO sessoes;
  `);
  console.log(`  sessoes recriadas com novo schema`);

  // ── 10. Recriar edital_assuntos com assunto_id NOT NULL ───────────────────
  db.exec(`
    CREATE TABLE edital_assuntos_new (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      edital_disciplina_id INTEGER NOT NULL REFERENCES edital_disciplinas(id) ON DELETE CASCADE,
      assunto_id           INTEGER NOT NULL REFERENCES assuntos_catalogo(id) ON DELETE CASCADE,
      nome_no_edital       TEXT NOT NULL,
      criado_em            TEXT DEFAULT (datetime('now','localtime'))
    );

    INSERT INTO edital_assuntos_new (id, edital_disciplina_id, assunto_id, nome_no_edital, criado_em)
    SELECT id, edital_disciplina_id, assunto_id, COALESCE(nome_no_edital, TRIM(nome)), criado_em
    FROM edital_assuntos;

    DROP TABLE edital_assuntos;
    ALTER TABLE edital_assuntos_new RENAME TO edital_assuntos;
  `);
  console.log(`  edital_assuntos recriada com assunto_id NOT NULL`);

  // ── 11. Remover tabelas pessoais ──────────────────────────────────────────
  db.exec(`
    DROP TABLE IF EXISTS assuntos;
    DROP TABLE IF EXISTS disciplinas;
  `);
  console.log(`  tabelas disciplinas e assuntos removidas`);
});

try {
  migrate();
  db.pragma("foreign_keys=ON");
  console.log("\nMigração concluída com sucesso!");
} catch (e) {
  console.error("\nErro na migração:", e.message);
  console.error("O banco NÃO foi alterado (transação revertida).");
  console.error(`Backup disponível em: ${BACKUP_PATH}`);
  process.exit(1);
}
