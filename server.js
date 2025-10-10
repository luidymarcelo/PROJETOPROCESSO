const express = require('express');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const mammoth = require('mammoth');

const bodyParser = require('body-parser');
const { authenticate } = require('./auth/adAuth');

const upload = multer({ dest: 'uploads/' });

const dbPath = path.join(__dirname, 'data', 'DBprojeto.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('Erro ao conectar ao banco:', err);
  console.log('Banco de dados conectado com sucesso!');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL
    )
  `);

  db.get("SELECT * FROM usuarios WHERE usuario = ?", ['admin'], (err, row) => {
    if (!row) {
      db.run("INSERT INTO usuarios (usuario, senha) VALUES (?, ?)", ['admin', '1234']);
      console.log('Usuário admin criado: admin / 1234');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS processos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT,
      data_criacao TEXT DEFAULT (datetime('now'))
    )
  `);
});

const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'segredo123',
  resave: false,
  saveUninitialized: false
}));

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ok = await authenticate(username, password);

  if (ok) {
    req.session.usuario = username;
    res.redirect('/dashboard');
  }
  else {
    res.status(401).send({ success: false, message: 'Usuário ou senha incorretos' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.usuario) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.post('/processos', (req, res) => {
  const usuario = req.session.usuario;
  const { titulo, descricao } = req.body;

  if (!usuario) return res.status(403).send('Usuário não autenticado.');
  if (!titulo) return res.status(400).send('Informe o título.');

  db.run(
    'INSERT INTO processos (usuario, titulo, descricao) VALUES (?, ?, ?)',
    [usuario, titulo, descricao],
    function (err) {
      if (err) return res.status(500).send('Erro ao salvar processo.');
      res.json({ id: this.lastID, usuario, titulo, descricao });
    }
  );
});

app.get('/meus-processos', (req, res) => {
  const usuario = req.session.usuario;
  if (!usuario) return res.status(403).send('Usuário não autenticado.');

  db.all('SELECT * FROM processos WHERE usuario = ?', [usuario], (err, rows) => {
    if (err) return res.status(500).send('Erro ao buscar processos.');
    res.json(rows);
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.post('/import-word', upload.single('word'), async (req, res) => {
  try {
    const filePath = req.file.path;

    // Extrai o texto do arquivo Word
    const result = await mammoth.extractRawText({ path: filePath });
    let text = result.value;

    // Mantém a identação e espaçamento entre parágrafos
    text = text.split('\n').map(l => l.trim()).filter(Boolean).join('\n\n');

    // Primeira linha = título, resto = descrição
    const linhas = text.split('\n\n');
    const titulo = linhas[0] || 'Sem título';
    const descricao = linhas.slice(1).join('\n\n') || '';

    // Remove o arquivo temporário
    fs.unlinkSync(filePath);

    // Retorna o texto extraído ao frontend
    res.json({ titulo, descricao });

  } catch (error) {
    console.error('Erro ao processar Word:', error);
    res.status(500).json({ error: 'Erro ao processar o arquivo Word.' });
  }
});

app.get('/buscar-processos', (req, res) => {
  const usuario = req.session.usuario;
  const q = req.query.q;

  if (!usuario) return res.status(403).send('Usuário não autenticado.');
  if (!q) return res.json([]);

  const sql = `
    SELECT * FROM processos 
    WHERE usuario = ? AND (titulo LIKE ? OR descricao LIKE ?)
    ORDER BY id DESC
  `;
  const likeQuery = `%${q}%`;

  db.all(sql, [usuario, likeQuery, likeQuery], (err, rows) => {
    if (err) return res.status(500).send('Erro ao buscar processos.');
    res.json(rows);
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));