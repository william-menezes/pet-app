import { expect, test, type Page } from '@playwright/test';
import { loginViaUi, tid, typeSmsCode } from './support/flows';
import {
  adminCreateUser,
  apiSignIn,
  confirmPhoneAsService,
  e164,
  rest,
  serviceRequest,
  stack,
  TEST_PASSWORD,
  uniquePhoneDigits,
} from './support/stack';

/** T082, T086 e T090 (parte real): sair, exportar, excluir, trocar celular, nome e aparencia. */

async function newTutor(): Promise<{ id: string; email: string; password: string; phone: string }> {
  const u = await adminCreateUser({});
  const phone = uniquePhoneDigits();
  await confirmPhoneAsService(u.id, phone);
  return { ...u, phone };
}

async function enter(page: Page, u: { email: string; password: string }): Promise<void> {
  await loginViaUi(page, u.email, u.password);
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
}

function keysDeep(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.push(k);
      keysDeep(x, out);
    }
  }
  return out;
}

test('T082a: Conta -> Sair leva a tela de entrada e grava um evento logout novo', async ({ page }) => {
  const u = await newTutor();
  await enter(page, u);
  const antes = (await serviceRequest(`auth_audit_log?evento=eq.logout&ator=eq.${u.id}&select=id`)).body.length;
  await page.goto('/app/conta');
  await page.locator(tid('account-logout')).click();
  await expect(page).toHaveURL(/localhost:4200\/auth(\?|$|\/)/);
  await expect.poll(async () => (await serviceRequest(`auth_audit_log?evento=eq.logout&ator=eq.${u.id}&select=id`)).body.length).toBe(antes + 1);
});

test('T082b: exportar baixa um JSON com a conta do proprio usuario e sem chave "hash"', async ({ page }) => {
  const u = await newTutor();
  const outro = await adminCreateUser({});
  await enter(page, u);
  await page.goto('/app/conta/privacidade');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator(tid('account-privacy-export')).click()]);
  const path = await download.path();
  const text = (await import('node:fs')).readFileSync(path, 'utf8');
  const data = JSON.parse(text);
  expect(data.conta.email).toBe(u.email);
  expect(keysDeep(data).filter((k) => /hash/i.test(k))).toEqual([]);
  expect(text).not.toContain(outro.email);
});

test('T082c: excluir com a senha errada mostra erro e a conta continua', async ({ page }) => {
  const u = await newTutor();
  await enter(page, u);
  await page.goto('/app/conta/privacidade');
  await page.locator(tid('account-privacy-delete')).click();
  await page.locator(tid('account-delete-confirm-text')).fill('EXCLUIR');
  await page.locator(tid('account-delete-password')).fill('SenhaErrada00000');
  await page.locator(tid('account-delete-submit')).click();
  await expect(page.locator(tid('account-delete-error'))).toBeVisible();
  expect((await apiSignIn(u.email, u.password)).status).toBe(200);
  expect((await serviceRequest(`perfis?id=eq.${u.id}&select=id`)).body.length).toBe(1);
});

test('T082d: excluir com a senha certa leva a /auth?conta=excluida, o login falha e o e-mail pode se cadastrar de novo', async ({ page }) => {
  const u = await newTutor();
  await enter(page, u);
  await page.goto('/app/conta/privacidade');
  await page.locator(tid('account-privacy-delete')).click();
  await page.locator(tid('account-delete-confirm-text')).fill('EXCLUIR');
  await page.locator(tid('account-delete-password')).fill(u.password);
  await page.locator(tid('account-delete-submit')).click();
  await expect(page).toHaveURL(/\/auth\?conta=excluida/);
  await expect(page.locator(tid('welcome-deleted-notice'))).toBeVisible();

  expect((await apiSignIn(u.email, u.password)).status).toBe(400);
  expect((await serviceRequest(`perfis?id=eq.${u.id}&select=id`)).body.length).toBe(0);
  const evento = await serviceRequest('auth_audit_log?evento=eq.conta_excluida&ator=is.null&select=id');
  expect(evento.body.length).toBeGreaterThanOrEqual(1);

  const again = await fetch(`${stack.url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: stack.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: TEST_PASSWORD, data: { name: 'Volta', terms_version: '2026-11' } }),
  });
  expect(again.status).toBe(200);
});

test('T086: trocar celular com senha errada nao muda nada; com a certa mantem o antigo ate confirmar o novo', async ({ page }) => {
  const u = await newTutor();
  const novo = uniquePhoneDigits();
  await enter(page, u);
  await page.goto('/app/conta/celular');
  await page.locator(tid('account-phone-change')).click();
  await expect(page).toHaveURL(/\/auth\/celular/);

  // senha errada
  await page.locator(tid('phone-input')).fill(novo);
  await page.locator(tid('phone-password')).fill('SenhaErrada00000');
  await page.locator(tid('phone-send')).click();
  await expect(page.locator(tid('phone-error'))).toBeVisible();
  let { session } = await apiSignIn(u.email, u.password);
  let acct = (await rest('rpc/my_account', { token: session!.access_token, body: {} })).body;
  expect(acct.celular).toBe(e164(u.phone));
  expect(acct.celular_pendente).toBeNull();

  // senha certa
  await page.locator(tid('phone-password')).fill(u.password);
  await page.locator(tid('phone-send')).click();
  await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
  ({ session } = await apiSignIn(u.email, u.password));
  acct = (await rest('rpc/my_account', { token: session!.access_token, body: {} })).body;
  expect(acct.celular).toBe(e164(u.phone));
  expect(acct.celular_pendente).toBe(e164(novo));
  const ainda = await rest('rpc/phone_is_confirmed', { token: session!.access_token, body: { p_user_id: u.id } });
  expect(ainda.body).toBe(true);

  await typeSmsCode(page);
  await expect(page).toHaveURL(/\/app\/conta\/celular/);
  acct = (await rest('rpc/my_account', { token: session!.access_token, body: {} })).body;
  expect(acct.celular).toBe(e164(novo));
  expect(acct.celular_pendente).toBeNull();
  await expect(page.locator(tid('account-phone-badge'))).toContainText(/confirmado/i);
});

test('T090a: alterar o nome aparece em /app/conta', async ({ page }) => {
  const u = await newTutor();
  await enter(page, u);
  await page.goto('/app/conta/dados');
  await page.locator(tid('account-personal-name')).fill('Nome Novo E2E');
  await page.locator(tid('account-personal-save')).click();
  await expect(page.locator(tid('account-personal-saved'))).toBeAttached();
  await page.goto('/app/conta');
  await expect(page.locator(tid('account-name'))).toContainText('Nome Novo E2E');
  expect((await serviceRequest(`perfis?id=eq.${u.id}&select=nome`)).body[0].nome).toBe('Nome Novo E2E');
});

test('T090c: escolher Escura escurece so a casca do tutor e o login continua claro', async ({ page }) => {
  const u = await newTutor();
  await enter(page, u);
  await page.goto('/app/conta/aparencia');
  await page.locator(tid('account-appearance-dark')).click();
  await expect(page.locator('app-tutor-shell')).toHaveClass(/dark/);
  await page.goto('/app/conta');
  await page.locator(tid('account-logout')).click();
  await expect(page).toHaveURL(/localhost:4200\/auth(\?|$|\/)/);
  await page.goto('/auth/login');
  expect(await page.evaluate(() => document.querySelectorAll('.dark').length)).toBe(0);
});
