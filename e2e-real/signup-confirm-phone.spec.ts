import { expect, test } from '@playwright/test';
import { signUpViaUi, loginViaUi, tid, typeSmsCode } from './support/flows';
import { waitForLink } from './support/mailbox';
import { apiSignIn, rest, TEST_PASSWORD, uniqueEmail, uniquePhoneDigits } from './support/stack';

/** T039 e T060: cadastro, link do e-mail, confirmar celular com o codigo do driver stub, chegar ao app. */

async function confirmEmailAndGo(page: import('@playwright/test').Page, email: string): Promise<void> {
  const link = await waitForLink(email, 'token_hash=');
  await page.goto(link);
  await page.locator(tid('confirm-email-confirm')).click();
}

test('T039/T060a: cadastro -> link -> confirmar e-mail -> codigo 424242 -> /app, e phone_is_confirmed vira true', async ({ page }) => {
  const email = uniqueEmail('signup');
  await signUpViaUi(page, { email, phoneDigits: uniquePhoneDigits() });
  await confirmEmailAndGo(page, email);
  await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
  await typeSmsCode(page);
  await expect(page).toHaveURL(/\/app(\?|$|\/)/);

  const { session } = await apiSignIn(email, TEST_PASSWORD);
  expect(session).not.toBeNull();
  const r = await rest('rpc/phone_is_confirmed', { token: session!.access_token, body: { p_user_id: session!.user.id } });
  expect(r.status).toBe(200);
  expect(r.body).toBe(true);
});

test('T039: antes de confirmar o e-mail, entrar mostra o aviso de e-mail nao confirmado', async ({ page }) => {
  const email = uniqueEmail('unconf');
  await signUpViaUi(page, { email, phoneDigits: uniquePhoneDigits() });
  await loginViaUi(page, email, TEST_PASSWORD);
  await expect(page.locator(tid('login-unconfirmed-notice'))).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('T060b: codigo errado mostra "restam 4"', async ({ page }) => {
  const email = uniqueEmail('wrongcode');
  await signUpViaUi(page, { email, phoneDigits: uniquePhoneDigits() });
  await confirmEmailAndGo(page, email);
  await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
  await typeSmsCode(page, '111111');
  await expect(page.locator(tid('confirm-phone-error'))).toContainText(/restam\s+4/i);
});

test('T060c: cadastro iniciado com returnUrl=/app/conta termina em /app/conta', async ({ page }) => {
  const email = uniqueEmail('retcta');
  await signUpViaUi(page, { email, phoneDigits: uniquePhoneDigits(), from: '/auth/criar-conta?returnUrl=%2Fapp%2Fconta' });
  await confirmEmailAndGo(page, email);
  await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
  await typeSmsCode(page);
  await expect(page).toHaveURL(/\/app\/conta(\?|$)/);
});

test('T060d: returnUrl externo (https://evil.com) e ignorado e termina em /app', async ({ page }) => {
  const email = uniqueEmail('evil');
  await signUpViaUi(page, {
    email,
    phoneDigits: uniquePhoneDigits(),
    from: '/auth/criar-conta?returnUrl=https%3A%2F%2Fevil.com',
  });
  await confirmEmailAndGo(page, email);
  await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
  await typeSmsCode(page);
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  expect(page.url()).not.toContain('evil.com');
});
