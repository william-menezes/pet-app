import { expect, test, type Page } from '@playwright/test';

import { WIDTHS, expectNoHorizontalScroll, expectNoSeriousA11y } from './support/ui';
import { mockTutorBackend, newTutorState, persistSession, type TutorState } from './support/mock-tutor';

/**
 * Painel, lista de pets, página do pet e editar/remover (spec 003, T062, T069 a T071, claro e escuro), com o backend
 * SIMULADO (ver `support/mock-tutor.ts`). `SHOTS_DIR=<pasta>` grava as capturas.
 */
const tid = (id: string) => `[data-testid="${id}"]`;
const SHOTS = process.env['SHOTS_DIR'];
const SIZES = [
  { name: 'celular', ...WIDTHS.phone },
  { name: 'tablet', ...WIDTHS.tablet },
  { name: 'desktop', ...WIDTHS.desktop },
] as const;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const petRow = (id: string, name: string, species: 'dog' | 'cat', breed: string, birth: string) => ({
  id,
  tutor_id: 'u1',
  name,
  species,
  breed,
  sex: species === 'dog' ? 'male' : 'female',
  size: species === 'dog' ? 'medium' : 'small',
  neutered: true,
  birth_month: birth,
  temperament: species === 'dog' ? ['Dócil com pessoas', 'Medo de barulho'] : [],
  care_notes: species === 'dog' ? 'Toma remédio para alergia' : null,
  photo_path: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
});
const scanRow = (id: string, hours: number, geo: string) => ({
  id,
  tag_code: '7K3MQ9XAC',
  pet_id: 'p1',
  occurred_at: hoursAgo(hours),
  geo_method: geo,
  lat: -23.55,
  lng: -46.63,
  accuracy_m: geo === 'gps' ? 15 : 3000,
  city: 'São Paulo',
  region: 'SP',
});

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function setup(page: Page, over: Partial<TutorState> = {}, theme?: 'dark'): Promise<TutorState> {
  const state = await mockTutorBackend(
    page,
    newTutorState({
      pets: [
        {
          id: 'p1',
          name: 'Paçoca',
          species: 'dog',
          hasTag: true,
          tagCode: '7K3M-Q9XA-C',
          scansMonth: 3,
          lastScan: { occurred_at: hoursAgo(2), geo_method: 'ip' },
          visibleShown: 3,
        },
        { id: 'p2', name: 'Mel', species: 'cat' },
      ],
      petRows: [petRow('p1', 'Paçoca', 'dog', 'SRD caramelo', '2022-03-01'), petRow('p2', 'Mel', 'cat', 'siamesa', '2024-05-01')],
      scansRows: [scanRow('s1', 2, 'ip'), scanRow('s2', 24 * 9, 'gps')],
      ...over,
    }),
  );
  await persistSession(page);
  if (theme) await page.addInitScript((v) => window.localStorage.setItem('faro.theme', v), theme);
  return state;
}

const PAGES = [
  { slug: 'painel', url: '/app', ready: 'dashboard-cover' },
  { slug: 'pets', url: '/app/pets', ready: 'pet-list-count' },
  { slug: 'pet', url: '/app/pets/p1', ready: 'pet-page-tag-card' },
  { slug: 'pet-sem-tag', url: '/app/pets/p2', ready: 'pet-page-link-tag' },
] as const;

for (const theme of [undefined, 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`app do tutor em ${size.width}px, tema ${theme === 'dark' ? 'escuro' : 'claro'}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      for (const screen of PAGES) {
        test(`${screen.slug}`, async ({ page }) => {
          await setup(page, {}, theme);
          await page.goto(screen.url);
          await expect(page.locator(tid(screen.ready))).toBeVisible({ timeout: 15_000 });
          if (theme === 'dark') await expect(page.locator('app-tutor-shell')).toHaveClass(/dark/);
          await page.waitForTimeout(500);
          await expectNoHorizontalScroll(page);
          await expectNoSeriousA11y(page);
          await shot(page, `${screen.slug}-${theme === 'dark' ? 'escuro-' : ''}${size.name}`);
        });
      }
    });
  }
}

test.describe('editar pet (fluxo claro)', () => {
  for (const size of SIZES) {
    test(`editar em ${size.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await setup(page);
      await page.goto('/app/pets/p1/editar');
      await expect(page.locator(tid('new-pet-name'))).toHaveValue('Paçoca', { timeout: 15_000 });
      await page.waitForTimeout(400);
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11y(page);
      await shot(page, `editar-${size.name}`);
    });
  }

  test('salvar grava no pet existente e volta para a página do pet', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/app/pets/p1/editar');
    await expect(page.locator(tid('new-pet-name'))).toHaveValue('Paçoca', { timeout: 15_000 });
    await page.locator(tid('new-pet-name')).fill('Paçoca Jr.');
    await page.locator(tid('new-pet-continue')).click();
    await expect(page.locator(tid('new-pet-skip'))).toHaveCount(0);
    await page.locator(tid('new-pet-save')).click();
    await expect(page).toHaveURL(/\/app\/pets\/p1$/);
    expect(state.petInserts).toEqual([]);
    expect(state.petUpdates).toEqual([expect.objectContaining({ name: 'Paçoca Jr.', species: 'dog' })]);
  });
});

