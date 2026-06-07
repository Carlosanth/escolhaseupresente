(async function Harvey() {
  // Importa as ferramentas modernas do Firebase mantendo a estrutura limpa
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
  const { getFirestore, collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

  // Dados do seu NOVO banco de dados (Modificado aqui)
  const firebaseConfig = {
    apiKey: "AIzaSyDcDs0qgXdOQRnMW2mClO1kCoYmbVfeThY",
    authDomain: "escolhaseupresente-35d3d.firebaseapp.com",
    projectId: "escolhaseupresente-35d3d",
    storageBucket: "escolhaseupresente-35d3d.firebasestorage.app",
    messagingSenderId: "374767023277",
    appId: "1:374767023277:web:0a6d45cb62136ba4040224",
    measurementId: "G-DJZFYZSGMV"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const URL_FORMSPREE = "https://formspree.io/f/mgoqprpl";
  const URL_WEBHOOK_MAKE = "https://hook.us2.make.com/gox07mdkwq2hsjlegc7666l929evnjnb";

  // Captura o ID do usuário que vem no link compartilhado (?id=...)
  const parametrosUrl = new URLSearchParams(window.location.search);
  const usuarioDonoDaListaUid = parametrosUrl.get('id');

  let produtoAtualId = "";
  let produtoAtualTitulo = "";

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

  window.addEventListener('DOMContentLoaded', () => {
    const listaContainer = document.getElementById('lista-produtos');
    const modal = document.getElementById('modal-nome');
    const inputNome = document.getElementById('nome-convidado');

    if (!listaContainer) {
      alert("Erro crítico: Não encontrei a div 'lista-produtos' no seu HTML!");
      return;
    }

    if (!usuarioDonoDaListaUid) {
      listaContainer.innerHTML = `<p style="padding: 20px; text-align: center; color: red; font-weight: bold;">Erro: Link incompleto. Falta o ID do dono da lista.</p>`;
      return;
    }

    // Aponta para a nova coleção 'produtos_teste' filtrando pelo seu ID de usuário
    const colecaoProdutos = collection(db, "produtos_teste");
    const consultaFiltrada = query(colecaoProdutos, where("usuario_id", "==", usuarioDonoDaListaUid));

    onSnapshot(consultaFiltrada, (snapshot) => {
      listaContainer.innerHTML = "";

      snapshot.forEach((doc) => {
        const produto = doc.data();
        const id = doc.id;

        const textoDisponibilidade = produto.disponivel ? "Disponível" : "Indisponível";
        const classeDisponibilidade = produto.disponivel ? "disponivel" : "indisponivel";
        
        const mainConteudo = document.createElement('main');
        mainConteudo.className = 'conteudo';
        
        if (!produto.disponivel) {
          mainConteudo.classList.add('item-esgotado');
        }

        // Proteção para garantir que se a imagem falhar, use uma padrão e não quebre o layout flexbox
        const urlImagem = produto.imagem || 'https://i.ibb.co/FqHbGwfs/189697.png';

        // SEU LAYOUT IDENTICO E SEM ALTERAÇÃO DE CLASSE
        mainConteudo.innerHTML = `
          <section class="cartao-produto">
            <div class="imagem-produto">
              <img src="${urlImagem}" alt="${produto.titulo}" />
            </div>

            <div class="detalhes-produto">
              <div class="titulo-produto">${produto.titulo}</div>

              <div class="rodape-produto">
                <div class="caixa-preco">
                  <div class="rotulo-preco">Valor:</div>
                  <div class="preco">${produto.preco}</div>
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

      // LÓGICA PARA ALTERNAR A VISUALIZAÇÃO
      const btnAlternar = document.getElementById('btn-alternar-layout');
      const listaProdutos = document.getElementById('lista-produtos');

      if (btnAlternar && listaProdutos) {
        // Evita duplicação de cliques no modo de tempo real
        const novoBtn = btnAlternar.cloneNode(true);
        btnAlternar.parentNode.replaceChild(novoBtn, btnAlternar);

        novoBtn.addEventListener('click', () => {
          listaProdutos.classList.toggle('visualizacao-vertical');
        });
      }

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

    const btnCancelar = document.getElementById('btn-cancelar-modal');
    if(btnCancelar) {
      btnCancelar.addEventListener('click', () => {
        const m = document.getElementById('modal-nome');
        if(m) m.classList.remove('mostrar');
      });
    }

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

    async function finalizarCompra(nomeConvidado) {
      try {
        const resposta = await fetch(URL_WEBHOOK_MAKE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produtoId: produtoAtualId,
            nomeConvidado: nomeConvidado,
            donoListaId: usuarioDonoDaListaUid // Passa o ID do dono para o webhook processar corretamente
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
