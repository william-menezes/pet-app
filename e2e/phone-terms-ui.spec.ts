import { expect, test, type Page } from '@playwright/test';

/**
 * Aceite dos termos, informar e confirmar o celular, e o botão do Google no cadastro
 * (spec 004, Phases 4 e 5, telas).
 *
 * TODO O BACKEND É SIMULADO. O `ng serve` aponta para o projeto Supabase hospedado, então este arquivo
 * bloqueia (`abort`) qualquer requisição para `*.supabase.co` antes de simular as poucas respostas de que
 * as telas precisam. Nada aqui cria conta, envia SMS ou e-mail, nem escreve no projeto real. A prova com
 * o SMS de verdade e com o Google real fica para o QA (T060, T064, T065).
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
    app_metadata: { provider: 'google' },
    user_metadata: {},
    created_at: '2026-11-22T09:00:00Z',
  },
};

interface State {
  termsAccepted: boolean;
  phoneConfirmed: boolean;
  pending: string | null;
  activeCode: boolean;
  /** Respostas simuladas das funções, em ordem; a última se repete. */
  startReplies: unknown[];
  confirmReplies: unknown[];
  startBodies: unknown[];
  confirmBodies: unknown[];
  blocked: string[];
}

function newState(over: Partial<State> = {}): State {
  return {
    termsAccepted: true,
    phoneConfirmed: false,
    pending: '+5511987654421',
    activeCode: true,
    startReplies: [
      {
        ok: true,
        phone: '+5511987654421',
        expires_at: '2099-01-01T00:10:00Z',
        resend_available_at: '2099-01-01T00:01:00Z',
        attempts_left: 5,
      },
    ],
    confirmReplies: [{ ok: true, phone: '+5511987654421' }],
    startBodies: [],
    confirmBodies: [],
    blocked: [],
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
  const next = (replies: unknown[], used: number) => replies[Math.min(used, replies.length - 1)];

  await page.route('**/rest/v1/rpc/current_user_role', (route) => route.fulfill(json('tutor')));
  await page.route('**/rest/v1/rpc/my_account', (route) =>
    route.fulfill(
      json({
        id: 'u1',
        nome: 'Ana Souza',
        email: 'ana@email.com',
        papel: 'tutor',
        celular: state.phoneConfirmed ? '+5511987654421' : null,
        celular_confirmado_em: state.phoneConfirmed ? '2026-11-22T10:05:00Z' : null,
        celular_pendente: state.phoneConfirmed ? null : state.pending,
        termos_aceitos_em: state.termsAccepted ? '2026-11-22T09:00:00Z' : null,
        termos_versao: state.termsAccepted ? '2026-11' : null,
        tem_senha: false,
        provedores: ['google'],
        criado_em: '2026-11-22T09:00:00Z',
      }),
    ),
  );
  await page.route('**/rest/v1/rpc/accept_terms', (route) => {
    state.termsAccepted = true;
    return route.fulfill(json(null));
  });
  await page.route('**/rest/v1/rpc/phone_verification_status', (route) =>
    route.fulfill(
      json({
        phone_confirmed: state.phoneConfirmed,
        phone: null,
        pending_phone: state.pending,
        active: state.activeCode ? { expires_at: '2099-01-01T00:10:00Z', attempts_left: 5 } : null,
        resend_available_at: null,
      }),
    ),
  );
  await page.route('**/functions/v1/phone-verify-start', (route) => {
    const body = route.request().postDataJSON();
    const reply = next(state.startReplies, state.startBodies.length);
    state.startBodies.push(body);
    if ((reply as { ok?: boolean }).ok) state.activeCode = true;
    return route.fulfill(json(reply));
  });
  await page.route('**/functions/v1/phone-verify-confirm', (route) => {
    const body = route.request().postDataJSON();
    const reply = next(state.confirmReplies, state.confirmBodies.length);
    state.confirmBodies.push(body);
    if ((reply as { ok?: boolean }).ok) state.phoneConfirmed = true;
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

async function typeCode(page: Page, code: string): Promise<void> {
  await page.locator(tid('confirm-phone-cell-1')).click();
  await page.keyboard.type(code);
}

test.describe('Celular, termos e Google: telas e fluxo (backend simulado)', () => {
  test('informar celular: pré-preenche, envia em E.164 e segue para o código', async ({ page }) => {
    const state = await mockBackend(page, newState({ activeCode: false }));
    await persistSession(page);
    await page.goto('/auth/celular?returnUrl=%2Fativar%2F7K3M-Q9XA-C');
    await expect(page.locator(tid('phone-input'))).toHaveValue('(11) 98765-4421');
    await page.locator(tid('phone-send')).click();
    await expect(page).toHaveURL(/\/auth\/confirmar-celular\?returnUrl=%2Fativar%2F7K3M-Q9XA-C$/, { timeout: 10_000 });
    expect(state.startBodies).toEqual([{ phone: '+5511987654421' }]);
    await expect(page.locator(tid('confirm-phone-cell-1'))).toBeVisible();
    await expect(page.locator(tid('confirm-phone-number'))).toHaveText('(11) 98765-4421');
    expect(page.url()).not.toContain('98765');
  });

  test('informar celular: "Agora não" leva ao app sem enviar nada', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await page.goto('/auth/celular');
    await page.locator(tid('phone-skip')).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 10_000 });
    expect(state.startBodies).toHaveLength(0);
  });

  test('informar celular: rate_limited mostra o aviso e mantém a saída', async ({ page }) => {
    await mockBackend(page, newState({ startReplies: [{ ok: false, error: 'rate_limited', retry_after_seconds: 3600 }] }));
    await persistSession(page);
    await page.goto('/auth/celular');
    await page.locator(tid('phone-send')).click();
    await expect(page.locator(tid('phone-error'))).toContainText('Muitos pedidos de código. Tente de novo em 1 hora.');
    await expect(page.locator(tid('phone-skip'))).toBeEnabled();
  });

  test('confirmar celular: digitar os 6 dígitos habilita o botão e leva ao app', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await persistSession(page);
    await page.goto('/auth/confirmar-celular');
    await expect(page.locator(tid('confirm-phone-submit'))).toBeDisabled();
    await typeCode(page, '482913');
    await expect(page.locator(tid('confirm-phone-submit'))).toBeEnabled();
    await page.locator(tid('confirm-phone-submit')).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 10_000 });
    expect(state.confirmBodies).toEqual([{ code: '482913' }]);
    expect(page.url()).not.toContain('482913');
  });

  test('confirmar celular: código incorreto limpa as células e foca a primeira', async ({ page }) => {
    await mockBackend(
      page,
      newState({ confirmReplies: [{ ok: false, error: 'invalid_code', attempts_left: 2 }] }),
    );
    await persistSession(page);
    await page.goto('/auth/confirmar-celular');
    await typeCode(page, '111111');
    await page.locator(tid('confirm-phone-submit')).click();
    await expect(page.locator(tid('confirm-phone-error'))).toContainText('Código incorreto. Você tem mais 2 tentativas.');
    await expect(page.locator(tid('confirm-phone-cell-1'))).toBeFocused();
    await expect(page.locator(tid('confirm-phone-cell-1'))).toHaveValue('');
    await expect(page.locator(tid('confirm-phone-continue-without'))).toHaveCount(0);
  });

  test('confirmar celular: código vencido oferece reenviar e volta às células', async ({ page }) => {
    const state = await mockBackend(page, newState({ confirmReplies: [{ ok: false, error: 'expired' }] }));
    await persistSession(page);
    await page.goto('/auth/confirmar-celular');
    await typeCode(page, '111111');
    await page.locator(tid('confirm-phone-submit')).click();
    await expect(page.locator(tid('confirm-phone-error'))).toContainText('Este código venceu. Peça um novo.');
    await page.locator(tid('confirm-phone-resend')).click();
    await expect(page.locator(tid('confirm-phone-cell-1'))).toBeVisible();
    expect(state.startBodies).toHaveLength(1);
  });

  test('confirmar celular: SMS indisponível oferece tentar de novo e continuar sem confirmar', async ({ page }) => {
    await mockBackend(page, newState({ startReplies: [{ ok: false, error: 'sms_unavailable' }] }));
    await persistSession(page);
    await page.goto('/auth/confirmar-celular');
    await page.locator(tid('confirm-phone-resend')).click();
    await expect(page.locator(tid('confirm-phone-error'))).toContainText('Não conseguimos enviar o SMS agora.');
    await expect(page.locator(tid('confirm-phone-resend'))).toContainText('Tentar de novo');
    await page.locator(tid('confirm-phone-continue-without')).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 10_000 });
  });

  test('confirmar celular sem número pendente volta para /auth/celular', async ({ page }) => {
    await mockBackend(page, newState({ pending: null, activeCode: false }));
    await persistSession(page);
    await page.goto('/auth/confirmar-celular');
    await expect(page).toHaveURL(/\/auth\/celular$/, { timeout: 10_000 });
  });

  test('aceite dos termos: abrir /app sem aceite leva à tela, e aceitar segue para o celular', async ({ page }) => {
    await mockBackend(page, newState({ termsAccepted: false, pending: null, activeCode: false }));
    await persistSession(page);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/auth\/termos\?returnUrl=%2Fapp$/);
    await expect(page.locator(tid('terms-account'))).toContainText('Você entrou com o Google');
    await expect(page.locator(tid('terms-accept'))).toBeDisabled();
    await page.locator(`${tid('terms-checkbox')} input`).click();
    await expect(page.locator(tid('terms-accept'))).toBeEnabled();
    await page.locator(tid('terms-accept')).click();
    await expect(page).toHaveURL(/\/auth\/celular\?returnUrl=%2Fapp$/, { timeout: 10_000 });
  });

  test('cadastro: "Continuar com o Google" pede o OAuth do Google com o retorno em /auth/callback', async ({ page }) => {
    const state = await mockBackend(page, newState());
    await page.goto('/auth/criar-conta');
    const google = page.locator(tid('signup-google'));
    await expect(google).toContainText('Continuar com o Google');
    await expect(google.locator('app-google-glyph svg')).toBeVisible();
    const authorize = page.waitForRequest(/\/auth\/v1\/authorize/);
    await google.click();
    const url = new URL((await authorize).url());
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_to')).toMatch(/\/auth\/callback$/);
    // O pedido do OAuth foi barrado (backend simulado): nenhum outro pedido saiu.
    expect(state.blocked.every((entry) => entry.includes('/auth/v1/authorize'))).toBe(true);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`sem rolagem horizontal em ${width} px`, async ({ page }) => {
      await mockBackend(page, newState({ termsAccepted: true }));
      await persistSession(page);
      await page.setViewportSize({ width, height: width >= 1440 ? 900 : width >= 768 ? 1024 : 844 });
      for (const url of ['/auth/celular', '/auth/confirmar-celular', '/auth/criar-conta']) {
        await page.goto(url);
        await expect(page.locator('h1')).toBeVisible();
        expect(await noHorizontalScroll(page), `${url} em ${width}px`).toBe(true);
      }
    });
  }

  test('aceite dos termos sem rolagem horizontal em 320 e 1440 px', async ({ page }) => {
    await mockBackend(page, newState({ termsAccepted: false }));
    await persistSession(page);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/auth/termos');
      await expect(page.locator('h1')).toBeVisible();
      expect(await noHorizontalScroll(page), `termos em ${width}px`).toBe(true);
    }
  });
});
