import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y } from './support/ui';
import { makePng } from './support/png';
import { mockTutorBackend, newTutorState, persistSession, type TutorState } from './support/mock-tutor';

/**
 * Novo pet, telas (spec 003, T044 e T045), com o backend SIMULADO (ver `support/mock-tutor.ts`).
 * O redimensionamento para WebP roda de verdade no Chromium. `SHOTS_DIR=<pasta>` grava as capturas.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;

// PNG válido montado na hora.
const PNG = makePng();

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function setup(page: Page): Promise<TutorState> {
  const state = await mockTutorBackend(page, newTutorState());
  await persistSession(page);
  return state;
}

const chip = (page: Page, group: string, label: string) =>
  page.locator(`${tid(group)} button`, { hasText: new RegExp(`^\\s*${label}\\s*$`) });

for (const size of SIZES) {
  test.describe(`novo pet em ${size.width}px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('passo 1, passo 2 e salvar', async ({ page }) => {
      const state = await setup(page);
      await page.goto('/novo-pet?returnUrl=%2Fativar%2F7K3MQ9XAC');

      // Passo 1
      await expect(page.locator(tid('new-pet-name'))).toBeVisible({ timeout: 15_000 });
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
      await shot(page, `novo-pet-dados-vazio-${size.name}`);
      await page.locator(tid('new-pet-continue')).click();
      await expect(page.locator(tid('new-pet-name-error'))).toBeVisible();
      await expect(page.locator(tid('new-pet-species-error'))).toBeVisible();
      await expectNoSeriousA11y(page);
      await chip(page, 'new-pet-species', 'Cão').click();
      await page.locator(tid('new-pet-name')).fill('Paçoca');
      await page.locator(tid('new-pet-breed')).fill('SRD (sem raça definida)');
      await chip(page, 'new-pet-sex', 'Macho').click();
      await chip(page, 'new-pet-size', 'Médio').click();
      await page.waitForTimeout(400);
      await shot(page, `novo-pet-dados-${size.name}`);
      await page.locator(tid('new-pet-continue')).click();

      // Passo 2
      await expect(page.locator(tid('new-pet-photo-button'))).toBeVisible();
      await page.locator(tid('new-pet-photo-input')).setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
      await expect(page.locator(tid('new-pet-photo-button'))).toContainText('Trocar foto');
      await chip(page, 'new-pet-temperament', 'Dócil com pessoas').click();
      await chip(page, 'new-pet-temperament', 'Medo de barulho').click();
      await page.locator(tid('new-pet-care')).fill('Toma remédio para alergia. Não ofereça comida, só água.');
      // Os chips animam a cor por 150 ms: o axe no meio da transição mede um contraste que não existe.
      await page.waitForTimeout(400);
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
      await shot(page, `novo-pet-resgate-${size.name}`);
      await page.locator(tid('new-pet-save')).click();

      // Volta para a ativação com o pet criado
      await expect(page).toHaveURL(/\/ativar\/7K3MQ9XAC\?pet=p-novo$/, { timeout: 15_000 });
      expect(state.petInserts).toHaveLength(1);
      expect(state.petInserts[0]).toMatchObject({
        tutor_id: 'u1',
        name: 'Paçoca',
        species: 'dog',
        breed: 'SRD (sem raça definida)',
        sex: 'male',
        size: 'medium',
        temperament: ['Dócil com pessoas', 'Medo de barulho'],
        care_notes: 'Toma remédio para alergia. Não ofereça comida, só água.',
      });
      expect(state.uploads).toHaveLength(1);
      expect(state.uploads[0]).toMatch(/\/pet-photos\/u1\/p-novo\/[0-9a-f-]{36}\.webp$/);
    });
  });
}

test.describe('novo pet: casos de borda (celular)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('pular por enquanto cria só com os dados e volta para o painel', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/novo-pet');
    await chip(page, 'new-pet-species', 'Gato').click();
    await page.locator(tid('new-pet-name')).fill('Mel');
    await page.locator(tid('new-pet-continue')).click();
    await page.locator(tid('new-pet-skip')).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
    expect(state.petInserts[0]).toMatchObject({ name: 'Mel', species: 'cat' });
    expect(Object.keys(state.petInserts[0] as object)).not.toContain('care_notes');
    expect(state.uploads).toHaveLength(0);
  });
});
