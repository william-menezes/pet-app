import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, expectNoSeriousA11y, WIDTHS } from '../e2e/support/ui';
import { loginViaUi, tid } from './support/flows';
import { rest, serviceRest } from './support/stack';
import { activateViaApi, createPet, newTutor, resolveAsServer, rpc, takeTag, type Tutor } from './support/tags';

/**
 * T074, T063, T067, T088 a T091 (spec 003): o app do TUTOR no navegador, contra o banco real. Cada teste cria as proprias
 * contas (API de admin do Auth, celular ja confirmado) e usa tags novas do pool. Largura de celular; as tres larguras e o
 * escuro ficam nos e2e com backend simulado (`e2e/*-ui.spec.ts`), que o QA mapeou na tabela do gate.
 */
test.use({ viewport: WIDTHS.phone });

const switchOf = (page: Page, id: string) => page.locator(`${tid(id)} button[role="switch"]`);

async function login(page: Page, t: Tutor, goto?: string) {
  await loginViaUi(page, t.email, t.password);
  await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });
  if (goto) await page.goto(goto);
}

const scanRows = async (code: string) =>
  (await serviceRest(`scan_events?tag_code=eq.${code}&select=id,assignment_id`)).body as Array<{ id: string; assignment_id: string }>;

async function visitAsStranger(browser: import('@playwright/test').Browser, code: string, ip: string) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': ip }, viewport: WIDTHS.phone });
  const p = await ctx.newPage();
  await p.goto(`/${code}`);
  await expect(p.locator(tid('public-rescue-title'))).toBeVisible();
  await ctx.close();
}

test('T074: vincular pelo app (codigo e PIN); o WhatsApp vem marcado nesta tela (comportamento registrado)', async ({ page }) => {
  const t = await newTutor();
  const petId = await createPet(t, 'Mel', 'cat');
  const tag = takeTag();
  await login(page, t, `/vincular/${petId}`);
  await expect(page.locator(tid('link-code'))).toBeVisible();
  await page.locator(tid('link-code')).fill(tag.display);
  await expect(page.locator(tid('link-code-ok'))).toContainText('Código válido · tag disponível');
  await expectNoSeriousA11y(page);
  await page.locator(tid('link-continue')).click();
  await expect(page.locator('h1')).toContainText('Digite o PIN do cartão');
  // (b) WhatsApp pre-marcado tambem aqui: o CLAUDE.md diz "marcada so na ativacao". Apenas registrado, sem corrigir.
  await expect(page.locator(`${tid('activation-whatsapp')} input`)).toBeChecked();
  await page.locator(`${tid('activation-whatsapp')} input`).uncheck({ force: true });
  await page.locator(tid('activation-pin-cell-1')).click();
  await page.keyboard.type(tag.pin);
  await page.locator(tid('activation-submit')).click();
  await expect(page.locator('body')).toContainText('tem como', { timeout: 30_000 });
  expect(page.url()).not.toContain(tag.pin);

  const html = (await resolveAsServer(tag.code)).text;
  expect(html).toContain('Mel');
  expect(html, 'WhatsApp desmarcado: sem link wa.me').not.toContain('wa.me');
  // codigo de outra tag, o do app com o PIN errado nunca vincula: o mesmo codigo agora esta vinculado (mensagem unica)
  const again = await rpc(t, 'check_tag_for_link', { p_code: tag.code });
  expect(again.body).toMatchObject({ ok: false, error: 'tag_unavailable' });
});

