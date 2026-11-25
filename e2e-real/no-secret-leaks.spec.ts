import { expect, test } from '@playwright/test';
import { signUpViaUi, loginViaUi, tid, typeSmsCode } from './support/flows';
import { waitForLink } from './support/mailbox';
import { SMS_STUB_CODE, TEST_PASSWORD, uniqueEmail, uniquePhoneDigits } from './support/stack';

/**
 * Gate (security-hardening §9 e portao T094): senha e codigo de SMS nunca aparecem em URL (do navegador nem de pedido) nem em
 * localStorage/sessionStorage. O log das Edge Functions e conferido por um passo do workflow (nao ha como lê-lo daqui).
 */
test('cadastro, codigo do SMS e login: senha e codigo fora de URL e de storage', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  page.on('framenavigated', (f) => urls.push(f.url()));

  const email = uniqueEmail('leak');
  await signUpViaUi(page, { email, phoneDigits: uniquePhoneDigits() });
  const link = await waitForLink(email, 'token_hash=');
  await page.goto(link);
  await page.locator(tid('confirm-email-confirm')).click();
  await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
  await typeSmsCode(page);
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);

  const stores = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
  expect(stores).not.toContain(TEST_PASSWORD);
  expect(stores).not.toContain(SMS_STUB_CODE);
  const joined = urls.join('\n');
  expect(joined).not.toContain(TEST_PASSWORD);
  expect(joined).not.toContain(encodeURIComponent(TEST_PASSWORD));
  expect(joined).not.toContain(SMS_STUB_CODE);

  // login pela tela
  await page.goto('/app/conta');
  await page.locator(tid('account-logout')).click();
  await expect(page).toHaveURL(/localhost:4200/auth(?|$|/)/);
  await loginViaUi(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  const after = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
  expect(after).not.toContain(TEST_PASSWORD);
  expect(page.url()).not.toContain(TEST_PASSWORD);
});
