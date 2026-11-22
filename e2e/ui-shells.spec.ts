import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y, rgb } from './support/ui';

/**
 * Cascas (spec 002, US3, cenários 1 a 10), conferidas nas páginas de `/dev/ui/...`.
 * A galeria só existe em build de desenvolvimento (o Playwright sobe `ng serve`).
 */
const INK = 'rgb(19, 32, 30)';

const PAGES = [
  ['/dev/ui/tutor', 'dev-gallery-tutor'],
  ['/dev/ui/tutor/inner', 'dev-gallery-tutor-inner'],
  ['/dev/ui/flow', 'dev-gallery-flow'],
  ['/dev/ui/admin', 'dev-gallery-admin'],
  ['/dev/ui/public', 'dev-gallery-public'],
  ['/dev/ui/public/photo', 'dev-gallery-public-photo'],
] as const;

const tid = (id: string) => `[data-testid="${id}"]`;

async function open(page: Page, path: string, testId: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator(tid(testId))).toBeVisible();
  // Em dev o CSS chega depois do primeiro desenho: espera o tema valer antes de medir.
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(247, 248, 248)');
}

/** Com 16 ou mais testes em paralelo o servidor de desenvolvimento demora para entregar a página. */
const SLOW_DEV = 20_000;

async function box(page: Page, selector: string) {
  // Em dev o servidor pode recarregar a página uma vez e, sob carga, demora a desenhar: tenta de novo
  // até haver uma caixa e devolve a que foi medida (uma leitura só, sem corrida com um recarregamento).
  const locator = page.locator(selector).first();
  let found: { x: number; y: number; width: number; height: number } | null = null;
  await expect
    .poll(
      async () => {
        found = await locator.boundingBox().catch(() => null);
        return found !== null;
      },
      { message: `sem caixa: ${selector}`, timeout: SLOW_DEV },
    )
    .toBe(true);
  return found as unknown as { x: number; y: number; width: number; height: number };
}

/** Mede de novo até a largura chegar ao valor esperado: o layout final só vale depois do CSS e da hidratação. */
async function expectWidth(page: Page, selector: string, expected: number): Promise<void> {
  await expect
    .poll(async () => Math.abs((await box(page, selector)).width - expected), {
      message: `largura de ${selector} deve chegar a ${expected}px (±2)`,
      timeout: SLOW_DEV,
    })
    .toBeLessThanOrEqual(2);
}

test.describe('casca do tutor', () => {
  test('phone: só a barra inferior', async ({ page }) => {
    await page.setViewportSize(WIDTHS.phone);
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    await expect(page.locator(tid('tutor-shell-bottom-nav'))).toBeVisible();
    await expect(page.locator(tid('tutor-shell-rail'))).toBeHidden();
    await expect(page.locator(tid('tutor-shell-sidebar'))).toBeHidden();
  });

  test('tablet: só o trilho', async ({ page }) => {
    await page.setViewportSize(WIDTHS.tablet);
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    await expect(page.locator(tid('tutor-shell-rail'))).toBeVisible();
    await expect(page.locator(tid('tutor-shell-bottom-nav'))).toBeHidden();
    await expect(page.locator(tid('tutor-shell-sidebar'))).toBeHidden();
  });

  test('desktop: só o menu lateral, com a identificação do tutor', async ({ page }) => {
    await page.setViewportSize(WIDTHS.desktop);
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    await expect(page.locator(tid('tutor-shell-sidebar'))).toBeVisible();
    await expect(page.locator(tid('tutor-shell-user'))).toBeVisible();
    await expect(page.locator(tid('tutor-shell-rail'))).toBeHidden();
    await expect(page.locator(tid('tutor-shell-bottom-nav'))).toBeHidden();
  });

  test('tela interna no celular: sem barra inferior e com o botão "Voltar"', async ({ page }) => {
    await page.setViewportSize(WIDTHS.phone);
    await open(page, '/dev/ui/tutor/inner', 'dev-gallery-tutor-inner');
    await expect(page.locator(tid('tutor-shell-bottom-nav'))).toHaveCount(0);
    await expect(page.locator('[aria-label="Voltar"]')).toBeVisible();
  });

  for (const [name, size, nav] of [
    ['phone', WIDTHS.phone, 'tutor-shell-bottom-nav'],
    ['tablet', WIDTHS.tablet, 'tutor-shell-rail'],
    ['desktop', WIDTHS.desktop, 'tutor-shell-sidebar'],
  ] as const) {
    test(`o item atual tem aria-current="page" e a tinta (${name})`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
      const current = `${tid(nav)} ${tid('tutor-nav-inicio')}`;
      await expect(page.locator(current)).toHaveAttribute('aria-current', 'page');
      await expect.poll(() => rgb(page, current, 'backgroundColor')).toBe(INK);
      await expect(page.locator(`${tid(nav)} ${tid('tutor-nav-pets')}`)).not.toHaveAttribute('aria-current', 'page');
    });
  }

  test('o primeiro Tab foca "Pular para o conteúdo" e Enter leva o foco para #conteudo', async ({ page }) => {
    await page.setViewportSize(WIDTHS.desktop);
    // A galeria é renderizada no servidor em dev; antes da hidratação o clique no atalho seguiria o
    // `href` e recarregaria a página (e o servidor de dev ainda pode recarregar a página uma vez).
    const hydrated = page.waitForEvent('console', (message) => message.text().includes('Angular hydrated'));
    await open(page, '/dev/ui/tutor', 'dev-gallery-tutor');
    await hydrated;
    await page.keyboard.press('Tab');
    await expect(page.locator(tid('tutor-shell-skip'))).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('conteudo');
    expect(new URL(page.url()).pathname).toBe('/dev/ui/tutor');
  });
});

