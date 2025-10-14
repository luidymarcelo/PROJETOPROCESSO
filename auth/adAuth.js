const ldap = require('ldapjs');
const { executeSQL } = require('../database');

async function authenticate(username, password) {
  try {
    const result = await executeSQL(`
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
          AND B.USR_SO_USERLOGIN = '${username}'
    `);

    if (!result || result.length === 0) {
      console.log('Usuário não encontrado no banco.');
      return false;
    }

    const dominio = result.rows[0].dominio.trim();
    const userPrincipal = `${dominio}\\${username}`;
    const AD_URL = `ldap://192.168.1.253`;
    const BASE_DN = `dc=${dominio},dc=local`;

    console.log(`Autenticando usuário ${userPrincipal} em ${AD_URL}`);

    // 🔹 2. Conecta no LDAP com o domínio correto
    const client = ldap.createClient({
      url: AD_URL,
      reconnect: true
    });

    return await new Promise((resolve) => {
      client.bind(userPrincipal, password, (err) => {
        if (err) {
          console.error('Erro de autenticação LDAP:', err.message);
          client.unbind();
          return resolve(false);
        }

        const opts = {
          filter: `(sAMAccountName=${username})`,
          scope: 'sub',
          attributes: ['cn', 'mail']
        };

        client.search(BASE_DN, opts, (searchErr, res) => {
          if (searchErr) {
            console.error('Erro na busca LDAP:', searchErr.message);
            client.unbind();
            return resolve(false);
          }

          res.on('searchEntry', (entry) => {
            console.log('Usuário encontrado:', entry.object);
          });

          res.on('end', () => {
            client.unbind();
            resolve(true);
          });
        });
      });
    });
  } catch (err) {
    console.error('Erro geral na autenticação:', err);
    return false;
  }
}

module.exports = { authenticate };
