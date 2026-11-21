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

test('galeria de desenvolvimento: as seis páginas das cascas abrem', async ({ page }) => {
  const pages = [
    ['/dev/ui/tutor', 'dev-gallery-tutor'],
    ['/dev/ui/tutor/inner', 'dev-gallery-tutor-inner'],
    ['/dev/ui/flow', 'dev-gallery-flow'],
    ['/dev/ui/admin', 'dev-gallery-admin'],
    ['/dev/ui/public', 'dev-gallery-public'],
    ['/dev/ui/public/photo', 'dev-gallery-public-photo'],
  ] as const;
  for (const [path, testId] of pages) {
    await page.goto(path);
    await expect(page.locator(`[data-testid="${testId}"]`), path).toBeVisible();
  }
});
