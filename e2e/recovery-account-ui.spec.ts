import { expect, test, type Page } from '@playwright/test';

/**
 * Recuperar a senha, Conta (lista), sair, exportar os dados e excluir a conta
 * (spec 004, Phases 6 e 7, telas). Os e2e de ponta a ponta com e-mail e banco reais são do QA
 * (`password-recovery.spec.ts`, T072, e `account.spec.ts`, T082).
 *
 * TODO O BACKEND É SIMULADO. O `ng serve` aponta para o projeto Supabase hospedado, então este arquivo
 * bloqueia (`abort`) qualquer requisição para `*.supabase.co` antes de simular as respostas de que as
 * telas precisam. Nada aqui cria, altera ou exclui conta, nem envia e-mail ou escreve no projeto real.
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

const EXPORT = {
  formato: 1,
  gerado_em: '2026-11-22T12:30:00Z',
  conta: { id: 'u1', nome: 'Ana Souza', email: 'ana@email.com', papel: 'tutor' },
  consentimentos: [{ tipo: 'termos_e_privacidade', versao: '2026-11', aceito_em: '2026-11-21T11:58:00Z' }],
  eventos: [],
  tags_e_pets: null,
  observacoes: ['Dados de pets, tags e scans ainda não estão disponíveis nesta exportação.'],
};

interface State {
  blocked: string[];
  /** Pedidos simulados, na ordem em que chegaram. */
  calls: string[];
  recoveryBodies: unknown[];
  deleteBodies: unknown[];
  deleteReplies: unknown[];
  exportReply: { status: number; body: unknown };
  hasPassword: boolean;
  verifyStatus: number;
}

