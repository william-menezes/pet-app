import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, expectNoSeriousA11y, WIDTHS } from '../e2e/support/ui';
import { loginViaUi, tid } from './support/flows';
import { SEED, serviceRest } from './support/stack';
import {
  activateViaApi,
  adminSession,
  createBatchViaFunction,
  createPet,
  newTutor,
  parsePinsCsv,
  readStoredZipEntry,
  resolveAsServer,
  rpc,
  takeTag,
} from './support/tags';

/**
 * T083 (spec 003, historia 7) e T105 (parte de navegador): o ADMIN no navegador, contra o banco e a Edge Function reais.
 * O lote criado AQUI pela tela e o unico que o teste baixa: o PIN sai do arquivo que o navegador salvou, como faria o admin.
 * Largura do desktop (a tela do admin e para desktop; as tres larguras estao nos e2e simulados).
 */
test.use({ viewport: WIDTHS.desktop });

async function loginAdmin(page: Page, goto: string) {
  await loginViaUi(page, SEED.admin.email, SEED.password);
  await expect(page).toHaveURL(/\/(admin|app)/, { timeout: 30_000 });
  await page.goto(goto);
}

test('criar lote pela tela, baixar o pacote, ativar com o PIN do arquivo; PIN fora de log, tabela e auditoria', async ({ page }) => {
  await loginAdmin(page, '/admin');
  await expect(page.locator(tid('admin-batches-counters'))).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11y(page);

  await page.locator(tid('admin-batches-create')).click();
  await page.locator(tid('admin-batches-quantity')).fill('3');
  await page.locator(tid('admin-batches-notes')).fill('E2E real');
  await page.locator(tid('admin-batches-continue')).click();
  const download = page.waitForEvent('download');
  await page.locator(tid('admin-batches-generate')).click();
  const file = await download;
  // com o CORS da funcao, o navegador consegue ler X-Batch-Id: o arquivo sai com o nome do lote, nao com o de reserva
  expect(file.suggestedFilename()).toMatch(/^lote-\d{3}\.zip$/);
  await expect(page.locator(tid('admin-batches-done'))).toBeVisible({ timeout: 60_000 });
  const tags = parsePinsCsv(readStoredZipEntry(readFileSync((await file.path()) as string), 'pins.csv'));
  expect(tags).toHaveLength(3);
  // nenhum signal nem storage guarda o pacote
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  for (const t of tags) expect(stored).not.toContain(t.pin);
  await expect(page.locator('body')).not.toContainText(tags[0].pin);

  // o PIN do arquivo ativa o codigo (so o hash esta no banco)
  const tutor = await newTutor();
  const pet = await createPet(tutor, 'Bolota');
  await activateViaApi(tutor, tags[0], pet);
  const hashes = (await serviceRest('tag_codes?select=activation_pin_hash&limit=500')).body as Array<{ activation_pin_hash: string }>;
  for (const h of hashes) expect(h.activation_pin_hash).toMatch(/^\$2[abxy]\$12\$/);
  const audit = JSON.stringify((await serviceRest('audit_log?select=event,detail&order=at.desc&limit=200')).body);
  for (const t of tags) expect(audit, 'PIN na auditoria').not.toContain(t.pin);

  // o segundo pedido do mesmo pacote nao existe: a tela nao oferece baixar de novo
  await page.goto('/admin');
  await expect(page.locator(tid('admin-batches-notice'))).toBeVisible({ timeout: 20_000 });
});

