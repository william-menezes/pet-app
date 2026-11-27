import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y } from './support/ui';
import { PIN_FIXTURE, mockAdminBackend, newAdminState, type AdminState } from './support/mock-admin';
import { persistSession } from './support/mock-tutor';

/**
 * Telas do admin da spec 003 (T078 a T082), com o backend SIMULADO (ver `support/mock-admin.ts`), nas três larguras.
 * O admin é SEMPRE claro. Nenhuma captura mostra PIN: a caixa do PIN novo é conferida pelo DOM, sem foto.
 * `SHOTS_DIR=<pasta>` grava as capturas.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function setup(page: Page, over: Partial<AdminState> = {}): Promise<AdminState> {
  const state = await mockAdminBackend(page, newAdminState(over));
  await persistSession(page);
  return state;
}

async function checkScreen(page: Page): Promise<void> {
  await page.waitForTimeout(400);
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11y(page);
}

for (const size of SIZES) {
  test.describe(`admin em ${size.width}px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('lotes: contadores, aviso do pacote e criar lote com download', async ({ page }) => {
      const state = await setup(page);
      await page.goto('/admin');
      await expect(page.locator(tid('admin-batches-counters'))).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(tid('admin-batches-notice'))).toContainText('uma vez só');
      // O admin é sempre claro, mesmo com o sistema no escuro.
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
      await checkScreen(page);
      await shot(page, `admin-lotes-${size.name}`);

      await page.locator(tid('admin-batches-create')).click();
      await page.locator(tid('admin-batches-quantity')).fill('10');
      await page.locator(tid('admin-batches-notes')).fill('Segunda leva');
      await page.waitForTimeout(300);
      await checkScreen(page);
      await shot(page, `admin-lotes-criar-${size.name}`);
      await page.locator(tid('admin-batches-continue')).click();
      await expect(page.locator(tid('admin-batches-panel'))).toContainText('Gerar 10 códigos?');
      expect(state.batchBodies).toEqual([]);
      await shot(page, `admin-lotes-confirmar-${size.name}`);

      const download = page.waitForEvent('download');
      await page.locator(tid('admin-batches-generate')).click();
      // O id do lote não é legível (cabeçalho não exposto): o pacote é salvo mesmo assim, com nome de reserva.
      expect((await download).suggestedFilename()).toBe('lote-novo.zip');
      await expect(page.locator(tid('admin-batches-done'))).toContainText('O arquivo foi baixado');
      expect(state.batchBodies).toEqual([{ quantity: 10, notes: 'Segunda leva' }]);
      await shot(page, `admin-lotes-pronto-${size.name}`);
    });

    test('lotes: exportar códigos baixa o CSV sem PIN', async ({ page }) => {
      await setup(page);
      await page.goto('/admin');
      await expect(page.locator(tid('admin-batches-counters'))).toBeVisible({ timeout: 15_000 });
      const download = page.waitForEvent('download');
      await page.locator(`${tid('admin-batch-export')}:visible`).first().click();
      const file = await download;
      expect(file.suggestedFilename()).toBe('lote-900-codigos.csv');
    });

    test('códigos: lista, filtro, busca e abre o detalhe', async ({ page }) => {
      const state = await setup(page);
      await page.goto('/admin/codigos');
      await expect(page.locator(`${tid('admin-code-link')}:visible`).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(tid('admin-codes-reprint-note'))).toContainText('geração das etiquetas');
      await checkScreen(page);
      await shot(page, `admin-codigos-${size.name}`);

      await page.getByRole('button', { name: 'Ativos' }).click();
      await expect.poll(() => state.calls['admin_list_codes']?.at(-1)?.['p_status']).toBe('assigned');
      await page.getByRole('button', { name: 'Todos' }).click();
      await page.locator(tid('admin-codes-search')).fill('paçoca');
      await page.locator(tid('admin-codes-search-submit')).click();
      await expect.poll(() => state.calls['admin_list_codes']?.at(-1)?.['p_search']).toBe('paçoca');

      await page.locator(`${tid('admin-code-link')}:visible`).first().click();
      await expect(page).toHaveURL(/\/admin\/codigos\/7K3M-Q9XA-C$/);
      await expect(page.locator(tid('admin-code-title'))).toContainText('7K3M-Q9XA-C');
    });

    test('detalhe: vínculo, scans, ações; bloquear com confirmação', async ({ page }) => {
      const state = await setup(page);
      await page.goto('/admin/codigos/7K3M-Q9XA-C');
      await expect(page.locator(tid('admin-code-assignment'))).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(tid('admin-code-pin-state'))).toContainText('Usado em');
      await checkScreen(page);
      await shot(page, `admin-codigo-${size.name}`);

      await page.locator(tid('admin-action-block')).click();
      await expect(page.locator(tid('admin-confirm-title'))).toContainText('Bloquear 7K3M-Q9XA-C?');
      await page.waitForTimeout(300);
      await expectNoSeriousA11y(page);
      await shot(page, `admin-codigo-confirmar-${size.name}`);
      await page.locator(tid('admin-confirm-ok')).click();
      await expect.poll(() => state.calls['admin_set_status']?.at(-1)).toEqual({ p_code: '7K3MQ9XAC', p_status: 'blocked', p_note: null });
    });

    test('detalhe: reemitir o PIN mostra o PIN uma vez e some ao concluir', async ({ page }) => {
      const state = await setup(page);
      state.detail = { ...state.detail, status: 'available', assignment: null };
      await page.goto('/admin/codigos/7K3M-Q9XA-C');
      await expect(page.locator(tid('admin-action-reissue'))).toBeEnabled({ timeout: 15_000 });
      await page.locator(tid('admin-action-reissue')).scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.locator(tid('admin-action-reissue')).click();
      await page.locator(tid('admin-confirm-ok')).click();
      await expect(page.locator(tid('admin-pin-reveal-pin'))).toHaveText(PIN_FIXTURE);
      // O PIN aparece uma vez só: a caixa tem de estar à vista (e com o foco no título), mesmo que a tela estivesse rolada.
      await expect(page.locator(tid('admin-pin-reveal-pin'))).toBeInViewport();
      await expect(page.locator('#admin-pin-reveal-title')).toBeFocused();
      await expect(page.locator(tid('admin-pin-reveal'))).toContainText('não aparece de novo');
      // O aviso (toast) do sonner é uma <ol> com filhos que não são <li>: o axe reprova enquanto ele estiver na tela.
      await expect(page.locator('ngx-sonner-toast')).toHaveCount(0, { timeout: 15_000 });
      await checkScreen(page);
      // PIN fora do armazenamento do navegador e da URL.
      const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);
      expect(stored).not.toContain(PIN_FIXTURE);
      await page.locator(tid('admin-pin-reveal-done')).click();
      await expect(page.locator(tid('admin-pin-reveal'))).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText(PIN_FIXTURE);
    });

    test('fila: três seções e filtro', async ({ page }) => {
      await setup(page);
      await page.goto('/admin/fila');
      await expect(page.locator(tid('admin-queue-scans'))).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(tid('admin-queue-replacements'))).toBeVisible();
      await expect(page.locator(tid('admin-queue-locked'))).toBeVisible();
      await checkScreen(page);
      await shot(page, `admin-fila-${size.name}`);
      await page.getByRole('button', { name: /^Travadas/ }).click();
      await expect(page.locator(tid('admin-queue-scans'))).toHaveCount(0);
      await expect(page.locator(tid('admin-queue-locked'))).toBeVisible();
    });

    test('auditoria: lista, filtro por tipo e nota sem dados pessoais', async ({ page }) => {
      await setup(page);
      await page.goto('/admin/auditoria');
      await expect(page.locator(`${tid('admin-audit-row')}`).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(tid('admin-audit-note'))).toContainText('nunca guarda PIN');
      await checkScreen(page);
      await shot(page, `admin-auditoria-${size.name}`);
      await page.getByRole('button', { name: 'PIN', exact: true }).click();
      await expect(page.locator(tid('admin-audit-row'))).toHaveCount(1);
    });
  });
}
