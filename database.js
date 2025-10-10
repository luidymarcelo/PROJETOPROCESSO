const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'DBprojeto.db'); // cria na pasta data/
const db = new sqlite3.Database('./data/DBprojeto.db', (err) => {
  if (err) console.error('Erro ao conectar ao banco:', err);
  else console.log('Banco de dados conectado com sucesso!');
});


db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS processos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descricao TEXT,
        data_criacao TEXT DEFAULT (datetime('now'))
    )`);
});

module.exports = db;
