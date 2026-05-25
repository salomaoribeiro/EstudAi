const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "estudai.db");
console.log("Banco em:", dbPath);
console.log("Existe:", fs.existsSync(dbPath));
console.log("Tamanho:", fs.statSync(dbPath).size);

const db = new Database(dbPath, { timeout: 10000 });

try {
  console.log("\nTabelasSQL_MASTER:");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log("Total:", tables.length);
  tables.forEach(t => console.log("  -", t.name));

  console.log("\nDados:");
  console.log("Usuários:", db.prepare("SELECT COUNT(*) as c FROM usuarios").get().c);
  console.log("Editais:", db.prepare("SELECT COUNT(*) as c FROM editais").get().c);
  console.log("Edital Disciplinas:", db.prepare("SELECT COUNT(*) as c FROM edital_disciplinas").get().c);
  console.log("Edital Assuntos:", db.prepare("SELECT COUNT(*) as c FROM edital_assuntos").get().c);
  
  // Se tem editais, mostrar nomes
  if (db.prepare("SELECT COUNT(*) as c FROM editais").get().c > 0) {
    console.log("\nEditais no banco:");
    db.prepare("SELECT id, nome FROM editais").all().forEach(e => {
      console.log(`  ${e.id}. ${e.nome}`);
    });
  }
} catch (e) {
  console.error("Erro:", e.message);
}

db.close();
