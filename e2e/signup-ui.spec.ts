import { expect, test, type Page } from '@playwright/test';

/**
 * Criar conta e confirmar o e-mail (spec 004, Phase 3, telas): boas-vindas, cadastro e "Confirme seu e-mail".
 *
 * TODO O BACKEND É SIMULADO. O `ng serve` aponta para o projeto Supabase hospedado, então este arquivo
 * bloqueia (`abort`) qualquer requisição para `*.supabase.co` antes de simular as poucas respostas de que
 * as telas precisam. Nada aqui cria conta nem envia e-mail. O fluxo com o coletor de e-mail local
 * (T039) fica para o QA com Supabase local.
 */
const tid = (id: string) => `[data-testid="${id}"]`;

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const NOW = Math.floor(Date.now() / 1000);
const JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', role: 'authenticated', exp: NOW + 3600 })}.assinatura`;

const SESSION = {
  access_token: JWT,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: NOW + 3600,
  refresh_token: 'refresh-simulado',
  user: {
    id: 'u1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'ana@email.com',
    email_confirmed_at: '2026-11-22T10:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-11-22T09:00:00Z',
  },
};

/** Conta recém-confirmada: aceite gravado no cadastro, celular ainda pendente. */
const ACCOUNT = {
  id: 'u1',
  nome: 'Ana Souza',
  email: 'ana@email.com',
  papel: 'tutor',
  celular: null,
  celular_confirmado_em: null,
  celular_pendente: '+5511987654421',
  termos_aceitos_em: '2026-11-22T09:00:00Z',
  termos_versao: '2026-11',
  tem_senha: true,
  provedores: ['email'],
  criado_em: '2026-11-22T09:00:00Z',
};

interface Backend {
  blocked: string[];
  calls: { signup: unknown[]; verify: unknown[]; resend: unknown[] };
}

/** Bloqueia o Supabase real e simula só o que as telas usam. Registrar o `abort` primeiro: o último registro vence. */
async function mockBackend(page: Page, opts: { verifyFails?: boolean } = {}): Promise<Backend> {
  const backend: Backend = { blocked: [], calls: { signup: [], verify: [], resend: [] } };
  await page.route(/\.supabase\.co\//, (route) => {
    backend.blocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.abort();
  });
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  await page.route('**/auth/v1/signup', (route) => {
    backend.calls.signup.push(route.request().postDataJSON());
    return route.fulfill(json({ id: 'u1', aud: 'authenticated', email: 'ana@email.com', identities: [{ id: 'i1' }] }));
  });
  await page.route('**/auth/v1/resend', (route) => {
    backend.calls.resend.push(route.request().postDataJSON());
    return route.fulfill(json({}));
  });
  await page.route('**/auth/v1/verify', (route) => {
    backend.calls.verify.push(route.request().postDataJSON());
    return opts.verifyFails
      ? route.fulfill(json({ code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }, 403))
      : route.fulfill(json(SESSION));
  });
  await page.route('**/rest/v1/rpc/current_user_role', (route) => route.fulfill(json('tutor')));
  await page.route('**/rest/v1/rpc/my_account', (route) => route.fulfill(json(ACCOUNT)));
  return backend;
}

