import { test, expect } from '@playwright/test';

test('galeria de desenvolvimento: o índice abre em /dev/ui', async ({ page }) => {
  await page.goto('/dev/ui');
  await expect(page.locator('[data-testid="dev-gallery"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Galeria de desenvolvimento' })).toBeVisible();
});
