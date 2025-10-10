const ldap = require('ldapjs');

const AD_URL = 'ldap://192.168.1.253';
const BASE_DN = 'dc=itacorda,dc=local';

function authenticate(username, password) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: AD_URL,
      reconnect: true
    });

    const userPrincipal = `itacorda\\${username}`;

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
}
module.exports = { authenticate };