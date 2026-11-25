import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11y, WIDTHS } from '../e2e/support/ui';
import { loginViaUi, tid } from './support/flows';
import { adminCreateUser, confirmPhoneAsService, SEED, uniquePhoneDigits } from './support/stack';

/**
 * T091 (parte real): axe (sem violacoes serious ou critical) e sem rolagem horizontal em 320, 390, 768 e 1440 px nas telas
 * da spec 004. Roda com sessoes reais do stack local (nada e simulado, nada toca o projeto hospedado).
 * Telas com sessao: Conta e suas cinco telas (claro e escuro). Telas sem sessao: /auth, criar conta, recuperar senha,
 * nova senha (sem token: estado "link invalido"), termos e privacidade.
 */

const SIZES = Object.values(WIDTHS);

async function check(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11y(page);
}

const PUBLIC_SCREENS = [
  '/auth',
  '/auth/criar-conta',
  '/auth/login',
  '/auth/recuperar-senha',
  '/auth/nova-senha',
  '/legal/termos',
  '/legal/privacidade',
];

for (const path of PUBLIC_SCREENS) {
  for (const size of SIZES) {
    test(`a11y ${path} em ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await check(page, path);
    });
  }
}

const ACCOUNT_SCREENS = [
  '/app/conta',
  '/app/conta/dados',
  '/app/conta/celular',
  '/app/conta/senha',
  '/app/conta/aparencia',
  '/app/conta/privacidade',
];

for (const theme of ['claro', 'escuro'] as const) {
  for (const path of ACCOUNT_SCREENS) {
    for (const size of SIZES) {
      test(`a11y ${path} (${theme}) em ${size.width}px`, async ({ page }) => {
        await page.setViewportSize(size);
        const u = await adminCreateUser({});
        await confirmPhoneAsService(u.id, uniquePhoneDigits());
        await loginViaUi(page, u.email, u.password);
        await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
        await page.goto('/app/conta/aparencia');
        await page.locator(tid(theme === 'escuro' ? 'account-appearance-dark' : 'account-appearance-light')).click();
        await check(page, path);
      });
    }
  }
}

// Telas do onboarding, com a conta que cada uma exige.
for (const size of SIZES) {
  test(`a11y /auth/termos em ${size.width}px (tutor B do seed, sem aceite)`, async ({ page }) => {
    await page.setViewportSize(size);
    await loginViaUi(page, SEED.tutorB.email, SEED.password);
    await expect(page).toHaveURL(/\/auth\/termos/);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
  });

  test(`a11y /auth/celular e /auth/confirmar-celular em ${size.width}px (conta com aceite e sem celular)`, async ({ page }) => {
    await page.setViewportSize(size);
    const u = await adminCreateUser({});
    await loginViaUi(page, u.email, u.password);
    await page.goto('/auth/celular');
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
    await page.locator(tid('phone-input')).fill(uniquePhoneDigits());
    await page.locator(tid('phone-send')).click();
    await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
    await expect(page.locator(tid('confirm-phone-cell-1'))).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
  });
}
