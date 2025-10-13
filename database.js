// database.js
const oracledb = require('oracledb');

// Configurações de conexão com o banco Protheus (Oracle)
const dbConfig = {
  user: 'protheus',
  password: '2023prodpr0theusita',
  connectString: '192.168.1.237:1521/Homo'
};

// Configura o formato de fetch globalmente (boa prática)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Função para abrir conexão
async function openConnection() {
  console.log('[DB] Tentando abrir conexão...');
  try {
    const connection = await oracledb.getConnection(dbConfig);
    console.log('[DB] Conectado ao banco Protheus com sucesso!');
    return connection;
  } catch (err) {
    console.error('[DB] Erro ao conectar ao banco Protheus:', err);
    throw err;
  }
}

// Função para remover referências circulares
function removeCircularReferences(obj, seen = new WeakSet()) {
  if (obj !== Object(obj)) return obj; // Valor primitivo ou null

  if (seen.has(obj)) return '[Circular]'; // Detecta referência circular

  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => removeCircularReferences(item, seen));
  }

  const plainObj = {};
  for (const [key, value] of Object.entries(obj)) {
    plainObj[key.toLowerCase()] = removeCircularReferences(value, seen);
  }

  return plainObj;
}

// Função genérica para executar comandos SQL
async function executeSQL(query, binds = {}, options = {}) {
  let connection;
  console.log('[DB] Iniciando execução da query...');
  try {
    connection = await openConnection();

    const execOptions = { autoCommit: true, ...options };

    const result = await connection.execute(query, binds, execOptions);

    if (result.rows) {
      // Remove referências circulares e normaliza datas
      const rowsSimples = removeCircularReferences(result.rows).map(row => {
        const obj = {};
        for (const key in row) {
          const value = row[key];
          obj[key] = value instanceof Date
            ? value.toISOString().split('T')[0] // Formato YYYY-MM-DD
            : value;
        }
        return obj;
      });

      return { rows: rowsSimples };
    }

    return result;
  } catch (err) {
    console.error('[DB] Erro ao executar SQL:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('[DB] Conexão fechada.');
      } catch (closeErr) {
        console.error('[DB] Erro ao fechar a conexão:', closeErr);
      }
    }
  }
}

// Exporta a função executeSQL
module.exports = { executeSQL };
