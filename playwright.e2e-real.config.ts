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
    // O dev server aplica a CSP de src/security-headers.ts, cujo connect-src so aceita https://<host>: o Supabase local
    // (http://127.0.0.1:54321) fica bloqueado. Achado de QA registrado no execution-log; os cabecalhos sao provados em headers.spec.
    bypassCSP: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx ng serve --configuration e2e --port 4200',
    url: 'http://localhost:4200',
    // No CI sempre sobe um servidor novo; na maquina de desenvolvimento reaproveita o `ng serve` ja no ar.
    reuseExistingServer: !process.env['CI'],
    timeout: 300_000,
    // Spec 003: o servidor SSR da pagina da tag fala com as Edge Functions do stack LOCAL com a chave do servidor.
    // Valores de teste, os mesmos que o `e2e-prepare.sh` grava no ambiente das funcoes.
    env: {
      SUPABASE_URL: process.env['E2E_SUPABASE_URL'] ?? '',
      SUPABASE_FUNCTIONS_URL: `${process.env['E2E_SUPABASE_URL'] ?? ''}/functions/v1`,
      FARO_SSR_KEY: process.env['E2E_SSR_KEY'] ?? '',
      IP_HASH_SECRET: process.env['E2E_IPHASH_SECRET'] ?? '',
    },
  },
});
