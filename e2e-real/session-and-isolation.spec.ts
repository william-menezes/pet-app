import { expect, test } from '@playwright/test';
import { loginViaUi, tid } from './support/flows';
import { apiSignIn, rest, SEED, serviceRequest } from './support/stack';

/** T029/T064 (parte real): login dos tres usuarios do seed com o papel certo; recarregar mantem a sessao; A nao ve nem altera B. */

test('seed: tutor A (completo) entra e cai em /app', async ({ page }) => {
  await loginViaUi(page, SEED.tutorA.email, SEED.password);
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
});

test('seed: tutor B (sem aceite dos termos) entra e cai em /auth/termos', async ({ page }) => {
  await loginViaUi(page, SEED.tutorB.email, SEED.password);
  await expect(page).toHaveURL(/\/auth\/termos/);
});

test('seed: admin entra e cai em /admin', async ({ page }) => {
  await loginViaUi(page, SEED.admin.email, SEED.password);
  await expect(page).toHaveURL(/\/admin/);
});

test('recarregar a pagina mantem a sessao (/app continua em /app)', async ({ page }) => {
  await loginViaUi(page, SEED.tutorA.email, SEED.password);
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  await page.reload();
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  await page.goto('/app/conta');
  await expect(page.locator(tid('account-home'))).toBeVisible();
  await page.reload();
  await expect(page.locator(tid('account-home'))).toBeVisible();
  await expect(page).toHaveURL(/\/app\/conta/);
});

// DEF-001 (corrigido): o cliente Supabase de cada carga le o storage onde a sessao esta (local com "Manter conectado",
// session sem ele). Sem "Manter conectado" a sessao sobrevive ao F5 na mesma aba; nada fica orfao ao sair.
const TOKEN_KEY = /^sb-.+-auth-token$/;
const chaves = (page: import('@playwright/test').Page) =>
  page.evaluate((src) => {
    const re = new RegExp(src);
    const pega = (st: Storage) => Object.keys(st).filter((k) => re.test(k));
    return { local: pega(localStorage), session: pega(sessionStorage) };
  }, TOKEN_KEY.source);

test('DEF-001: sem "Manter conectado", recarregar a mesma aba mantem a sessao', async ({ page }) => {
  await loginViaUi(page, SEED.tutorA.email, SEED.password, { remember: false });
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  expect(await chaves(page)).toEqual({ local: [], session: [expect.any(String)] });
  await page.reload();
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  await page.goto('/app/conta');
  await expect(page.locator(tid('account-home'))).toBeVisible();
  await page.reload();
  await expect(page.locator(tid('account-home'))).toBeVisible();
  expect(await chaves(page)).toEqual({ local: [], session: [expect.any(String)] });
});

test('DEF-001: com "Manter conectado" a sessao fica no localStorage e sobrevive ao F5', async ({ page }) => {
  await loginViaUi(page, SEED.tutorA.email, SEED.password, { remember: true });
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  expect(await chaves(page)).toEqual({ local: [expect.any(String)], session: [] });
  await page.goto('/app/conta');
  await expect(page.locator(tid('account-home'))).toBeVisible();
  await page.reload();
  await expect(page.locator(tid('account-home'))).toBeVisible();
});

test('DEF-001: sair limpa o token dos dois storages', async ({ page }) => {
  await loginViaUi(page, SEED.tutorA.email, SEED.password, { remember: false });
  await expect(page).toHaveURL(/localhost:4200\/app(\?|$|\/)/);
  await page.goto('/app/conta');
  await page.locator(tid('account-logout')).click();
  await expect(page).toHaveURL(/localhost:4200\/auth(\?|$|\/)/);
  expect(await chaves(page)).toEqual({ local: [], session: [] });
  await page.reload();
  expect(await chaves(page)).toEqual({ local: [], session: [] });
});

test('papel pelo servidor: current_user_role de cada usuario do seed', async () => {
  for (const [u, papel] of [
    [SEED.tutorA, 'tutor'],
    [SEED.tutorB, 'tutor'],
    [SEED.admin, 'admin'],
  ] as const) {
    const { session } = await apiSignIn(u.email, SEED.password);
    expect(session).not.toBeNull();
    const r = await rest('rpc/current_user_role', { token: session!.access_token, body: {} });
    expect(r.body).toBe(papel);
  }
});

test('isolamento A <-> B pela API com o proprio token', async () => {
  const a = (await apiSignIn(SEED.tutorA.email, SEED.password)).session!;
  const b = (await apiSignIn(SEED.tutorB.email, SEED.password)).session!;
  const nomeB = (await serviceRequest(`perfis?id=eq.${SEED.tutorB.id}&select=nome`)).body[0].nome;

  // leitura: A so enxerga a propria linha
  const lista = await rest('perfis?select=id', { token: a.access_token });
  expect(lista.status).toBe(200);
  expect(lista.body.map((x: { id: string }) => x.id)).toEqual([SEED.tutorA.id]);
  const deB = await rest(`perfis?id=eq.${SEED.tutorB.id}&select=id,nome`, { token: a.access_token });
  expect(deB.body).toEqual([]);

  // alteracao do nome de B: 0 linhas e o nome de B nao muda
  const patch = await rest(`perfis?id=eq.${SEED.tutorB.id}`, {
    token: a.access_token,
    method: 'PATCH',
    body: { nome: 'Invadido' },
    headers: { Prefer: 'return=representation' },
  });
  expect(patch.body).toEqual([]);
  expect((await serviceRequest(`perfis?id=eq.${SEED.tutorB.id}&select=nome`)).body[0].nome).toBe(nomeB);

  // colunas protegidas da propria linha: 42501 (nao se autoconfirma, nao escala papel)
  for (const body of [{ papel: 'admin' }, { celular: '+5511999999999' }, { celular_confirmado_em: new Date().toISOString() }, { termos_aceitos_em: new Date().toISOString() }]) {
    const r = await rest(`perfis?id=eq.${SEED.tutorA.id}`, { token: a.access_token, method: 'PATCH', body });
    expect(r.status, JSON.stringify(Object.keys(body))).toBe(403);
    expect(JSON.stringify(r.body)).toContain('42501');
  }

  // my_account so devolve a propria conta
  const minha = await rest('rpc/my_account', { token: b.access_token, body: {} });
  expect(minha.body.email).toBe(SEED.tutorB.email);
  const acct = await rest('rpc/my_account', { token: a.access_token, body: {} });
  expect(acct.body.email).toBe(SEED.tutorA.email);
});

test('anon: nenhuma tabela da spec e nenhuma funcao exposta', async () => {
  for (const t of ['perfis', 'phone_verifications', 'rate_limit_events', 'auth_audit_log', 'auth_login_attempts']) {
    const r = await rest(`${t}?select=*&limit=1`);
    expect([401, 403], t).toContain(r.status);
    expect(JSON.stringify(r.body), t).toMatch(/42501|permission denied/i);
  }
  for (const f of ['my_account', 'export_my_data', 'rate_limit_check', 'phone_verification_status', 'accept_terms']) {
    const r = await rest(`rpc/${f}`, { body: {} });
    expect([401, 403, 404], f).toContain(r.status);
  }
});
