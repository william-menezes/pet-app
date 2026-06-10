import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração e2e do Faro (Playwright).
 *
 * O foco do MVP são os fluxos públicos (rota SSR de resgate, landing). O webServer
 * sobe o `ng serve` (dev-server híbrido) automaticamente antes dos testes.
 *
 * Outros navegadores além do Chromium: `npx playwright install` e adicione projetos abaixo.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
