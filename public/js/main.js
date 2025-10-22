document.addEventListener('DOMContentLoaded', () => {
  const btnNovo = document.getElementById('btn-novo-processo');
  const btnMeus = document.getElementById('btn-meus-processos');
  const btnUsoComum = document.getElementById('btn-uso-comum');
  const novoProcesso = document.getElementById('novo-processo');
  const meusProcessos = document.getElementById('meus-processos');
  const tabelaMeus = document.getElementById('tabela-meus-processos');
  const tabelaUsoComum = document.getElementById('tabela-uso-comum-body');
  const tabelaRecentes = document.getElementById('tabela-processos-recentes');
  const btnSalvar = document.getElementById('salvar-processo');
  const inputWord = document.getElementById('word-file');
  const buscaInput = document.getElementById('pesquisa');
  const buscaBtn = document.getElementById('btn-pesquisar');
  const resultadosSec = document.getElementById('resultados-busca');
  const resultadosUL = document.getElementById('resultados-ul');
  const btnClear = document.getElementById('btn-clear');
  const inputProxRev = document.getElementById('data_proxima_revisao');
  const inputrevisao = document.getElementById('revisao');
  const salvardoc = document.getElementById('btn-salvar-edicao');

  btnNovo.addEventListener('click', async () => { // ← async adicionado
    const hoje = new Date();
    novoProcesso.style.display = 'block';
    meusProcessos.style.display = 'none';
    document.getElementById('tabela-uso-comum').style.display = 'none';

    hoje.setMonth(hoje.getMonth() + 6);
    inputProxRev.value = hoje.toISOString().split('T')[0];
    inputrevisao.value = 1;

    const selectUsoComum = document.getElementById('uso-comum');

    try {
      const response = await fetch('/api/usuario');
      if (!response.ok) throw new Error('Erro ao buscar usuário');

      const usuario = await response.json();
      const departamento = usuario.departamento?.trim?.() || '';

      console.log('Cargo do usuário:', departamento);

      if (departamento !== 'TI') {
        selectUsoComum.value = '2'; // '2' = Não
        selectUsoComum.disabled = true;
      } else {
        selectUsoComum.disabled = false;
      }
    } catch (error) {
      console.error('Erro ao obter o usuário:', error);
    }
  });

  btnUsoComum.addEventListener('click', async () => {
    document.getElementById('tabela-uso-comum').style.display =
      document.getElementById('tabela-uso-comum').style.display === 'none' ? 'block' : 'none';
    novoProcesso.style.display = 'none';
    meusProcessos.style.display = 'none';
    await carregarUsoComum();
  });

  btnMeus.addEventListener('click', async () => {
    meusProcessos.style.display = meusProcessos.style.display === 'none' ? 'block' : 'none';
    novoProcesso.style.display = 'none';
    document.getElementById('tabela-uso-comum').style.display = 'none';
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
          li.innerHTML = `<strong> ${p.id} - </strong><strong>${p.titulo}</strong><br>Revisão: ${p.revisao || '-'} | Próxima: ${p.proxima_revisao || '-'}`;
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
    const usucomum = document.getElementById('uso-comum').value.trim();

    if (!titulo) return alert('Digite o título do processo.');

    try {
      const userRes = await fetch('/api/usuario');
      if (!userRes.ok) return console.warn('Não foi possível carregar usuário.');
      const usuario = await userRes.json();
      var userid = usuario.id
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar processo.');
      return;
    }

    try {
      const method = 'POST';
      const url = '/documento/';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid, titulo, descricao, revisao, usucomum })
      });

      if (!res.ok) {
        const erro = await res.text();
        alert('Erro: ' + erro);
        return;
      }

      document.getElementById('titulo').value = '';
      document.getElementById('descricao').innerHTML = '';
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

  function editarProcesso(p) {
    const hoje = new Date();
    const dataProxima = new Date(hoje);
    dataProxima.setMonth(hoje.getMonth() + 6);

    document.getElementById('display-editar').style.display = 'block';

    document.getElementById('editar-id').value = p.id;
    document.getElementById('editar-titulo').value = p.titulo;
    document.getElementById('editar-descricao').innerHTML = p.descricao || '';
    document.getElementById('editar-revisao').value = p.revisao + 1 || '';
    document.getElementById('editar-data_proxima_revisao').value = dataProxima.toISOString().split('T')[0];
  }

  salvardoc.addEventListener('click', async () => {
    const id = document.getElementById('editar-id').value;
    const titulo = document.getElementById('editar-titulo').value.trim();
    const descricao = document.getElementById('editar-descricao').innerHTML.trim();
    const revisao = document.getElementById('editar-revisao').value.trim();
    const proxima = document.getElementById('editar-data_proxima_revisao').value.trim();

    if (!titulo) return alert('Digite o título do processo.');

    try {
      const res = await fetch(`/editar/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descricao, revisao, proxima_revisao: proxima })
      });

      if (!res.ok) {
        const erro = await res.text();
        return alert('Erro ao atualizar: ' + erro);
      }

      fecharedit();
      await listarProcessos();
      carregarRecentes();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar processo.');
    }
  });

  function fecharWord() {
    document.getElementById('display-word').style.display = 'none';
  }

  function fecharedit() {
    document.getElementById('display-editar').style.display = 'none';
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
      fecharWord();
      fecharedit();
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

  function criarLinhaTabela(p, departamento) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.titulo}</td>
      <td>${p.data_inclusao ? new Date(p.data_inclusao).toLocaleDateString() : '-'}</td>
      <td>${p.revisao || '-'}</td>
      <td>${p.proxima_revisao ? new Date(p.proxima_revisao).toLocaleDateString() : '-'}</td>
      <td>${p.uso_comum}</td>
      <td>
        <button class="btn-editar" data-id="${p.id}" 
          ${p.uso_comum === 'Sim' && departamento !== 'TI' ? 'disabled' : ''}>
          Editar
        </button>
      </td>
      <td>
        <button class="btn-excluir" data-id="${p.id}" 
          ${p.uso_comum === 'Sim' && departamento !== 'TI' ? 'disabled' : ''}>
          Excluir
        </button>
      </td>
    `;

    tr.onclick = () => abrirword(p);

    tr.querySelector('.btn-excluir').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Deseja realmente excluir o processo "${p.titulo}"?`)) return;

      try {
        const res = await fetch(`/delete/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ D_E_L_E_T_: '*' })
        });
        if (!res.ok) {
          const erro = await res.text();
          alert('Erro ao excluir: ' + erro);
          return;
        }
        await listarProcessos();
        carregarRecentes();
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir processo.');
      }
    };

    return tr;
  }

  async function listarProcessos() {
    try {
      const res = await fetch('/meus-processos');
      if (!res.ok) {
        alert('Erro ao carregar processos.');
        return;
      }
      const { processos, departamento } = await res.json(); // ← desestruturação
      console.log('Departamento do usuário:', departamento);
      tabelaMeus.innerHTML = '';
      processos.forEach(p => tabelaMeus.appendChild(criarLinhaTabela(p, departamento)));
    } catch (e) {
      console.error('Erro ao listar processos:', e);
    }
  }

  async function carregarRecentes() {
    try {
      const res = await fetch('/meus-processos');
      if (!res.ok) return;
      const { processos, departamento } = await res.json();
      tabelaRecentes.innerHTML = '';
      processos.slice(-5).reverse().forEach(p => tabelaRecentes.appendChild(criarLinhaTabela(p, departamento)));
    } catch (e) { console.error(e); }
  }

  async function carregarUsoComum() {
    try {
      const res = await fetch('/uso-comum');
      if (!res.ok) return alert('Erro ao carregar processos de uso comum.');
      const processos = await res.json();
      tabelaUsoComum.innerHTML = '';
      processos.forEach(p => tabelaUsoComum.appendChild(criarLinhaTabela(p)));
    } catch (e) { console.error(e); }
  }

  listarProcessos();
  carregarRecentes();
  carregarUsoComum();

});