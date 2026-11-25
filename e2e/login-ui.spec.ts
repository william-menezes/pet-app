import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y, rgb } from './support/ui';

/**
 * Login com a identidade nova (spec 002, US2): elementos, três larguras, cores, alvos de toque,
 * foco, tema sempre claro e erros de campo. Roda contra `npm start` (o Playwright sobe sozinho).
 */
const LOGIN = '/auth/login';
const LIME = 'rgb(132, 195, 46)';
const INK = 'rgb(19, 32, 30)';
const BACKGROUND = 'rgb(247, 248, 248)';

const TESTIDS = [
  'login-email',
  'login-password',
  'login-password-toggle',
  'login-remember',
  'login-submit',
  'login-google',
  'login-forgot-link',
  'login-signup-link',
] as const;

const tid = (id: string) => `[data-testid="${id}"]`;

async function openLogin(page: Page): Promise<void> {
  await page.goto(LOGIN);
  await expect(page.locator(tid('login-submit'))).toBeVisible();
  // Em dev o CSS chega depois do primeiro desenho: espera o tema valer antes de ler estilos.
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(247, 248, 248)');
}

for (const [name, size] of Object.entries(WIDTHS)) {
  test.describe(`login (${name})`, () => {
    test.use({ viewport: size });

    test('todos os elementos aparecem, sem rolagem horizontal e sem violação grave de acessibilidade', async ({ page }) => {
      await openLogin(page);
      for (const id of TESTIDS) {
        await expect(page.locator(tid(id)), id).toBeVisible();
      }
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
    });
  });
}

for (const [name, size] of [
  ['phone', WIDTHS.phone],
  ['tablet', WIDTHS.tablet],
] as const) {
  test(`login (${name}): wordmark na coluna e nenhum painel de marca`, async ({ page }) => {
    await page.setViewportSize(size);
    await openLogin(page);
    await expect(page.locator('img[alt="Faro"]:visible')).toHaveCount(1);
    await expect(page.locator('app-brand-panel')).toBeHidden();
  });
}

test.describe('login (desktop)', () => {
  test.use({ viewport: WIDTHS.desktop });

  test('o painel de marca ocupa a metade esquerda e é o único wordmark', async ({ page }) => {
    await openLogin(page);
    const panel = page.locator('app-brand-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(700);
    expect(box?.width ?? 0).toBeLessThanOrEqual(740);
    await expect(panel).toContainText('para casa.');
    await expect(page.locator('img[alt="Faro"]:visible')).toHaveCount(1);
  });
});

test.describe('login (cores, toque e foco)', () => {
  test.use({ viewport: WIDTHS.phone });

  test('o botão Entrar é lima e o do Google é branco', async ({ page }) => {
    await openLogin(page);
    await expect.poll(() => rgb(page, tid('login-submit'), 'backgroundColor')).toBe(LIME);
    await expect.poll(() => rgb(page, tid('login-google'), 'backgroundColor')).toBe('rgb(255, 255, 255)');
  });

  test('controles, links e rótulo têm pelo menos 44px de altura', async ({ page }) => {
    await openLogin(page);
    for (const id of [
      'login-submit',
      'login-google',
      'login-password-toggle',
      'login-email',
      'login-password',
      'login-forgot-link',
      'login-signup-link',
      'login-remember',
    ]) {
      const box = await page.locator(tid(id)).boundingBox();
      expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44);
    }
  });

  test('o foco por teclado no e-mail é um anel de tinta', async ({ page }) => {
    await openLogin(page);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const onEmail = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') === 'login-email',
      );
      if (onEmail) break;
    }
    // O contorno pode estar no meio de uma transição logo após o foco: lê com poll.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          return { testid: el.getAttribute('data-testid'), color: getComputedStyle(el).outlineColor };
        }),
      )
      .toEqual({ testid: 'login-email', color: INK });
  });

  test('o formulário vazio mostra o erro do e-mail e o da senha', async ({ page }) => {
    await openLogin(page);
    await page.locator(tid('login-submit')).click();
    await expect(page.locator(tid('login-email-error'))).toBeVisible();
    await expect(page.locator(tid('login-password-error'))).toBeVisible();
  });

  test('nenhuma requisição vai para as fontes do Google', async ({ page }) => {
    const hosts: string[] = [];
    page.on('request', (request) => hosts.push(new URL(request.url()).hostname));
    await openLogin(page);
    await page.evaluate(() => document.fonts.ready);
    expect(hosts.filter((h) => h === 'fonts.googleapis.com' || h === 'fonts.gstatic.com')).toEqual([]);
  });
});

test.describe('login (tema escuro nunca vale aqui)', () => {
  test.use({ viewport: WIDTHS.phone, colorScheme: 'dark' });

  test('o fundo continua claro e não há elemento com a classe dark', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('faro.theme', 'dark'));
    await openLogin(page);
    await expect.poll(() => rgb(page, 'body', 'backgroundColor')).toBe(BACKGROUND);
    await expect(page.locator('.dark')).toHaveCount(0);
  });
});
