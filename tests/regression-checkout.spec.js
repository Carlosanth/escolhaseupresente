/**
 * regression-checkout.spec.js
 * ------------------------------------------------------------------
 * Teste de regressão do fluxo crítico: convidado abre a lista, escolhe
 * um presente (ou uma cota) e confirma. Requer o pacote @playwright/test:
 *
 *   npm install -D @playwright/test
 *   npx playwright test tests/regression-checkout.spec.js
 *
 * Este arquivo é um TEMPLATE — os seletores (data-testid) precisam ser
 * conferidos/adicionados no HTML real (lista.html) porque o repo hoje
 * não tem atributos de teste. Rodar contra um projeto Firebase de
 * staging, nunca contra o de produção.
 * ------------------------------------------------------------------
 */
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.STAGING_URL || 'http://localhost:8080';
// ID de uma lista de presentes de teste, criada previamente no ambiente de staging.
const LISTA_TESTE_ID = process.env.LISTA_TESTE_ID || 'lista-de-teste';

test.describe('Fluxo crítico: escolher e reservar presente', () => {
  test('convidado consegue abrir a lista e ver os produtos', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (err) => erros.push(err));

    await page.goto(`${BASE_URL}/lista.html?id=${LISTA_TESTE_ID}`);
    await expect(page.locator('[data-testid="produto-card"]').first()).toBeVisible({ timeout: 10000 });

    expect(erros, 'não deve haver erros JS não tratados na página').toHaveLength(0);
  });

  test('convidado consegue reservar um presente sem cota', async ({ page }) => {
    await page.goto(`${BASE_URL}/lista.html?id=${LISTA_TESTE_ID}`);

    const primeiroCard = page.locator('[data-testid="produto-card"]').first();
    await primeiroCard.locator('[data-testid="btn-presentear"]').click();

    await page.fill('[data-testid="input-nome-convidado"]', 'Teste Regressão');
    await page.click('[data-testid="btn-confirmar-presente"]');

    await expect(page.locator('[data-testid="confirmacao-sucesso"]')).toBeVisible({ timeout: 10000 });
  });

  test('reservar uma cota decrementa as cotas disponíveis', async ({ page }) => {
    await page.goto(`${BASE_URL}/lista.html?id=${LISTA_TESTE_ID}`);

    const produtoComCota = page.locator('[data-testid="produto-card"][data-tem-cota="true"]').first();
    const cotasAntes = await produtoComCota.locator('[data-testid="cotas-disponiveis"]').innerText();

    await produtoComCota.locator('[data-testid="btn-escolher-cota"]').click();
    await page.click('[data-testid="btn-confirmar-cota"]');
    await expect(page.locator('[data-testid="confirmacao-sucesso"]')).toBeVisible({ timeout: 10000 });

    await page.reload();
    const cotasDepois = await page
      .locator('[data-testid="produto-card"][data-tem-cota="true"]')
      .first()
      .locator('[data-testid="cotas-disponiveis"]')
      .innerText();

    expect(Number(cotasDepois)).toBeLessThan(Number(cotasAntes));
  });

  test('health check reporta status healthy', async ({ page }) => {
    await page.goto(`${BASE_URL}/health.html`);
    await expect(page.locator('#status')).toHaveText('healthy', { timeout: 15000 });
  });
});
