import { expect, test, type Page } from '@playwright/test';

/**
 * Fundação da conta (spec 004, Phase 2): navegação depois do login e guards.
 *
 * TODO O BACKEND É SIMULADO. O `ng serve` aponta para o projeto Supabase hospedado, então este
 * arquivo bloqueia (`abort`) qualquer requisição para `*.supabase.co` antes de simular as poucas
 * respostas de que a tela precisa. Nada aqui cria conta, envia e-mail ou escreve no projeto real.
 * A prova com os usuários do seed (`tutor.a`, `tutor.b`, `admin`) fica para o QA com Supabase local.
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
    email: 'simulado@faro.test',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-11-21T00:00:00Z',
  },
};

type Shape = 'tutorSemAceite' | 'tutorComAceite' | 'tutorSemCelular' | 'admin';

const ACCOUNTS: Record<Shape, { papel: 'tutor' | 'admin'; aceite: boolean; celular: boolean }> = {
  tutorSemAceite: { papel: 'tutor', aceite: false, celular: false },
  tutorComAceite: { papel: 'tutor', aceite: true, celular: true },
  tutorSemCelular: { papel: 'tutor', aceite: true, celular: false },
  admin: { papel: 'admin', aceite: true, celular: true },
};

function myAccount(shape: Shape) {
  const a = ACCOUNTS[shape];
  return {
    id: 'u1',
    nome: 'Pessoa de Teste',
    email: 'simulado@faro.test',
    papel: a.papel,
    celular: a.celular ? '+5511900000001' : null,
    celular_confirmado_em: a.celular ? '2026-11-21T12:00:00Z' : null,
    celular_pendente: null,
    termos_aceitos_em: a.aceite ? '2026-11-21T11:00:00Z' : null,
    termos_versao: a.aceite ? '2026-11' : null,
    tem_senha: true,
    provedores: ['email'],
    criado_em: '2026-11-21T10:00:00Z',
  };
}

/** Bloqueia o Supabase real e simula só o que o login usa. Registrar o `abort` primeiro: o último registro vence. */
async function mockBackend(page: Page, shape: Shape): Promise<{ blocked: string[] }> {
  const blocked: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => {
    blocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.abort();
  });
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/functions/v1/login-guard', (route) => route.fulfill(json({ decision: 'allow' })));
  await page.route('**/auth/v1/token?grant_type=password', (route) => route.fulfill(json(SESSION)));
  await page.route('**/rest/v1/rpc/current_user_role', (route) => route.fulfill(json(ACCOUNTS[shape].papel)));
  await page.route('**/rest/v1/rpc/my_account', (route) => route.fulfill(json(myAccount(shape))));
  return { blocked };
}

async function login(page: Page, query = ''): Promise<void> {
  await page.goto(`/auth/login${query}`);
  await page.locator(tid('login-email')).fill('simulado@faro.test');
  await page.locator(tid('login-password')).fill('SenhaSimulada123');
  await page.locator(tid('login-submit')).click();
}

