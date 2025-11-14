document.addEventListener('DOMContentLoaded', () => {
  const btnNovo = document.getElementById('btn-novo-processo');
  const btnMeus = document.getElementById('btn-meus-processos');
  const btnUsoComum = document.getElementById('btn-uso-comum');
  const novoProcesso = document.getElementById('novo-processo');
  const meusProcessos = document.getElementById('meus-processos');
  const tabelaMeus = document.getElementById('tabela-meus-processos');
  const tabelaUsoComum = document.getElementById('tabela-uso-comum-body');
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

  btnNovo.addEventListener('click', async () => {
  const hoje = new Date();
  const selectUsoComum = document.getElementById('uso-comum');
  const tabelaUsoComum = document.getElementById('tabela-uso-comum');
  const defineusuario = document.getElementById('usuario_doc');

  const isVisible = novoProcesso.style.display === 'block';

  if (isVisible) {
    novoProcesso.style.display = 'none';
    meusProcessos.style.display = 'block';
    tabelaUsoComum.style.display = 'none';
    return;
  }

  novoProcesso.style.display = 'block';
  meusProcessos.style.display = 'none';
  tabelaUsoComum.style.display = 'none';

  document.getElementById('label-tipo-doc').style.display = 'block';
  document.getElementById('tipo_doc').style.display = 'block';
  document.getElementById('label-usuario_doc').style.display = 'block';
  document.getElementById('usuario_doc').style.display = 'block';
  document.getElementById('label-departamento_doc').style.display = 'block';
  document.getElementById('departamento_doc').style.display = 'block';

  try {
    const res = await fetch('/doctipos');
    if (!res.ok) throw new Error('Erro ao buscar tipos de documento');
    const tipos = await res.json();

    const selectTipo = document.getElementById('tipo_doc');
    selectTipo.innerHTML = '';

    const optionDefault = document.createElement('option');
    optionDefault.value = '';
    optionDefault.textContent = 'Selecione o tipo de documento';
    selectTipo.appendChild(optionDefault);

    tipos.forEach(t => {
      const option = document.createElement('option');
      option.value = t.ID;
      option.textContent = `${t.NOME} - ${t.DESCRICAO}`;
      selectTipo.appendChild(option);
    });
  } catch (e) {
    console.error('Erro ao carregar tipos de documento:', e);
  }

  // Define datas e revisão
  hoje.setMonth(hoje.getMonth() + 6);
  inputProxRev.value = hoje.toISOString().split('T')[0];
  inputrevisao.value = 1;

  console.log('Iniciando carregamento de usuários...');
  let departamento = '';
  let idusuario = '';
  let grupo = '';

  try {
    const response = await fetch('/api/usuarios');
    if (!response.ok) throw new Error('Erro ao buscar usuários');
    const usuarios = await response.json();

    const responseLogado = await fetch('/api/usuario_logado');
    if (!responseLogado.ok) throw new Error('Erro ao buscar usuário logado');
    const usuarioLogado = await responseLogado.json();

    departamento = usuarioLogado.departamento?.trim?.() || '';
    idusuario = usuarioLogado.id?.trim?.() || '';
    grupo = usuarioLogado.grupo?.trim?.() || '';

    const selectuser = document.getElementById('usuario_doc');
    selectuser.innerHTML = '';

    let usuariosFiltrados = usuarios;

    if (grupo !== 'Administradores') {
      usuariosFiltrados = usuarios.filter(u =>
        (u.departamento || '').trim().toLowerCase() === departamento.trim().toLowerCase()
      );
    }

    usuariosFiltrados.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.nome}`;
      opt.dataset.departamento = u.departamento || '';
      selectuser.appendChild(opt);
    });

    selectuser.addEventListener('change', () => {
      const selected = selectuser.options[selectuser.selectedIndex];
      document.getElementById('departamento_doc').value = selected.dataset.departamento || '';
    });

    if (grupo == 'N/D' || grupo == '*') {
      selectuser.value = idusuario;
      selectuser.disabled = true;

      const selected = selectuser.options[selectuser.selectedIndex];
      if (selected) {
        document.getElementById('departamento_doc').value = selected.dataset.departamento || '';
      }
    }

    console.log('Execução concluída com sucesso');
  } catch (error) {
    console.error('Erro no carregamento:', error);
  }

  if (grupo !== 'Administradores') {
    selectUsoComum.value = '2'; // '2' = Não
    selectUsoComum.disabled = true;
  } else {
    selectUsoComum.disabled = false;
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
    const tipo_doc = document.getElementById('tipo_doc').value;
    const user = document.getElementById('usuario_doc').value;

    if (!tipo_doc) return alert('Digite o tipo de documento.');

    if (!titulo) return alert('Digite o título do processo.');

    try {
      const method = 'POST';
      const url = '/documento/';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, titulo, descricao, revisao, usucomum, tipo_doc })
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
      const res = await fetch('/api/usuario_logado');
      if (!res.ok) return console.warn('Não foi possível carregar usuário.');
      const usuario = await res.json();
      const userInfoDiv = document.getElementById('user-info');
      if (userInfoDiv && usuario) {
        userInfoDiv.innerHTML = `<strong>${usuario.usr}</strong> - ${usuario.nome}<br><small>${usuario.departamento} • ${usuario.cargo}</small>`;
      }
    } catch (err) { console.error('Erro ao carregar dados do usuário:', err); }
  })();

  function criarLinhaTabela(p, grupo) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.titulo}</td>
      <td>${p.tipo_documento}</td>
      <td>${p.data_inclusao ? new Date(p.data_inclusao).toLocaleDateString() : '-'}</td>
      <td>${p.revisao || '-'}</td>
      <td>${p.proxima_revisao ? new Date(p.proxima_revisao).toLocaleDateString() : '-'}</td>
      <td>${p.uso_comum}</td>
      <td>
        <button class="btn-editar" data-id="${p.id}" 
          ${p.uso_comum === 'Sim' && grupo !== 'Administradores' ? 'disabled' : ''}>
          Editar
        </button>
      </td>
      <td>
        <button class="btn-excluir" data-id="${p.id}" 
          ${p.uso_comum === 'Sim' && grupo !== 'Administradores' ? 'disabled' : ''}>
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
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir processo.');
      }
    };
    tr.querySelector('.btn-editar').onclick = (e) => {
      e.stopPropagation();
      editarProcesso(p);
    };

    return tr;
  }

  async function listarProcessos() {
    try {
      const res = await fetch('/meus-processos');
      if (!res.ok) return alert('Erro ao carregar processos.');
      const { processos, grupo } = await res.json();
      tabelaMeus.innerHTML = '';
      processos.forEach(p => tabelaMeus.appendChild(criarLinhaTabela(p, grupo)));
    } catch (e) { console.error(e); }
  }

  async function carregarUsoComum() {
    try {
      const res = await fetch('/uso-comum');
      if (!res.ok) return alert('Erro ao carregar processos de uso comum.');
      const { processos, grupo } = await res.json();
      tabelaUsoComum.innerHTML = '';
      processos.forEach(p => tabelaUsoComum.appendChild(criarLinhaTabela(p, grupo)));
    } catch (e) { console.error(e); }
  }

  carregarUsoComum();

});