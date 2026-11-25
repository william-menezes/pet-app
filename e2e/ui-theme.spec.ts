import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoSeriousA11y, rgb } from './support/ui';

/**
 * Tema escuro (spec 002, US4, cenários 1 a 8). Vale só na casca do tutor; o resto é sempre claro.
 * A galeria só existe em build de desenvolvimento (o Playwright sobe `ng serve`).
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const BODY_LIGHT = 'rgb(247, 248, 248)';
const BG_DARK = 'rgb(11, 15, 42)';
const POPOVER_DARK = 'rgb(22, 28, 74)';
const FOREGROUND_DARK = 'rgb(243, 245, 252)';
const LIME = 'rgb(132, 195, 46)';
const HOST = 'app-tutor-shell';
const INNER = `${HOST} > div`;

/** A galeria é renderizada no servidor em dev (sempre clara); o tema vale depois da hidratação. */
const hydration = (page: Page) =>
  page.waitForEvent('console', { predicate: (m) => m.text().includes('Angular hydrated'), timeout: 20_000 }).catch(() => null);

async function open(page: Page, path: string, testId: string): Promise<void> {
  const hydrated = hydration(page);
  await page.goto(path);
  await expect(page.locator(tid(testId))).toBeVisible();
  await hydrated;
  // Em dev o CSS chega depois do primeiro desenho: espera o tema valer antes de medir.
  await page.waitForFunction((light) => getComputedStyle(document.body).backgroundColor === light, BODY_LIGHT);
}

async function storeTheme(page: Page, value: string): Promise<void> {
  await page.addInitScript((v) => window.localStorage.setItem('faro.theme', v), value);
}

const hasDark = (page: Page) => page.locator(HOST).evaluate((el) => el.classList.contains('dark'));

test.describe('tema escuro do app do tutor', () => {
  test('1. preferência "dark": só o hospedeiro é escuro, html e body não', async ({ page }) => {
    await storeTheme(page, 'dark');
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    await expect.poll(() => hasDark(page)).toBe(true);
    await expect.poll(() => rgb(page, INNER, 'backgroundColor')).toBe(BG_DARK);
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
    expect(await page.evaluate(() => document.body.classList.contains('dark'))).toBe(false);
    await expect.poll(() => rgb(page, 'body', 'backgroundColor')).toBe(BODY_LIGHT);
  });

  test('2. sem preferência guardada, segue o sistema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    await expect.poll(() => hasDark(page)).toBe(true);
    await page.emulateMedia({ colorScheme: 'light' });
    const hydrated = hydration(page);
    await page.reload();
    await expect(page.locator(tid('dev-gallery-tutor'))).toBeVisible();
    await hydrated;
    expect(await hasDark(page)).toBe(false);
  });

  test('3. "light" guardado vale mesmo com o sistema escuro', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await storeTheme(page, 'light');
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    expect(await hasDark(page)).toBe(false);
  });

  test('4. com "system", mudar o sistema escurece sem recarregar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    expect(await hasDark(page)).toBe(false);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => hasDark(page)).toBe(true);
  });

  test('5. escolher "Escuro" no seletor da galeria sobrevive ao recarregar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    await page.locator(`${tid('dev-gallery-theme-switch')} button`, { hasText: 'Escuro' }).click();
    await expect.poll(() => hasDark(page)).toBe(true);
    const hydrated = hydration(page);
    await page.reload();
    await expect(page.locator(tid('dev-gallery-tutor'))).toBeVisible();
    await hydrated;
    await expect.poll(() => hasDark(page)).toBe(true);
  });

  test('6. com preferência escura e sistema escuro, o resto do site nunca tem .dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await storeTheme(page, 'dark');
    for (const path of ['/', '/auth/login', '/dev/ui/flow', '/dev/ui/admin', '/dev/ui/public', '/dev/ui/components']) {
      await page.goto(path);
      await page.waitForFunction((light) => getComputedStyle(document.body).backgroundColor === light, BODY_LIGHT);
      expect(await page.evaluate(() => document.querySelectorAll('.dark').length), path).toBe(0);
    }
  });

  test('7. o diálogo aberto no escuro sai escuro e some com a casca', async ({ page }) => {
    await storeTheme(page, 'dark');
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    await page.locator(tid('dev-gallery-tutor-open-dialog')).click();
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible();
    await expect.poll(() => rgb(page, '[role="alertdialog"]', 'backgroundColor')).toBe(POPOVER_DARK);
    await page.locator(tid('z-alert-cancel-button')).click();
    await expect(dialog).toBeHidden();
    // navegação interna (sem recarregar): a casca é destruída e leva a classe do contêiner de overlays
    await page.evaluate(() => {
      history.pushState({}, '', '/dev/ui/flow');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.locator(tid('dev-gallery-flow'))).toBeVisible();
    expect(await page.evaluate(() => document.querySelectorAll('.dark').length)).toBe(0);
  });

  test('8. no escuro, o item ativo é claro e o botão principal continua lima', async ({ page }) => {
    await page.setViewportSize(WIDTHS.desktop);
    await storeTheme(page, 'dark');
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    const active = `${tid('tutor-shell-sidebar')} a[aria-current="page"]`;
    await expect.poll(() => rgb(page, active, 'backgroundColor')).toBe(FOREGROUND_DARK);
    await expect.poll(() => rgb(page, tid('dev-gallery-tutor-primary'), 'backgroundColor')).toBe(LIME);
  });

  for (const [name, size] of [
    ['phone', WIDTHS.phone],
    ['desktop', WIDTHS.desktop],
  ] as const) {
    test(`9. sem violações graves de acessibilidade no escuro (${name})`, async ({ page }) => {
      await page.setViewportSize(size);
      await storeTheme(page, 'dark');
      await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
      await expect.poll(() => rgb(page, INNER, 'backgroundColor')).toBe(BG_DARK);
      await expectNoSeriousA11y(page);
    });
  }
});
