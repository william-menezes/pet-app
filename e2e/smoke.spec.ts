import { test, expect } from '@playwright/test';

/**
 * Smoke e2e do bootstrap: a landing pública (rota SSR/prerender) carrega e o tema Faro
 * é aplicado. A suíte completa de e2e (resgate, scan, modo perdido) vem com as features.
 */
test('landing pública responde e renderiza o app', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('[data-testid="public-landing"]')).toBeVisible();
});
