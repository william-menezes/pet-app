import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y, rgb } from './support/ui';

/**
 * Identidade visual (spec 002, US1, cenários 1 a 8) conferida em `/dev/ui/components`,
 * no celular e no desktop. A galeria só existe em build de desenvolvimento (`npm start`).
 */
const PAGE = '/dev/ui/components';

const LIME = 'rgb(132, 195, 46)';
const INK = 'rgb(19, 32, 30)';

async function openGallery(page: Page): Promise<void> {
  await page.goto(PAGE);
  await expect(page.locator('[data-testid="dev-gallery-components"]')).toBeVisible();
  // Em dev o CSS chega depois do primeiro desenho: espera o tema valer antes de ler estilos.
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(247, 248, 248)');
}

for (const [name, size] of [
  ['phone', WIDTHS.phone],
  ['desktop', WIDTHS.desktop],
] as const) {
  test.describe(`identidade visual (${name})`, () => {
    test.use({ viewport: size });

    test('o botão default é lima com texto de tinta', async ({ page }) => {
      await openGallery(page);
      const button = '[data-testid="dev-button-default"]';
      await expect.poll(() => rgb(page, button, 'backgroundColor')).toBe(LIME);
      await expect.poll(() => rgb(page, button, 'color')).toBe(INK);
    });

    test('chip escolhido e caixa marcada usam a tinta, nunca o lima', async ({ page }) => {
      await openGallery(page);
      await expect.poll(() => rgb(page, '[data-testid="dev-chip-on"] button', 'backgroundColor')).toBe(INK);
      await expect.poll(() => rgb(page, '[data-testid="dev-checkbox-on"] input[type="checkbox"]', 'backgroundColor')).toBe(INK);
    });

    test('o foco por teclado é um anel de 2px em tinta', async ({ page }) => {
      await openGallery(page);
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const style = getComputedStyle(el);
        return {
          tag: el.tagName,
          color: style.outlineColor,
          width: style.outlineWidth,
          style: style.outlineStyle,
        };
      });
      expect(focus.tag).toBe('BUTTON');
      expect(focus.color).toBe(INK);
      expect(focus.width).toBe('2px');
      expect(focus.style).toBe('solid');
    });

    test('todo alvo de toque tem pelo menos 44px de altura', async ({ page }) => {
      await openGallery(page);
      const tooSmall = await page.evaluate(() => {
        const found: string[] = [];
        const selector = 'button, a, input, [role="switch"]';
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0 || getComputedStyle(el).visibility === 'hidden') {
            continue;
          }
          // Área de toque estendida por pseudo-elemento (`before`/`after` absolutos).
          let height = box.height;
          for (const pseudo of ['::before', '::after']) {
            const style = getComputedStyle(el, pseudo);
            if (style.position === 'absolute' && style.content !== 'none') {
              height = Math.max(height, parseFloat(style.height) || 0);
            }
          }
          if (height < 43.5) {
            found.push(`${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.className.slice(0, 40)}] ${height}px`);
          }
        }
        return found;
      });
      expect(tooSmall, tooSmall.join('\n')).toEqual([]);
    });

    test('títulos em Outfit, texto em Inter, fontes carregadas do próprio domínio', async ({ page }) => {
      const external: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
          external.push(url);
        }
      });
      await openGallery(page);
      const families = await page.evaluate(() => ({
        h1: getComputedStyle(document.querySelector('h1') as Element).fontFamily,
        body: getComputedStyle(document.body).fontFamily,
      }));
      expect(families.h1.replace(/["']/g, '')).toMatch(/^Outfit/);
      expect(families.body.replace(/["']/g, '')).toMatch(/^Inter/);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.fonts.check('700 40px Outfit'))).toBe(true);
      expect(await page.evaluate(() => document.fonts.check('400 16px Inter'))).toBe(true);
      expect(external).toEqual([]);
    });

    test('sem violações graves de acessibilidade e sem rolagem horizontal', async ({ page }) => {
      await openGallery(page);
      await expectNoSeriousA11y(page);
      await expectNoHorizontalScroll(page);
    });

    test('com movimento reduzido o spinner quase não anima', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openGallery(page);
      const spinner = page.locator('[data-testid="dev-spinner"] ng-icon').first();
      await expect(spinner).toBeVisible();
      await expect
        .poll(async () => parseFloat(await spinner.evaluate((el) => getComputedStyle(el).animationDuration)))
        .toBeLessThan(0.1);
    });
  });
}

test('sem rolagem horizontal em 320px', async ({ page }) => {
  await page.setViewportSize(WIDTHS.narrow);
  await openGallery(page);
  await expectNoHorizontalScroll(page);
});