test('codigos, detalhe e acoes: bloquear manda a pagina para "nao encontrada" e o scan para a fila; desbloquear volta', async ({ page, browser }) => {
  const tutor = await newTutor();
  const pet = await createPet(tutor, 'Bolota');
  const tag = takeTag();
  await activateViaApi(tutor, tag, pet);

  await loginAdmin(page, '/admin/codigos');
  await page.locator(tid('admin-codes-search')).fill(tag.display);
  await page.locator(tid('admin-codes-search-submit')).click();
  await expect(page.locator(`${tid('admin-code-link')}:visible`).first()).toContainText(tag.display, { timeout: 20_000 });
  await expectNoSeriousA11y(page);
  await page.locator(`${tid('admin-code-link')}:visible`).first().click();
  await expect(page.locator(tid('admin-code-title'))).toContainText(tag.display);
  await expect(page.locator(tid('admin-code-assignment'))).toBeVisible();
  await expect(page.locator(tid('admin-code-pin-state'))).toContainText('Usado em');
  // nunca o valor do PIN, nem e-mail ou telefone do tutor
  const body = await page.locator('body').innerText();
  expect(body).not.toContain(tag.pin);
  expect(body).not.toContain(tutor.email);
  expect(body).not.toContain(tutor.phoneDigits);
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11y(page);

  await page.locator(tid('admin-action-block')).click();
  await expect(page.locator(tid('admin-confirm-title'))).toContainText(`Bloquear ${tag.display}?`);
  await page.locator(tid('admin-confirm-ok')).click();
  await expect.poll(async () => ((await serviceRest(`tag_codes?code=eq.${tag.code}&select=status`)).body as Array<{ status: string }>)[0]?.status, { timeout: 15_000 }).toBe('blocked');

  // pagina publica igual a "nao encontrada" e o scan vai para a fila
  expect((await resolveAsServer(tag.code)).text).toContain('not_found');
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': '198.51.100.31' } });
  const p2 = await ctx.newPage();
  await p2.goto(`/${tag.code}`);
  await expect(p2.locator(tid('public-notice-title'))).toBeVisible();
  await ctx.close();
  await expect
    .poll(async () => ((await serviceRest(`scan_events?tag_code=eq.${tag.code}&select=status_at_scan`)).body as Array<{ status_at_scan: string }>).map((r) => r.status_at_scan), { timeout: 20_000 })
    .toEqual(['blocked']);
  await page.goto('/admin/fila');
  await expect(page.locator(tid('admin-queue-scans'))).toContainText(tag.display, { timeout: 20_000 });
  await expectNoSeriousA11y(page);
  // o tutor nao ve o scan de tag bloqueada como dele? Ele e do vinculo vigente: e visivel ao dono, mas sem aviso para o publico
  await page.goto(`/admin/codigos/${tag.display}`);
  await page.locator(tid('admin-action-unblock')).click();
  await page.locator(tid('admin-confirm-ok')).click();
  await expect.poll(async () => ((await serviceRest(`tag_codes?code=eq.${tag.code}&select=status`)).body as Array<{ status: string }>)[0]?.status, { timeout: 15_000 }).toBe('assigned');
  expect((await resolveAsServer(tag.code)).text).toContain('Bolota');
});

test('reemitir PIN e encerrar vinculo: PIN uma vez na tela; o antigo deixa de valer; auditoria sem PIN', async ({ page }) => {
  const tutor = await newTutor();
  const pet = await createPet(tutor, 'Bolota');
  const tag = takeTag();
  await activateViaApi(tutor, tag, pet);

  await loginAdmin(page, `/admin/codigos/${tag.display}`);
  // encerrar o vinculo (obrigatorio antes de reemitir)
  await expect(page.locator(tid('admin-code-assignment'))).toBeVisible({ timeout: 20_000 });
  await page.locator(tid('admin-action-end')).click();
  await page.locator(tid('admin-confirm-ok')).click();
  await expect(page.locator(tid('admin-pin-reveal-pin'))).toBeVisible({ timeout: 20_000 });
  const pin = (await page.locator(tid('admin-pin-reveal-pin')).innerText()).replace(/[\s-]/g, '');
  expect(pin).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  expect(pin).not.toBe(tag.pin);
  await expect(page.locator(tid('admin-pin-reveal-pin'))).toBeInViewport();
  await page.locator(tid('admin-pin-reveal-done')).click();
  await expect(page.locator('body')).not.toContainText(pin);

  // o PIN novo ativa; o antigo nao
  const other = await newTutor();
  const otherPet = await createPet(other, 'Outro');
  expect((await rpc(other, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: otherPet, p_replace: false, p_enable_whatsapp: false })).body).toMatchObject({ ok: false, error: 'wrong_pin' });
  expect((await rpc(other, 'activate_tag', { p_code: tag.code, p_pin: pin, p_pet_id: otherPet, p_replace: false, p_enable_whatsapp: false })).body).toMatchObject({ ok: true });

  // auditoria: os eventos existem, sem PIN, sem telefone, sem IP
  await page.goto('/admin/auditoria');
  await expect(page.locator(tid('admin-audit-row')).first()).toBeVisible({ timeout: 20_000 });
  await expectNoSeriousA11y(page);
  const text = await page.locator('body').innerText();
  for (const secret of [pin, tag.pin, tutor.email, tutor.phoneDigits]) expect(text).not.toContain(secret);
  const log = JSON.stringify((await serviceRest('audit_log?select=event,detail&order=at.desc&limit=300')).body);
  for (const secret of [pin, tag.pin, tutor.phoneDigits]) expect(log).not.toContain(secret);
});

