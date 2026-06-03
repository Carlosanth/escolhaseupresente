(function Harvey(){
  const firebaseConfig = {
    apiKey: "AIzaSyD-VWgC9Z8R9IgjlnYRNmGxG8YrEFTlzMM",
    authDomain: "lista-casamento-8c482.firebaseapp.com",
    projectId: "lista-casamento-8c482",
    storageBucket: "lista-casamento-8c482.firebasestorage.app",
    messagingSenderId: "873428866016",
    appId: "1:873428866016:web:985b96d66a18ff399ed185"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const URL_FORMSPREE = "https://formspree.io/f/mgoqprpl";
  const URL_WEBHOOK_MAKE = "https://hook.us2.make.com/gox07mdkwq2hsjlegc7666l929evnjnb";

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

    db.collection("produtos").onSnapshot((snapshot) => {
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

        mainConteudo.innerHTML = `
          <section class="cartao-produto">
            <div class="imagem-produto">
              <img src="${produto.imagem}" alt="${produto.titulo}" />
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

      // ==========================================
      // LÓGICA PARA ALTERNAR A VISUALIZAÇÃO
      // ==========================================
      const btnAlternar = document.getElementById('btn-alternar-layout');
      const listaProdutos = document.getElementById('lista-produtos');

      if (btnAlternar && listaProdutos) {
        btnAlternar.addEventListener('click', () => {
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
            nomeConvidado: nomeConvidado
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