import { test, expect, type Page } from '@playwright/test';

/**
 * Restauração da sessão ao recarregar (F5 / carga a frio).
 *
 * O Supabase é SIMULADO: tudo que vai a *.supabase.co é abortado, exceto as rotas
 * simuladas abaixo. Nenhum teste fala com o projeto real nem faz login real.
 */
const PROJECT_REF = 'orawzpslqvduwsvmlemv';
const KEY = `sb-${PROJECT_REF}-auth-token`;
const NOW = () => Math.floor(Date.now() / 1000);

function fakeJwt(exp: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', role: 'authenticated', exp })}.assinatura`;
}

function storedSession(expiresAt: number): string {
  return JSON.stringify({
    access_token: fakeJwt(expiresAt),
    refresh_token: 'refresh-simulado',
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'tutor@exemplo.test',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  });
}

async function mockSupabase(page: Page, opts: { refreshOk: boolean }) {
  // Primeiro o abort geral; as rotas registradas depois têm precedência.
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.route('**/*.supabase.co/auth/v1/user', (route) =>
    route.fulfill({ json: JSON.parse(storedSession(NOW() + 3600)).user }),
  );
  await page.route('**/*.supabase.co/auth/v1/token**', (route) =>
    opts.refreshOk
      ? route.fulfill({ json: JSON.parse(storedSession(NOW() + 3600)) })
      : route.fulfill({
          status: 400,
          json: { error: 'invalid_grant', error_description: 'Invalid Refresh Token' },
        }),
  );
  await page.route('**/*.supabase.co/auth/v1/logout**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/*.supabase.co/rest/v1/rpc/current_user_role', (route) =>
    route.fulfill({ json: 'tutor' }),
  );
}

async function seed(page: Page, where: 'localStorage' | 'sessionStorage', value: string) {
  await page.addInitScript(
    ([w, k, v]) => {
      (window as unknown as Record<string, Storage>)[w].setItem(k, v);
    },
    [where, KEY, value] as const,
  );
}

const inStorage = (page: Page) =>
  page.evaluate((k) => [localStorage.getItem(k), sessionStorage.getItem(k)], KEY);

for (const where of ['sessionStorage', 'localStorage'] as const) {
  test(`sessão válida em ${where}: carga a frio de /app permanece em /app`, async ({ page }) => {
    await mockSupabase(page, { refreshOk: true });
    await seed(page, where, storedSession(NOW() + 3600));
    await page.goto('/app');
    // O painel só aparece se o guard deixou passar; o URL sozinho não prova nada (a carga começa em /app).
    await expect(page.getByTestId('pets-home')).toBeVisible();
    await expect(page).toHaveURL(/\/app$/);
    // F5 de novo, com o storage que o app deixou
    await page.reload();
    await expect(page.getByTestId('pets-home')).toBeVisible();
    await expect(page).toHaveURL(/\/app$/);
  });
}

test('sem sessão: /app vai para o login', async ({ page }) => {
  await mockSupabase(page, { refreshOk: true });
  await page.goto('/app');
  await expect(page).toHaveURL(/\/auth(\?|$|\/)/);
});

test('sessão inválida gravada: vai para o login e a chave some do storage', async ({ page }) => {
  await mockSupabase(page, { refreshOk: false });
  await seed(page, 'sessionStorage', storedSession(NOW() - 3600));
  await page.goto('/app');
  await expect(page).toHaveURL(/\/auth(\?|$|\/)/);
  await expect.poll(() => inStorage(page)).toEqual([null, null]);
});