function newState(over: Partial<State> = {}): State {
  return {
    blocked: [],
    calls: [],
    recoveryBodies: [],
    deleteBodies: [],
    deleteReplies: [{ ok: true }],
    exportReply: { status: 200, body: EXPORT },
    hasPassword: true,
    verifyStatus: 200,
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

  await page.route('**/functions/v1/password-recovery', (route) => {
    track('password-recovery');
    state.recoveryBodies.push(route.request().postDataJSON());
    return route.fulfill(json({ ok: true }));
  });
  await page.route('**/auth/v1/verify', (route) => {
    track('verify');
    if (state.verifyStatus !== 200) {
      return route.fulfill(
        json({ code: state.verifyStatus, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }, state.verifyStatus),
      );
    }
    return route.fulfill(json(SESSION));
  });
  await page.route('**/auth/v1/user', (route) => {
    if (route.request().method() === 'PUT') track('updateUser');
    return route.fulfill(json(USER));
  });
  await page.route('**/auth/v1/logout*', (route) => {
    track(`logout:${new URL(route.request().url()).searchParams.get('scope') ?? 'global'}`);
    return route.fulfill({ status: 204 });
  });
  await page.route('**/functions/v1/login-guard', (route) => route.fulfill(json({ decision: 'allow' })));
  await page.route('**/rest/v1/rpc/current_user_role', (route) => route.fulfill(json('tutor')));
  await page.route('**/rest/v1/rpc/my_account', (route) =>
    route.fulfill(
      json({
        id: 'u1',
        nome: 'Ana Souza',
        email: 'ana@email.com',
        papel: 'tutor',
        celular: '+5511987654421',
        celular_confirmado_em: '2026-11-22T10:05:00Z',
        celular_pendente: null,
        termos_aceitos_em: '2026-11-22T09:00:00Z',
        termos_versao: '2026-11',
        tem_senha: state.hasPassword,
        provedores: state.hasPassword ? ['email'] : ['google'],
        criado_em: '2026-11-22T09:00:00Z',
      }),
    ),
  );
  await page.route('**/rest/v1/rpc/log_logout', (route) => {
    track('log_logout');
    return route.fulfill(json(null));
  });
  await page.route('**/rest/v1/rpc/export_my_data', (route) => {
    track('export_my_data');
    return route.fulfill(json(state.exportReply.body, state.exportReply.status));
  });
  await page.route('**/functions/v1/account-delete', (route) => {
    track('account-delete');
    const body = route.request().postDataJSON();
    const reply = state.deleteReplies[Math.min(state.deleteBodies.length, state.deleteReplies.length - 1)];
    state.deleteBodies.push(body);
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

test.describe('Recuperar a senha (backend simulado)', () => {
  test('esqueci a senha: e-mail inválido não envia; válido mostra a confirmação, sem e-mail na URL', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await page.goto('/auth/recuperar-senha');
    await page.locator(tid('forgot-password-email')).fill('ana@email');
    await page.locator(tid('forgot-password-submit')).click();
    await expect(page.locator(tid('forgot-password-error'))).toContainText('Informe um e-mail válido.');
    expect(state.recoveryBodies).toHaveLength(0);

    await page.locator(tid('forgot-password-email')).fill('ana@email.com');
    await page.locator(tid('forgot-password-submit')).click();
    await expect(page.locator(tid('forgot-password-sent'))).toContainText(
      'Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora.',
    );
    expect(state.recoveryBodies).toEqual([{ email: 'ana@email.com' }]);
    expect(page.url()).not.toContain('ana');
    await expect(page.locator(tid('forgot-password-countdown'))).toContainText('Você pode pedir outro link em 0:');
    await expect(page.locator(tid('forgot-password-back'))).toHaveAttribute('href', '/auth/login');
    expect(state.blocked).toEqual([]);
  });

  test('esqueci a senha: a confirmação é a mesma mesmo com o servidor fora do ar', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await page.route('**/functions/v1/password-recovery', (route) => route.abort());
    await page.goto('/auth/recuperar-senha');
    await page.locator(tid('forgot-password-email')).fill('ninguem@email.com');
    await page.locator(tid('forgot-password-submit')).click();
    await expect(page.locator(tid('forgot-password-sent'))).toContainText('Se existir uma conta com este e-mail');
    expect(state.recoveryBodies).toHaveLength(0);
  });

  test('o link "Esqueci a senha" do login leva à tela de recuperação, sem o aviso "em breve"', async ({ page }) => {
    await mockBackend(page, newState());
    await page.addInitScript(() => window.localStorage.setItem('faro.returning', '1'));
    await page.goto('/auth/login');
    const link = page.locator(tid('login-forgot-link'));
    await expect(link).not.toHaveAttribute('aria-label', /em breve/);
    await link.click();
    await expect(page).toHaveURL(/\/auth\/recuperar-senha$/);
    await expect(page.locator(tid('forgot-password-email'))).toBeVisible();
  });

  test('nova senha: nada é chamado ao carregar; senha curta não envia; a ordem é verifyOtp, updateUser, signOut global', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await page.goto('/auth/nova-senha?token_hash=hash-simulado&type=recovery');
    await expect(page.locator(tid('reset-password-input'))).toBeVisible();
    expect(state.calls).toEqual([]);

    await page.locator(tid('reset-password-input')).fill('1234567');
    await page.locator(tid('reset-password-submit')).click();
    await expect(page.locator(tid('reset-password-error'))).toContainText('Use uma senha com pelo menos 8 caracteres.');
    expect(state.calls).toEqual([]);

    await page.locator(tid('reset-password-input')).fill('NovaSenha123');
    await page.locator(tid('reset-password-submit')).click();
    await expect(page).toHaveURL(/\/auth\/login\?senha=alterada$/, { timeout: 10_000 });
    await expect(page.locator(tid('login-password-changed'))).toContainText('Senha alterada. Entre com a nova senha.');
    expect(state.calls).toEqual(['verify', 'updateUser', 'logout:global']);
    expect(page.url()).not.toContain('NovaSenha');
    expect(state.blocked).toEqual([]);
  });

  test('nova senha: link vencido mostra "Este link não vale mais" e leva a pedir outro', async ({ page }) => {
    const state = await mockBackend(page, newState({ verifyStatus: 403 }));
    await page.goto('/auth/nova-senha?token_hash=hash-velho&type=recovery');
    await page.locator(tid('reset-password-input')).fill('NovaSenha123');
    await page.locator(tid('reset-password-submit')).click();
    await expect(page.locator(tid('reset-password-invalid'))).toContainText('Este link não vale mais');
    expect(state.calls).toEqual(['verify']);
    await page.locator(tid('reset-password-new-link')).click();
    await expect(page).toHaveURL(/\/auth\/recuperar-senha$/);
  });

  test('nova senha: sem token_hash já abre como link inválido, sem chamar nada', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await page.goto('/auth/nova-senha');
    await expect(page.locator(tid('reset-password-invalid'))).toBeVisible();
    await expect(page.locator(tid('reset-password-new-link'))).toBeVisible();
    expect(state.calls).toEqual([]);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`sem rolagem horizontal em ${width} px nas telas de recuperação`, async ({ page }) => {
      await mockBackend(page, newState());
      await page.setViewportSize({ width, height: 900 });
      for (const url of ['/auth/recuperar-senha', '/auth/nova-senha?token_hash=x&type=recovery', '/auth/nova-senha']) {
        await page.goto(url);
        await expect(page.locator('h1')).toBeVisible();
        expect(await noHorizontalScroll(page), `${url} em ${width}px`).toBe(true);
      }
      await page.goto('/auth/recuperar-senha');
      await page.locator(tid('forgot-password-email')).fill('ana@email.com');
      await page.locator(tid('forgot-password-submit')).click();
      await expect(page.locator(tid('forgot-password-sent'))).toBeVisible();
      expect(await noHorizontalScroll(page), `enviado em ${width}px`).toBe(true);
    });
  }
});

