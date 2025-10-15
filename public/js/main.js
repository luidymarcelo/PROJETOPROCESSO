document.addEventListener('DOMContentLoaded', () => {
  const btnNovo = document.getElementById('btn-novo-processo');
  const btnMeus = document.getElementById('btn-meus-processos');
  const novoProcesso = document.getElementById('novo-processo');
  const meusProcessos = document.getElementById('meus-processos');
  const tabelaMeus = document.getElementById('tabela-meus-processos');
  const tabelaRecentes = document.getElementById('tabela-processos-recentes');
  const btnSalvar = document.getElementById('salvar-processo');
  const inputWord = document.getElementById('word-file');
  const buscaInput = document.getElementById('pesquisa');
  const buscaBtn = document.getElementById('btn-pesquisar');
  const resultadosSec = document.getElementById('resultados-busca');
  const resultadosUL = document.getElementById('resultados-ul');
  const btnClear = document.getElementById('btn-clear');
  const inputProxRev = document.getElementById('data_proxima_revisao');
  const btnTreinee = document.getElementById('btn-treinamentos');

  if (inputProxRev) {
    const hoje = new Date();
    hoje.setMonth(hoje.getMonth() + 6);
    inputProxRev.value = hoje.toISOString().split('T')[0];
  }

  btnNovo.addEventListener('click', () => {
    novoProcesso.style.display = novoProcesso.style.display === 'none' ? 'block' : 'none';
    meusProcessos.style.display = 'none';
  });

  btnMeus.addEventListener('click', async () => {
    meusProcessos.style.display = meusProcessos.style.display === 'none' ? 'block' : 'none';
    novoProcesso.style.display = 'none';
    await listarProcessos();
  });

  buscaBtn.addEventListener('click', async () => {
    const query = buscaInput.value.trim();
    if (!query) return alert('Digite uma palavra para buscar.');

    try {
      const res = await fetch(`/buscar-processos?q=${encodeURIComponent(query)}`);
      if (!res.ok) return alert('Erro ao buscar processos.');
      const resultados = await res.json();

      resultadosUL.innerHTML = '';
      if (resultados.length === 0) {
        resultadosUL.innerHTML = '<li>Nenhum processo encontrado.</li>';
      } else {
        resultados.forEach(p => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${p.titulo}</strong><br>Revisão: ${p.revisao || '-'} | Próxima: ${p.data_proxima_revisao || '-'}`;
          li.onclick = () => abrirword(p);
          resultadosUL.appendChild(li);
        });
      }

      resultadosSec.style.display = 'block';
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar processos.');
    }
  });

  btnClear.addEventListener('click', () => {
    buscaInput.value = '';
    resultadosSec.style.display = 'none';
    resultadosUL.innerHTML = '';
  });

  btnSalvar.addEventListener('click', async () => {
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').innerHTML.trim();
    const revisao = document.getElementById('revisao').value.trim();

    if (!titulo) return alert('Digite o título do processo.');

    try {
      const userRes = await fetch('/api/usuario');
      if (!userRes.ok) return console.warn('Não foi possível carregar usuário.');
      const usuario = await userRes.json();
      var userid = usuario.id
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar processo.');
    }

    try {
      const res = await fetch('/processos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid, titulo, descricao, revisao })
      });

      if (!res.ok) {
        const erro = await res.text();
        alert('Erro: ' + erro);
        return;
      }
      
      document.getElementById('titulo').value = '';
      document.getElementById('descricao').innerHTML = '';
      document.getElementById('revisao').value = '';
      document.getElementById('data_proxima_revisao').value = '';
      novoProcesso.style.display = 'none';

      await listarProcessos();
      carregarRecentes();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar processo.');
    }
  });

  inputWord?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = result.value;
      const firstParagraph = tempDiv.querySelector("p");
      const titulo = firstParagraph ? firstParagraph.textContent.trim() : "Sem título";

      if (firstParagraph) firstParagraph.remove();
      const descricao = tempDiv.innerHTML.trim();

      document.getElementById("titulo").value = titulo;
      document.getElementById("descricao").innerHTML = descricao;

    } catch (err) {
      console.error("Erro ao ler Word:", err);
      alert("Erro ao importar o Word.");
    }
  });

  function abrirword(p) {
    const wordContent = document.getElementById('word-content');
    wordContent.innerHTML = p.descricao || '<p>Sem descrição</p>';

    document.getElementById('display-word').style.display = 'block';
  }

  function fecharWord() {
    document.getElementById('display-word').style.display = 'none';
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
      fecharWord();
    }
  });

  (async () => {
    try {
      const res = await fetch('/api/usuario');
      if (!res.ok) return console.warn('Não foi possível carregar usuário.');
      const usuario = await res.json();
      const userInfoDiv = document.getElementById('user-info');
      if (userInfoDiv && usuario) {
        userInfoDiv.innerHTML = `<strong>${usuario.usr}</strong> - ${usuario.nome}<br><small>${usuario.departamento} • ${usuario.cargo}</small>`;
      }
    } catch (err) { console.error('Erro ao carregar dados do usuário:', err); }
  })();

  function criarLinhaTabela(p) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.titulo}</td>
      <td>${p.data_inclusao ? new Date(p.data_inclusao).toLocaleDateString() : '-'}</td>
      <td>${p.revisao || '-'}</td>
      <td>${p.proxima_revisao || '-'}</td>
    `;
    tr.onclick = () => abrirword(p);
    return tr;
  }

  async function listarProcessos() {
    try {
      const res = await fetch('/meus-processos');
      if (!res.ok) return alert('Erro ao carregar processos.');
      const processos = await res.json();
      tabelaMeus.innerHTML = '';
      processos.forEach(p => tabelaMeus.appendChild(criarLinhaTabela(p)));
    } catch (e) { console.error(e); }
  }

  async function carregarRecentes() {
    try {
      const res = await fetch('/meus-processos');
      if (!res.ok) return;
      const processos = await res.json();
      tabelaRecentes.innerHTML = '';
      processos.slice(-5).reverse().forEach(p => tabelaRecentes.appendChild(criarLinhaTabela(p)));
    } catch (e) { console.error(e); }
  }

  listarProcessos();
  carregarRecentes();
});
