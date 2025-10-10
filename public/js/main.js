document.addEventListener('DOMContentLoaded', () => {
  const btnNovo = document.getElementById('btn-novo-processo');
  const btnMeus = document.getElementById('btn-meus-processos');
  const novoProcesso = document.getElementById('novo-processo');
  const meusProcessos = document.getElementById('meus-processos');
  const listaUL = document.getElementById('processos-ul');
  const recentesUL = document.getElementById('recentes-ul');
  const btnSalvar = document.getElementById('salvar-processo');
  const inputWord = document.getElementById('word-file');
  const modal = document.getElementById('modal');
  const modalTitulo = document.getElementById('modal-titulo');
  const modalDescricao = document.getElementById('modal-descricao');
  const modalClose = document.querySelector('.close');
  const buscaInput = document.getElementById('pesquisa');
  const buscaBtn = document.getElementById('btn-pesquisar');
  const resultadosSec = document.getElementById('resultados-busca');
  const resultadosUL = document.getElementById('resultados-ul');
  const btnClear = document.getElementById('btn-clear');
  const pesquisaInput = document.getElementById('pesquisa');
  
  modal.style.display = 'none'

  modalClose.onclick = () => modal.style.display = 'none';
  window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

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
          li.textContent = p.titulo;
          li.onclick = () => {
            modalTitulo.textContent = p.titulo;
            modalDescricao.innerHTML = p.descricao || 'Sem descrição';
            modal.style.display = 'block';
          };
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
      pesquisaInput.value = '';

      // Se quiser também esconder os resultados da busca
      const resultadosBusca = document.getElementById('resultados-busca');
      resultadosBusca.style.display = 'none';

      const resultadosUL = document.getElementById('resultados-ul');
      resultadosUL.innerHTML = '';
  });

  btnSalvar.addEventListener('click', async () => {
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();

    if (!titulo) return alert('Digite o título do processo.');

    try {
      const res = await fetch('/processos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descricao })
      });

      if (!res.ok) {
        const erro = await res.text();
        alert('Erro: ' + erro);
        return;
      }

      document.getElementById('titulo').value = '';
      document.getElementById('descricao').value = '';
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

      mammoth.convertToHtml({ arrayBuffer }) // 🔹 converte para HTML, não texto cru
        .then(result => {
          let html = result.value; // Conteúdo formatado
          html = html.replace(/\n/g, "<br>"); // garante espaçamento visual

          // Primeira linha = título, resto = descrição
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = html;
          const firstParagraph = tempDiv.querySelector("p");
          const titulo = firstParagraph ? firstParagraph.textContent.trim() : "Sem título";

          if (firstParagraph) firstParagraph.remove();
          const descricao = tempDiv.innerHTML.trim();

          document.getElementById("titulo").value = titulo;
          document.getElementById("descricao").value = descricao;
        })
        .catch(err => {
          console.error("Erro ao ler Word:", err);
          alert("Erro ao importar o Word.");
        });
    } catch (err) {
      console.error(err);
      alert("Erro ao importar o Word.");
    }
  });


  async function listarProcessos() {
    try {
      const res = await fetch('/meus-processos');
      if (!res.ok) return alert('Erro ao carregar processos.');
      const processos = await res.json();
      listaUL.innerHTML = '';
      processos.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.titulo;
        li.onclick = () => {
          modalTitulo.textContent = p.titulo;
          modalDescricao.innerHTML = p.descricao || 'Sem descrição';
          modal.style.display = 'block';
        };
        listaUL.appendChild(li);
      });
    } catch (e) { console.error(e); }
  }

  async function carregarRecentes() {
    try {
      const res = await fetch('/meus-processos');
      if (!res.ok) return;
      const processos = await res.json();
      recentesUL.innerHTML = '';
      processos.slice(-5).reverse().forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.titulo;
        li.onclick = () => {
          modalTitulo.textContent = p.titulo;
          modalDescricao.innerHTML = p.descricao || 'Sem descrição';
          modal.style.display = 'block';
        };
        recentesUL.appendChild(li);
      });
    } catch (e) { console.error(e); }
  }

  listarProcessos();
  carregarRecentes();
});
