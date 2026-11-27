import { expect, test, type Page } from '@playwright/test';

import seed from '../e2e/fixtures/seed-codes.json';
import { expectNoHorizontalScroll, expectNoSeriousA11y, WIDTHS } from '../e2e/support/ui';
import { loginViaUi, signUpViaUi, tid, typeSmsCode } from './support/flows';
import { waitForLink } from './support/mailbox';
import { serviceRest, uniqueEmail, uniquePhoneDigits } from './support/stack';
import { activateViaApi, createPet, newTutor, rpc, takeTag, type PoolTag } from './support/tags';

/**
 * T049 (spec 003, historia 2): ativar a tag, no NAVEGADOR e contra o banco real. Tag nova do pool em cada teste (os testes
 * mudam o estado da tag e `retries` nao pode encontrar uma tag ja vinculada).
 * Limites que tocam aqui: PIN errado 5x em 15 min por conta (`locked`, 900 s); 20 erros em 24 h por tag (`locked`, 86400 s).
 */
test.use({ viewport: WIDTHS.phone });

const typePin = async (page: Page, pin: string) => {
  await page.locator(tid('activation-pin-cell-1')).click();
  await page.keyboard.type(pin);
};

async function loginAndOpen(page: Page, t: { email: string; password: string }, path: string) {
  await loginViaUi(page, t.email, t.password);
  await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });
  await page.goto(path);
}

const wrongPin = (pin: string) => (pin[0] === '2' ? '3' : '2') + pin.slice(1);

test('tag disponivel: cadastro, SMS, novo pet, PIN certo; a pagina publica muda', async ({ page }) => {
  const tag = takeTag();
  // pagina publica "tag nao ativada" -> "Ativar"
  await page.goto(`/${tag.code}`);
  await expect(page.locator(tid('public-not-activated-code'))).toBeVisible();
  await expectNoSeriousA11y(page);
  const hrefs = await page.locator(tid('public-not-activated-activate')).getAttribute('href');
  expect(hrefs).toContain(`/ativar/${tag.code}`);
  await page.locator(tid('public-not-activated-activate')).click();
  await expect(page).toHaveURL(/\/auth\/criar-conta\?returnUrl=%2Fativar%2F/, { timeout: 20_000 });

  // cadastro pela tela (SMS simulado), com a volta para a ativacao
  const email = uniqueEmail('act');
  await signUpViaUi(page, { email, phoneDigits: uniquePhoneDigits(), from: page.url() });
  await page.goto(await waitForLink(email, 'token_hash='));
  await page.locator(tid('confirm-email-confirm')).click();
  await expect(page).toHaveURL(/\/auth\/confirmar-celular/);
  await typeSmsCode(page);

  // sem pet: cadastrar um e voltar
  await expect(page).toHaveURL(new RegExp(`/ativar/${tag.code}`), { timeout: 30_000 });
  await expect(page.locator(tid('activation-no-pets'))).toBeVisible({ timeout: 20_000 });
  await page.locator(tid('activation-add-pet')).click();
  await expect(page.locator(tid('new-pet-name'))).toBeVisible();
  await page.locator(`${tid('new-pet-species')} button`, { hasText: /^\s*Gato\s*$/ }).click();
  await page.locator(tid('new-pet-name')).fill('Mingau');
  await page.locator(tid('new-pet-continue')).click();
  await page.locator(tid('new-pet-save')).click();

  await expect(page).toHaveURL(new RegExp(`/ativar/${tag.code}`), { timeout: 30_000 });
  await expect(page.locator(`${tid('activation-pet-list')} input:checked`)).toBeAttached({ timeout: 20_000 });
  await page.locator(tid('activation-continue')).click();
  await expect(page.locator(tid('activation-pin-cell-1'))).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11y(page);
  await expect(page.locator(`${tid('activation-whatsapp')} input`)).toBeChecked();
  await expect(page.locator(tid('activation-whatsapp-notice'))).toBeVisible();

  await typePin(page, tag.pin);
  await expect(page.locator(tid('activation-submit'))).toBeEnabled();
  await page.locator(tid('activation-submit')).click();
  await expect(page.locator(tid('activation-done'))).toBeVisible({ timeout: 30_000 });
  expect(page.url()).not.toContain(tag.pin);
  await expectNoSeriousA11y(page);

  // a pagina publica muda de "nao ativada" para o resgate do pet
  await page.goto(`/${tag.code}`);
  await expect(page.locator(tid('public-rescue-title'))).toContainText('Mingau');
  // o PIN nao esta guardado em lugar nenhum do navegador
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  expect(stored).not.toContain(tag.pin);
});

