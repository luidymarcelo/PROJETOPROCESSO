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

app.get('/api/usuario', async (req, res) => {
  try {
    const adUser = req.session.usuario;
    if (!adUser) return res.status(401).json({ message: 'Usuário não autenticado' });

    const query = `
      SELECT 
          A.USR_ID            AS ID,
          A.USR_MSBLQL        AS BLOQUEADO,
          A.USR_CODIGO        AS USR,
          A.USR_NOME          AS NOME,
          A.USR_EMAIL         AS EMAIL,
          A.USR_DEPTO         AS DEPARTAMENTO,
          A.USR_CARGO         AS CARGO,
          B.USR_SO_DOMINIO    AS DOMINIO,
          B.USR_SO_USERLOGIN  AS AD,
          A2.USR_CODIGO       AS SUPERIOR
      FROM SYS_USR A
      LEFT JOIN SYS_USR_SSIGNON B
          ON A.USR_ID = B.USR_ID
          AND B.D_E_L_E_T_ <> '*'
      LEFT JOIN SYS_USR_SUPER C
          ON A.USR_ID = C.USR_ID
          AND C.D_E_L_E_T_ <> '*'
      LEFT JOIN SYS_USR A2
          ON C.USR_SUPER = A2.USR_ID
          AND A2.D_E_L_E_T_ <> '*'
      WHERE 
          A.USR_MSBLQL = '2'
          AND A.D_E_L_E_T_ <> '*'
          AND B.USR_SO_USERLOGIN = '${adUser}'
    `;

    const result = await executeSQL(query);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Usuário não encontrado' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[API] Erro ao buscar usuário:', err);
    res.status(500).json({ message: 'Erro interno ao buscar usuário' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));

app.get('/dashboard', (req, res) => {
  if (!req.session.usuario) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.post('/processos', async (req, res) => {
  const { titulo, descricao, revisao, proxima_revisao } = req.body;
  try {
    await executeSQL(`
      INSERT INTO TSI_PROCESSOS (USUARIO, TITULO, DESCRICAO, DATA_INCLUSAO, REVISAO, PROXIMA_REVISAO)
      VALUES (:usuario, :titulo, :descricao, SYSDATE, :revisao, ADD_MONTHS(SYSDATE, 6))
    `, { usuario: req.session.usuario, titulo, descricao, revisao });

    res.json({ success: true });
  } catch (err) {
    console.error('[ERRO] ao salvar processo:', err);
    res.status(500).send('Erro ao salvar processo');
  }
});

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

    // Garantir que descricao seja string
    const processos = result.rows.map(p => ({
      ...p,
      descricao: p.descricao ? String(p.descricao) : ''
    }));

    res.json(processos);

  } catch (err) {
    console.error('[ERRO] ao buscar processos:', err);
    res.status(500).send('Erro ao buscar processos');
  }
});

app.post('/import-word', upload.single('word'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const result = await mammoth.convertToHtml({ path: filePath });
    const html = result.value;

    const tempDiv = document.createElement("div"); // Não funciona no Node.js
    const match = html.match(/<p>(.*?)<\/p>/i);
    const titulo = match ? match[1].trim() : "Sem título";

    // Remove o primeiro parágrafo do HTML
    const descricao = html.replace(match[0], '').trim();

    fs.unlinkSync(filePath);
    res.json({ titulo, descricao });

  } catch (error) {
    console.error('[ERRO] ao processar Word:', error);
    res.status(500).json({ error: 'Erro ao processar o arquivo Word.' });
  }
});

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

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));

if (process.env.NODE_ENV === 'debug') {
  console.log('Debug ativo: pressionar CTRL+C para sair...');
  process.stdin.resume(); // mantém Node vivo no debug
}
