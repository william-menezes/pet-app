import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y } from './support/ui';
import { mockTutorBackend, newTutorState, persistSession, type TutorState } from './support/mock-tutor';

/**
 * Histórico de scans, tela (spec 003, T056, claro e escuro), com o backend SIMULADO (ver `support/mock-tutor.ts`).
 * O Leaflet roda de verdade; os tiles do OpenStreetMap são simulados. `SHOTS_DIR=<pasta>` grava as capturas.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const row = (over: Record<string, unknown>) => ({
  id: 's',
  tag_code: '7K3MQ9XAC',
  pet_id: 'p1',
  occurred_at: hoursAgo(1),
  geo_method: 'ip',
  lat: -23.55,
  lng: -46.63,
  accuracy_m: 3000,
  city: 'São Paulo',
  region: 'SP',
  ...over,
});
const ROWS = [
  row({ id: 's1' }),
  row({ id: 's2', occurred_at: hoursAgo(24 * 9), geo_method: 'gps', accuracy_m: 15, city: null, region: null, lat: -23.561, lng: -46.656 }),
  row({ id: 's3', occurred_at: hoursAgo(24 * 22), geo_method: 'gps', accuracy_m: 30, city: null, region: null, lat: -23.56, lng: -46.65 }),
];

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function setup(page: Page, over: Partial<TutorState> = {}, theme?: 'dark'): Promise<TutorState> {
  const state = await mockTutorBackend(page, newTutorState({ scansRows: ROWS, ...over }));
  await persistSession(page);
  if (theme) await page.addInitScript((v) => window.localStorage.setItem('faro.theme', v), theme);
  return state;
}

for (const theme of [undefined, 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`scans em ${size.width}px, tema ${theme === 'dark' ? 'escuro' : 'claro'}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('lista, mapa e filtros', async ({ page }) => {
        const state = await setup(page, {}, theme);
        await page.goto('/app/scans');
        await expect(page.locator(tid('scans-row')).first()).toBeVisible({ timeout: 15_000 });
        await expect(page.locator(tid('scans-row'))).toHaveCount(3);
        await expect(page.locator(tid('scans-row-badge')).nth(1)).toHaveText('Precisa · ± 15 m');
        // O Leaflet carregou de verdade e desenhou a área aproximada.
        await expect(page.locator('.leaflet-container')).toBeVisible();
        await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
        await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator(tid('scans-map-radius'))).toContainText('Raio de ~3 km');
        if (theme === 'dark') await expect(page.locator('app-tutor-shell')).toHaveClass(/dark/);
        await page.waitForTimeout(400);
        await expectNoHorizontalScroll(page);
        await expectNoSeriousA11y(page);
        await shot(page, `scans-${theme === 'dark' ? 'escuro-' : ''}${size.name}`);

        await page.getByRole('button', { name: 'Localização precisa' }).click();
        await expect.poll(() => state.scanQueries.at(-1) ?? '').toContain('geo_method=eq.gps');
      });
    });
  }
}

test.describe('scans: estados (celular)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sem scans: estado vazio com o caminho de volta', async ({ page }) => {
    await setup(page, { scansRows: [] });
    await page.goto('/app/scans');
    await expect(page.locator(tid('scans-empty'))).toContainText('Ninguém escaneou a tag ainda');
    await expect(page.locator(tid('scans-map'))).toHaveCount(0);
    await expectNoSeriousA11y(page);
    await shot(page, 'scans-vazio-celular');
  });

  test('só scans sem local: lista sem mapa', async ({ page }) => {
    await setup(page, {
      scansRows: [row({ id: 'n', geo_method: 'none', lat: null, lng: null, accuracy_m: null, city: null, region: null })],
    });
    await page.goto('/app/scans');
    await expect(page.locator(tid('scans-row'))).toHaveCount(1);
    await expect(page.locator(tid('scans-map'))).toHaveCount(0);
    await expect(page.locator('.leaflet-container')).toHaveCount(0);
  });

  test('?pet=<id> manda o filtro por pet', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/app/scans?pet=p1');
    await expect(page.locator(tid('scans-pet-filter'))).toBeVisible({ timeout: 15_000 });
    expect(state.scanQueries[0]).toContain('pet_id=eq.p1');
  });
});