test('T057/T091: o scan aparece no historico do dono; passar a tag adiante isola os vinculos', async ({ page, browser }) => {
  const ana = await newTutor();
  const petA = await createPet(ana, 'Bolota');
  const tag = takeTag();
  await activateViaApi(ana, tag, petA, { whatsapp: true });
  await visitAsStranger(browser, tag.code, '198.51.100.21');
  await expect.poll(async () => (await scanRows(tag.code)).length, { timeout: 20_000 }).toBe(1);

  await login(page, ana, '/app/scans');
  await expect(page.locator(tid('scans-row')).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(tid('scans-row'))).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11y(page);
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/ip_hash|[0-9a-f]{40,}/);

  // Ana passa a tag adiante pela tela de gerenciar
  await page.goto(`/app/pets/${petA}/tag`);
  await expect(page.locator(tid('manage-tag-code'))).toContainText(tag.display, { timeout: 20_000 });
  await page.locator(tid('manage-tag-transfer')).click();
  await page.locator(tid('manage-tag-confirm')).click();
  await expect(page.locator(tid('manage-tag-pin'))).toBeVisible({ timeout: 20_000 });
  const newPin = (await page.locator(tid('manage-tag-pin')).innerText()).replace(/[\s-]/g, '');
  expect(newPin).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  expect(newPin).not.toBe(tag.pin);
  await expectNoSeriousA11y(page);
  await page.locator(tid('manage-tag-done')).click();

  // outra conta (Bia) ativa pela tela com o PIN novo
  const bia = await newTutor();
  const petB = await createPet(bia, 'Rex');
  const ctx = await browser.newContext({ viewport: WIDTHS.phone });
  const pb = await ctx.newPage();
  await login(pb, bia, `/ativar/${tag.code}`);
  await pb.locator(`${tid('activation-pet-' + petB)} input`).check({ force: true });
  await pb.locator(tid('activation-continue')).click();
  await pb.locator(tid('activation-pin-cell-1')).click();
  await pb.keyboard.type(newPin);
  await pb.locator(tid('activation-submit')).click();
  await expect(pb.locator(tid('activation-done'))).toBeVisible({ timeout: 30_000 });

  // Bia nao ve nenhum scan anterior; um scan novo e da Bia e nao da Ana
  await pb.goto('/app/scans');
  await expect(pb.locator(tid('scans-empty'))).toBeVisible({ timeout: 20_000 });
  expect((await rest('my_scans?select=id', { token: bia.token })).body).toEqual([]);
  await visitAsStranger(browser, tag.code, '198.51.100.22');
  await expect.poll(async () => (await scanRows(tag.code)).length, { timeout: 20_000 }).toBe(2);
  const biaScans = (await rest('my_scans?select=id,tag_code', { token: bia.token })).body as unknown[];
  const anaScans = (await rest('my_scans?select=id,tag_code', { token: ana.token })).body as unknown[];
  expect(biaScans).toHaveLength(1);
  expect(anaScans, 'Ana ve so o scan do vinculo dela, nunca o novo').toHaveLength(1);
  // Ana tambem nao le o vinculo nem os pets da Bia
  expect((await rest(`tag_assignments?select=id&tag_code=eq.${tag.code}&ended_at=is.null`, { token: ana.token })).body).toEqual([]);
  expect((await rest(`pets?select=id&id=eq.${petB}`, { token: ana.token })).body).toEqual([]);
  await ctx.close();
});

test('T067: desligar "Cuidados" na tela e conferir a pagina publica sem login', async ({ page }) => {
  const t = await newTutor();
  const petId = await createPet(t, 'Bolota');
  const note = 'CUIDADO-SECRETO-4471';
  await rest(`pets?id=eq.${petId}`, { token: t.token, method: 'PATCH', body: { care_notes: note, temperament: ['Dócil com pessoas'] } });
  const tag = takeTag();
  await activateViaApi(t, tag, petId);
  expect((await resolveAsServer(tag.code)).text).toContain(note);

  await login(page, t, `/app/pets/${petId}/visibilidade`);
  await expect(page.locator(tid('visibility-care'))).toBeVisible({ timeout: 20_000 });
  await expectNoSeriousA11y(page);
  await switchOf(page, 'visibility-care').click();
  await page.locator(tid('visibility-preview-open')).click();
  await expect(page.locator(tid('visibility-preview'))).toBeVisible();
  await expect(page.locator(tid('visibility-preview'))).not.toContainText(note);
  await page.locator(tid('visibility-preview-close')).click();
  await page.locator(tid('visibility-save')).click();
  await expect.poll(async () => (await resolveAsServer(tag.code)).text, { timeout: 15_000 }).not.toContain(note);
  const raw = (await resolveAsServer(tag.code)).text;
  expect(raw).toContain('Bolota');
  expect(raw, 'o nome e a foto sao sempre visiveis; cuidados saiu do HTML bruto').not.toContain('CUIDADO-SECRETO');
});

test('T063: modo perdido pela tela muda a pagina publica; desligar volta ao normal', async ({ page }) => {
  const t = await newTutor();
  const petId = await createPet(t, 'Bolota');
  const tag = takeTag();
  await activateViaApi(t, tag, petId);
  await login(page, t, `/app/pets/${petId}/modo-perdido`);
  await expect(page.locator(tid('lost-mode-title'))).toBeVisible({ timeout: 20_000 });
  await page.locator(tid('lost-mode-message')).fill('RECADO-DA-TELA-9913');
  await expectNoSeriousA11y(page);
  await page.locator(tid('lost-mode-submit')).click();
  await expect.poll(async () => (await resolveAsServer(tag.code)).text, { timeout: 15_000 }).toContain('RECADO-DA-TELA-9913');

  await page.goto(`/app/pets/${petId}`);
  await expect(page.locator(tid('lost-row'))).toBeVisible({ timeout: 20_000 });
  await switchOf(page, 'lost-row').click();
  await page.locator(tid('lost-row-confirm')).click();
  await expect.poll(async () => (await resolveAsServer(tag.code)).text, { timeout: 15_000 }).not.toContain('RECADO-DA-TELA-9913');
});

