import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, expectNoSeriousA11y, WIDTHS } from '../e2e/support/ui';
import seed from '../e2e/fixtures/seed-codes.json';
import { loginViaUi, tid } from './support/flows';
import { rest, serviceRest } from './support/stack';
import { activateViaApi, createPet, newTutor, takeTag } from './support/tags';

/**
 * T035, T037 (parte de navegador), T057 e T107 (parte dinamica): a PAGINA PUBLICA da tag contra o banco e as Edge Functions
 * REAIS (servidor SSR de `ng serve` com `FARO_SSR_KEY`, Supabase local). O servidor do app nunca recebe `x-real-ip` do
 * navegador: cada teste injeta um IP proprio so nas chamadas a `localhost:4200`, para que os limites por origem
 * (30 resolve/min, 20 scan/min) nao se misturem entre testes.
 */
let ipSeq = 0;
const nextIp = () => `203.0.113.${(++ipSeq % 250) + 1}`;
const norm = (s: string, codes: string[]) => codes.reduce((acc, c) => acc.split(c).join('CODE'), s);

async function withIp(page: Page, ip = nextIp()): Promise<string> {
  await page.route(/^http:\/\/localhost:4200\//, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-real-ip': ip } }),
  );
  return ip;
}

const scans = async (code: string) =>
  (await serviceRest(`scan_events?tag_code=eq.${code}&select=id,notified_at,geo_method,lat,lng,assignment_id,status_at_scan&order=occurred_at`)).body as Array<{
    id: string;
    notified_at: string | null;
    geo_method: string;
    lat: number | null;
    lng: number | null;
    assignment_id: string | null;
    status_at_scan: string;
  }>;

/** Tutor novo, pet, tag do pool ativada. */
async function activatedTag(opts: { whatsapp?: boolean } = {}) {
  const tutor = await newTutor();
  const petId = await createPet(tutor, 'Bolota');
  const tag = takeTag();
  await activateViaApi(tutor, tag, petId, opts);
  return { tutor, petId, tag };
}

test.describe('pagina da tag: os estados', () => {
  test('tag vinculada mostra o resgate (HTML do servidor, sem JavaScript)', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, extraHTTPHeaders: { 'x-real-ip': nextIp() } });
    const page = await ctx.newPage();
    const res = await page.goto(`/${seed.assigned}`);
    expect(res?.status()).toBe(200);
    expect(res?.headers()['cache-control']).toBe('no-store');
    await expect(page.locator(tid('public-rescue-title'))).toContainText('Paçoca');
    await ctx.close();
  });

  test('tag disponivel leva a ativar; inexistente, bloqueada e anulada: resposta identica', async ({ request }) => {
    const get = (code: string) => request.get(`/${code}`, { headers: { 'x-real-ip': nextIp() } });
    const available = await (await get(seed.available)).text();
    expect(available).toContain('public-not-activated-code');

    const other = 'ZZZZZZZZ'; // corpo valido, digito invalido
    const absent = '00000000' + '0'; // formato valido; 9 chars; digito quase certamente errado ou inexistente
    const [blocked, voided, missing, badDigit] = await Promise.all([
      get(seed.blocked),
      get(seed.void),
      get(absent),
      get(other + 'Z'),
    ]);
    const codes = [seed.blocked, seed.void, absent, other + 'Z'];
    const bodies = await Promise.all([blocked, voided, missing, badDigit].map((r) => r.text()));
    for (const r of [blocked, voided, missing, badDigit]) {
      expect(r.status()).toBe(200);
      expect(r.headers()['cache-control']).toBe('no-store');
    }
    // Bloqueada, anulada e inexistente (digito valido): HTML identico, byte a byte, fora o proprio codigo.
    const normalized = bodies.map((b) => norm(b, codes));
    expect(normalized[1], 'anulada = bloqueada').toBe(normalized[0]);
    expect(normalized[2], 'inexistente = bloqueada').toBe(normalized[0]);
    expect(normalized[0]).not.toContain('public-rescue-title');
    expect(normalized[0]).not.toContain('public-not-activated-code');
    // Digito invalido nem chega ao banco: a TELA e a mesma; so o TransferState (`faro-tag:<codigo>`) nao existe.
    // Registrado como observacao do QA: o HTML deixa distinguir "digito invalido" de "digito valido sem tag", o que o
    // algoritmo publico do digito ja permite a qualquer um; nao revela existencia, bloqueio nem anulacao.
    const stripState = (h: string) => h.replace(/<script id="ng-state"[\s\S]*?<\/script>/, '');
    expect(stripState(normalized[3])).toBe(stripState(normalized[0]));
  });

  test('o piso de 150 ms vale para os estados que nao sao o resgate (servidor real)', async ({ request }) => {
    for (const code of [seed.blocked, seed.void, '000000000', seed.available]) {
      const t0 = Date.now();
      const r = await request.get(`/${code}`, { headers: { 'x-real-ip': nextIp() } });
      expect(r.status()).toBe(200);
      expect(Date.now() - t0, code).toBeGreaterThanOrEqual(140);
    }
  });

  test('cada estado nas tres larguras: sem rolagem horizontal e axe sem violacao grave', async ({ page }) => {
    await withIp(page);
    for (const w of [WIDTHS.phone, WIDTHS.tablet, WIDTHS.desktop]) {
      await page.setViewportSize(w);
      for (const [name, code, probe] of [
        ['resgate', seed.assigned, 'public-rescue-title'],
        ['nao ativada', seed.available, 'public-not-activated-code'],
        ['nao encontrada', seed.blocked, 'public-notice-title'],
      ] as const) {
        await page.goto(`/${code}`);
        await expect(page.locator(tid(probe)), `${name} a ${w.width}px`).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectNoSeriousA11y(page);
      }
    }
  });
});

