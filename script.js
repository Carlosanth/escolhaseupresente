(function Harvey(){
  // 1. Atualizado para as credenciais do projeto 'escolhaseupresente'
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
  const URL_WEBHOOK_MAKE = "projeto não concluido";

  let produtoAtualId = "";
  let produtoAtualTitulo = "";

  // FUNÇÃO PARA PEGAR O ID DO DONO DA LISTA NA URL (?id=...)
  function obterUsuarioIdDaUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  async function enviarEmailNotificacao(nomeConvidado, nomeProduto, linkPagamento) {
    try {
      await fetch(URL_FORMSPREE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: `Olá! O(a) convidado(a) ${nomeConvidado} escolheu o presente: ${nomeProduto}. O link de pagamento gerado foi: ${linkPagamento}`
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

    const usuarioIdUrl = obterUsuarioIdDaUrl();

    if (!usuarioIdUrl) {
      listaContainer.innerHTML = "<p style='text-align:center; padding: 20px;'>Erro: Esta lista não possui um identificador válido. Peça o link correto aos noivos!</p>";
      return;
    }

    db.collection("configuracoes").doc(usuarioIdUrl)
      .onSnapshot((doc) => {
        if (doc.exists && doc.data().cor_tema) {
          const corDoTema = doc.data().cor_tema;
          document.documentElement.style.setProperty('--cor-principal', corDoTema);
        }
      }, (error) => {
        console.error("Erro ao carregar tema", error);
      });

    db.collection("produtos").where("usuario_id", "==", usuarioIdUrl)
      .onSnapshot((snapshot) => {
        listaContainer.innerHTML = "";

        if (snapshot.empty) {
          listaContainer.innerHTML = "<p style='text-align:center; padding: 20px;'>Esta lista ainda não possui produtos cadastrados.</p>";
          return;
        }

        snapshot.forEach((doc) => {
          const produto = doc.data();
          const id = doc.id;

          // IMPORTANTE: Garantir que os campos no banco usem as chaves 'disponivel', 'imagem', 'titulo' e 'preco'
          const textoDisponibilidade = produto.disponivel ? "Disponível" : "Indisponível";
          const classeDisponibilidade = produto.disponivel ? "disponivel" : "indisponivel";
          
          const mainConteudo = document.createElement('main');
          mainConteudo.className = 'conteudo';
          
          if (!produto.disponivel) {
            mainConteudo.classList.add('item-esgotado');
          }

          // Mantido 100% o seu HTML interno e suas classes originais do Style.css
          mainConteudo.innerHTML = `
            <section class="cartao-produto">
              <div class="imagem-produto">
                <img src="${produto.imagem || 'https://via.placeholder.com/150'}" alt="${produto.titulo || 'Produto'}" />
              </div>

              <div class="detalhes-produto">
                <div class="titulo-produto">${produto.titulo || 'Sem título'}</div>

                <div class="rodape-produto">
                  <div class="caixa-preco">
                    <div class="rotulo-preco">Valor:</div>
                    <div class="preco">${produto.preco || 'Consulte'}</div>
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

        // Reatribui os eventos dos botões gerados dinamicamente
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

    // LÓGICA PARA ALTERNAR A VISUALIZAÇÃO
    const btnAlternar = document.getElementById('btn-alternar-layout');
    if (btnAlternar && listaContainer) {
      btnAlternar.addEventListener('click', () => {
        listaContainer.classList.toggle('visualizacao-vertical');
      });
    }

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
