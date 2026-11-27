import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y } from './support/ui';
import { mockTutorBackend, newTutorState, persistSession, type TutorState } from './support/mock-tutor';

/**
 * Ativação da tag, telas (spec 003, T042 a T047), com o backend SIMULADO (ver `support/mock-tutor.ts`).
 * A prova contra o banco real (PIN errado, bloqueio, concorrência) é do QA (T049).
 * `SHOTS_DIR=<pasta>` grava uma captura de cada tela em cada largura.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const CODE = '7K3M-Q9XA-C';
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function typePin(page: Page, pin: string): Promise<void> {
  await page.locator(tid('activation-pin-cell-1')).click();
  await page.keyboard.type(pin);
}

async function setup(page: Page, over: Partial<TutorState> = {}): Promise<TutorState> {
  const state = await mockTutorBackend(page, newTutorState(over));
  await persistSession(page);
  return state;
}

for (const size of SIZES) {
  test.describe(`ativação em ${size.width}px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('passo 1, passo 2 e "Tag ativa!"', async ({ page }) => {
      const state = await setup(page);
      await page.goto(`/ativar/${CODE}`);

      // Passo 1
      await expect(page.locator(tid('activation-pet-list'))).toBeVisible({ timeout: 15_000 });
      expect(state.pendingCodes).toEqual(['7K3MQ9XAC']);
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
      await shot(page, `ativacao-pet-${size.name}`);
      await page.locator(`${tid('activation-pet-p1')} input`).check({ force: true });
      await page.locator(tid('activation-continue')).click();

      // Passo 2
      await expect(page.locator(tid('activation-pin-cell-1'))).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
      await shot(page, `ativacao-pin-${size.name}`);
      if (size.width === 390) {
        // O aviso do WhatsApp e o botão cabem na tela do celular sem rolar.
        for (const id of ['activation-whatsapp-notice', 'activation-submit']) {
          const box = await page.locator(tid(id)).boundingBox();
          expect(box, id).not.toBeNull();
          expect(box!.y + box!.height, `${id} fora da primeira tela`).toBeLessThanOrEqual(size.height);
        }
      }
      await typePin(page, 'K47Q9M');
      await expect(page.locator(tid('activation-submit'))).toBeEnabled();
      await page.locator(tid('activation-submit')).click();

      // Sucesso
      await expect(page.locator(tid('activation-done'))).toBeVisible();
      expect(state.activateBodies).toEqual([
        { p_code: '7K3MQ9XAC', p_pin: 'K47Q9M', p_pet_id: 'p1', p_replace: false, p_enable_whatsapp: true },
      ]);
      expect(page.url()).not.toContain('K47Q9M');
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
      await shot(page, `ativacao-sucesso-${size.name}`);
      await expect(page.locator(tid('activation-view-page'))).toHaveAttribute('href', '/7K3MQ9XAC');
    });
  });
}

test.describe('ativação: casos de borda (celular)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sem sessão: cadastro com a volta para a ativação', async ({ page }) => {
    await page.route(/\.supabase\.co\//, (route) => route.abort());
    await page.goto(`/ativar/${CODE}`);
    await expect(page).toHaveURL(/\/auth\/criar-conta\?returnUrl=%2Fativar%2F7K3MQ9XAC$/, { timeout: 15_000 });
  });

  test('celular sem confirmar: leva a /auth/celular com a volta', async ({ page }) => {
    await setup(page, { phoneConfirmed: false });
    await page.goto(`/ativar/${CODE}`);
    await expect(page).toHaveURL(/\/auth\/celular\?returnUrl=%2Fativar%2F7K3M-Q9XA-C$/, { timeout: 15_000 });
  });

  test('PIN errado: mensagem, células limpas, pode tentar de novo', async ({ page }) => {
    const state = await setup(page, {
      activateReplies: [
        { ok: false, error: 'wrong_pin' },
        { ok: true, code: CODE, pet_id: 'p1', pet_name: 'Paçoca', whatsapp_enabled: false },
      ],
    });
    await page.goto(`/ativar/${CODE}`);
    await page.locator(`${tid('activation-pet-p1')} input`).check({ force: true });
    await page.locator(tid('activation-continue')).click();
    await page.locator(`${tid('activation-whatsapp')} input`).uncheck({ force: true });
    await typePin(page, 'K47Q9M');
    await page.locator(tid('activation-submit')).click();
    await expect(page.locator(tid('activation-pin-error'))).toContainText('PIN incorreto. Confira o cartão.');
    await expect(page.locator(tid('activation-pin-cell-1'))).toHaveValue('');
    await shot(page, 'ativacao-pin-erro-celular');
    await typePin(page, 'K47Q9M');
    await page.locator(tid('activation-submit')).click();
    await expect(page.locator(tid('activation-done-whatsapp'))).toContainText('WhatsApp desligado');
    expect(state.activateBodies).toHaveLength(2);
    expect(state.activateBodies[1]).toMatchObject({ p_enable_whatsapp: false });
  });

  test('pet que já tem tag: confirmação antes do PIN e troca enviada', async ({ page }) => {
    const state = await setup(page);
    await page.goto(`/ativar/${CODE}`);
    await page.locator(`${tid('activation-pet-p2')} input`).check({ force: true });
    await page.locator(tid('activation-continue')).click();
    await expect(page.locator(tid('activation-replace'))).toContainText('2FX8-CN73-F');
    await shot(page, 'ativacao-troca-celular');
    await page.locator(tid('activation-replace-confirm')).click();
    await typePin(page, 'K47Q9M');
    await page.locator(tid('activation-submit')).click();
    await expect(page.locator(tid('activation-done'))).toBeVisible();
    expect(state.activateBodies[0]).toMatchObject({ p_pet_id: 'p2', p_replace: true });
  });

  test('código inválido: mensagem do contrato', async ({ page }) => {
    await setup(page);
    await page.goto('/ativar/7K3M-Q9XA-D');
    await expect(page.locator(tid('activation-invalid-text'))).toHaveText('Confira o código. Ele fica embaixo do QR.');
  });
});