test.describe('pagina da tag: scan e privacidade (banco real)', () => {
  test('abrir a pagina gera 1 scan e 1 aviso por e-mail; repetir em 10 min nao duplica', async ({ page }) => {
    const { tag } = await activatedTag();
    await withIp(page);
    await page.goto(`/${tag.code}`);
    await expect(page.locator(tid('public-rescue-title'))).toContainText('Bolota');
    await expect.poll(async () => (await scans(tag.code)).length, { timeout: 20_000 }).toBe(1);
    // o aviso: `notified_at` preenchido pelo envio (driver `log`, que escreve so o assunto)
    await expect.poll(async () => (await scans(tag.code))[0]?.notified_at, { timeout: 30_000 }).not.toBeNull();
    const first = (await scans(tag.code))[0];
    expect(first.status_at_scan).toBe('assigned');
    expect(first.assignment_id).not.toBeNull();

    await page.reload();
    await expect(page.locator(tid('public-rescue-title'))).toBeVisible();
    await page.waitForTimeout(2000);
    expect((await scans(tag.code)).length, 'repeticao em 10 minutos nao duplica').toBe(1);
  });

  test('robo de pre-visualizacao (sem JavaScript) e o proprio dono nao geram scan', async ({ page, request }) => {
    const { tutor, tag } = await activatedTag();
    const r = await request.get(`/${tag.code}`, {
      headers: { 'x-real-ip': nextIp(), 'user-agent': 'WhatsApp/2.23 Preview Bot' },
    });
    expect(r.status()).toBe(200);
    await new Promise((res) => setTimeout(res, 2000));
    expect((await scans(tag.code)).length, 'robo').toBe(0);

    // dono logado: visao do dono, sem scan
    await loginViaUi(page, tutor.email, tutor.password);
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });
    await withIp(page);
    await page.goto(`/${tag.code}`);
    await expect(page.locator(tid('public-owner-banner'))).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    expect((await scans(tag.code)).length, 'dono').toBe(0);
  });

  test('geolocalizacao permitida: o scan guarda o metodo gps e a posicao', async ({ browser }) => {
    // o botao de localizacao so existe com algum contato liberado: WhatsApp ligado na ativacao
    const { tag } = await activatedTag({ whatsapp: true });
    const ctx = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -23.5505, longitude: -46.6333, accuracy: 25 },
    });
    const page = await ctx.newPage();
    await withIp(page);
    await page.goto(`/${tag.code}`);
    await expect(page.locator(tid('public-rescue-title'))).toBeVisible();
    await expect.poll(async () => (await scans(tag.code)).length, { timeout: 20_000 }).toBe(1);
    await page.locator(tid('public-rescue-location')).click();
    await expect(page.locator(tid('public-rescue-location-sent'))).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => (await scans(tag.code))[0]?.geo_method, { timeout: 25_000, message: 'a posicao precisa deveria ter sido gravada' })
      .toBe('gps');
    const s = (await scans(tag.code))[0];
    expect(s.lat).toBeCloseTo(-23.5505, 3);
    await ctx.close();
  });

  test('campo desligado em "O que estranhos veem" nao aparece no HTML bruto; WhatsApp so com opt-in', async ({ request }) => {
    const { tutor, petId, tag } = await activatedTag({ whatsapp: false });
    const note = 'NOTA-DE-CUIDADO-UNICA-7731';
    const p = await rest(`pets?id=eq.${petId}`, { token: tutor.token, method: 'PATCH', body: { care_notes: note, temperament: ['TEMPERAMENTO-UNICO-8842'] } });
    expect(p.status).toBeLessThan(300);
    const html = async () => (await request.get(`/${tag.code}`, { headers: { 'x-real-ip': nextIp() } })).text();
    const patch = (body: Record<string, boolean>) => rest(`rescue_profiles?pet_id=eq.${petId}`, { token: tutor.token, method: 'PATCH', body });

    expect((await patch({ show_care: true, show_temperament: true, show_whatsapp: false, show_phone: false, show_tutor_first_name: false })).status).toBeLessThan(300);
    let h = await html();
    expect(h).toContain(note);
    expect(h).toContain('TEMPERAMENTO-UNICO-8842');
    expect(h).not.toContain('wa.me');
    expect(h).not.toContain(tutor.phoneDigits);

    expect((await patch({ show_care: false, show_temperament: false })).status).toBeLessThan(300);
    h = await html();
    expect(h, 'cuidados desligados').not.toContain(note);
    expect(h, 'temperamento desligado').not.toContain('TEMPERAMENTO-UNICO-8842');

    // WhatsApp ligado com celular confirmado: link wa.me; desligado de novo: some
    expect((await patch({ show_whatsapp: true })).status).toBeLessThan(300);
    h = await html();
    expect(h).toContain(`wa.me/55${tutor.phoneDigits}`);
    expect((await patch({ show_whatsapp: false })).status).toBeLessThan(300);
    expect(await html()).not.toContain('wa.me');
  });

  test('WhatsApp e telefone nao ligam sem celular confirmado (gatilho do banco)', async () => {
    const tutor = await newTutor({ phoneConfirmed: false });
    const petId = await createPet(tutor, 'Sem Celular');
    const r = await rest(`rescue_profiles?pet_id=eq.${petId}`, { token: tutor.token, method: 'PATCH', body: { show_whatsapp: true } });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.body)).toContain('phone_not_confirmed');
  });

  test('modo perdido muda a pagina; voltar ao normal a restaura', async ({ page, request }) => {
    const { tutor, petId, tag } = await activatedTag();
    const call = (on: boolean) =>
      rest('rpc/set_lost_mode', { token: tutor.token, method: 'POST', body: { p_pet_id: petId, p_on: on, p_message: on ? 'RECADO-PERDIDO-5521' : null, p_show_since: true, p_show_reward: true } });
    const lost = await call(true);
    expect(lost.body?.ok, JSON.stringify(lost.body)).toBe(true);
    await withIp(page);
    await page.goto(`/${tag.code}`);
    await expect(page.locator(tid('public-rescue-lost'))).toBeVisible();
    await expect(page.locator('body')).toContainText('RECADO-PERDIDO-5521');
    await expectNoSeriousA11y(page);
    expect((await call(false)).body?.ok).toBe(true);
    const h = await (await request.get(`/${tag.code}`, { headers: { 'x-real-ip': nextIp() } })).text();
    expect(h).not.toContain('RECADO-PERDIDO-5521');
    expect(h).not.toContain('public-rescue-lost');
  });
});