test.describe('casca dos fluxos', () => {
  test('phone: as ações ficam na metade de baixo da tela', async ({ page }) => {
    await page.setViewportSize(WIDTHS.phone);
    await open(page, '/dev/ui/flow', 'dev-gallery-flow');
    const footer = await box(page, tid('flow-shell-footer'));
    expect(footer.y + footer.height / 2).toBeGreaterThan(WIDTHS.phone.height / 2);
    await expect(page.locator(tid('flow-shell-brand-panel'))).toBeHidden();
  });

  test('tablet: coluna de 480px', async ({ page }) => {
    await page.setViewportSize(WIDTHS.tablet);
    await open(page, '/dev/ui/flow', 'dev-gallery-flow');
    await expectWidth(page, `${tid('flow-shell')} main >> xpath=..`, 480);
    await expect(page.locator(tid('flow-shell-brand-panel'))).toBeHidden();
  });

  test('desktop: painel de marca de 560px', async ({ page }) => {
    await page.setViewportSize(WIDTHS.desktop);
    await open(page, '/dev/ui/flow', 'dev-gallery-flow');
    await expect(page.locator(tid('flow-shell-brand-panel'))).toBeVisible();
    await expectWidth(page, tid('flow-shell-brand-panel'), 560);
  });
});

test.describe('casca do admin', () => {
  for (const [name, size] of [
    ['phone', WIDTHS.phone],
    ['tablet', WIDTHS.tablet],
  ] as const) {
    test(`${name}: barra no topo e sem menu lateral`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page, '/dev/ui/admin', 'dev-gallery-admin');
      await expect(page.locator(tid('admin-shell-topbar'))).toBeVisible();
      await expect(page.locator(tid('admin-shell-sidebar'))).toBeHidden();
    });
  }

  test('desktop: só o menu lateral', async ({ page }) => {
    await page.setViewportSize(WIDTHS.desktop);
    await open(page, '/dev/ui/admin', 'dev-gallery-admin');
    await expect(page.locator(tid('admin-shell-sidebar'))).toBeVisible();
    await expect(page.locator(tid('admin-shell-topbar'))).toBeHidden();
  });
});

test.describe('páginas públicas', () => {
  test('phone: a faixa fica acima da folha', async ({ page }) => {
    await page.setViewportSize(WIDTHS.phone);
    await open(page, '/dev/ui/public', 'dev-gallery-public');
    const media = await box(page, tid('public-layout-media'));
    const sheet = await box(page, tid('public-layout-sheet'));
    expect(media.y).toBeLessThan(sheet.y);
    expect(media.height).toBeCloseTo(230, 0);
  });

  test('desktop: faixa e folha lado a lado, com o rodapé visível', async ({ page }) => {
    await page.setViewportSize(WIDTHS.desktop);
    await open(page, '/dev/ui/public', 'dev-gallery-public');
    const media = await box(page, tid('public-layout-media'));
    const sheet = await box(page, tid('public-layout-sheet'));
    expect(media.x + media.width).toBeLessThanOrEqual(sheet.x + 2);
    expect(Math.abs(media.y - sheet.y)).toBeLessThanOrEqual(2);
    await expect(page.locator(tid('public-footer'))).toBeVisible();
  });
});

for (const [name, size] of Object.entries(WIDTHS)) {
  test.describe(`todas as páginas (${name})`, () => {
    test.use({ viewport: size });

    for (const [path, testId] of PAGES) {
      test(`${path}: sem rolagem horizontal${name === 'phone' || name === 'desktop' ? ' e sem violação grave de acessibilidade' : ''}`, async ({ page }) => {
        await open(page, path, testId);
        await expectNoHorizontalScroll(page);
        if (name === 'phone' || name === 'desktop') {
          await expectNoSeriousA11y(page);
        }
      });
    }
  });
}

test.describe('painel de marca da casca de fluxo', () => {
  // Desvio do desenho de referência (execution-log): o focinho gigante não pode cobrir o logo.
  for (const width of [1280, 1440]) {
    test(`desktop ${width}px: o focinho gigante deixa pelo menos 24px de respiro do logo`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, '/dev/ui/flow', 'dev-gallery-flow');
      const logo = await box(page, `${tid('flow-shell-brand-panel')} app-logo img >> visible=true`);
      const paw = await box(page, tid('brand-panel-focinho'));
      const gapX = paw.x - (logo.x + logo.width);
      const gapY = logo.y - (paw.y + paw.height);
      expect(Math.max(gapX, gapY), `caixas do logo e do focinho: logo ${JSON.stringify(logo)}, focinho ${JSON.stringify(paw)}`).toBeGreaterThanOrEqual(24);
    });
  }
});
