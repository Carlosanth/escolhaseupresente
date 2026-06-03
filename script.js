(function Harvey(){
  // Configuração do Firebase com as credenciais da sua Lista de Casamento
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
  const URL_FORMSPREE = "https://formspree.io/f/mgoqprpl";
  const URL_WEBHOOK_MAKE = "https://hook.us2.make.com/gox07mdkwq2hsjlegc7666l929evnjnb";

  let produtoAtualId = "";
  let produtoAtualTitulo = "";

  // Captura o ID do usuário/noivo diretamente da URL (?id=...)
  const urlParams = new URLSearchParams(window.location.search);
  const idNoivo = urlParams.get('id');

  // Envio de e-mail de notificação via Formspree
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
    const btnAlternar = document.getElementById('btn-alternar-layout');

    if (!listaContainer) {
      alert("Erro crítico: Não encontrei a div 'lista-produtos' no seu HTML!");
      return;
    }

    // Gerenciador do botão de alternar layout
    if (btnAlternar) {
      btnAlternar.addEventListener('click', () => {
        listaContainer.classList.toggle('visualizacao-vertical');
      });
    }

    // Validação de segurança: Se não houver ID na URL, avisa o usuário
    if (!idNoivo) {
      listaContainer.innerHTML = `
        <div style="text-align:center; grid-column: 1/-1; color:#d93025; padding: 20px; font-weight: 600;">
          <p>⚠️ Link inválido ou incompleto.</p>
          <p style="font-size: 14px; color: #666; font-weight: 400;">Por favor, acesse utilizando o link correto com o identificador da lista.</p>
        </div>`;
      return;
    }

    // Monitoramento em tempo real focado APENAS na coleção produtos_teste
    db.collection("produtos_teste")
      .where("usuario_id", "==", idNoivo)
      .onSnapshot((snapshot) => {
        listaContainer.innerHTML = "";

        if (snapshot.empty) {
          listaContainer.innerHTML = "<p style='text-align:center; grid-column: 1/-1; color:#888;'>Nenhum produto cadastrado para esta lista.</p>";
          return;
        }

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
                <img src="${produto.imagem || 'https://via.placeholder.com/150'}" alt="${produto.titulo}" />
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

        // Vincula o evento de clique nos botões "Presentear" criados dinamicamente
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

    // Fechar modal ao clicar em voltar
    const btnCancelar = document.getElementById('btn-cancelar-modal');
    if(btnCancelar) {
      btnCancelar.addEventListener('click', () => {
        const m = document.getElementById('modal-nome');
        if(m) m.classList.remove('mostrar');
      });
    }

    // Confirmar nome no modal e avançar para a compra
    const btnConfirmar = document.getElementById('btn-confirmar-modal');
    if(btnConfirmar) {
      btnConfirmar.addEventListener('click', async () => {
        const nome = inputNome ? inputNome.value.trim() : "";
        if (nome === "") {
          alert("Por favor, digite o seu nome para continuing.");
          return;
        }
        const m = document.getElementById('modal-nome');
        if(m) m.classList.remove('mostrar');
        
        await finalizarCompra(nome);
      });
    }

    // Comunicação com o webhook do Make
    async function finalizarCompra(nomeConvidado) {
      try {
        const resposta = await fetch(URL_WEBHOOK_MAKE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produtoId: produtoAtualId,
            nomeConvidado: nomeConvidado,
            colecao: "produtos_teste" // Fixo em produtos_teste para o seu fluxo do Make trabalhar sempre com a tabela certa
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