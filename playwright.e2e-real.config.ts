import { defineConfig, devices } from '@playwright/test';

/**
 * E2E com backend REAL (Supabase local do CI), spec 004 (T039, T040, T060, T072, T082, T086, T090, T108).
 *
 * So roda no job `e2e` do workflow: o Supabase local, o `functions serve` (FARO_ENV=test, SMS_DRIVER=stub) e o
 * `src/environments/environment.e2e.ts` (gerado no runner, nunca versionado) existem la. O `global-setup` ABORTA se a
 * URL do Supabase do ambiente nao for local, para este conjunto nunca escrever no projeto hospedado.
 *
 * Desvio de caminho registrado no execution-log: estes testes ficam em `e2e-real/` e nao em `e2e/` (os caminhos do
 * tasks.md), porque `npm run e2e` (config padrao, testDir `e2e/`) roda na maquina de desenvolvimento, onde o
 * `environment` aponta para o projeto hospedado.
 */
export default defineConfig({
  testDir: './e2e-real',
  globalSetup: './e2e-real/global-setup.ts',
  fullyParallel: false,
  workers: 1, // limites de taxa compartilham o IP do runner
  forbidOnly: true,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-real', open: 'never' }]],
  outputDir: 'test-results-real',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx ng serve --configuration e2e --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
