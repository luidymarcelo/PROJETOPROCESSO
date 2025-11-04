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

app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ extended: true, limit: '1000mb' }));
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
      req.session.ad = username;
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
    const adUser = req.session.ad;
    if (!adUser) return res.status(401).json({ message: 'Usuário não autenticado' });

    const query = `
      SELECT 
        NVL(A.USR_ID, 'N/D')             AS ID,
        NVL(A.USR_MSBLQL, 'N/D')         AS BLOQUEADO,
        NVL(A.USR_CODIGO, 'N/D')         AS USR,
        NVL(A.USR_NOME, 'N/D')           AS NOME,
        NVL(A.USR_EMAIL, 'N/D')          AS EMAIL,
        NVL(A.USR_DEPTO, 'N/D')          AS DEPARTAMENTO,
        NVL(A.USR_CARGO, 'N/D')          AS CARGO,
        NVL(B.USR_SO_DOMINIO, 'N/D')     AS DOMINIO,
        NVL(B.USR_SO_USERLOGIN, 'N/D')   AS AD,
        NVL(A2.USR_CODIGO, 'N/D')        AS SUPERIOR
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

    req.session.ad = result.rows[0].ad.trim()
    req.session.protheuscargo = result.rows[0].cargo.trim()
    req.session.protheusdepartamento = result.rows[0].departamento.trim()
    req.session.protheusdominio = result.rows[0].dominio.trim()
    req.session.protheusemail = result.rows[0].email.trim()
    req.session.protheusid = result.rows[0].id.trim()
    req.session.protheusnome = result.rows[0].nome.trim()
    req.session.protheussuperior = result.rows[0].superior.trim()
    req.session.protheususer = result.rows[0].usr.trim()

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
  if (!req.session.ad) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.post('/documento', async (req, res) => {
  try {
    const sql = `
      INSERT INTO TSI_PROCESSOS (
        USUARIO,
        TITULO,
        DESCRICAO,
        DATA_INCLUSAO,
        REVISAO,
        PROXIMA_REVISAO,
        UC,
        ID_TIPODOC
      )
      VALUES (
        :usuario,
        :titulo,
        :descricao,
        SYSDATE,
        :revisao,
        ADD_MONTHS(SYSDATE, 6),
        :usucomum,
        :tipo_doc
      )
    `;

    await executeSQL(sql, {
      usuario: req.body.userid,
      titulo: req.body.titulo,
      descricao: req.body.descricao,
      revisao: req.body.revisao,
      usucomum: req.body.usucomum,
      tipo_doc: req.body.tipo_doc
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[ERRO] ao salvar processo:', err);
    res.status(500).send('Erro ao salvar processo');
  }
});

app.put('/delete/:id', async (req, res) => {
  const { id } = req.params;
  const { D_E_L_E_T_ } = req.body;

  try {
    const result = await executeSQL(`
      UPDATE TSI_PROCESSOS
      SET D_E_L_E_T_ = :D_E_L_E_T_
      WHERE ID = :ID
    `, { D_E_L_E_T_, ID: id });

    res.send('Processo marcado como excluído.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar processo.');
  }
});

app.put('/editar/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, descricao, revisao, proxima_revisao } = req.body;

  try {
    await executeSQL(`
      UPDATE TSI_PROCESSOS
      SET TITULO = :titulo,
          DESCRICAO = :descricao,
          REVISAO = :revisao,
          PROXIMA_REVISAO = TO_DATE(:proxima_revisao, 'YYYY-MM-DD')
      WHERE ID = :id
    `, { titulo, descricao, revisao, proxima_revisao, id });

    res.send('Processo atualizado com sucesso.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar processo.');
  }
});

app.get('/meus-processos', async (req, res) => {
  const usuario = req.session.protheusid;
  const departamento = req.session.protheusdepartamento;
  if (!usuario) return res.status(403).send('Usuário não autenticado.');

  try {
    const result = await executeSQL(`
        SELECT 
            P.ID,
            P.TITULO,
            T.NOME AS TIPO_DOCUMENTO,
            P.DATA_INCLUSAO AS DATA_INCLUSAO,
            P.REVISAO,
            P.PROXIMA_REVISAO AS PROXIMA_REVISAO,
            CASE
                WHEN P.UC = 1 THEN 'Sim'
                WHEN P.UC = 2 THEN 'Não'
                ELSE 'N/A'
            END AS USO_COMUM
        FROM 
            TSI_PROCESSOS P
            LEFT JOIN TSI_TIPODOC T ON T.ID = P.ID_TIPODOC
        WHERE 
            P.USUARIO = :usuario
            AND P.ID IS NOT NULL
            AND P.D_E_L_E_T_ <> '*'
        ORDER BY 
            P.DATA_INCLUSAO DESC
    `, { usuario });

    const processos = result.rows.map(p => ({
      ...p,
      descricao: p.descricao ? String(p.descricao) : ''
    }));

    res.json({ processos, departamento });

  } catch (err) {
    console.error('[ERRO] ao buscar processos:', err);
    res.status(500).send('Erro ao buscar processos');
  }
});

app.get('/uso-comum', async (req, res) => {
  const departamento = req.session.protheusdepartamento;
  try {
    const result = await executeSQL(`
      SELECT ID, TITULO, DESCRICAO,
            DATA_INCLUSAO AS DATA_INCLUSAO,
            REVISAO,
            PROXIMA_REVISAO AS PROXIMA_REVISAO,
            CASE
                WHEN UC = 1 THEN 'Sim'
                WHEN UC = 2 THEN 'Não'
                ELSE 'N/A'
            END AS USO_COMUM
      FROM TSI_PROCESSOS
      WHERE UC = '1'
        AND ID IS NOT NULL
        AND D_E_L_E_T_ <> '*'
      ORDER BY DATA_INCLUSAO DESC
    `);

    // Garantir que descricao seja string
    const processos = result.rows.map(p => ({
      ...p,
      descricao: p.descricao ? String(p.descricao) : ''
    }));

    res.json({ processos, departamento });

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
  const usuario = req.session.protheusid;
  const q = req.query.q;

  if (!usuario) return res.status(403).send('Usuário não autenticado.');
  if (!q) return res.json([]);

  try {
    const result = await executeSQL(`
      SELECT ID, TITULO, DESCRICAO,
             TO_CHAR(DATA_INCLUSAO, 'YYYY-MM-DD') AS DATA_INCLUSAO,
             REVISAO,
             TO_CHAR(PROXIMA_REVISAO, 'YYYY-MM-DD') AS PROXIMA_REVISAO,
             CASE
                WHEN UC = 1 THEN 'Sim'
                WHEN UC = 2 THEN 'Não'
                ELSE 'N/A'
             END AS USO_COMUM
      FROM TSI_PROCESSOS
      WHERE USUARIO = :usuario
        AND D_E_L_E_T_ <> '*'
        AND ID IS NOT NULL
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

app.get('/doctipos', async (req, res) => {
  try {
    const sql = `
      SELECT 
        ID,
        NOME,
        DESCRICAO
      FROM TSI_TIPODOC
      ORDER BY NOME
    `;

    const result = await executeSQL(sql);

    // Acessa por nomes de coluna, não índices
    const doctipos = result.rows.map(row => ({
      ID: row.ID || row.id,
      NOME: row.NOME || row.nome,
      DESCRICAO: row.DESCRICAO || row.descricao
    }));

    res.json(doctipos);

  } catch (err) {
    console.error('[ERRO] ao buscar tipos de documento:', err);
    res.status(500).send('Erro ao buscar tipos de documento');
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));

if (process.env.NODE_ENV === 'debug') {
  console.log('Debug ativo: pressionar CTRL+C para sair...');
  process.stdin.resume(); // mantém Node vivo no debug
}