test('T071: remover pet com tag mostra o PIN novo uma vez; a tag volta a ficar livre com esse PIN', async ({ page }) => {
  const t = await newTutor();
  const petId = await createPet(t, 'Bolota');
  const tag = takeTag();
  await activateViaApi(t, tag, petId);
  await login(page, t, `/app/pets/${petId}/editar`);
  await expect(page.locator(tid('new-pet-name'))).toHaveValue('Bolota', { timeout: 20_000 });
  await page.locator(tid('remove-pet-open')).click();
  await expect(page.locator(tid('remove-pet-text'))).toContainText(tag.display);
  await page.locator(tid('remove-pet-confirm')).click();
  await expect(page.locator(tid('remove-pet-pin'))).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(tid('remove-pet-pin'))).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.locator(tid('remove-pet-pin')), 'Esc nao esconde o unico PIN').toBeVisible();
  const newPin = (await page.locator(tid('remove-pet-pin')).innerText()).replace(/[\s-]/g, '');
  expect(newPin).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(newPin);
  await page.locator(tid('remove-pet-done')).click();
  await expect(page).toHaveURL(/\/app\/pets$/);

  expect((await rest(`pets?id=eq.${petId}&select=id`, { token: t.token })).body).toEqual([]);
  const other = await newTutor();
  const otherPet = await createPet(other, 'Outro');
  const old = await rpc(other, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: otherPet, p_replace: false, p_enable_whatsapp: false });
  expect(old.body, 'PIN antigo nao vale').toMatchObject({ ok: false, error: 'wrong_pin' });
  const ok = await rpc(other, 'activate_tag', { p_code: tag.code, p_pin: newPin, p_pet_id: otherPet, p_replace: false, p_enable_whatsapp: false });
  expect(ok.body).toMatchObject({ ok: true });
});

test('T088 a T090: 2a via: danificada mantem o codigo; perdida anula o codigo e entra na fila do admin', async ({ page }) => {
  const t = await newTutor();
  const petA = await createPet(t, 'Bolota');
  const petB = await createPet(t, 'Mel', 'cat');
  const damaged = takeTag();
  const lost = takeTag();
  await activateViaApi(t, damaged, petA);
  await activateViaApi(t, lost, petB);

  await login(page, t, `/app/pets/${petA}/tag`);
  await expect(page.locator(tid('manage-tag-code'))).toContainText(damaged.display, { timeout: 20_000 });
  await page.locator(tid('manage-tag-damaged')).click();
  await page.locator(tid('manage-tag-confirm')).click();
  await expect(page.locator(tid('manage-tag-registered'))).toBeVisible({ timeout: 20_000 });
  const rows = (await rest('tag_replacement_requests?select=kind,status,tag_code', { token: t.token })).body as Array<{ kind: string; tag_code: string }>;
  expect(rows).toEqual([expect.objectContaining({ kind: 'damaged', tag_code: damaged.code })]);
  expect((await resolveAsServer(damaged.code)).text).toContain('Bolota');

  await page.goto(`/app/pets/${petB}/tag`);
  await expect(page.locator(tid('manage-tag-code'))).toContainText(lost.display, { timeout: 20_000 });
  await page.locator(tid('manage-tag-lost')).click();
  await page.locator(tid('manage-tag-confirm')).click();
  await expect(page.locator(tid('manage-tag-registered'))).toBeVisible({ timeout: 20_000 });
  const status = (await serviceRest(`tag_codes?code=eq.${lost.code}&select=status`)).body as Array<{ status: string }>;
  expect(status[0].status).toBe('void');
  // codigo anulado: a pagina publica passa a "nao encontrada" e a ativacao com o PIN velho e recusada
  expect((await resolveAsServer(lost.code)).text).toContain('not_found');
  const other = await newTutor();
  const otherPet = await createPet(other, 'Outro');
  const r = await rpc(other, 'activate_tag', { p_code: lost.code, p_pin: lost.pin, p_pet_id: otherPet, p_replace: false, p_enable_whatsapp: false });
  expect(r.body).toMatchObject({ ok: false, error: 'tag_unavailable' });
});

test('painel: pets, dashboard vazio e cheio, sem erro tecnico', async ({ page }) => {
  const t = await newTutor();
  await login(page, t);
  await expect(page.locator(tid('dashboard-empty'))).toBeVisible({ timeout: 20_000 });
  await expectNoSeriousA11y(page);
  const petId = await createPet(t, 'Bolota');
  await activateViaApi(t, takeTag(), petId);
  await page.reload();
  await expect(page.locator(tid('pets-home'))).toContainText('Bolota', { timeout: 20_000 });
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11y(page);
});
