import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y } from './support/ui';
import { mockTutorBackend, newTutorState, persistSession, type TutorState } from './support/mock-tutor';

/**
 * Vincular tag pelo app (spec 003, T072 e T073), com o backend SIMULADO (ver `support/mock-tutor.ts`). O leitor de QR
 * roda com a câmera falsa do Chromium (`--use-fake-device-for-media-stream`): ela mostra um vídeo de teste, sem QR.
 * `SHOTS_DIR=<pasta>` grava as capturas.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;
const CODE = '5P8N-MRXY-W';

// Câmera falsa do Chromium para o leitor de QR (vale para o arquivo todo: `launchOptions` não pode ficar num describe).
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function setup(page: Page, over: Partial<TutorState> = {}): Promise<TutorState> {
  const state = await mockTutorBackend(
    page,
    newTutorState({
      pets: [
        { id: 'p1', name: 'Paçoca', species: 'dog' },
        { id: 'p2', name: 'Mel', species: 'cat' },
        { id: 'p3', name: 'Rex', species: 'dog', hasTag: true, tagCode: '2FX8-CN73-F' },
      ],
      checkReplies: [{ ok: true, code: CODE }],
      activateReplies: [{ ok: true, code: CODE, pet_id: 'p2', pet_name: 'Mel', whatsapp_enabled: true }],
      ...over,
    }),
  );
  await persistSession(page);
  return state;
}

async function openType(page: Page): Promise<void> {
  await page.goto('/vincular/p2');
  await expect(page.locator(tid('link-code'))).toBeVisible({ timeout: 15_000 });
}

for (const size of SIZES) {
  test.describe(`vincular tag em ${size.width}px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('código, câmera e PIN', async ({ page }) => {
      const state = await setup(page);
      await openType(page);
      await page.locator(tid('link-code')).fill(CODE);
      await expect(page.locator(tid('link-code-ok'))).toContainText('Código válido · tag disponível');
      await expect(page.locator(tid('link-continue'))).toBeEnabled();
      await page.waitForTimeout(400);
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
      await shot(page, `vincular-codigo-${size.name}`);
      expect(state.checkBodies).toEqual([{ p_code: '5P8NMRXYW' }]);

      // Aba da câmera: a câmera falsa abre e o leitor fica olhando (sem QR no vídeo de teste).
      await page.getByRole('button', { name: 'Escanear QR' }).click();
      await expect(page.locator(`${tid('link-scanner')} video`)).toBeVisible();
      await expect(page.locator(tid('qr-scanner-starting'))).toHaveCount(0, { timeout: 15_000 });
      await page.waitForTimeout(400);
      await expectNoSeriousA11y(page);
      await shot(page, `vincular-camera-${size.name}`);
      await page.getByRole('button', { name: 'Digitar código' }).click();

      // PIN.
      await expect(page.locator(tid('link-code'))).toHaveValue(CODE);
      await page.locator(tid('link-continue')).click();
      await expect(page.locator('h1')).toContainText('Digite o PIN do cartão');
      await page.locator(tid('activation-pin-cell-1')).click();
      await page.keyboard.type('K47Q9M');
      await page.waitForTimeout(400);
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
      await shot(page, `vincular-pin-${size.name}`);
      await page.locator(tid('activation-submit')).click();
      await expect(page.locator('h1, [data-testid="flow-shell"]').first()).toBeVisible();
      await expect(page.locator('body')).toContainText('tem como');
      expect(state.activateBodies).toEqual([
        { p_code: '5P8NMRXYW', p_pin: 'K47Q9M', p_pet_id: 'p2', p_replace: false, p_enable_whatsapp: true },
      ]);
      await page.waitForTimeout(300);
      await shot(page, `vincular-pronto-${size.name}`);
    });
  });
}

test.describe('vincular tag: fluxos', () => {
  test('a página do pet sem tag leva a "Vincular tag"', async ({ page }) => {
    await setup(page, {
      petRows: [
        { id: 'p2', tutor_id: 'u1', name: 'Mel', species: 'cat', breed: null, sex: null, size: null, neutered: null, birth_month: null, temperament: [], care_notes: null, photo_path: null, created_at: 'a', updated_at: 'b' },
      ],
    });
    await page.goto('/app/pets/p2');
    await page.locator(tid('pet-page-link-tag')).click();
    await expect(page).toHaveURL(/\/vincular\/p2$/);
    await expect(page.locator(tid('link-code'))).toBeVisible();
  });

  test('câmera negada: cai em "Digitar código" com o motivo', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('negada'), { name: 'NotAllowedError' }));
    });
    await setup(page);
    await openType(page);
    await page.getByRole('button', { name: 'Escanear QR' }).click();
    await expect(page.locator(tid('link-notice'))).toContainText('A câmera não foi liberada');
    await expect(page.locator(tid('link-code'))).toBeVisible();
    await expectNoSeriousA11y(page);
  });

  test('código inválido: mensagem do contrato e nenhuma chamada ao banco', async ({ page }) => {
    const state = await setup(page);
    await openType(page);
    await page.locator(tid('link-code')).fill('5P8N-MRXY-X');
    await expect(page.locator(tid('link-code-problem'))).toContainText('Confira o código. Ele fica embaixo do QR.');
    await expect(page.locator(tid('link-continue'))).toBeDisabled();
    expect(state.checkBodies).toEqual([]);
    await page.waitForTimeout(300);
    await expectNoSeriousA11y(page);
  });

  test('PIN errado: a mensagem aparece e o PIN some das células', async ({ page }) => {
    await setup(page, { activateReplies: [{ ok: false, error: 'wrong_pin' }] });
    await openType(page);
    await page.locator(tid('link-code')).fill(CODE);
    await expect(page.locator(tid('link-code-ok'))).toBeVisible();
    await page.locator(tid('link-continue')).click();
    await page.locator(tid('activation-pin-cell-1')).click();
    await page.keyboard.type('K47Q9M');
    await page.locator(tid('activation-submit')).click();
    await expect(page.locator(tid('activation-pin-error'))).toContainText('PIN incorreto. Confira o cartão.');
    await expect(page.locator(tid('activation-pin-cell-1'))).toHaveValue('');
  });

  test('pet que já tem tag: avisa e leva a "Gerenciar tag"', async ({ page }) => {
    await setup(page);
    await page.goto('/vincular/p3');
    await expect(page.locator(tid('link-taken'))).toContainText('2FX8-CN73-F', { timeout: 15_000 });
    await expect(page.locator(tid('link-taken-manage'))).toHaveAttribute('href', '/app/pets/p3/tag');
  });
});