test('tutor comum nao entra no admin: a tela recusa e toda RPC admin_* devolve forbidden', async ({ page }) => {
  const t = await newTutor();
  await loginViaUi(page, t.email, t.password);
  await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });
  await page.goto('/admin');
  await expect(page).not.toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
  for (const fn of ['admin_list_batches', 'admin_list_codes', 'admin_scan_queue', 'admin_audit', 'admin_dashboard_counters']) {
    const r = await rpc(t, fn, fn === 'admin_audit' ? { p_limit: 5 } : {});
    expect(JSON.stringify(r.body), fn).toMatch(/forbidden|permission denied|"error"/i);
    expect(JSON.stringify(r.body), fn).not.toMatch(/"ok":\s*true/);
  }
  const create = await createBatchViaFunction(1, t.token);
  expect(create.status, 'admin-create-batch com JWT de tutor').toBe(403);
  const anon = await fetch(`${process.env['E2E_SUPABASE_URL']}/functions/v1/admin-create-batch`, { method: 'POST', body: '{"quantity":1}' });
  expect([401, 403]).toContain(anon.status);
});

// DEF-003-01 (corrigido na migration 0036): o bcrypt custo 12 dos PINs saiu do insert; a Edge Function pede os hashes em
// fatias de 10 (admin_hash_pins) e grava tudo de uma vez. 54 e 500 (o maximo do contrato) criam o lote inteiro.
for (const quantity of [54, 500]) {
  test(`DEF-003-01: criar um lote de ${quantity} codigos funciona (pacote com ${quantity} pares valido)`, async () => {
    test.setTimeout(180_000);
    const session = await adminSession();
    const t0 = Date.now();
    const r = await createBatchViaFunction(quantity, session.access_token);
    const ms = Date.now() - t0;
    console.log(`DEF-003-01: lote de ${quantity} codigos em ${ms} ms`);
    expect(r.status).toBe(200);
    expect(r.batchId).toMatch(/^lote-[0-9]{3}$/);
    expect(r.tags).toHaveLength(quantity);
    expect(new Set(r.tags.map((t) => t.code)).size).toBe(quantity);
    for (const t of r.tags) expect(t.pin).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
    if (quantity === 500) {
      // Os PINs do lote de 500 vao para um arquivo temporario do sistema (fora do repositorio): o passo do CI `check-pins-in-log` os
      // procura nos logs (PIN_POOL_FILE). Sem isso, so os 48 PINs do pool do E2E eram conferidos.
      writeFileSync(join(tmpdir(), 'faro-e2e-pool-lote500.json'), JSON.stringify({ batchId: r.batchId, tags: r.tags }));
      // O par codigo/PIN do pacote confere com o hash gravado em CADA fatia de 10 (primeiro, do meio e ultimo): ativar prova a ordem.
      const t = await newTutor();
      for (const idx of [0, 249, 499]) {
        const pet = await createPet(t, `Lote${idx}`);
        const act = await rpc(t, 'activate_tag', { p_code: r.tags[idx].code, p_pin: r.tags[idx].pin, p_pet_id: pet, p_replace: false, p_enable_whatsapp: false });
        expect(act.body.ok, `ativar o codigo ${idx} do lote com o PIN do pacote`).toBe(true);
      }
    }
  });
}
