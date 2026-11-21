import { test, expect } from '@playwright/test';

test('galeria de desenvolvimento: o índice abre em /dev/ui', async ({ page }) => {
  await page.goto('/dev/ui');
  await expect(page.locator('[data-testid="dev-gallery"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Galeria de desenvolvimento' })).toBeVisible();
});

test('galeria de desenvolvimento: /dev/ui/components mostra as 12 seções', async ({ page }) => {
  await page.goto('/dev/ui/components');
  await expect(page.locator('[data-testid="dev-gallery-components"]')).toBeVisible();
  await expect(page.locator('[data-testid^="gallery-"]')).toHaveCount(12);
});
