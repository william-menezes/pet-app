import { expect, test } from '@playwright/test';
import { signUpViaUi, tid } from './support/flows';
import { SEED, serviceRequest, stack, TEST_PASSWORD, uniqueEmail, uniquePhoneDigits } from './support/stack';

/** T040 (cadastro): anti-enumeracao. */

async function apiSignup(email: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${stack.url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: stack.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, data: { name: 'Invasor', terms_version: '2026-11' } }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('T040 (API): e-mail novo e e-mail existente nao devolvem sessao; o perfil do existente nao muda', async ({}, testInfo) => {
  const novo = await apiSignup(uniqueEmail('enum'));
  const existente = await apiSignup(SEED.tutorA.email);
  testInfo.annotations.push({ type: 'status', description: `novo=${novo.status} existente=${existente.status}` });
  for (const r of [novo, existente]) {
    expect(JSON.stringify(r.body)).not.toContain('access_token');
    expect(JSON.stringify(r.body)).not.toContain('refresh_token');
  }
  const nome = (await serviceRequest(`perfis?id=eq.${SEED.tutorA.id}&select=nome`)).body[0].nome;
  expect(nome).toBe('Tutor A Teste');
  // Risco residual aceito no log: o GoTrue responde 422 user_already_exists para chamada direta, entao os status podem diferir.
});

test('T040 (tela): cadastro com e-mail novo e com tutor.a terminam na mesma tela de espera, com o mesmo texto', async ({ page }) => {
  const texto = async (email: string) => {
    await signUpViaUi(page, { email, phoneDigits: uniquePhoneDigits() });
    await expect(page.locator(tid('confirm-email-address'))).toBeVisible();
    const t = await page.locator('main').innerText();
    return t.split(email).join('<EMAIL>');
  };
  const novo = await texto(uniqueEmail('enumui'));
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const existente = await texto(SEED.tutorA.email);
  expect(existente).toBe(novo);
  const nome = (await serviceRequest(`perfis?id=eq.${SEED.tutorA.id}&select=nome`)).body[0].nome;
  expect(nome).toBe('Tutor A Teste');
});