test.describe('Conta, sair, exportar e excluir (backend simulado)', () => {
  test('lista: nome, e-mail, cinco linhas e "Conta" ativo na navegação', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await page.goto('/app/conta');
    await expect(page.locator(tid('account-name'))).toHaveText('Ana Souza');
    await expect(page.locator(tid('account-email'))).toHaveText('ana@email.com');
    await expect(page.locator(tid('account-phone-badge'))).toHaveText('Confirmado');
    for (const id of ['personal', 'phone', 'password', 'appearance', 'privacy']) {
      await expect(page.locator(tid(`account-row-${id}`))).toBeVisible();
    }
    await expect(page.locator('[data-testid="tutor-nav-conta"][aria-current="page"]:visible')).toHaveCount(1);
    expect(state.blocked).toEqual([]);
  });

  test('uma linha da Phase 8 ainda não pronta cai na tela "em construção", não em branco', async ({ page }) => {
    await mockBackend(page, newState());
    await persistSession(page);
    await page.goto('/app/conta');
    await page.locator(tid('account-row-personal')).click();
    await expect(page).toHaveURL(/\/app\/conta\/dados$/);
    await expect(page.locator(tid('shell-fallback'))).toContainText('Esta parte ainda está em construção.');
    await expect(page.locator(tid('shell-fallback-home'))).toHaveAttribute('href', '/app');
  });

  test('Sair registra a saída, encerra a sessão e leva ao login com o aviso', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await page.goto('/app/conta');
    await page.locator(tid('account-logout')).click();
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
    await expect(page.locator(tid('login-logged-out'))).toBeVisible();
    expect(state.calls.indexOf('log_logout')).toBeGreaterThanOrEqual(0);
    expect(state.calls.indexOf('log_logout')).toBeLessThan(state.calls.findIndex((c) => c.startsWith('logout:')));
  });

  test('privacidade: baixar meus dados gera o arquivo com o nome do dia e o JSON da conta', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await page.goto('/app/conta/privacidade');
    const downloadPromise = page.waitForEvent('download');
    await page.locator(tid('account-privacy-export')).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^faro-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const file = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(file.conta.email).toBe('ana@email.com');
    expect(JSON.stringify(file)).not.toMatch(/hash/);
    expect(state.calls).toContain('export_my_data');
    await expect(page.locator(tid('account-privacy-exported'))).toBeVisible();
  });

  test('privacidade: limite de exportação mostra o tempo e não baixa nada', async ({ page }) => {
    await mockBackend(
      page,
      newState({
        exportReply: { status: 400, body: { code: 'P0001', message: 'rate_limited', details: '5400', hint: null } },
      }),
    );
    await persistSession(page);
    await page.goto('/app/conta/privacidade');
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    await page.locator(tid('account-privacy-export')).click();
    await expect(page.locator(tid('account-privacy-export-error'))).toContainText(
      'Você já exportou seus dados 3 vezes hoje. Tente de novo em 2 horas.',
    );
    expect(downloaded).toBe(false);
  });

  test('excluir: botão desabilitado até EXCLUIR e a senha; senha errada mantém a conta; senha certa vai a /auth?conta=excluida', async ({ page }) => {
    const state = await mockBackend(
      page,
      newState({ deleteReplies: [{ ok: false, error: 'invalid_password' }, { ok: true }] }),
    );
    await persistSession(page);
    await page.addInitScript(() => window.localStorage.setItem('faro.returning', '1'));
    await page.goto('/app/conta/privacidade');
    await page.locator(tid('account-privacy-delete')).click();
    const submit = page.locator(tid('account-delete-submit'));
    await expect(submit).toBeDisabled();
    await page.locator(tid('account-delete-confirm-text')).fill('EXCLUIR');
    await expect(submit).toBeDisabled();
    await page.locator(tid('account-delete-password')).fill('errada123');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.locator(tid('account-delete-error'))).toContainText('Senha incorreta.');
    await expect(page.locator(tid('account-delete-password'))).toHaveValue('');
    await expect(page).toHaveURL(/\/app\/conta\/privacidade$/);

    await page.locator(tid('account-delete-password')).fill('SenhaSegura1');
    await submit.click();
    await expect(page).toHaveURL(/\/auth\?conta=excluida$/, { timeout: 10_000 });
    await expect(page.locator(tid('welcome-deleted-notice'))).toContainText('Sua conta foi excluída.');
    expect(state.deleteBodies).toEqual([
      { confirm: 'EXCLUIR', password: 'errada123' },
      { confirm: 'EXCLUIR', password: 'SenhaSegura1' },
    ]);
    expect(page.url()).not.toContain('SenhaSegura1');
    expect(await page.evaluate(() => window.localStorage.getItem('faro.returning'))).toBeNull();
    expect(state.blocked).toEqual([]);
  });

  test('excluir: Cancelar fecha sem chamar o servidor', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await page.goto('/app/conta/privacidade');
    await page.locator(tid('account-privacy-delete')).click();
    await page.locator(tid('account-delete-confirm-text')).fill('EXCLUIR');
    await page.locator(tid('account-delete-cancel')).click();
    await expect(page.locator(tid('account-delete-submit'))).toHaveCount(0);
    expect(state.deleteBodies).toHaveLength(0);
  });

  test('excluir, conta só com o Google: sem campo de senha, e o aviso de reautenticação leva ao Google', async ({ page }) => {
    const state = await mockBackend(
      page,
      newState({ hasPassword: false, deleteReplies: [{ ok: false, error: 'reauth_required', method: 'google' }] }),
    );
    await persistSession(page);
    await page.goto('/app/conta/privacidade');
    await page.locator(tid('account-privacy-delete')).click();
    await expect(page.locator(tid('account-delete-password'))).toHaveCount(0);
    await page.locator(tid('account-delete-confirm-text')).fill('EXCLUIR');
    await page.locator(tid('account-delete-submit')).click();
    await expect(page.locator(tid('account-delete-error'))).toContainText('Confirme que é você para excluir a conta.');
    expect(state.deleteBodies).toEqual([{ confirm: 'EXCLUIR' }]);
    // O pedido ao Google é desviado de volta para o app (a sessionStorage sobrevive à navegação no mesmo domínio).
    let provider: string | null = null;
    await page.route('**/auth/v1/authorize*', (route) => {
      provider = new URL(route.request().url()).searchParams.get('provider');
      return route.fulfill({ status: 302, headers: { location: 'http://localhost:4200/auth/login' } });
    });
    await page.locator(tid('account-delete-google-reauth')).click();
    await expect.poll(() => provider).toBe('google');
    await expect(page).toHaveURL('http://localhost:4200/auth/login');
    expect(await page.evaluate(() => window.sessionStorage.getItem('faro.returnUrl'))).toBe('/app/conta/privacidade');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`tema ${scheme}: privacidade e diálogo seguem o tema do app`, async ({ page }) => {
      await mockBackend(page, newState());
      await persistSession(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/app/conta/privacidade');
      await page.locator(tid('account-privacy-delete')).click();
      await expect(page.locator(tid('account-delete-submit'))).toBeVisible();
      const dark = await page.evaluate(() => ({
        shell: document.querySelector('[data-testid="tutor-shell"]')?.classList.contains('dark') ?? false,
        overlay: document.querySelector('.cdk-overlay-container')?.classList.contains('dark') ?? false,
        panelBg: getComputedStyle(document.querySelector('[role="alertdialog"]') as Element).backgroundColor,
      }));
      expect(dark.shell).toBe(scheme === 'dark');
      expect(dark.overlay).toBe(scheme === 'dark');
      const [r, g, b] = (dark.panelBg.match(/\d+(\.\d+)?/g) ?? ['255', '255', '255']).map(Number);
      const luminance = (r + g + b) / 3;
      if (scheme === 'dark') expect(luminance).toBeLessThan(90);
      else expect(luminance).toBeGreaterThan(200);
    });
  }

  for (const width of [320, 390, 768, 1440]) {
    test(`sem rolagem horizontal em ${width} px na lista, na privacidade e no diálogo`, async ({ page }) => {
      await mockBackend(page, newState());
      await persistSession(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app/conta');
      await expect(page.locator(tid('account-name'))).toBeVisible();
      expect(await noHorizontalScroll(page), `lista em ${width}px`).toBe(true);
      await page.goto('/app/conta/privacidade');
      await expect(page.locator(tid('account-privacy-export'))).toBeVisible();
      expect(await noHorizontalScroll(page), `privacidade em ${width}px`).toBe(true);
      await page.locator(tid('account-privacy-delete')).click();
      await expect(page.locator(tid('account-delete-submit'))).toBeVisible();
      expect(await noHorizontalScroll(page), `diálogo em ${width}px`).toBe(true);
    });
  }
});
