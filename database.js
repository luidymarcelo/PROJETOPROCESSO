// database.js
const oracledb = require('oracledb');
console.log('Modo atual:', oracledb.thin ? 'Thin' : 'Thick');

try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_28' }); // caminho da pasta que você extraiu
  console.log('Cliente Oracle inicializado (modo Thick).');
} catch (err) {
  console.error('Erro ao inicializar Oracle Client:', err);
}

// Configurações de conexão com o banco Protheus (Oracle)
const dbConfig = {
  user: 'Protheus',
  password: '2023prodpr0theusita',
  connectString: '192.168.1.244:1521/prod'
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
      const rowsSimples = [];
      for (let row of result.rows) {
        const obj = {};
        for (const key in row) {
          const value = row[key];

          if (value instanceof Date) {
            obj[key.toLowerCase()] = value.toISOString().split('T')[0]; // datas
          } else if (value && typeof value === 'object' && typeof value.getData === 'function') {
            obj[key.toLowerCase()] = await value.getData();
          } else {
            obj[key.toLowerCase()] = value;
          }
        }
        rowsSimples.push(obj);
      }
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
