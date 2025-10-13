// server.js
process.env.NODE_ENV = process.env.NODE_ENV || 'debug';

const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const mammoth = require('mammoth');
const fs = require('fs');
const bodyParser = require('body-parser');
const { authenticate } = require('./auth/adAuth');
const { executeSQL } = require('./database');

const upload = multer({ dest: 'uploads/' });
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

// --- LOGIN ---
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const ok = await authenticate(username, password);
    if (ok) {
      req.session.usuario = username;
      res.redirect('/dashboard');
    } else {
      res.status(401).send({ success: false, message: 'Usuário ou senha incorretos' });
    }
  } catch (err) {
    console.error('[ERRO] ao autenticar:', err);
    res.status(500).send('Erro no login');
  }
});

// --- PÁGINAS ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));

app.get('/dashboard', (req, res) => {
  if (!req.session.usuario) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// --- NOVO PROCESSO ---
app.post('/processos', async (req, res) => {
  const { titulo, descricao, revisao, proxima_revisao } = req.body;
  try {
    await executeSQL(`
      INSERT INTO TSI_PROCESSOS (USUARIO, TITULO, DESCRICAO, DATA_INCLUSAO, REVISAO, PROXIMA_REVISAO)
      VALUES (:usuario, :titulo, :descricao, SYSDATE, :revisao, TO_DATE(:proxima_revisao, 'YYYY-MM-DD'))
    `, { usuario: req.session.usuario, titulo, descricao, revisao, proxima_revisao });

    res.json({ success: true });
  } catch (err) {
    console.error('[ERRO] ao salvar processo:', err);
    res.status(500).send('Erro ao salvar processo');
  }
});

// --- LISTAR MEUS PROCESSOS ---
app.get('/meus-processos', async (req, res) => {
  const usuario = req.session.usuario;
  if (!usuario) return res.status(403).send('Usuário não autenticado.');

  try {
    const result = await executeSQL(`
      SELECT TITULO, DESCRICAO,
             TO_CHAR(DATA_INCLUSAO, 'YYYY-MM-DD') AS DATA_INCLUSAO,
             REVISAO,
             TO_CHAR(PROXIMA_REVISAO, 'YYYY-MM-DD') AS PROXIMA_REVISAO
      FROM TSI_PROCESSOS
      WHERE USUARIO = :usuario
      ORDER BY DATA_INCLUSAO DESC
    `, { usuario });

    res.json(result.rows); // já tratado para JSON seguro
  } catch (err) {
    console.error('[ERRO] ao buscar processos:', err);
    res.status(500).send('Erro ao buscar processos');
  }
});

// --- IMPORTAR WORD ---
app.post('/import-word', upload.single('word'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const result = await mammoth.extractRawText({ path: filePath });
    let text = result.value.split('\n').map(l => l.trim()).filter(Boolean).join('\n\n');

    const linhas = text.split('\n\n');
    const titulo = linhas[0] || 'Sem título';
    const descricao = linhas.slice(1).join('\n\n') || '';

    fs.unlinkSync(filePath);
    res.json({ titulo, descricao });
  } catch (error) {
    console.error('[ERRO] ao processar Word:', error);
    res.status(500).json({ error: 'Erro ao processar o arquivo Word.' });
  }
});

// --- BUSCA DE PROCESSOS ---
app.get('/buscar-processos', async (req, res) => {
  const usuario = req.session.usuario;
  const q = req.query.q;

  if (!usuario) return res.status(403).send('Usuário não autenticado.');
  if (!q) return res.json([]);

  try {
    const result = await executeSQL(`
      SELECT TITULO, DESCRICAO,
             TO_CHAR(DATA_INCLUSAO, 'YYYY-MM-DD') AS DATA_INCLUSAO,
             REVISAO,
             TO_CHAR(PROXIMA_REVISAO, 'YYYY-MM-DD') AS PROXIMA_REVISAO
      FROM TSI_PROCESSOS
      WHERE USUARIO = :usuario
        AND (TITULO LIKE :q OR DESCRICAO LIKE :q)
      ORDER BY DATA_INCLUSAO DESC
    `, { usuario, q: `%${q}%` });

    res.json(result.rows);
  } catch (err) {
    console.error('[ERRO] ao buscar processos:', err);
    res.status(500).send('Erro ao buscar processos');
  }
});

// --- LOGOUT ---
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// --- SERVIDOR ---
const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));

if (process.env.NODE_ENV === 'debug') {
  console.log('Debug ativo: pressionar CTRL+C para sair...');
  process.stdin.resume(); // mantém Node vivo no debug
}