async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test.describe('Criar conta: telas e fluxo (backend simulado)', () => {
  const widths = [320, 390, 768, 1440];

  for (const width of widths) {
    test(`sem rolagem horizontal em ${width} px`, async ({ page }) => {
      await mockBackend(page);
      await page.setViewportSize({ width, height: width >= 1440 ? 900 : width >= 768 ? 1024 : 844 });
      for (const url of [
        '/auth',
        '/auth?conta=excluida',
        '/auth/criar-conta',
        '/auth/confirmar-email',
        '/auth/confirmar-email?token_hash=abc&type=email',
        '/legal/termos',
      ]) {
        await page.goto(url);
        await expect(page.locator('h1')).toBeVisible();
        expect(await noHorizontalScroll(page), `${url} em ${width}px`).toBe(true);
      }
    });
  }

  test('boas-vindas: botões levam a criar conta e entrar, com o returnUrl', async ({ page }) => {
    const backend = await mockBackend(page);
    await page.goto('/auth?returnUrl=%2Fativar%2F7K3M-Q9XA-C');
    await expect(page.locator(tid('welcome-create-account'))).toBeVisible();
    await expect(page.locator(tid('welcome-login'))).toHaveAttribute('href', '/auth/login?returnUrl=%2Fativar%2F7K3M-Q9XA-C');
    await page.locator(tid('welcome-create-account')).click();
    await expect(page).toHaveURL(/\/auth\/criar-conta\?returnUrl=%2Fativar%2F7K3M-Q9XA-C$/);
    expect(backend.blocked).toEqual([]);
  });

  test('boas-vindas: aviso de conta excluída', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/auth?conta=excluida');
    await expect(page.locator(tid('welcome-deleted-notice'))).toContainText('Sua conta foi excluída.');
  });

  test('cadastro com erros de validação mostra os avisos e não envia', async ({ page }) => {
    const backend = await mockBackend(page);
    await page.goto('/auth/criar-conta');
    await page.locator(tid('signup-submit')).click();
    await expect(page.locator(tid('signup-name-error'))).toBeVisible();
    await expect(page.locator(tid('signup-email-error'))).toBeVisible();
    await expect(page.locator(tid('signup-phone-error'))).toBeVisible();
    await expect(page.locator(tid('signup-password-error'))).toBeVisible();
    await expect(page.locator(tid('signup-terms-error'))).toBeVisible();
    expect(backend.calls.signup).toHaveLength(0);
  });

  test('cadastro: envia os metadados, vai para "Confirme seu e-mail" sem e-mail na URL', async ({ page }) => {
    const backend = await mockBackend(page);
    await page.goto('/auth?returnUrl=%2Fativar%2F7K3M-Q9XA-C');
    await page.locator(tid('welcome-create-account')).click();

    await page.locator(tid('signup-name')).fill('Ana Souza');
    await page.locator(tid('signup-email')).fill('ana@email.com');
    await page.locator(tid('signup-phone')).fill('11987654421');
    await expect(page.locator(tid('signup-phone'))).toHaveValue('(11) 98765-4421');
    await page.locator(tid('signup-password')).fill('SenhaSegura1');
    await page.locator(`${tid('signup-terms')} input`).click();
    await page.locator(tid('signup-submit')).click();

    await expect(page).toHaveURL(/\/auth\/confirmar-email$/, { timeout: 10_000 });
    expect(page.url()).not.toContain('ana');
    expect(page.url()).not.toContain('SenhaSegura1');
    await expect(page.locator(tid('confirm-email-address'))).toHaveText('ana@email.com');
    await expect(page.locator(tid('confirm-email-countdown'))).toBeVisible();
    await expect(page.locator(tid('confirm-email-resend'))).toBeDisabled();

    expect(backend.calls.signup).toHaveLength(1);
    const body = backend.calls.signup[0] as { email: string; data: Record<string, string> };
    expect(body.email).toBe('ana@email.com');
    expect(body.data['name']).toBe('Ana Souza');
    expect(body.data['phone']).toBe('+5511987654421');
    expect(body.data['terms_version']).toBe('2026-11');
    expect(body.data['return_to']).toBe('/ativar/7K3M-Q9XA-C');
    expect(body.data['return_to_at']).toBeTruthy();
    expect(backend.blocked).toEqual([]);
  });

  test('espera sem e-mail no estado: campo, reenvio e aviso uniforme', async ({ page }) => {
    const backend = await mockBackend(page);
    await page.goto('/auth/confirmar-email');
    await expect(page.locator(tid('confirm-email-input'))).toBeVisible();
    await page.locator(tid('confirm-email-input')).fill('ana@email.com');
    await page.locator(tid('confirm-email-resend')).click();
    await expect(page.locator(tid('confirm-email-resent-notice'))).toContainText(
      'Se houver um cadastro pendente para este e-mail, enviamos um novo link.',
    );
    expect(backend.calls.resend).toHaveLength(1);
    expect((backend.calls.resend[0] as { email: string }).email).toBe('ana@email.com');
    await expect(page.locator(tid('confirm-email-login'))).toHaveAttribute('href', '/auth/login');
  });

  test('link: nada é chamado ao carregar; o clique confirma e segue para o próximo passo', async ({ page }) => {
    const backend = await mockBackend(page);
    await page.goto('/auth/confirmar-email?token_hash=abc123&type=email');
    await expect(page.locator(tid('confirm-email-confirm'))).toBeVisible();
    await page.waitForTimeout(500);
    expect(backend.calls.verify).toHaveLength(0);

    await page.locator(tid('confirm-email-confirm')).click();
    await expect(page).toHaveURL(/\/auth\/celular$/, { timeout: 10_000 });
    expect(backend.calls.verify).toHaveLength(1);
    expect(backend.calls.verify[0]).toMatchObject({ token_hash: 'abc123', type: 'email' });
    expect(backend.blocked).toEqual([]);
  });

  test('link inválido: estado "não vale mais" com os dois caminhos', async ({ page }) => {
    const backend = await mockBackend(page, { verifyFails: true });
    await page.goto('/auth/confirmar-email?token_hash=velho&type=email');
    await page.locator(tid('confirm-email-confirm')).click();
    await expect(page.locator(tid('confirm-email-invalid'))).toContainText('Este link não vale mais');
    expect(backend.calls.verify).toHaveLength(1);
    await expect(page.locator(tid('confirm-email-login'))).toHaveAttribute('href', '/auth/login');
    await page.locator(tid('confirm-email-new-link')).click();
    await expect(page).toHaveURL(/\/auth\/confirmar-email$/);
    await expect(page.locator(tid('confirm-email-input'))).toBeVisible();
  });

  test('login: "Criar conta" e "Voltar" levam para a tela certa', async ({ page }) => {
    await mockBackend(page);
    await page.setViewportSize({ width: 390, height: 844 }); // o Voltar só existe abaixo de xl
    await page.goto('/auth/login');
    await expect(page.locator(tid('login-signup-link'))).toHaveAttribute('href', '/auth/criar-conta');
    await page.locator(tid('login-signup-link')).click();
    await expect(page).toHaveURL(/\/auth\/criar-conta$/);
    await page.goto('/auth/login');
    await page.locator(tid('login-back')).click();
    await expect(page).toHaveURL(/\/auth$/);
  });
});
