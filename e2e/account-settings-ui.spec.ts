import { expect, test, type Page } from '@playwright/test';

/**
 * Telas da Conta da Phase 8 (spec 004): dados pessoais, celular, trocar celular, senha e aparência.
 * Os e2e de ponta a ponta com banco e SMS reais são do QA (`account.spec.ts`, T086 e T090).
 *
 * TODO O BACKEND É SIMULADO. O `ng serve` aponta para o projeto Supabase hospedado, então este arquivo
 * bloqueia (`abort`) qualquer requisição para `*.supabase.co` antes de simular as respostas de que as
 * telas precisam. Nada aqui cria, altera ou exclui conta, nem envia SMS ou e-mail.
 */
const tid = (id: string) => `[data-testid="${id}"]`;

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const NOW = Math.floor(Date.now() / 1000);
const JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', role: 'authenticated', exp: NOW + 3600 })}.assinatura`;

const USER = {
  id: 'u1',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'ana@email.com',
  email_confirmed_at: '2026-11-22T10:00:00Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-11-22T09:00:00Z',
};

const SESSION = {
  access_token: JWT,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: NOW + 3600,
  refresh_token: 'refresh-simulado',
  user: USER,
};

interface State {
  blocked: string[];
  calls: string[];
  nome: string;
  celular: string | null;
  celularPendente: string | null;
  hasPassword: boolean;
  nameBodies: unknown[];
  startBodies: unknown[];
  startReplies: unknown[];
  tokenBodies: string[];
  tokenStatus: number;
  updateBodies: unknown[];
}

function newState(over: Partial<State> = {}): State {
  return {
    blocked: [],
    calls: [],
    nome: 'Ana Souza',
    celular: '+5511987654421',
    celularPendente: null,
    hasPassword: true,
    nameBodies: [],
    startBodies: [],
    startReplies: [
      {
        ok: true,
        phone: '+5511912345678',
        expires_at: '2099-01-01T00:10:00Z',
        resend_available_at: '2099-01-01T00:01:00Z',
        attempts_left: 5,
      },
    ],
    tokenBodies: [],
    tokenStatus: 200,
    updateBodies: [],
    ...over,
  };
}

/** Bloqueia o Supabase real e simula só o que as telas usam. Registrar o `abort` primeiro: o último registro vence. */
async function mockBackend(page: Page, state: State): Promise<State> {
  await page.route(/\.supabase\.co\//, (route) => {
    state.blocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.abort();
  });
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  const track = (name: string) => state.calls.push(name);

  await page.route('**/functions/v1/login-guard', (route) => {
    track('login-guard');
    return route.fulfill(json({ decision: 'allow' }));
  });
  await page.route('**/auth/v1/token?grant_type=password', (route) => {
    track('token');
    state.tokenBodies.push(route.request().postData() ?? '');
    if (state.tokenStatus !== 200) {
      return route.fulfill(json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400));
    }
    return route.fulfill(json(SESSION));
  });
  await page.route('**/auth/v1/user', (route) => {
    if (route.request().method() === 'PUT') {
      track('updateUser');
      state.updateBodies.push(route.request().postDataJSON());
    }
    return route.fulfill(json(USER));
  });
  await page.route('**/auth/v1/logout*', (route) => {
    track(`logout:${new URL(route.request().url()).searchParams.get('scope') ?? 'global'}`);
    return route.fulfill({ status: 204 });
  });
  await page.route('**/rest/v1/rpc/current_user_role', (route) => route.fulfill(json('tutor')));
  await page.route('**/rest/v1/rpc/my_account', (route) =>
    route.fulfill(
      json({
        id: 'u1',
        nome: state.nome,
        email: 'ana@email.com',
        papel: 'tutor',
        celular: state.celular,
        celular_confirmado_em: state.celular ? '2026-11-02T15:00:00Z' : null,
        celular_pendente: state.celularPendente,
        termos_aceitos_em: '2026-11-22T09:00:00Z',
        termos_versao: '2026-11',
        tem_senha: state.hasPassword,
        provedores: state.hasPassword ? ['email'] : ['google'],
        criado_em: '2026-11-22T09:00:00Z',
      }),
    ),
  );
  await page.route('**/rest/v1/perfis*', (route) => {
    if (route.request().method() === 'PATCH') {
      track('perfis-update');
      const body = route.request().postDataJSON() as { nome: string };
      state.nameBodies.push(body);
      state.nome = body.nome;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill(json([]));
  });
  await page.route('**/rest/v1/rpc/phone_verification_status', (route) =>
    route.fulfill(
      json({
        phone_confirmed: state.celular !== null,
        phone: state.celular,
        pending_phone: state.celularPendente,
        active: state.celularPendente ? { expires_at: '2099-01-01T00:10:00Z', attempts_left: 5 } : null,
        resend_available_at: null,
      }),
    ),
  );
  await page.route('**/functions/v1/phone-verify-start', (route) => {
    track('phone-verify-start');
    const reply = state.startReplies[Math.min(state.startBodies.length, state.startReplies.length - 1)];
    state.startBodies.push(route.request().postDataJSON());
    if ((reply as { ok?: boolean }).ok) {
      state.celularPendente = (reply as { phone: string }).phone;
    }
    return route.fulfill(json(reply));
  });
  return state;
}

