import { expect, type Page } from '@playwright/test';
import { SMS_STUB_CODE, TEST_PASSWORD } from './stack';

export const tid = (id: string) => `[data-testid="${id}"]`;

/** Preenche e envia o cadastro pela tela. Termina na tela de espera do e-mail. */
export async function signUpViaUi(
  page: Page,
  p: { name?: string; email: string; phoneDigits: string; password?: string; from?: string },
): Promise<void> {
  await page.goto(p.from ?? '/auth/criar-conta');
  await page.locator(tid('signup-name')).fill(p.name ?? 'Pessoa E2E');
  await page.locator(tid('signup-email')).fill(p.email);
  await page.locator(tid('signup-phone')).fill(p.phoneDigits);
  await page.locator(tid('signup-password')).fill(p.password ?? TEST_PASSWORD);
  await page.locator(`${tid('signup-terms')} input`).click();
  await page.locator(tid('signup-submit')).click();
  await expect(page).toHaveURL(/\/auth\/confirmar-email/);
}

/** Entra pela tela de login. */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.locator(tid('login-email')).fill(email);
  await page.locator(tid('login-password')).fill(password);
  await page.locator(tid('login-submit')).click();
}

/** Digita o codigo do SMS na tela de confirmar celular (driver stub). */
export async function typeSmsCode(page: Page, code: string = SMS_STUB_CODE): Promise<void> {
  await page.locator(tid('confirm-phone-cell-1')).click();
  await page.keyboard.type(code);
  const submit = page.locator(tid('confirm-phone-submit'));
  if (await submit.isVisible().catch(() => false)) {
    if (await submit.isEnabled().catch(() => false)) await submit.click();
  }
}
