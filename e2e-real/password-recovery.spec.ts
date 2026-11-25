import { expect, test, type Page } from '@playwright/test';
import { loginViaUi, tid } from './support/flows';
import { waitForLink } from './support/mailbox';
import { adminCreateUser, apiSignIn, authGetUser, confirmPhoneAsService, refresh, TEST_PASSWORD, uniqueEmail, uniquePhoneDigits } from './support/stack';

/** T072 e T087 (parte real): recuperacao de senha com o link real, link reutilizado, troca de senha encerra as outras sessoes. */

async function requestRecovery(page: Page, email: string): Promise<void> {
  await page.goto('/auth/recuperar-senha');
  await page.locator(tid('forgot-password-email')).fill(email);
  await page.locator(tid('forgot-password-submit')).click();
  await expect(page.locator(tid('forgot-password-sent'))).toBeVisible();
}

test('T072: recuperar -> link do e-mail -> nova senha -> entra com a nova, a antiga nao, e o mesmo link nao vale de novo', async ({ page }) => {
  const u = await adminCreateUser({});
  const nova = 'NovaSenha98765';
  await requestRecovery(page, u.email);
  const link = await waitForLink(u.email, 'token_hash=');
  expect(link).toContain('/auth/nova-senha?token_hash=');
  expect(link).toContain('type=recovery');

  await page.goto(link);
  await page.locator(tid('reset-password-input')).fill(nova);
  await page.locator(tid('reset-password-submit')).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator(tid('login-password-changed'))).toBeVisible();

  expect((await apiSignIn(u.email, TEST_PASSWORD)).status).toBe(400);
  expect((await apiSignIn(u.email, nova)).status).toBe(200);

  // a senha antiga na tela: mensagem generica; a nova na tela: sai de /auth/login
  await loginViaUi(page, u.email, TEST_PASSWORD);
  await expect(page.locator(tid('login-error'))).toBeVisible();
  await loginViaUi(page, u.email, nova);
  await expect(page).not.toHaveURL(/\/auth\/login/);

  // o mesmo link de novo: "Este link nao vale mais"
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(link);
  const input = page.locator(tid('reset-password-input'));
  if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
    await input.fill('OutraSenha13579');
    await page.locator(tid('reset-password-submit')).click();
  }
  await expect(page.locator(tid('reset-password-invalid'))).toBeVisible();
  expect((await apiSignIn(u.email, 'OutraSenha13579')).status).toBe(400);
});

test('T072 (enumeracao): a tela mostra o mesmo texto para e-mail existente e inexistente', async ({ page }) => {
  const u = await adminCreateUser({});
  const texto = async (email: string) => {
    await requestRecovery(page, email);
    const t = await page.locator('main').innerText();
    return t.split(email).join('<EMAIL>');
  };
  const existente = await texto(u.email);
  const inexistente = await texto(uniqueEmail('naoexiste'));
  expect(inexistente).toBe(existente);
});

test('T087: trocar a senha na conta encerra as outras sessoes e mantem a atual', async ({ page }) => {
  const u = await adminCreateUser({});
  await confirmPhoneAsService(u.id, uniquePhoneDigits());
  const outra = (await apiSignIn(u.email, u.password)).session!;
  expect(await authGetUser(outra.access_token)).toBe(200);

  await loginViaUi(page, u.email, u.password);
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  await page.goto('/app/conta/senha');
  const nova = 'TrocaSenha24680';
  await page.locator(tid('account-password-current')).fill(u.password);
  await page.locator(tid('account-password-new')).fill(nova);
  await page.locator(tid('account-password-submit')).click();
  await expect(page.locator(tid('account-password-success'))).toBeVisible();

  // a outra sessao nao renova mais; a atual segue valida
  expect(await refresh(outra.refresh_token)).not.toBe(200);
  await page.reload();
  await expect(page).toHaveURL(/\/app\/conta\/senha/);
  expect((await apiSignIn(u.email, nova)).status).toBe(200);
  expect((await apiSignIn(u.email, u.password)).status).toBe(400);
});

test('T087: senha atual errada nao troca nada', async ({ page }) => {
  const u = await adminCreateUser({});
  await confirmPhoneAsService(u.id, uniquePhoneDigits());
  await loginViaUi(page, u.email, u.password);
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  await page.goto('/app/conta/senha');
  await page.locator(tid('account-password-current')).fill('SenhaErrada00000');
  await page.locator(tid('account-password-new')).fill('TrocaSenha24680');
  await page.locator(tid('account-password-submit')).click();
  await expect(page.locator(tid('account-password-error'))).toBeVisible();
  expect((await apiSignIn(u.email, u.password)).status).toBe(200);
});