test('PIN errado: mensagem unica, 5 erros bloqueiam a conta e o PIN certo no bloqueio e recusado', async ({ page }) => {
  const tag = takeTag();
  const t = await newTutor();
  const petId = await createPet(t, 'Bolota');
  await loginAndOpen(page, t, `/ativar/${tag.code}`);
  await page.locator(`${tid('activation-pet-' + petId)} input`).check({ force: true });
  await page.locator(tid('activation-continue')).click();

  await typePin(page, wrongPin(tag.pin));
  await page.locator(tid('activation-submit')).click();
  await expect(page.locator(tid('activation-pin-error'))).toContainText('PIN incorreto. Confira o cartão.');
  await expect(page.locator(tid('activation-pin-cell-1'))).toHaveValue('');

  // mais 3 erros pela API e o 5o pela tela: a 5a tentativa errada trava
  for (let i = 0; i < 3; i++) {
    const r = await rpc(t, 'activate_tag', { p_code: tag.code, p_pin: wrongPin(tag.pin), p_pet_id: petId, p_replace: false, p_enable_whatsapp: false });
    expect(r.body, `erro ${i + 2}`).toMatchObject({ ok: false, error: 'wrong_pin' });
  }
  await typePin(page, wrongPin(tag.pin));
  await page.locator(tid('activation-submit')).click();
  await expect(page.locator(tid('activation-pin-error'))).toBeVisible();

  // PIN CERTO durante o bloqueio: recusado, com o mesmo aviso de espera, e o PIN nao vira vinculo
  await typePin(page, tag.pin);
  await page.locator(tid('activation-submit')).click();
  await expect(page.locator(tid('activation-pin-error'))).toContainText(/aguarde|tentativas|minutos/i, { timeout: 20_000 });
  const viaApi = await rpc(t, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: petId, p_replace: false, p_enable_whatsapp: false });
  expect(viaApi.body).toMatchObject({ ok: false, error: 'locked' });
  expect(viaApi.body.retry_after_seconds).toBeGreaterThan(0);
  expect(viaApi.body.retry_after_seconds).toBeLessThanOrEqual(900);
  const assignments = (await serviceRest(`tag_assignments?tag_code=eq.${tag.code}&select=id`)).body as unknown[];
  expect(assignments, 'nenhum vinculo criado durante o bloqueio').toHaveLength(0);
  await expectNoSeriousA11y(page);
});

test('bloqueio por tag: 20 erros em varias contas travam a tag por 24 h, ate para o PIN certo', async () => {
  const tag = takeTag();
  // 4 contas x 5 erros = 20 na tag (cada conta trava aos 5 e nao conta mais)
  for (let a = 0; a < 4; a++) {
    const t = await newTutor();
    const petId = await createPet(t, `Pet${a}`);
    for (let i = 0; i < 5; i++) {
      const r = await rpc(t, 'activate_tag', { p_code: tag.code, p_pin: wrongPin(tag.pin), p_pet_id: petId, p_replace: false, p_enable_whatsapp: false });
      expect(r.body.ok).toBe(false);
    }
  }
  const fresh = await newTutor();
  const petId = await createPet(fresh, 'Bolota');
  const r = await rpc(fresh, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: petId, p_replace: false, p_enable_whatsapp: false });
  expect(r.body).toMatchObject({ ok: false, error: 'locked' });
  expect(r.body.retry_after_seconds).toBeGreaterThan(900);
  expect(r.body.retry_after_seconds).toBeLessThanOrEqual(86400);
  // a fila do admin enxerga a tag travada
  const audit = await serviceRest(`audit_log?event=like.*lock*&select=event,detail&order=at.desc&limit=20`);
  expect(JSON.stringify(audit.body)).not.toContain(tag.pin);
});

