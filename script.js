(function Harvey(){
  const firebaseConfig = {
    apiKey: "AIzaSyDcDs0qgXdOQRnMW2mClO1kCoYmbVfeThY",
    authDomain: "escolhaseupresente-35d3d.firebaseapp.com",
    projectId: "escolhaseupresente-35d3d",
    storageBucket: "escolhaseupresente-35d3d.firebasestorage.app",
    messagingSenderId: "374767023277",
    appId: "1:374767023277:web:0a6d45cb62136ba4040224",
    measurementId: "G-DJZFYZSGMV"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  let produtoAtualId     = "";
  let produtoAtualTitulo = "";

  // ============================================================
  // 🎨 SISTEMA DE TEMA INTELIGENTE
  // ============================================================

  function hexParaHSL(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0,2), 16) / 255;
    const g = parseInt(hex.slice(2,4), 16) / 255;
    const b = parseInt(hex.slice(4,6), 16) / 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hexParaRGB(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return [
      parseInt(hex.slice(0,2), 16),
      parseInt(hex.slice(2,4), 16),
      parseInt(hex.slice(4,6), 16)
    ].join(', ');
  }

  function aplicarTema(hex, modoForcado) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;

    const { h, s, l } = hexParaHSL(hex);
    const rgb  = hexParaRGB(hex);
    const root = document.documentElement;
    const sAdj = Math.max(s, 40);

    const modoClaro = modoForcado !== undefined ? modoForcado : l > 75;

    if (modoClaro) {
      const hAcento = s < 10 ? 240 : h;
      const sAcento = s < 10 ? 60  : Math.min(sAdj + 20, 90);
      const lAcento = 45;

      root.style.setProperty('--acento',     `hsl(${hAcento}, ${sAcento}%, ${lAcento}%)`);
      root.style.setProperty('--acento-rgb', `${Math.round(255 * lAcento/100)}, ${Math.round(255 * lAcento/100)}, 255`);
      root.style.setProperty('--fundo-base', `hsl(${hAcento}, ${Math.round(sAcento * 0.08)}%, 96%)`);
      root.style.setProperty('--fundo-glow-1', `hsla(${hAcento}, ${sAcento}%, 60%, 0.08)`);
      root.style.setProperty('--fundo-glow-2', `hsla(${hAcento - 15}, ${sAcento}%, 55%, 0.06)`);
      root.style.setProperty('--glass-bg',           `rgba(255, 255, 255, 0.85)`);
      root.style.setProperty('--glass-borda',        `hsla(${hAcento}, ${sAcento}%, ${lAcento}%, 0.14)`);
      root.style.setProperty('--glass-hover-bg',     `rgba(255, 255, 255, 0.97)`);
      root.style.setProperty('--glass-hover-borda',  `hsla(${hAcento}, ${sAcento}%, ${lAcento}%, 0.38)`);
      root.style.setProperty('--preco-bg',    `hsla(${hAcento}, ${sAcento}%, ${lAcento}%, 0.07)`);
      root.style.setProperty('--preco-borda', `hsla(${hAcento}, ${sAcento}%, ${lAcento}%, 0.22)`);
      root.style.setProperty('--preco-glow',  `hsla(${hAcento}, ${sAcento}%, ${lAcento}%, 0.10)`);
      root.style.setProperty('--preco-texto', `hsl(${hAcento}, ${sAcento}%, ${lAcento}%)`);
      root.style.setProperty('--btn-bg',       `hsl(${hAcento}, ${sAcento}%, ${lAcento}%)`);
      root.style.setProperty('--btn-borda',    `hsl(${hAcento}, ${sAcento}%, ${lAcento - 8}%)`);
      root.style.setProperty('--btn-hover-bg', `hsl(${hAcento}, ${sAcento}%, ${lAcento - 8}%)`);
      root.style.setProperty('--btn-texto',    '#ffffff');
      root.style.setProperty('--btn-sombra',   `hsla(${hAcento}, ${sAcento}%, ${lAcento}%, 0.35)`);
      root.style.setProperty('--texto-titulo', '#111111');
      root.style.setProperty('--texto-rotulo', 'rgba(0,0,0,0.40)');
      document.body.classList.add('tema-claro');
      document.body.classList.remove('tema-escuro');

    } else {
      const lAcento = Math.min(Math.max(l, 58), 72);

      root.style.setProperty('--acento',     `hsl(${h}, ${sAdj}%, ${lAcento}%)`);
      root.style.setProperty('--acento-rgb', rgb);
      root.style.setProperty('--fundo-base', `hsl(${h}, ${Math.round(sAdj * 0.45)}%, 7%)`);
      root.style.setProperty('--fundo-glow-1', `hsla(${h}, ${sAdj}%, ${Math.min(l+5,52)}%, 0.20)`);
      root.style.setProperty('--fundo-glow-2', `hsla(${h - 12}, ${sAdj}%, ${Math.min(l,48)}%, 0.15)`);
      root.style.setProperty('--glass-bg',           `hsla(${h}, ${Math.round(sAdj*0.25)}%, 80%, 0.055)`);
      root.style.setProperty('--glass-borda',        `hsla(${h}, ${sAdj}%, 75%, 0.11)`);
      root.style.setProperty('--glass-hover-bg',     `hsla(${h}, ${sAdj}%, ${lAcento}%, 0.10)`);
      root.style.setProperty('--glass-hover-borda',  `hsla(${h}, ${sAdj}%, ${lAcento}%, 0.38)`);
      root.style.setProperty('--preco-bg',    `hsla(${h}, ${sAdj}%, ${lAcento}%, 0.10)`);
      root.style.setProperty('--preco-borda', `hsla(${h}, ${sAdj}%, ${lAcento}%, 0.30)`);
      root.style.setProperty('--preco-glow',  `hsla(${h}, ${sAdj}%, ${lAcento}%, 0.18)`);
      root.style.setProperty('--preco-texto', `hsl(${h}, ${Math.min(sAdj+8,88)}%, ${Math.min(lAcento+14,86)}%)`);
      const lBtn = Math.max(lAcento - 12, 38);
      root.style.setProperty('--btn-bg',       `hsla(${h}, ${Math.min(sAdj+15,95)}%, ${lBtn}%, 0.75)`);
      root.style.setProperty('--btn-borda',    `hsla(${h}, ${sAdj}%, ${lAcento}%, 0.50)`);
      root.style.setProperty('--btn-hover-bg', `hsla(${h}, ${Math.min(sAdj+15,95)}%, ${lBtn}%, 0.92)`);
      root.style.setProperty('--btn-texto',    '#ffffff');
      root.style.setProperty('--btn-sombra',   `hsla(${h}, ${sAdj}%, ${lBtn}%, 0.45)`);
      root.style.setProperty('--texto-titulo', '#ffffff');
      root.style.setProperty('--texto-rotulo', 'rgba(255,255,255,0.40)');
      document.body.classList.add('tema-escuro');
      document.body.classList.remove('tema-claro');
    }
  }

  // ============================================================

  function obterUsuarioIdDaUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  window.addEventListener('DOMContentLoaded', () => {
    const listaContainer = document.getElementById('lista-produtos');
    const inputNome      = document.getElementById('nome-convidado');

    if (!listaContainer) {
      alert("Erro crítico: div 'lista-produtos' não encontrada!");
      return;
    }

    const usuarioIdUrl = obterUsuarioIdDaUrl();
    if (!usuarioIdUrl) {
      listaContainer.innerHTML = "<p style='text-align:center;padding:40px;color:rgba(255,255,255,0.45)'>Erro: lista sem identificador. Peça o link correto aos noivos!</p>";
      return;
    }

    // ── Tema em tempo real ─────────────────────────────────────
    db.collection("configuracoes").doc(usuarioIdUrl)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const dados = doc.data();

          const modoForcado = dados.modo_display === 'claro'  ? true
                            : dados.modo_display === 'escuro' ? false
                            : undefined;

          if (dados.cor_tema) aplicarTema(dados.cor_tema, modoForcado);

          if (dados.imagem_fundo) {
            document.documentElement.style.setProperty(
              '--imagem-fundo', `url('${dados.imagem_fundo}')`
            );
          }

          if (dados.titulo_boas_vindas) {
            const h1 = document.querySelector('.conteudo-boas-vindas h1');
            if (h1) h1.textContent = dados.titulo_boas_vindas;
          }
          if (dados.descricao_boas_vindas) {
            const p = document.querySelector('.conteudo-boas-vindas p');
            if (p) p.textContent = dados.descricao_boas_vindas;
          }
          if (dados.data_evento) {
            iniciarContagem(dados.data_evento);
          } else {
            const bloco = document.getElementById('countdown-bloco');
            if (bloco) bloco.style.display = 'none';
          }
        }
      }, err => console.error("Erro tema:", err));

    // ── Contagem regressiva ────────────────────────────────────
    let countdownInterval = null;

    function iniciarContagem(dataEvento) {
      const bloco = document.getElementById('countdown-bloco');
      if (!bloco) return;

      // Limpa intervalo anterior se existir
      if (countdownInterval) clearInterval(countdownInterval);

      const alvo = new Date(dataEvento).getTime();
      if (isNaN(alvo)) { bloco.style.display = 'none'; return; }

      bloco.style.display = 'flex';

      function atualizar() {
        const agora = Date.now();
        const diff  = alvo - agora;

        if (diff <= 0) {
          clearInterval(countdownInterval);
          document.getElementById('cd-dias').textContent  = '00';
          document.getElementById('cd-horas').textContent = '00';
          document.getElementById('cd-min').textContent   = '00';
          document.getElementById('cd-seg').textContent   = '00';
          const label = bloco.querySelector('.cd-evento-label');
          if (label) label.textContent = '🎉 O grande dia chegou!';
          return;
        }

        const dias  = Math.floor(diff / 86400000);
        const horas = Math.floor((diff % 86400000) / 3600000);
        const min   = Math.floor((diff % 3600000)  / 60000);
        const seg   = Math.floor((diff % 60000)    / 1000);

        document.getElementById('cd-dias').textContent  = String(dias).padStart(2,'0');
        document.getElementById('cd-horas').textContent = String(horas).padStart(2,'0');
        document.getElementById('cd-min').textContent   = String(min).padStart(2,'0');
        document.getElementById('cd-seg').textContent   = String(seg).padStart(2,'0');
      }

      atualizar();
      countdownInterval = setInterval(atualizar, 1000);
    }

    // ── Filtro de categorias ───────────────────────────────────
    let categoriaAtiva = 'todos';
    let todosProdutosCache = [];

    function renderizarFiltros(categorias) {
      const wrap = document.getElementById('filtro-categorias');
      if (!wrap) return;
      wrap.innerHTML = '';

      // Chip "Todos"
      const chipTodos = document.createElement('button');
      chipTodos.className = 'chip-categoria' + (categoriaAtiva === 'todos' ? ' ativo' : '');
      chipTodos.textContent = 'Todos';
      chipTodos.addEventListener('click', () => {
        categoriaAtiva = 'todos';
        aplicarFiltro();
        atualizarChips();
      });
      wrap.appendChild(chipTodos);

      // Chips por categoria
      categorias.forEach(cat => {
        const chip = document.createElement('button');
        chip.className = 'chip-categoria' + (categoriaAtiva === cat ? ' ativo' : '');
        chip.textContent = cat;
        chip.addEventListener('click', () => {
          categoriaAtiva = cat;
          aplicarFiltro();
          atualizarChips();
        });
        wrap.appendChild(chip);
      });
    }

    function atualizarChips() {
      document.querySelectorAll('.chip-categoria').forEach(chip => {
        const cat = chip.textContent;
        chip.classList.toggle('ativo',
          cat === 'Todos' ? categoriaAtiva === 'todos' : categoriaAtiva === cat
        );
      });
    }

    function aplicarFiltro() {
      const cards = listaContainer.querySelectorAll('main.conteudo');
      cards.forEach(card => {
        if (categoriaAtiva === 'todos') {
          card.style.display = '';
        } else {
          card.style.display = card.dataset.categoria === categoriaAtiva ? '' : 'none';
        }
      });
    }

    // ── Produtos em tempo real ─────────────────────────────────
    db.collection("produtos_teste").where("usuario_id", "==", usuarioIdUrl)
      .onSnapshot((snapshot) => {
        listaContainer.innerHTML = "";
        todosProdutosCache = [];

        if (snapshot.empty) {
          listaContainer.innerHTML = "<p style='text-align:center;padding:40px;color:rgba(255,255,255,0.40)'>Esta lista ainda não possui produtos cadastrados.</p>";
          document.getElementById('filtro-categorias').innerHTML = '';
          return;
        }

        // Coleta categorias únicas com pelo menos 1 item
        const categoriasSet = new Set();

        snapshot.forEach((doc) => {
          const produto = doc.data();
          const id      = doc.id;
          todosProdutosCache.push({ id, ...produto });

          if (produto.categoria && produto.categoria.trim()) {
            categoriasSet.add(produto.categoria.trim());
          }

          const dispClass = produto.disponivel ? "disponivel" : "indisponivel";
          const dispTexto = produto.disponivel ? "Disponível"  : "Presenteado";

          const wrap = document.createElement('main');
          wrap.className = 'conteudo';
          wrap.dataset.categoria = produto.categoria?.trim() || '';
          if (!produto.disponivel) wrap.classList.add('item-esgotado');

          // Usa DOM seguro para campos vindos do Firestore
          const section = document.createElement('section');
          section.className = 'cartao-produto';

          const imgDiv = document.createElement('div');
          imgDiv.className = 'imagem-produto';
          const img = document.createElement('img');
          img.src = produto.imagem || 'https://i.ibb.co/YBZJdZ2N/icon-192.jpg';
          img.alt = produto.titulo || 'Produto';
          img.onerror = () => { img.src = 'https://i.ibb.co/YBZJdZ2N/icon-192.jpg'; };
          imgDiv.appendChild(img);

          const detalhes = document.createElement('div');
          detalhes.className = 'detalhes-produto';

          const titulo = document.createElement('div');
          titulo.className = 'titulo-produto';
          titulo.textContent = produto.titulo || 'Sem título';

          const rodape = document.createElement('div');
          rodape.className = 'rodape-produto';

          const caixaPreco = document.createElement('div');
          caixaPreco.className = 'caixa-preco';
          caixaPreco.innerHTML = `
            <div class="rotulo-preco">Valor</div>
            <div class="preco"></div>
            <div class="disponibilidade ${dispClass}"></div>`;
          caixaPreco.querySelector('.preco').textContent          = produto.preco || 'Consulte';
          caixaPreco.querySelector('.disponibilidade').textContent = dispTexto;

          const acoes = document.createElement('div');
          acoes.className = 'acoes';

          if (produto.disponivel) {
            const btn = document.createElement('button');
            btn.className = 'botao primario botao-presentear';
            btn.dataset.id     = id;
            btn.dataset.titulo = produto.titulo || '';
            btn.textContent    = '😊 Presentear 😊';
            acoes.appendChild(btn);
          } else {
            const btn = document.createElement('button');
            btn.className = 'botao';
            btn.disabled  = true;
            btn.textContent = '😍 Ganhamos! 😍';
            acoes.appendChild(btn);
          }

          rodape.appendChild(caixaPreco);
          rodape.appendChild(acoes);
          detalhes.appendChild(titulo);
          detalhes.appendChild(rodape);
          section.appendChild(imgDiv);
          section.appendChild(detalhes);
          wrap.appendChild(section);
          listaContainer.appendChild(wrap);
        });

        // Atualiza chips (só categorias com itens)
        const categoriasOrdenadas = [...categoriasSet].sort();
        renderizarFiltros(categoriasOrdenadas);

        // Reaplica filtro ativo
        aplicarFiltro();

        // Eventos dos botões presentear
        listaContainer.querySelectorAll('.botao-presentear').forEach(btn => {
          btn.addEventListener('click', function() {
            produtoAtualId     = this.dataset.id;
            produtoAtualTitulo = this.dataset.titulo;
            const m = document.getElementById('modal-nome');
            if (m) {
              if (inputNome) inputNome.value = "";
              m.classList.add('mostrar');
              if (inputNome) inputNome.focus();
            } else {
              const nome = prompt("Digite seu nome completo:");
              if (nome) finalizarCompra(nome);
            }
          });
        });
      });

    // Alternar layout
    document.getElementById('btn-alternar-layout')?.addEventListener('click', () => {
      listaContainer.classList.toggle('visualizacao-vertical');
    });

    // Fechar modal
    document.getElementById('btn-cancelar-modal')?.addEventListener('click', () => {
      document.getElementById('modal-nome')?.classList.remove('mostrar');
    });

    // Confirmar
    document.getElementById('btn-confirmar-modal')?.addEventListener('click', async () => {
      const nome = inputNome?.value.trim() || "";
      if (!nome) { alert("Digite seu nome para continuar."); return; }
      document.getElementById('modal-nome')?.classList.remove('mostrar');
      await finalizarCompra(nome);
    });

    // Enter no input
    inputNome?.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      const nome = inputNome.value.trim();
      if (!nome) { alert("Digite seu nome para continuar."); return; }
      document.getElementById('modal-nome')?.classList.remove('mostrar');
      await finalizarCompra(nome);
    });

    async function finalizarCompra(nomeConvidado) {
      try {
        const res = await fetch(
          "https://southamerica-east1-escolhaseupresente-35d3d.cloudfunctions.net/finalizarCompra",
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ produtoId: produtoAtualId, nomeConvidado })
          }
        );
        const resultado = await res.json();
        if (resultado?.url) {
          window.location.href = resultado.url;
        } else {
          alert(resultado.erro || "Não foi possível gerar o link. Tente novamente.");
        }
      } catch (err) {
        console.error("Erro:", err);
        alert("Erro de comunicação. Tente novamente.");
      }
    }
  });
})();