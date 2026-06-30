const functions = require("firebase-functions/v2/https");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

// Inicializar Firebase Admin uma única vez
if (!admin.apps.length) {
  admin.initializeApp();
}

// ════════════════════════════════════════════════════════════
// RATE LIMITING: Protege contra abuso
// ════════════════════════════════════════════════════════════
const requestCounts = new Map();

function checkRateLimit(ip, maxRequests = 5, windowMs = 60000) {
  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip);
  const recentRequests = timestamps.filter(t => now - t < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false; // Bloqueado
  }

  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true; // Permitido
}

// ════════════════════════════════════════════════════════════
// FUNÇÃO: finalizarCompra (COM SUPORTE A COTAS)
// ════════════════════════════════════════════════════════════

exports.finalizarCompra = functions.onRequest(
  { region: "southamerica-east1", cors: true },
  async (req, res) => {
    try {
      const { produtoId, nomeConvidado, cotasEscolhidas, cotasNumeros } = req.body;
      const ip = req.ip;

      // ── Rate limiting (máx 5 tentativas por minuto) ──────────────
      if (!checkRateLimit(ip, 5, 60000)) {
        return res.status(429).json({
          erro: "Muitas tentativas. Aguarde 1 minuto.",
        });
      }

      // ── Validação rigorosa de dados básicos ──────────────────────
      if (!produtoId || typeof produtoId !== "string") {
        return res.status(400).json({ erro: "produtoId inválido" });
      }

      if (!nomeConvidado || typeof nomeConvidado !== "string") {
        return res.status(400).json({ erro: "nomeConvidado inválido" });
      }

      if (produtoId.length > 255) {
        return res.status(400).json({ erro: "produtoId muito longo" });
      }

      if (nomeConvidado.length > 255) {
        return res.status(400).json({ erro: "Nome muito longo" });
      }

      // ── Detecta se é fluxo de cota e valida o formato ────────────
      // ehCota só é true se o convidado realmente escolheu cotas específicas.
      // Sem isso, o fluxo cai no caminho normal (presente inteiro), como antes.
      const ehCota = Array.isArray(cotasNumeros) && cotasNumeros.length > 0;

      if (ehCota) {
        // Cada número de cota deve ser um inteiro positivo, sem duplicatas,
        // e cotasEscolhidas precisa bater com a quantidade de números enviados —
        // isso impede que alguém manipule o payload manualmente (ex: via DevTools)
        // para pagar 1 cota mas marcar 5 como ocupadas.
        const numerosValidos = cotasNumeros.every(n => Number.isInteger(n) && n > 0);
        const semDuplicatas   = new Set(cotasNumeros).size === cotasNumeros.length;

        if (!numerosValidos || !semDuplicatas) {
          return res.status(400).json({ erro: "Seleção de cotas inválida" });
        }
        if (cotasEscolhidas !== cotasNumeros.length) {
          return res.status(400).json({ erro: "Quantidade de cotas não confere" });
        }
        if (cotasNumeros.length > 50) {
          return res.status(400).json({ erro: "Quantidade de cotas muito alta" });
        }
      }

      const produtoRef = admin.firestore().collection("produtos_teste").doc(produtoId);

      // ── Transação atômica: lê e já reserva as cotas/produto numa só operação ──
      // Isso é o que impede dois convidados de pegarem a mesma cota (ou o mesmo
      // presente inteiro) ao confirmarem ao mesmo tempo. Dentro de uma transação,
      // o Firestore garante que, se o documento mudar entre o get e o set de
      // outra requisição concorrente, uma delas falha e tenta de novo sozinha.
      let valorCentavosCobranca;
      let tituloProduto;
      let cotasReservadasNestaChamada = []; // usado pra rollback se algo falhar depois
      let eraReservaTotal = false;          // idem, pro caso de produto sem cota

      // Reverte exatamente o que essa chamada reservou, sem mexer em reservas
      // de outros convidados feitas em paralelo. Usado quando qualquer etapa
      // DEPOIS da reserva falha (ex: Make.com fora do ar, MAKE_URL ausente).
      async function reverterReserva() {
        try {
          await admin.firestore().runTransaction(async (tx) => {
            const snap = await tx.get(produtoRef);
            if (!snap.exists) return;
            const dados = snap.data();

            if (eraReservaTotal) {
              tx.update(produtoRef, { disponivel: true });
            } else if (cotasReservadasNestaChamada.length > 0) {
              const ocupadasAtuais = Array.isArray(dados.cotas_ocupadas) ? dados.cotas_ocupadas : [];
              const restantes = ocupadasAtuais.filter(n => !cotasReservadasNestaChamada.includes(n));
              const cotasTotal = parseInt(dados.cotas_total || 0);
              tx.update(produtoRef, {
                cotas_ocupadas: restantes,
                cotas_disponiveis: Math.max(0, cotasTotal - restantes.length),
                disponivel: true, // se tinha sido fechado por completar todas, reabre
              });
            }
          });
        } catch (rollbackErr) {
          // Se até o rollback falhar, registra pra investigação manual —
          // mas não derruba a resposta de erro original que o convidado já recebeu.
          console.error("⚠️ Falha ao reverter reserva (requer correção manual):", rollbackErr, {
            produtoId, cotasReservadasNestaChamada, eraReservaTotal,
          });
        }
      }

      try {
        await admin.firestore().runTransaction(async (tx) => {
          const prodSnap = await tx.get(produtoRef);

          if (!prodSnap.exists) {
            throw { codigo: 404, erro: "Produto não encontrado" };
          }

          const produto = prodSnap.data();
          tituloProduto = produto.titulo || "Presente";

          if (!produto.disponivel) {
            throw { codigo: 409, erro: "Este presente já foi escolhido por outro convidado" };
          }

          if (ehCota) {
            const cotasTotal = parseInt(produto.cotas_total || 0);
            if (cotasTotal < 2) {
              throw { codigo: 400, erro: "Este produto não está dividido em cotas" };
            }

            const precoCentavos = parseInt(produto.preco_centavos || 0);
            if (precoCentavos <= 0) {
              throw { codigo: 400, erro: "Produto sem valor definido" };
            }

            // Cotas já ocupadas, lidas dentro da transação — valor sempre fresco,
            // nunca o que o front mandou (o front só serve pra UX, não pra confiança).
            const ocupadasAtuais = Array.isArray(produto.cotas_ocupadas) ? produto.cotas_ocupadas : [];
            const ocupadasSet = new Set(ocupadasAtuais);

            // Confere se ALGUM número pedido já não está mais livre — pode ter
            // sido pego por outro convidado entre o convidado abrir o popup e
            // confirmar. Se algum colidir, a transação inteira é rejeitada.
            const numerosInvalidos = cotasNumeros.some(n => n > cotasTotal);
            if (numerosInvalidos) {
              throw { codigo: 400, erro: "Número de cota inválido para este produto" };
            }
            const colisao = cotasNumeros.some(n => ocupadasSet.has(n));
            if (colisao) {
              throw {
                codigo: 409,
                erro: "Uma ou mais cotas escolhidas acabaram de ser reservadas por outro convidado. Atualize a página e tente novamente.",
              };
            }

            // Calcula o valor da cota com base no preço total / total de cotas —
            // arredondamento em centavos pra não perder/sobrar fração no agregado.
            const porCotaCentavos = Math.round(precoCentavos / cotasTotal);
            valorCentavosCobranca = porCotaCentavos * cotasNumeros.length;

            const novasOcupadas = [...ocupadasAtuais, ...cotasNumeros].sort((a, b) => a - b);
            const todasPreenchidas = novasOcupadas.length >= cotasTotal;
            cotasReservadasNestaChamada = cotasNumeros; // para rollback, se precisar

            tx.update(produtoRef, {
              cotas_ocupadas: novasOcupadas,
              cotas_disponiveis: Math.max(0, cotasTotal - novasOcupadas.length),
              // Se essa contribuição preencheu a última cota, marca o produto
              // inteiro como indisponível — assim o card também para de aparecer.
              ...(todasPreenchidas ? { disponivel: false } : {}),
            });

          } else {
            // Fluxo normal: presente inteiro, comportamento igual ao original.
            valorCentavosCobranca = parseInt(produto.preco_centavos || 0);
            eraReservaTotal = true; // para rollback, se precisar
            tx.update(produtoRef, { disponivel: false });
          }
        });
      } catch (txErr) {
        // Erros lançados de propósito dentro da transação (objeto com .codigo)
        // viram resposta HTTP correta; qualquer outro erro é falha inesperada.
        if (txErr && txErr.codigo) {
          return res.status(txErr.codigo).json({ erro: txErr.erro });
        }
        console.error("Erro na transação de reserva:", txErr);
        return res.status(500).json({ erro: "Erro ao reservar o presente. Tente novamente." });
      }

      // ── Cria transação PENDENTE no Firestore (registro/auditoria) ───
      const transacaoRef = await admin
        .firestore()
        .collection("transacoes")
        .add({
          produto_id: produtoId,
          convidado_nome: nomeConvidado,
          status: "pendente",
          eh_cota: ehCota,
          cotas_numeros: ehCota ? cotasNumeros : null,
          valor_centavos: valorCentavosCobranca,
          // preco_centavos recebe o valor JÁ CALCULADO (cota parcial ou produto inteiro).
          // O Make lê este campo para gerar o link do Infinitepay — assim ele não
          // precisa saber se é cota ou não, só lê daqui e cobra o valor certo.
          preco_centavos: valorCentavosCobranca.toString(),
          ip: ip,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          pendente_expira_em: admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
        });

      // ── Valida que MAKE_URL está configurada ─────────────────────
      const makeUrl = process.env.MAKE_URL;
      if (!makeUrl) {
        console.error("⚠️ MAKE_URL não configurada em variáveis de ambiente");
        await reverterReserva();
        await transacaoRef.update({ status: "falhou", motivo_falha: "make_url_ausente" });
        return res.status(500).json({
          erro: "Serviço de pagamento temporariamente indisponível",
        });
      }

      // ── Chama Make.com com o valor JÁ CALCULADO da cota (ou cheio) ──
      // Qualquer falha aqui (rede, timeout, resposta sem url) precisa desfazer
      // a reserva feita lá em cima — senão o produto/cota fica "preso" mesmo
      // sem nenhum pagamento de fato iniciado.
      let data;
      try {
        const response = await fetch(makeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId,
            nomeConvidado,
            transacaoId: transacaoRef.id,
            valorCentavos: valorCentavosCobranca, // valor real a cobrar — cota ou total
            tituloProduto,
            ehCota,
            cotasQuantidade: ehCota ? cotasNumeros.length : null,
          }),
          timeout: 10000,
        });
        data = await response.json();
      } catch (fetchErr) {
        console.error("Erro de rede/timeout ao chamar Make.com:", fetchErr.message);
        await reverterReserva();
        await transacaoRef.update({ status: "falhou", motivo_falha: "erro_rede_make" });
        return res.status(500).json({
          erro: "Erro ao conectar com o serviço de pagamento. Tente novamente.",
        });
      }

      if (!data || !data.url) {
        console.error("Make.com retornou erro:", data);
        await reverterReserva();
        await transacaoRef.update({ status: "falhou", motivo_falha: "make_sem_url" });
        return res.status(500).json({
          erro: "Erro ao gerar link de pagamento",
        });
      }

      // ── Log de auditoria ──────────────────────────────────────────
      await admin.firestore().collection("audit_logs").add({
        acao: ehCota ? "compra_cota_iniciada" : "compra_iniciada",
        produto_id: produtoId,
        convidado_nome: nomeConvidado.substring(0, 50),
        transacao_id: transacaoRef.id,
        cotas_numeros: ehCota ? cotasNumeros : null,
        valor_centavos: valorCentavosCobranca,
        ip: ip,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({
        url: data.url,
        transacaoId: transacaoRef.id,
      });

    } catch (err) {
      console.error("Erro em finalizarCompra:", err.message);
      return res.status(500).json({ erro: "Erro ao processar compra" });
    }
  }
);

