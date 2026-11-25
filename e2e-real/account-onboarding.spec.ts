import { expect, test } from '@playwright/test';
import { loginViaUi, tid } from './support/flows';
import { adminCreateUser, apiSignIn, rest } from './support/stack';

/**
 * T064 (parte real): conta confirmada SEM metadados de aceite (equivale a uma conta vinda do Google) entra por /auth/termos,
 * nao alcanca /app antes de aceitar, aceita, passa por /auth/celular e, com "Agora nao", chega a /app com o aceite gravado.
 * Cada execucao cria uma conta nova (e-mail unico): repetir o teste nao depende de `supabase db reset`.
 */
test('T064: conta sem aceite: termos, /app barrado, aceitar, celular, "Agora nao", /app, termos_versao gravada', async ({ page }) => {
  const u = await adminCreateUser({ metadata: { terms_version: undefined } });

  await loginViaUi(page, u.email, u.password);
  await expect(page).toHaveURL(/\/auth\/termos/);

  await page.goto('/app');
  await expect(page).toHaveURL(/\/auth\/termos/);

  await page.locator(`${tid('terms-checkbox')} input`).click();
  await page.locator(tid('terms-accept')).click();
  await expect(page).toHaveURL(/\/auth\/celular/);

  await page.locator(tid('phone-skip')).first().click();
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);

  const { session } = await apiSignIn(u.email, u.password);
  const conta = (await rest('rpc/my_account', { token: session!.access_token, body: {} })).body;
  expect(conta.termos_versao).toBe('2026-11');
});
