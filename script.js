(async function Harvey() {
  // 1. IMPORTANDO AS BIBLIOTECAS DO FIREBASE (Mesma versão v10 usada no seu painel)
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
  const { getFirestore, collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

  // CONFIGURAÇÃO DO FIREBASE (Apontando exatamente para o projeto "escolhaseupresente-35d3d")
  const firebaseConfig = {
    apiKey: "AIzaSyDcDs0qgXdOQRnMW2mClO1kCoYmbVfeThY",
    authDomain: "escolhaseupresente-35d3d.firebaseapp.com",
    projectId: "escolhaseupresente-35d3d",
    storageBucket: "escolhaseupresente-35d3d.firebasestorage.app",
    messagingSenderId: "374767023277",
    appId: "1:374767023277:web:0a6d45cb62136ba4040224",
    measurementId: "G-DJZFYZSGMV"
  };

  // Inicializa o Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // CONFIGURAÇÕES DE INTEGRAÇÃO EXTERNA (Formspree e Make)
  const URL_FORMSPREE = "https://formspree.io/f/mgoqprpl";
  const URL_WEBHOOK_MAKE = "https://hook.us2.make.com/gox07mdkwq2hsjlegc7666l929evnjnb";

  // CAPTURA O ID DO DONO DA LISTA VIA URL (Ex: lista.html?id=374767...)
  const parametrosUrl = new URLSearchParams(window.location.search);
  const usuarioDonoDaListaUid = parametrosUrl.get('id');

  let produtoAtualId = "";
  let produtoAtualTitulo = "";

  // Função para enviar notificação por e-mail via Formspree
  async function enviarEmailNotificacao(nomeConvidado, nomeProduto, linkPagamento) {
    try {
      await fetch(URL_FORMSPREE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: `Olá Carlos! O(a) convidado(a) ${nomeConvidado} escolheu o presente: ${nomeProduto}. O link de pagamento gerado foi: ${linkPagamento}`
        })
      });
    } catch (error) {
      console.error("Erro ao enviar e-mail: ", error);
    }
  }

  // Executa assim que a estrutura da página estiver pronta
  window.addEventListener('DOMContentLoaded', () => {
    const listaContainer = document.getElementById('lista-produtos');
    const modal = document.getElementById('modal-nome');
    const inputNome = document.getElementById('nome-convidado');

    if (!listaContainer) {
      alert("Erro crítico: Não encontrei a div 'lista-produtos' no seu HTML!");
      return;
    }

    // Se o link não tiver o "?id=...", avisa o usuário
    if (!usuarioDonoDaListaUid) {
      listaContainer.innerHTML = `<p style="padding: 20px; color: red; font-weight: bold; text-align: center;">Erro: Esta lista é inválida ou o link de compartilhamento está incompleto (falta o ID do usuário).</p>`;
      return;
    }

    // 2. CONSULTA FILTRADA: Busca apenas os produtos onde 'usuario_id' é igual ao ID do dono da lista
    const colecaoProdutos = collection(db, "produtos_teste");
    const consultaFiltrada = query(colecaoProdutos, where("usuario_id", "==", usuarioDonoDaListaUid));

    // Escuta em tempo real as mudanças nos seus produtos cadastrados
    onSnapshot(consultaFiltrada, (snapshot) => {
      listaContainer.innerHTML = "";

      if (snapshot.empty) {
        listaContainer.innerHTML = `<p style="padding: 20px; text-align: center; opacity: 0.7;">Nenhum produto cadastrado ou disponível nesta lista ainda.</p>`;
        return;
      }

      snapshot.forEach((docSnap) => {
        const produto = docSnap.data();
        const id = docSnap.id;

        const textoDisponibilidade = produto.disponivel ? "Disponível" : "Indisponível";
        const classeDisponibilidade = produto.disponivel ? "disponivel" : "indisponivel";
        
        const mainConteudo = document.createElement('main');
        mainConteudo.className = 'conteudo';
        
        if (!produto.disponivel) {
          mainConteudo.classList.add('item-esgotado');
        }

        // Renderiza o produto usando os mesmos campos salvos pelo seu painel administrativo
        mainConteudo.innerHTML = `
          <section class="cartao-produto">
            <div class="imagem-produto">
              <img src="${produto.imagem || 'https://i.ibb.co/FqHbGwfs/189697.png'}" alt="${produto.titulo || 'Produto'}" />
            </div>

            <div class="detalhes-produto">
              <div class="titulo-produto">${produto.titulo || "Sem nome"}</div>
              <small style="display:block; font-size:11px; opacity:0.6; margin-bottom: 5px;">Categoria: ${produto.categoria || "Geral"}</small>

              <div class="rodape-produto">
                <div class="caixa-preco">
                  <div class="rotulo-preco">Valor:</div>
                  <div class="preco">${produto.preco || "R$ 0,00"}</div>
                  <div class="disponibilidade ${classeDisponibilidade}">${textoDisponibilidade}</div>
                </div>

                <div class="acoes">
                  ${produto.disponivel 
                    ? `<button class="botao primario botao-presentear" 
                                 data-id="${id}" 
                                 data-titulo="${produto.titulo}">
                        <span class="texto-presentear">😊 Presentear 😊</span>
                      </button>`
                    : `<button class="botao" disabled style="background-color: #ccc; cursor: not-allowed;">😍 Ganhamos! 😍</button>`
                  }
                </div>
              </div>
            </div>
          </section>
        `;

        listaContainer.appendChild(mainConteudo);
      });

      // Lógica para alternar layout de exibição (se o botão existir na página do convidado)
      const btnAlternar = document.getElementById('btn-alternar-layout');
      const listaProdutos = document.getElementById('lista-produtos');

      if (btnAlternar && listaProdutos) {
        // Remove ouvintes antigos para não duplicar eventos em atualizações em tempo real
        const novoBtn = btnAlternar.cloneNode(true);
        btnAlternar.parentNode.replaceChild(novoBtn, btnAlternar);
        
        novoBtn.addEventListener('click', () => {
          listaProdutos.classList.toggle('visualizacao-vertical');
        });
      }

      // Adiciona o clique em todos os botões de presentear gerados na tela
      document.querySelectorAll('.botao-presentear').forEach(botao => {
        botao.addEventListener('click', function() {
          produtoAtualId = this.dataset.id;
          produtoAtualTitulo = this.dataset.titulo;

          const m = document.getElementById('modal-nome');
          if(m) {
            if(inputNome) inputNome.value = "";
            m.classList.add('mostrar');
            if(inputNome) inputNome.focus();
          } else {
            const nomeBackup = prompt("Digite seu nome completo para confirmar o presente:");
            if(nomeBackup) finalizarCompra(nomeBackup);
          }
        });
      });
    });

    // Lógica para fechar o Modal do Nome
    const btnCancelar = document.getElementById('btn-cancelar-modal');
    if(btnCancelar) {
      btnCancelar.addEventListener('click', () => {
        const m = document.getElementById('modal-nome');
        if(m) m.classList.remove('mostrar');
      });
    }

    // Lógica para confirmar o Nome no Modal e ir para o Pagamento
    const btnConfirmar = document.getElementById('btn-confirmar-modal');
    if(btnConfirmar) {
      btnConfirmar.addEventListener('click', async () => {
        const nome = inputNome ? inputNome.value.trim() : "";
        if (nome === "") {
          alert("Por favor, digite o seu nome para continuar.");
          return;
        }
        const m = document.getElementById('modal-nome');
        if(m) m.classList.remove('mostrar');
        
        await finalizarCompra(nome);
      });
    }

    // Envia os dados de compra para o Make.com e trata o link retornado
    async function finalizarCompra(nomeConvidado) {
      try {
        const resposta = await fetch(URL_WEBHOOK_MAKE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produtoId: produtoAtualId,
            nomeConvidado: nomeConvidado,
            donoListaId: usuarioDonoDaListaUid // Enviando também quem é o dono para o Make saber quem recebe
          })
        });

        const resultado = await resposta.json();

        if (resultado && resultado.url) {
          enviarEmailNotificacao(nomeConvidado, produtoAtualTitulo, resultado.url);
          window.location.href = resultado.url;
        } else {
          alert(resultado.erro || "Não foi possível gerar o link de pagamento. Tente novamente.");
        }

      } catch (erro) {
        console.error("Erro ao falar com o servidor seguro:", erro);
        alert("Erro de comunicação. O sistema de pagamentos está instável.");
      }
    }
  });
})();