async function persistSession(page: Page): Promise<void> {
  await page.addInitScript(
    (session) => window.localStorage.setItem('sb-orawzpslqvduwsvmlemv-auth-token', JSON.stringify(session)),
    SESSION,
  );
}

async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

async function open(page: Page, path: string, testId: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator(tid(testId))).toBeVisible();
}

test.describe('Telas da Conta, Phase 8 (backend simulado)', () => {
  test('dados pessoais: salvar o nome avisa "Dados salvos." e a lista mostra o nome novo', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await open(page, '/app/conta/dados', 'account-personal');
    await expect(page.locator(tid('account-personal-name'))).toHaveValue('Ana Souza');
    await expect(page.locator(tid('account-personal-email'))).toHaveValue('ana@email.com');
    await expect(page.locator(tid('account-personal-save'))).toBeDisabled();

    await page.locator(tid('account-personal-name')).fill('Ana Maria Souza');
    await expect(page.locator(tid('account-personal-save'))).toBeEnabled();
    await page.locator(tid('account-personal-save')).click();
    await expect(page.getByText('Dados salvos.', { exact: true }).first()).toBeVisible();
    expect(state.nameBodies).toEqual([{ nome: 'Ana Maria Souza' }]);
    await expect(page.locator(tid('account-personal-save'))).toBeDisabled();

    await page.locator(tid('screen-header-back')).first().click();
    await expect(page).toHaveURL(/\/app\/conta$/);
    await expect(page.locator(tid('account-name'))).toHaveText('Ana Maria Souza');
    expect(state.blocked).toEqual([]);
  });

  test('dados pessoais: 1 caractere não envia nada e mostra o erro do campo', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await open(page, '/app/conta/dados', 'account-personal');
    await page.locator(tid('account-personal-name')).fill('A');
    await page.locator(tid('account-personal-save')).click();
    await expect(page.locator(tid('account-personal-name-error'))).toContainText('Use entre 2 e 80 caracteres.');
    expect(state.nameBodies).toEqual([]);
  });

  test('celular confirmado: número, selo e "Trocar celular" com o destino de volta', async ({ page }) => {
    await mockBackend(page, newState());
    await persistSession(page);
    await open(page, '/app/conta/celular', 'account-phone');
    await expect(page.locator(tid('account-phone-number'))).toHaveText('(11) 98765-4421');
    await expect(page.locator(tid('account-phone-status'))).toHaveText('Confirmado');
    await expect(page.locator(tid('account-phone-change'))).toHaveAttribute(
      'href',
      '/auth/celular?returnUrl=%2Fapp%2Fconta%2Fcelular',
    );
  });

  test('celular não confirmado e troca pendente mostram o botão certo', async ({ page }) => {
    await mockBackend(page, newState({ celular: null, celularPendente: '+5511987654421' }));
    await persistSession(page);
    await open(page, '/app/conta/celular', 'account-phone');
    await expect(page.locator(tid('account-phone-status'))).toHaveText('Não confirmado');
    await expect(page.locator(tid('account-phone-confirm'))).toHaveAttribute(
      'href',
      '/auth/celular?returnUrl=%2Fapp%2Fconta%2Fcelular',
    );

    const second = await page.context().newPage();
    await mockBackend(second, newState({ celularPendente: '+5521999998888' }));
    await persistSession(second);
    await open(second, '/app/conta/celular', 'account-phone');
    await expect(second.locator(tid('account-phone-pending'))).toContainText(
      'Aguardando confirmação de (21) 99999-8888',
    );
    await expect(second.locator(tid('account-phone-continue'))).toHaveAttribute(
      'href',
      '/auth/confirmar-celular?returnUrl=%2Fapp%2Fconta%2Fcelular',
    );
  });

  test('trocar celular: modo troca envia o número e a senha, e vai para a confirmação', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await open(page, '/app/conta/celular', 'account-phone');
    await page.locator(tid('account-phone-change')).click();
    await expect(page).toHaveURL(/\/auth\/celular\?returnUrl=%2Fapp%2Fconta%2Fcelular$/);
    await expect(page.locator(tid('phone-title'))).toHaveText('Novo celular');
    await expect(page.locator(tid('phone-current'))).toContainText('Seu celular atual: (11) 98765-4421.');
    await expect(page.locator(tid('phone-skip'))).toHaveText('Cancelar');

    await page.locator(tid('phone-input')).fill('11912345678');
    await expect(page.locator(tid('phone-send'))).toBeDisabled();
    await page.locator(tid('phone-password')).fill('senhasegura');
    await page.locator(tid('phone-send')).click();
    await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
    expect(state.startBodies).toEqual([{ phone: '+5511912345678', password: 'senhasegura' }]);
    expect(page.url()).not.toContain('senhasegura');
    expect(state.blocked).toEqual([]);
  });

  test('trocar celular: senha errada mostra "Senha incorreta." e esvazia o campo; "Cancelar" volta', async ({ page }) => {
    const state = await mockBackend(page, newState({ startReplies: [{ ok: false, error: 'invalid_password' }] }));
    await persistSession(page);
    await open(page, '/auth/celular?returnUrl=%2Fapp%2Fconta%2Fcelular', 'phone-title');
    await page.locator(tid('phone-input')).fill('11912345678');
    await page.locator(tid('phone-password')).fill('errada');
    await page.locator(tid('phone-send')).click();
    await expect(page.locator(tid('phone-error'))).toContainText('Senha incorreta.');
    await expect(page.locator(tid('phone-password'))).toHaveValue('');
    expect(state.startBodies).toHaveLength(1);
    await page.locator(tid('phone-skip')).click();
    await expect(page).toHaveURL(/\/app\/conta\/celular$/);
  });

  test('senha: troca na ordem token, updateUser e saída das outras sessões; senha errada não troca', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await open(page, '/app/conta/senha', 'account-password');

    await page.locator(tid('account-password-current')).fill('atual1234');
    await page.locator(tid('account-password-new')).fill('1234567');
    await page.locator(tid('account-password-submit')).click();
    await expect(page.locator(tid('account-password-error'))).toContainText('Use uma senha com pelo menos 8 caracteres.');
    expect(state.calls).not.toContain('token');

    await page.locator(tid('account-password-new')).fill('NovaSenha123');
    await page.locator(tid('account-password-submit')).click();
    await expect(page.locator(tid('account-password-success'))).toContainText(
      'Senha alterada. As outras sessões foram encerradas.',
    );
    const order = state.calls.filter((c) => ['token', 'updateUser'].includes(c) || c.startsWith('logout:'));
    expect(order).toEqual(['token', 'updateUser', 'logout:others']);
    expect(state.updateBodies).toEqual([expect.objectContaining({ password: 'NovaSenha123' })]);
    await expect(page.locator(tid('account-password-current'))).toHaveValue('');
    expect(page.url()).not.toContain('Senha');

    state.tokenStatus = 400;
    state.calls.length = 0;
    await page.locator(tid('account-password-current')).fill('errada123');
    await page.locator(tid('account-password-new')).fill('OutraSenha123');
    await page.locator(tid('account-password-submit')).click();
    await expect(page.locator(tid('account-password-error'))).toContainText('Senha atual incorreta.');
    expect(state.calls).not.toContain('updateUser');
    expect(state.blocked).toEqual([]);
  });

  test('senha: conta só com o Google vê só a nota', async ({ page }) => {
    await mockBackend(page, newState({ hasPassword: false }));
    await persistSession(page);
    await open(page, '/app/conta/senha', 'account-password');
    await expect(page.locator(tid('account-password-google-note'))).toBeVisible();
    await expect(page.locator(tid('account-password-current'))).toHaveCount(0);
  });

  test('aparência: "Escura" escurece só a casca do tutor e vale depois de recarregar; o login continua claro', async ({ page }) => {
    await mockBackend(page, newState());
    await persistSession(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page, '/app/conta/aparencia', 'account-appearance');
    await expect(page.locator(tid('account-appearance-system'))).toHaveAttribute('aria-pressed', 'true');

    await page.locator(tid('account-appearance-dark')).click();
    await expect(page.locator(tid('account-appearance-dark'))).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('app-tutor-shell')).toHaveClass(/dark/);
    expect(await page.evaluate(() => window.localStorage.getItem('faro.theme'))).toBe('dark');
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);

    await page.reload();
    await expect(page.locator(tid('account-appearance-dark'))).toHaveAttribute('aria-pressed', 'true');

    // O login, aberto numa aba sem sessão e com a preferência escura gravada, continua claro.
    await page.evaluate(() => window.localStorage.removeItem('sb-orawzpslqvduwsvmlemv-auth-token'));
    const login = await page.context().newPage();
    await mockBackend(login, newState());
    await login.goto('/auth/login');
    await expect(login.locator('h1')).toBeVisible();
    expect(await login.evaluate(() => window.localStorage.getItem('faro.theme'))).toBe('dark');
    expect(await login.evaluate(() => document.querySelectorAll('.dark').length)).toBe(0);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`sem rolagem horizontal em ${width} px nas telas da Conta`, async ({ page }) => {
      await mockBackend(page, newState());
      await persistSession(page);
      await page.setViewportSize({ width, height: 900 });
      for (const [url, id] of [
        ['/app/conta/dados', 'account-personal'],
        ['/app/conta/celular', 'account-phone'],
        ['/app/conta/senha', 'account-password'],
        ['/app/conta/aparencia', 'account-appearance'],
        ['/auth/celular?returnUrl=%2Fapp%2Fconta%2Fcelular', 'phone-title'],
      ] as const) {
        await open(page, url, id);
        expect(await noHorizontalScroll(page), `${url} em ${width}px`).toBe(true);
      }
    });
  }
});
