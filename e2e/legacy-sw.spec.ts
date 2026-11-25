import { expect, test } from '@playwright/test';

/**
 * Service worker antigo (spec 002, US5). O Faro não usa service worker; quem ainda tem o `ngsw`
 * registrado o larga ao pedir `/ngsw-worker.js` (arquivo de desligamento) e na limpeza do carregamento.
 */
test.describe('worker antigo', () => {
  test('um aparelho que registra o worker antigo o vê ser cancelado em até 10s', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/ngsw-worker.js');
    });
    const remaining = async () =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    await expect.poll(remaining, { timeout: 10_000, intervals: [250] }).toBe(0);
  });

  test('/ngsw-worker.js é JavaScript e é o arquivo de desligamento', async ({ request }) => {
    const response = await request.get('/ngsw-worker.js');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/javascript/);
    expect(await response.text()).toContain('registration.unregister');
  });

  test('depois de carregar a página, não há registro de service worker', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-root')).toBeAttached();
    await page.waitForLoadState('networkidle');
    const count = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    expect(count).toBe(0);
  });
});