test.describe('navegação depois do login (backend simulado)', () => {
  test('conta sem aceite dos termos vai para /auth/termos', async ({ page }) => {
    await mockBackend(page, 'tutorSemAceite');
    await login(page);
    await expect(page).toHaveURL(/\/auth\/termos$/);
  });

  test('o destino guardado sobrevive ao passo dos termos', async ({ page }) => {
    await mockBackend(page, 'tutorSemAceite');
    await login(page, '?returnUrl=%2Fapp%2Fconta');
    await expect(page).toHaveURL(/\/auth\/termos\?returnUrl=%2Fapp%2Fconta$/);
  });

  test('tutor com aceite e celular vai para /app', async ({ page }) => {
    await mockBackend(page, 'tutorComAceite');
    await login(page);
    await expect(page).toHaveURL(/\/app$/);
  });

  test('tutor com aceite e sem celular confirmado vai para /auth/celular', async ({ page }) => {
    await mockBackend(page, 'tutorSemCelular');
    await login(page);
    await expect(page).toHaveURL(/\/auth\/celular$/);
  });

  test('admin vai para /admin', async ({ page }) => {
    await mockBackend(page, 'admin');
    await login(page);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('returnUrl externo é ignorado', async ({ page }) => {
    await mockBackend(page, 'tutorComAceite');
    await login(page, '?returnUrl=https%3A%2F%2Fevil.com');
    await expect(page).toHaveURL(/\/app$/);
  });

  test('com sessão ativa na página, voltar a /app sem aceite leva a /auth/termos', async ({ page }) => {
    await mockBackend(page, 'tutorSemAceite');
    await login(page);
    await expect(page).toHaveURL(/\/auth\/termos$/);
    // navegação dentro do app (a sessão vive só na memória; ver restoreSession no log da spec)
    await page.evaluate(() => {
      history.pushState({}, '', '/app');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(/\/auth\/termos\?returnUrl=%2Fapp$/);
  });
});

test.describe('carga a frio (sem sessão em memória)', () => {
  test('/app sem sessão e sem marca cai nas boas-vindas, com o destino', async ({ page }) => {
    const { blocked } = await mockBackend(page, 'tutorComAceite');
    await page.goto('/app/conta');
    await expect(page.locator(tid('welcome-create-account'))).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/auth');
    expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/app/conta');
    expect(blocked).toEqual([]);
  });

  test('/app sem sessão e com a marca de quem já entrou cai no login, com o aviso de sessão expirada', async ({ page }) => {
    await mockBackend(page, 'tutorComAceite');
    await page.addInitScript(() => window.localStorage.setItem('faro.returning', '1'));
    await page.goto('/app/conta');
    await expect(page.locator(tid('login-submit'))).toBeVisible();
    expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/app/conta');
    expect(new URL(page.url()).searchParams.get('reason')).toBe('session_expired');
  });

  test('/auth/termos sem sessão não guarda destino dentro de /auth', async ({ page }) => {
    await mockBackend(page, 'tutorSemAceite');
    await page.goto('/auth/termos');
    await expect(page.locator(tid('welcome-create-account'))).toBeVisible();
    expect(new URL(page.url()).searchParams.get('returnUrl')).toBeNull();
  });
});

/** Grava a sessão do Supabase como o navegador a deixaria depois de um login (chave `sb-<ref>-auth-token`). */
async function persistSession(page: Page, where: 'localStorage' | 'sessionStorage'): Promise<void> {
  await page.addInitScript(
    ({ where, session }) => window[where].setItem('sb-orawzpslqvduwsvmlemv-auth-token', JSON.stringify(session)),
    { where, session: SESSION },
  );
}

test.describe('carga a frio com a sessão restaurada (session-bootstrap)', () => {
  test('sessão válida no localStorage: /app permanece em /app', async ({ page }) => {
    await mockBackend(page, 'tutorComAceite');
    await persistSession(page, 'localStorage');
    await page.goto('/app');
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator(tid('login-submit'))).toHaveCount(0);
  });

  test('sessão válida no sessionStorage ("Manter conectado" desligado) também é restaurada', async ({ page }) => {
    await mockBackend(page, 'tutorComAceite');
    await persistSession(page, 'sessionStorage');
    await page.goto('/app');
    await expect(page).toHaveURL(/\/app$/);
  });

  test('sessão de conta sem aceite: /app vai para /auth/termos', async ({ page }) => {
    await mockBackend(page, 'tutorSemAceite');
    await persistSession(page, 'localStorage');
    await page.goto('/app');
    await expect(page).toHaveURL(/\/auth\/termos\?returnUrl=%2Fapp$/);
  });

  test('sem sessão: /app vai para as boas-vindas', async ({ page }) => {
    await mockBackend(page, 'tutorComAceite');
    await page.goto('/app');
    await expect(page.locator(tid('welcome-create-account'))).toBeVisible();
    expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/app');
  });

  test('a página pública / sem sessão não faz nenhum pedido ao Supabase', async ({ page }) => {
    const hosts: string[] = [];
    page.on('request', (request) => hosts.push(new URL(request.url()).hostname));
    const { blocked } = await mockBackend(page, 'tutorComAceite');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(hosts.filter((h) => h.endsWith('.supabase.co'))).toEqual([]);
    expect(blocked).toEqual([]);
  });
});
