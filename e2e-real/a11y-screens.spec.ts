import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, expectNoSeriousA11y, WIDTHS } from '../e2e/support/ui';
import { loginViaUi, tid } from './support/flows';
import { SEED } from './support/stack';
import { activateViaApi, createPet, newTutor, takeTag } from './support/tags';

/**
 * T093 (spec 003): axe (WCAG 2.0/2.1 A e AA, nenhuma violacao grave) e ausencia de rolagem horizontal em todas as telas da
 * spec, nas tres larguras, com DADOS REAIS (banco local). O tema escuro vale so na casca do tutor; fluxos (ativar, novo pet,
 * vincular, editar), paginas publicas, conta e admin sao sempre claros (e o teste confere que o escuro NAO vaza para eles).
 * Os estados de erro, vazio e carga de cada tela estao nos e2e com backend simulado (`e2e/*-ui.spec.ts`).
 */
const SIZES = [WIDTHS.phone, WIDTHS.tablet, WIDTHS.desktop];

async function settle(page: Page) {
  // os chips animam a cor por 150 ms: o axe no meio da transicao mede um contraste que nao existe
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(450);
  await expect(page.locator('ngx-sonner-toast')).toHaveCount(0);
}

async function check(page: Page, path: string, ready: string, opts: { dark?: boolean; expectDark: boolean }) {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto(path);
    await expect(page.locator(ready).first(), `${path} a ${size.width}px`).toBeVisible({ timeout: 20_000 });
    await settle(page);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark') || !!document.querySelector('.dark'));
    expect(isDark, `${path}: tema escuro ${opts.expectDark ? 'deveria' : 'nao deve'} valer`).toBe(opts.expectDark);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
  }
}

for (const dark of [false, true]) {
  test(`telas do tutor em dados reais, 3 larguras, tema ${dark ? 'escuro' : 'claro'}`, async ({ page, browser }) => {
    test.setTimeout(420_000);
    const t = await newTutor();
    const petA = await createPet(t, 'Bolota');
    const petB = await createPet(t, 'Mel', 'cat');
    const tag = takeTag();
    await activateViaApi(t, tag, petA, { whatsapp: true });
    // um scan para o historico
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': `198.51.100.${dark ? 41 : 42}` } });
    const stranger = await ctx.newPage();
    await stranger.goto(`/${tag.code}`);
    await expect(stranger.locator(tid('public-rescue-title'))).toBeVisible();
    await ctx.close();

    if (dark) await page.addInitScript(() => localStorage.setItem('faro.theme', 'dark'));
    await loginViaUi(page, t.email, t.password);
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });

    // casca do tutor: escuro vale quando a preferencia esta no escuro
    const shell = { dark, expectDark: dark };
    await check(page, '/app', tid('pets-home'), shell);
    await check(page, '/app/pets', 'main', shell);
    await check(page, `/app/pets/${petA}`, tid('pet-page'), shell);
    await check(page, `/app/pets/${petB}`, tid('pet-page'), shell);
    await check(page, `/app/pets/${petA}/visibilidade`, tid('visibility'), shell);
    await check(page, `/app/pets/${petA}/modo-perdido`, tid('lost-mode'), shell);
    await check(page, `/app/pets/${petA}/tag`, tid('manage-tag'), shell);
    await check(page, '/app/scans', tid('scans'), shell);
    await check(page, '/app/conta', 'main', shell);

    // fluxos e telas claras: o escuro nao vaza para elas
    const light = { dark, expectDark: false };
    await check(page, `/app/pets/${petA}/editar`, tid('new-pet-name'), light);
    await check(page, `/vincular/${petB}`, tid('link-code'), light);
    await check(page, '/novo-pet', tid('new-pet-name'), light);
    const free = takeTag();
    await check(page, `/ativar/${free.code}`, tid('activation-pet-list'), light);
  });
}

test('telas publicas e do admin: 3 larguras, sempre claras', async ({ page }) => {
  test.setTimeout(300_000);
  const light = { expectDark: false };
  // com a preferencia escura no navegador, as publicas e o admin continuam claros
  await page.addInitScript(() => localStorage.setItem('faro.theme', 'dark'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await check(page, `/${'7K3MQ9XAC'}`, tid('public-rescue-title'), light);
  await check(page, '/5P8NMRXYW', tid('public-not-activated-code'), light);
  await check(page, '/5QQWQ2MM4', tid('public-notice-title'), light);
  await check(page, '/auth/login', 'main', light);

  await loginViaUi(page, SEED.admin.email, SEED.password);
  await expect(page).toHaveURL(/\/(admin|app)/, { timeout: 30_000 });
  await check(page, '/admin', tid('admin-batches-counters'), light);
  await check(page, '/admin/codigos', tid('admin-codes-search'), light);
  await check(page, '/admin/codigos/7K3M-Q9XA-C', tid('admin-code-title'), light);
  await check(page, '/admin/fila', tid('admin-queue-scans'), light);
  await check(page, '/admin/auditoria', tid('admin-audit-row'), light);
});

// DEF-003-03 (corrigido): o aviso (toast) do ngx-sonner era uma <ol> cujos filhos nao sao <li>: o axe reprovava (`list`, grave) enquanto o
// aviso esta na tela. Os e2e simulados esperam o aviso sair antes de rodar o axe; aqui ele e medido COM o aviso visivel.
test('DEF-003-03: axe sem violacao grave com um aviso (toast) na tela', async ({ page }) => {
  const tag = takeTag();
  await loginViaUi(page, SEED.admin.email, SEED.password);
  await expect(page).toHaveURL(/\/(admin|app)/, { timeout: 30_000 });
  await page.goto(`/admin/codigos/${tag.display}`);
  await expect(page.locator(tid('admin-action-reissue'))).toBeEnabled({ timeout: 20_000 });
  await page.locator(tid('admin-action-reissue')).click();
  await page.locator(tid('admin-confirm-ok')).click();
  await expect(page.locator(tid('admin-pin-reveal-pin'))).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('ngx-sonner-toast').first()).toBeAttached({ timeout: 5_000 });
  await expectNoSeriousA11y(page);
});
