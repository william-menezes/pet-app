import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y } from './support/ui';
import { defaultProfile, mockTutorBackend, newTutorState, persistSession, type TutorState } from './support/mock-tutor';

/**
 * "Ativar modo perdido" (spec 003, T060, claro e escuro), com o backend SIMULADO (ver `support/mock-tutor.ts`).
 * `SHOTS_DIR=<pasta>` grava as capturas.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;
const MESSAGE = 'Ele se assusta fácil. Fale baixo, ofereça água e não corra atrás. Me chame que eu vou até aí.';

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function setup(page: Page, over: Partial<TutorState> = {}, theme?: 'dark'): Promise<TutorState> {
  const state = await mockTutorBackend(
    page,
    newTutorState({
      pets: [{ id: 'p1', name: 'Paçoca', species: 'dog', hasTag: true, tagCode: '7K3M-Q9XA-C' }],
      profiles: { p1: { ...defaultProfile('p1'), lost_message: MESSAGE, lost_show_reward: true } },
      ...over,
    }),
  );
  await persistSession(page);
  if (theme) await page.addInitScript((v) => window.localStorage.setItem('faro.theme', v), theme);
  return state;
}

for (const theme of [undefined, 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`modo perdido em ${size.width}px, tema ${theme === 'dark' ? 'escuro' : 'claro'}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('tela com recado, interruptores e prévia', async ({ page }) => {
        await setup(page, {}, theme);
        await page.goto('/app/pets/p1/modo-perdido');
        await expect(page.locator(tid('lost-mode-title'))).toContainText('Paçoca sumiu?', { timeout: 15_000 });
        await expect(page.locator(tid('lost-mode-message'))).toHaveValue(MESSAGE);
        await expect(page.locator(tid('lost-mode-count'))).toContainText(`${MESSAGE.length}/280`);
        if (theme === 'dark') await expect(page.locator('app-tutor-shell')).toHaveClass(/dark/);
        // A prévia do alerta só existe do tablet para cima.
        await expect(page.locator(tid('lost-mode-preview'))).toBeVisible({ visible: size.width >= 768 });
        if (size.width >= 768) {
          await expect(page.locator(tid('lost-mode-preview-reward'))).toBeVisible();
        }
        await page.waitForTimeout(400);
        await expectNoHorizontalScroll(page);
        await expectNoSeriousA11y(page);
        await shot(page, `modo-perdido-${theme === 'dark' ? 'escuro-' : ''}${size.name}`);
      });
    });
  }
}

test.describe('modo perdido: fluxo', () => {
  test('ativar manda recado e opções e volta para a página do pet', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/app/pets/p1/modo-perdido');
    await expect(page.locator(tid('lost-mode-title'))).toBeVisible({ timeout: 15_000 });
    await page.locator(`${tid('lost-mode-reward')} button[role="switch"]`).click();
    await page.locator(tid('lost-mode-submit')).click();
    await expect(page).toHaveURL(/\/app\/pets\/p1$/);
    expect(state.lostBodies).toEqual([
      { p_pet_id: 'p1', p_on: true, p_message: MESSAGE, p_show_since: true, p_show_reward: false },
    ]);
  });

  test('pet sem tag: aviso e caminho para vincular', async ({ page }) => {
    await setup(page, { pets: [{ id: 'p1', name: 'Paçoca', species: 'dog' }] });
    await page.goto('/app/pets/p1/modo-perdido');
    await expect(page.locator(tid('lost-mode-no-tag'))).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(tid('lost-mode-link-tag'))).toHaveAttribute('href', '/vincular/p1');
    await expect(page.locator(tid('lost-mode-submit'))).toBeDisabled();
  });
});
