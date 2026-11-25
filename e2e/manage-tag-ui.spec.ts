import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y } from './support/ui';
import { mockTutorBackend, newTutorState, persistSession, type TutorState } from './support/mock-tutor';

/**
 * Gerenciar tag, passar adiante, desvincular e 2ª via (spec 003, T088 a T090, claro e escuro), com o backend SIMULADO
 * (ver `support/mock-tutor.ts`). O PIN novo é inventado (`K47Q9M`) e nenhuma captura o mostra: a tela do PIN é
 * conferida pelo DOM. `SHOTS_DIR=<pasta>` grava as capturas.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;
const PIN = 'K47Q9M';

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function setup(page: Page, over: Partial<TutorState> = {}, theme?: 'dark'): Promise<TutorState> {
  const state = await mockTutorBackend(
    page,
    newTutorState({
      pets: [
        { id: 'p1', name: 'Paçoca', species: 'dog', hasTag: true, tagCode: '7K3M-Q9XA-C', scansMonth: 3, lastScan: null },
        { id: 'p2', name: 'Mel', species: 'cat' },
      ],
      ...over,
    }),
  );
  await persistSession(page);
  if (theme) await page.addInitScript((v) => window.localStorage.setItem('faro.theme', v), theme);
  return state;
}

for (const theme of [undefined, 'dark'] as const) {
  for (const size of SIZES) {
    const suffix = `${theme === 'dark' ? 'escuro-' : ''}${size.name}`;
    test.describe(`gerenciar tag em ${size.width}px, tema ${theme === 'dark' ? 'escuro' : 'claro'}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('tela, confirmação e PIN novo ao passar adiante', async ({ page }) => {
        const state = await setup(page, {}, theme);
        await page.goto('/app/pets/p1/tag');
        await expect(page.locator(tid('manage-tag-code'))).toContainText('7K3M-Q9XA-C', { timeout: 15_000 });
        await expect(page.locator(tid('manage-tag-since'))).toContainText('Vinculada a Paçoca desde');
        if (theme === 'dark') await expect(page.locator('app-tutor-shell')).toHaveClass(/dark/);
        await page.waitForTimeout(400);
        await expectNoHorizontalScroll(page);
        await expectNoSeriousA11y(page);
        await shot(page, `tag-${suffix}`);

        await page.locator(tid('manage-tag-transfer')).click();
        await expect(page.locator(tid('manage-tag-confirm-title'))).toContainText('Passar a tag 7K3M-Q9XA-C adiante?');
        await page.waitForTimeout(300);
        await expectNoSeriousA11y(page);
        await shot(page, `tag-adiante-confirmar-${suffix}`);
        expect(state.releaseBodies).toEqual([]);

        await page.locator(tid('manage-tag-confirm')).click();
        await expect(page.locator(tid('manage-tag-pin'))).toHaveText(PIN);
        await expect(page.locator(tid('manage-tag-pin'))).toBeInViewport();
        await expect(page.locator('#manage-tag-pin-title')).toBeFocused();
        await expect(page.locator(tid('manage-tag-pin-warning'))).toContainText('Anote agora. Ele não aparece de novo.');
        expect(state.releaseBodies).toEqual([{ p_code: '7K3MQ9XAC', p_reason: 'transferred' }]);
        const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);
        expect(stored).not.toContain(PIN);

        await page.locator(tid('manage-tag-done')).click();
        await expect(page).toHaveURL(/\/app\/pets\/p1$/);
        await expect(page.locator('body')).not.toContainText(PIN);
      });
    });
  }
}

for (const size of SIZES) {
  test.describe(`2ª via em ${size.width}px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('perdida: confirma explicando e registra', async ({ page }) => {
      const state = await setup(page);
      await page.goto('/app/pets/p1/tag');
      await page.locator(tid('manage-tag-lost')).click();
      await expect(page.locator(tid('manage-tag-confirm-text'))).toContainText('deixa de funcionar agora e não volta');
      await page.waitForTimeout(300);
      await shot(page, `tag-perdida-confirmar-${size.name}`);
      await page.locator(tid('manage-tag-confirm')).click();
      await expect(page.locator(tid('manage-tag-registered-text'))).toContainText('O código antigo foi anulado');
      expect(state.replacementBodies).toEqual([{ p_code: '7K3MQ9XAC', p_kind: 'lost' }]);
      // O diálogo de confirmação sai com uma transição: a captura espera ele sumir.
      await page.waitForTimeout(600);
      await shot(page, `tag-perdida-registrada-${size.name}`);
    });

    test('danificada: registra e a tag segue funcionando', async ({ page }) => {
      const state = await setup(page);
      await page.goto('/app/pets/p1/tag');
      await page.locator(tid('manage-tag-damaged')).click();
      await page.locator(tid('manage-tag-confirm')).click();
      await expect(page.locator(tid('manage-tag-registered-text'))).toContainText('A tag continua funcionando');
      expect(state.replacementBodies).toEqual([{ p_code: '7K3MQ9XAC', p_kind: 'damaged' }]);
    });
  });
}