/*
════════════════════════════════════════════════════════════
O QUE MUDOU NESSA VERSÃO (suporte a cotas):

✅ Transação atômica (runTransaction):
  - Lê e reserva o produto/cotas numa única operação indivisível
  - Se dois convidados confirmarem a mesma cota ao mesmo tempo,
    o Firestore garante que só um consegue — o outro recebe erro 409
    pedindo para atualizar a página e tentar de novo

✅ Validação de payload de cotas:
  - cotasNumeros precisa ser array de inteiros positivos, sem duplicata
  - cotasEscolhidas precisa bater com o tamanho do array (evita manipulação)
  - números fora do intervalo do produto são rejeitados

✅ Cálculo de valor sempre no servidor:
  - porCotaCentavos = preco_centavos / cotas_total (nunca confia no front)
  - valor final = porCotaCentavos × quantidade de cotas escolhidas

✅ Atualização do Firestore:
  - cotas_ocupadas ganha os novos números (mesclados com os existentes)
  - cotas_disponiveis recalculado
  - se todas as cotas forem preenchidas, disponivel vira false automaticamente

✅ Make.com agora recebe:
  - valorCentavos (já calculado — cota ou produto inteiro)
  - ehCota e cotasQuantidade, para personalizar a mensagem/descrição do pagamento

✅ Auditoria expandida:
  - audit_logs e transacoes agora guardam cotas_numeros e valor_centavos

⚠️ PENDENTE (próximo passo sugerido):
  - Job de expiração: hoje pendente_expira_em é gravado, mas nada ainda libera
    automaticamente as cotas/produto se o pagamento não for concluído em 15 min.
    Isso precisa de uma function agendada (scheduled function) ou de uma checagem
    no início de finalizarCompra que primeiro libera reservas expiradas antes de
    aplicar uma nova.

════════════════════════════════════════════════════════════
COMO USAR:

1. Copie TODO este código
2. Abra Google Cloud Console → Cloud Functions (ou seu terminal com firebase deploy)
3. Substitua TODO o código do index.js por este
4. Deploy
════════════════════════════════════════════════════════════
*/