test.describe('página do pet: fluxos', () => {
  test('modo perdido ligado: "Pet encontrado" confirma e desliga', async ({ page }) => {
    const state = await setup(page, {
      pets: [{ id: 'p1', name: 'Paçoca', species: 'dog', hasTag: true, tagCode: '7K3M-Q9XA-C', lostMode: true, lostSince: hoursAgo(5) }],
    });
    await page.goto('/app/pets/p1');
    await expect(page.locator(tid('lost-row'))).toContainText('Ligado há 5 horas', { timeout: 15_000 });
    await page.locator(`${tid('lost-row')} button[role="switch"]`).click();
    await expect(page.locator(tid('lost-row-dialog-title'))).toContainText('Paçoca foi encontrado?');
    await page.waitForTimeout(400);
    await shot(page, 'pet-encontrado-dialogo');
    await expectNoSeriousA11y(page);
    await page.locator(tid('lost-row-confirm')).click();
    await expect(page.locator(tid('lost-row'))).toContainText('Mostra um alerta na página da tag');
    expect(state.lostBodies).toEqual([expect.objectContaining({ p_pet_id: 'p1', p_on: false })]);
  });

  test('modo perdido desligado: o interruptor leva à tela do modo perdido', async ({ page }) => {
    await setup(page);
    await page.goto('/app/pets/p1');
    await page.locator(`${tid('lost-row')} button[role="switch"]`).click();
    await expect(page).toHaveURL(/\/app\/pets\/p1\/modo-perdido$/);
  });

  test('remover pet com tag: confirma, libera a tag, apaga o pet e mostra o PIN novo uma vez', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/app/pets/p1/editar');
    await expect(page.locator(tid('new-pet-name'))).toHaveValue('Paçoca', { timeout: 15_000 });
    await page.locator(tid('remove-pet-open')).click();
    await expect(page.locator(tid('remove-pet-text'))).toContainText('7K3M-Q9XA-C');
    await page.waitForTimeout(400);
    await shot(page, 'remover-pet-confirmacao');
    await expectNoSeriousA11y(page);
    await page.locator(tid('remove-pet-confirm')).click();
    await expect(page.locator(tid('remove-pet-pin'))).toHaveText('K47Q9M');
    await expect(page.locator('body')).toContainText('Anote agora. Ele não aparece de novo.');
    await page.waitForTimeout(400);
    await shot(page, 'remover-pet-pin');
    expect(state.releaseBodies).toEqual([{ p_code: '7K3MQ9XAC', p_reason: 'released' }]);
    expect(state.petDeletes).toHaveLength(1);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('K47Q9M');
    await page.locator(tid('remove-pet-done')).click();
    await expect(page).toHaveURL(/\/app\/pets$/);
  });
});

test.describe('painel: estados', () => {
  test('sem pets: convite para cadastrar o primeiro', async ({ page }) => {
    await setup(page, { pets: [], petRows: [] });
    await page.goto('/app');
    await expect(page.locator(tid('dashboard-empty'))).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(300);
    await expectNoSeriousA11y(page);
    await shot(page, 'painel-vazio');
    await page.locator(tid('dashboard-empty-add')).click();
    await expect(page).toHaveURL(/\/novo-pet$/);
  });

  test('com mais de um pet o seletor troca a capa', async ({ page }) => {
    await setup(page);
    await page.goto('/app');
    await expect(page.locator(tid('dashboard-pet-select'))).toBeVisible({ timeout: 15_000 });
    await page.locator(tid('dashboard-pet-select')).selectOption('p2');
    await expect(page.locator(tid('pet-hero-name'))).toContainText('Mel');
    await expect(page.locator(tid('dashboard-link-tag'))).toHaveAttribute('href', '/vincular/p2');
  });
});