test('pet que ja tem tag: confirmacao antes do PIN e a troca devolve a tag antiga com o MESMO PIN', async ({ page }) => {
  const t = await newTutor();
  const petId = await createPet(t, 'Bolota');
  const oldTag = takeTag();
  const newTag = takeTag();
  await activateViaApi(t, oldTag, petId);

  await loginAndOpen(page, t, `/ativar/${newTag.code}`);
  await page.locator(`${tid('activation-pet-' + petId)} input`).check({ force: true });
  await page.locator(tid('activation-continue')).click();
  await expect(page.locator(tid('activation-replace'))).toContainText(oldTag.display);
  await page.locator(tid('activation-replace-confirm')).click();
  await typePin(page, newTag.pin);
  await page.locator(tid('activation-submit')).click();
  await expect(page.locator(tid('activation-done'))).toBeVisible({ timeout: 30_000 });

  // a tag antiga voltou a ficar livre, com o PIN do cartao dela (PIN mantido na troca): outra conta ativa com o original
  const other = await newTutor();
  const otherPet = await createPet(other, 'Outro');
  const again = await rpc(other, 'activate_tag', { p_code: oldTag.code, p_pin: oldTag.pin, p_pet_id: otherPet, p_replace: false, p_enable_whatsapp: false });
  expect(again.body, 'PIN original da tag antiga continua valendo depois da troca').toMatchObject({ ok: true });
});

test('uso unico: o PIN vale uma vez; liberada, a tag so ativa com o PIN novo e o antigo e recusado', async () => {
  const a = await newTutor();
  const petA = await createPet(a, 'Bolota');
  const tag: PoolTag = takeTag();
  await activateViaApi(a, tag, petA);

  const b = await newTutor();
  const petB = await createPet(b, 'Rex');
  const used = await rpc(b, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: petB, p_replace: false, p_enable_whatsapp: false });
  expect(used.body, 'mensagem unica para tag ja vinculada, mesmo com o PIN certo').toMatchObject({ ok: false, error: 'tag_unavailable' });

  const rel = await rpc(a, 'release_tag', { p_code: tag.code, p_reason: 'transferred' });
  expect(rel.body.ok).toBe(true);
  const newPin = rel.body.new_pin as string;
  expect(newPin).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  expect(newPin).not.toBe(tag.pin);

  const old = await rpc(b, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: petB, p_replace: false, p_enable_whatsapp: false });
  expect(old.body, 'PIN antigo nao vale depois de liberar').toMatchObject({ ok: false, error: 'wrong_pin' });
  const ok = await rpc(b, 'activate_tag', { p_code: tag.code, p_pin: newPin, p_pet_id: petB, p_replace: false, p_enable_whatsapp: false });
  expect(ok.body).toMatchObject({ ok: true });
  // o PIN novo tambem e de uso unico
  const c = await newTutor();
  const petC = await createPet(c, 'Terceiro');
  const again = await rpc(c, 'activate_tag', { p_code: tag.code, p_pin: newPin, p_pet_id: petC, p_replace: false, p_enable_whatsapp: false });
  expect(again.body).toMatchObject({ ok: false, error: 'tag_unavailable' });

  // isolamento entre vinculos: B nao le scan nenhum anterior; o PIN nunca aparece em tabela legivel pelo tutor
  const mine = await rpc(b, 'my_dashboard');
  expect(JSON.stringify(mine.body)).not.toContain(newPin);
});

test('tag invalida, bloqueada, anulada e inexistente na ativacao: mesma resposta; digito errado nem vai ao banco', async () => {
  const t = await newTutor();
  const petId = await createPet(t, 'Bolota');
  const call = (code: string) => rpc(t, 'activate_tag', { p_code: code, p_pin: 'AAAAAA', p_pet_id: petId, p_replace: false, p_enable_whatsapp: false });
  const results = await Promise.all([call(seed.blocked), call(seed.void), call('000000000')]);
  const bodies = results.map((r) => JSON.stringify(r.body));
  expect(new Set(bodies).size, JSON.stringify(bodies)).toBe(1);
  expect(results[0].body).toMatchObject({ ok: false, error: 'tag_unavailable' });
  const bad = await call('ZZZZZZZZZ');
  expect(bad.body).toMatchObject({ ok: false, error: 'invalid_code' });
});

for (const size of [WIDTHS.tablet, WIDTHS.desktop]) {
  test(`ativacao em ${size.width}px: passo do pet, passo do PIN e "Tag ativa!" (dados reais)`, async ({ page }) => {
    await page.setViewportSize(size);
    const t = await newTutor();
    const petId = await createPet(t, 'Bolota');
    const tag = takeTag();
    await loginAndOpen(page, t, `/ativar/${tag.code}`);
    await expect(page.locator(tid('activation-pet-list'))).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(450);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
    await page.locator(`${tid('activation-pet-' + petId)} input`).check({ force: true });
    await page.locator(tid('activation-continue')).click();
    await expect(page.locator(tid('activation-pin-cell-1'))).toBeVisible();
    await page.waitForTimeout(450);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
    await typePin(page, tag.pin);
    await page.locator(tid('activation-submit')).click();
    await expect(page.locator(tid('activation-done'))).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
  });
}
