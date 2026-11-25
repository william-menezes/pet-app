import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y, rgb } from './support/ui';
import { mockTutorBackend, newTutorState, persistSession, type TutorState } from './support/mock-tutor';

/**
 * "O que estranhos veem" e a prévia (spec 003, T065 e T066, claro e escuro), com o backend SIMULADO
 * (ver `support/mock-tutor.ts`). `SHOTS_DIR=<pasta>` grava as capturas.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;

const PET_ROW = {
  id: 'p1',
  tutor_id: 'u1',
  name: 'Paçoca',
  species: 'dog',
  breed: null,
  sex: null,
  size: null,
  neutered: null,
  birth_month: null,
  temperament: ['Dócil com pessoas', 'Medo de barulho'],
  care_notes: 'Toma remédio para alergia',
  photo_path: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function setup(page: Page, over: Partial<TutorState> = {}, theme?: 'dark'): Promise<TutorState> {
  const state = await mockTutorBackend(
    page,
    newTutorState({
      pets: [{ id: 'p1', name: 'Paçoca', species: 'dog', hasTag: true, tagCode: '7K3M-Q9XA-C' }],
      petRows: [PET_ROW],
      ...over,
    }),
  );
  await persistSession(page);
  if (theme) await page.addInitScript((v) => window.localStorage.setItem('faro.theme', v), theme);
  return state;
}

const switchOf = (page: Page, id: string) => page.locator(`${tid(id)} button[role="switch"]`);

for (const theme of [undefined, 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`visibilidade em ${size.width}px, tema ${theme === 'dark' ? 'escuro' : 'claro'}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('tela com os três grupos e a prévia sempre clara', async ({ page }) => {
        await setup(page, {}, theme);
        await page.goto('/app/pets/p1/visibilidade');
        await expect(page.locator(tid('visibility-temperament'))).toBeVisible({ timeout: 15_000 });
        await expect(page.locator(tid('visibility-name'))).toContainText('Sempre');
        await expect(page.locator(tid('visibility-phone'))).toContainText('(11) 9••••-4421 · confirmado');
        if (theme === 'dark') await expect(page.locator('app-tutor-shell')).toHaveClass(/dark/);
        await page.waitForTimeout(400);
        await expectNoHorizontalScroll(page);
        await expectNoSeriousA11y(page);
        await shot(page, `visibilidade-${theme === 'dark' ? 'escuro-' : ''}${size.name}`);

        // Prévia: a página pública, clara mesmo com o app escuro.
        await switchOf(page, 'visibility-care').click();
        await page.locator(tid('visibility-preview-open')).click();
        const preview = page.locator(tid('visibility-preview'));
        await expect(preview).toBeVisible();
        await expect(page.locator(tid('public-rescue-title'))).toContainText('Paçoca');
        await expect(page.locator(tid('public-rescue-care'))).toHaveCount(0);
        await expect(page.locator(tid('public-rescue-temperament'))).toContainText('Medo de barulho');
        await expect.poll(() => rgb(page, tid('visibility-preview'), 'backgroundColor')).toBe('rgb(247, 248, 248)');
        await page.waitForTimeout(400);
        await expectNoSeriousA11y(page);
        await shot(page, `visibilidade-previa-${theme === 'dark' ? 'escuro-' : ''}${size.name}`);
      });
    });
  }
}

test.describe('visibilidade: fluxo', () => {
  test('salvar manda só o que mudou e volta para a página do pet', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/app/pets/p1/visibilidade');
    await expect(page.locator(tid('visibility-care'))).toBeVisible({ timeout: 15_000 });
    await switchOf(page, 'visibility-care').click();
    await switchOf(page, 'visibility-phone').click();
    await page.locator(tid('visibility-save')).click();
    await expect(page).toHaveURL(/\/app\/pets\/p1$/);
    expect(state.profilePatches).toEqual([{ show_care: false, show_phone: true }]);
  });

  test('celular sem confirmação: o contato não liga, o aviso leva à confirmação e nada é gravado', async ({ page }) => {
    const state = await setup(page, { phoneConfirmed: false });
    await page.goto('/app/pets/p1/visibilidade');
    await expect(page.locator(tid('visibility-whatsapp'))).toBeVisible({ timeout: 15_000 });
    await switchOf(page, 'visibility-whatsapp').click();
    await expect(page.locator(tid('visibility-phone-notice'))).toContainText('Confirme seu celular');
    await expect(switchOf(page, 'visibility-whatsapp')).toHaveAttribute('aria-checked', 'false');
    await page.waitForTimeout(300);
    await shot(page, 'visibilidade-aviso-celular');
    await expectNoSeriousA11y(page);
    await page.locator(tid('visibility-confirm-phone')).click();
    await expect(page).toHaveURL(/\/auth\/celular\?returnUrl=%2Fapp%2Fpets%2Fp1%2Fvisibilidade/);
    expect(state.profilePatches).toEqual([]);
  });

  test('"Editar" da visão do dono chega a esta tela pelo código da tag', async ({ page }) => {
    await setup(page);
    await page.goto('/app/tag/7K3M-Q9XA-C');
    await expect(page).toHaveURL(/\/app\/pets\/p1\/visibilidade$/, { timeout: 15_000 });
    await expect(page.locator(tid('visibility-temperament'))).toBeVisible();
  });

  test('a prévia fecha com Esc e devolve o foco ao botão', async ({ page }) => {
    await setup(page);
    await page.goto('/app/pets/p1/visibilidade');
    await page.locator(tid('visibility-preview-open')).click();
    await expect(page.locator(tid('visibility-preview-close'))).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator(tid('visibility-preview'))).toHaveCount(0);
    await expect(page.locator(tid('visibility-preview-open'))).toBeFocused();
  });
});
