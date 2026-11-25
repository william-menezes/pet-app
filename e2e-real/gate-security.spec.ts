import { expect, test } from '@playwright/test';

import seed from '../e2e/fixtures/seed-codes.json';
import { rest, SEED, serviceRequest, serviceRest, stack } from './support/stack';
import {
  activateViaApi,
  createPet,
  newTutor,
  resolveAsServer,
  rpc,
  seedTutor,
  SSR_KEY,
  takeTag,
  type Tutor,
} from './support/tags';

/**
 * T092 e T107 (spec 003): o gate de `contracts/rls-expectations.md` e de `security-hardening.contract.md` pela API HTTP REAL
 * (PostgREST, Storage e Edge Functions do stack local), como um atacante com o token de um tutor ou sem token nenhum.
 * Complementa o pgTAP (que prova os mesmos contratos dentro do banco): aqui o que importa e o que sai pela rede.
 */
const TABLES = [
  'pets',
  'rescue_profiles',
  'tag_codes',
  'tag_batches',
  'tag_assignments',
  'tag_pin_attempts',
  'pending_activations',
  'rate_limits',
  'scan_events',
  'my_scans',
  'tag_replacement_requests',
  'audit_log',
];
const RPCS = [
  'resolve_tag',
  'register_scan',
  'set_scan_location',
  'admin_insert_batch',
  'end_assignments_for_account',
  'export_tutor_tag_data',
  'activate_tag',
  'check_tag_for_link',
  'release_tag',
  'request_tag_replacement',
  'my_dashboard',
  'set_lost_mode',
  'set_pending_activation',
  'get_pending_activation',
  'clear_pending_activation',
  'can_link_tag',
  'new_activation_pin',
  'rate_limit_hit',
  'audit',
  'admin_list_batches',
  'admin_list_codes',
  'admin_code_detail',
  'admin_set_status',
  'admin_reissue_pin',
  'admin_end_assignment',
  'admin_resolve_replacement',
  'admin_scan_queue',
  'admin_audit',
  'admin_dashboard_counters',
  'admin_export_codes',
];

const denied = (status: number) => status === 401 || status === 403 || status === 404;
/** "Nega": sem privilegio (401/403) ou, com privilegio mas sem politica, a RLS devolve zero linhas. */
const blocked = (r: { status: number; body: unknown }) => denied(r.status) || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0);

test.describe('anon: nenhuma tabela e nenhuma funcao', () => {
  for (const table of TABLES) {
    test(`anon nao le ${table}`, async () => {
      const r = await rest(`${table}?select=*&limit=1`);
      expect(denied(r.status), `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`).toBe(true);
      const w = await rest(table, { method: 'POST', body: {} });
      // visao (my_scans) nao e gravavel: o PostgREST responde 500 "nao atualizavel"; o que importa e nao ser 2xx
      expect(w.status, `escrita HTTP ${w.status}`).toBeGreaterThanOrEqual(400);
    });
  }
  test('anon nao executa nenhuma funcao da spec', async () => {
    for (const fn of RPCS) {
      const r = await rest(`rpc/${fn}`, { method: 'POST', body: {} });
      expect(denied(r.status), `${fn}: HTTP ${r.status}`).toBe(true);
    }
  });
});

test.describe('funcoes so de servidor: tutor e admin tambem sao negados', () => {
  const serverOnly = ['resolve_tag', 'register_scan', 'set_scan_location', 'admin_insert_batch', 'end_assignments_for_account', 'export_tutor_tag_data', 'new_activation_pin', 'rate_limit_hit', 'audit', 'can_link_tag'];
  test('tutor (e admin) recebem permissao negada', async () => {
    const t = await newTutor();
    const admin = await seedTutor('tutorA'); // tutor do seed; o admin real e conferido abaixo com o token do admin
    const adminSess = await (await import('./support/stack')).apiSignIn(SEED.admin.email, SEED.password);
    for (const fn of serverOnly) {
      for (const who of [t.token, admin.token, adminSess.session!.access_token]) {
        const r = await rest(`rpc/${fn}`, { token: who, method: 'POST', body: {} });
        expect(denied(r.status), `${fn}: HTTP ${r.status}`).toBe(true);
      }
    }
  });
});

test.describe('isolamento entre tutores (A nao toca no B)', () => {
  let a: Tutor;
  let b: Tutor;
  let petA: string;
  let petB: string;
  let tagA: ReturnType<typeof takeTag>;
  let tagB: ReturnType<typeof takeTag>;

  test.beforeAll(async () => {
    a = await newTutor();
    b = await newTutor();
    petA = await createPet(a, 'PetDoA');
    petB = await createPet(b, 'PetDoB');
    tagA = takeTag();
    tagB = takeTag();
    await activateViaApi(a, tagA, petA, { whatsapp: true });
    await activateViaApi(b, tagB, petB);
    // scan de cada tag
    for (const [i, t] of [tagA, tagB].entries()) {
      await fetch(`${stack.url}/functions/v1/register-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-faro-ssr-key': SSR_KEY },
        body: JSON.stringify({ code: t.code, ip_hash: `iso-ip-${Date.now()}-${i}` }),
      });
    }
  });

  test('B nao le nem altera pets, perfil de resgate, vinculos, pedidos e scans de A', async () => {
    expect((await rest(`pets?id=eq.${petA}&select=id`, { token: b.token })).body).toEqual([]);
    expect((await rest(`rescue_profiles?pet_id=eq.${petA}&select=pet_id`, { token: b.token })).body).toEqual([]);
    expect((await rest(`tag_assignments?tag_code=eq.${tagA.code}&select=id`, { token: b.token })).body).toEqual([]);
    expect((await rest(`tag_replacement_requests?select=id&tag_code=eq.${tagA.code}`, { token: b.token })).body).toEqual([]);
    expect((await rest(`my_scans?select=id&tag_code=eq.${tagA.code}`, { token: b.token })).body).toEqual([]);
    // alterar: 0 linhas afetadas, e nada mudou para A
    const upd = await rest(`pets?id=eq.${petA}`, { token: b.token, method: 'PATCH', body: { name: 'HACK' }, headers: { Prefer: 'return=representation' } });
    expect(upd.body).toEqual([]);
    const del = await rest(`pets?id=eq.${petA}`, { token: b.token, method: 'DELETE', headers: { Prefer: 'return=representation' } });
    expect(del.body).toEqual([]);
    const prof = await rest(`rescue_profiles?pet_id=eq.${petA}`, { token: b.token, method: 'PATCH', body: { show_care: false }, headers: { Prefer: 'return=representation' } });
    expect(prof.body).toEqual([]);
    const mine = await rest(`pets?id=eq.${petA}&select=name`, { token: a.token });
    expect(mine.body).toEqual([{ name: 'PetDoA' }]);
    // inserir pet em nome do A e rejeitado
    const ins = await rest('pets', { token: b.token, method: 'POST', body: { tutor_id: a.id, name: 'FALSO', species: 'dog' } });
    expect(ins.status).toBeGreaterThanOrEqual(400);
    // RPCs do tutor: tag e pet de outra pessoa
    expect((await rpc(b, 'release_tag', { p_code: tagA.code, p_reason: 'released' })).body).toMatchObject({ ok: false, error: 'not_owner' });
    expect((await rpc(b, 'request_tag_replacement', { p_code: tagA.code, p_kind: 'damaged' })).body).toMatchObject({ ok: false, error: 'not_owner' });
    expect((await rpc(b, 'set_lost_mode', { p_pet_id: petA, p_on: true, p_message: 'x', p_show_since: true, p_show_reward: false })).body).toMatchObject({ ok: false });
    // cada um ve os proprios scans
    expect(((await rest(`my_scans?select=id&tag_code=eq.${tagB.code}`, { token: b.token })).body as unknown[]).length).toBeGreaterThanOrEqual(0);
  });

  test('colunas privadas: tag_codes direto, hash do PIN, ip_hash e token de local nunca saem para o tutor', async () => {
    for (const who of [a, b]) {
      expect(denied((await rest('tag_codes?select=*&limit=1', { token: who.token })).status)).toBe(true);
      expect(denied((await rest('tag_codes?select=activation_pin_hash&limit=1', { token: who.token })).status)).toBe(true);
      expect(denied((await rest('scan_events?select=*&limit=1', { token: who.token })).status)).toBe(true);
      expect(denied((await rest('scan_events?select=ip_hash&limit=1', { token: who.token })).status)).toBe(true);
      expect(denied((await rest('scan_events?select=location_token_hash&limit=1', { token: who.token })).status)).toBe(true);
      expect(blocked(await rest('tag_pin_attempts?select=*&limit=1', { token: who.token }))).toBe(true);
      expect(blocked(await rest('tag_batches?select=*&limit=1', { token: who.token }))).toBe(true);
      expect(blocked(await rest('rate_limits?select=*&limit=1', { token: who.token }))).toBe(true);
      expect(blocked(await rest('audit_log?select=*&limit=1', { token: who.token }))).toBe(true);
    }
    // controles positivos: as tabelas que o tutor ve vazias NAO estao vazias para o service_role (o vazio e a RLS, nao a falta de dado)
    for (const t of ['tag_pin_attempts', 'tag_batches', 'audit_log']) {
      expect(((await serviceRest(`${t}?select=*&limit=1`)).body as unknown[]).length, t).toBeGreaterThan(0);
    }
    const view = JSON.stringify((await rest('my_scans?select=*', { token: a.token })).body);
    expect(view).not.toMatch(/ip_hash|location_token|notified_at|notify_attempts/);
    const dash = JSON.stringify((await rpc(a, 'my_dashboard')).body);
    expect(dash).not.toMatch(/ip_hash|\$2[abxy]\$|activation_pin|"pin"/);
  });

  test('so as colunas liberadas do perfil mudam; modo perdido so pela RPC', async () => {
    const ok = await rest(`rescue_profiles?pet_id=eq.${petA}`, { token: a.token, method: 'PATCH', body: { show_care: false }, headers: { Prefer: 'return=representation' } });
    expect(ok.status).toBeLessThan(300);
    const lost = await rest(`rescue_profiles?pet_id=eq.${petA}`, { token: a.token, method: 'PATCH', body: { lost_mode: true } });
    expect(lost.status).toBeGreaterThanOrEqual(400);
    const upd = await rest(`pets?id=eq.${petA}`, { token: a.token, method: 'PATCH', body: { tutor_id: b.id } });
    expect(upd.status).toBeGreaterThanOrEqual(400);
  });

  test('pending_activations: so por RPC, a propria', async () => {
    await rpc(a, 'set_pending_activation', { p_code: tagA.code });
    expect(denied((await rest('pending_activations?select=*', { token: a.token })).status)).toBe(true);
    expect((await rpc(b, 'get_pending_activation')).body).toMatchObject({ ok: true, code: null });
    expect((await rpc(a, 'get_pending_activation')).body).toMatchObject({ ok: true });
  });
});

test.describe('Storage pet-photos (real)', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const upload = (token: string, path: string, body: Buffer | string = png, type = 'image/png') =>
    fetch(`${stack.url}/storage/v1/object/pet-photos/${path}`, {
      method: 'POST',
      headers: { apikey: stack.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': type },
      body: typeof body === 'string' ? body : new Uint8Array(body),
    });

  test('A grava e le no proprio prefixo; B, anon e o prefixo alheio sao negados; tipo e tamanho tem teto', async () => {
    const a = await newTutor();
    const b = await newTutor();
    const pet = await createPet(a, 'Foto');
    const path = `${a.id}/${pet}/foto.png`;
    expect((await upload(a.token, path)).status).toBe(200);

    // A le por URL assinada (como o resgate): funciona; sem assinatura, nao
    const sign = await fetch(`${stack.url}/storage/v1/object/sign/pet-photos/${path}`, {
      method: 'POST',
      headers: { apikey: stack.anonKey, Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 }),
    });
    expect(sign.status).toBe(200);
    const readA = await fetch(`${stack.url}/storage/v1/object/authenticated/pet-photos/${path}`, { headers: { apikey: stack.anonKey, Authorization: `Bearer ${a.token}` } });
    expect(readA.status).toBe(200);

    // B nao le, nao assina, nao grava no prefixo do A, nao lista, nao apaga
    const readB = await fetch(`${stack.url}/storage/v1/object/authenticated/pet-photos/${path}`, { headers: { apikey: stack.anonKey, Authorization: `Bearer ${b.token}` } });
    expect(readB.status).toBeGreaterThanOrEqual(400);
    const signB = await fetch(`${stack.url}/storage/v1/object/sign/pet-photos/${path}`, { method: 'POST', headers: { apikey: stack.anonKey, Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }) });
    expect(signB.status).toBeGreaterThanOrEqual(400);
    expect((await upload(b.token, `${a.id}/${pet}/invasor.png`)).status).toBeGreaterThanOrEqual(400);
    const listB = await fetch(`${stack.url}/storage/v1/object/list/pet-photos`, { method: 'POST', headers: { apikey: stack.anonKey, Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: `${a.id}/`, limit: 10 }) });
    const listed = listB.status === 200 ? ((await listB.json()) as unknown[]) : [];
    expect(listed).toEqual([]);
    const delB = await fetch(`${stack.url}/storage/v1/object/pet-photos/${path}`, { method: 'DELETE', headers: { apikey: stack.anonKey, Authorization: `Bearer ${b.token}` } });
    expect([200, 400, 401, 403, 404]).toContain(delB.status);
    expect((await fetch(`${stack.url}/storage/v1/object/authenticated/pet-photos/${path}`, { headers: { apikey: stack.anonKey, Authorization: `Bearer ${a.token}` } })).status, 'a foto do A continua la').toBe(200);

    // anon: nem leitura nem escrita; bucket nao e publico
    expect((await fetch(`${stack.url}/storage/v1/object/public/pet-photos/${path}`)).status).toBeGreaterThanOrEqual(400);
    expect((await upload(stack.anonKey, `${a.id}/${pet}/anon.png`)).status).toBeGreaterThanOrEqual(400);

    // teto: tipo (so jpeg, png, webp) e 5 MB
    expect((await upload(a.token, `${a.id}/${pet}/x.txt`, 'texto', 'text/plain')).status).toBeGreaterThanOrEqual(400);
    expect((await upload(a.token, `${a.id}/${pet}/grande.png`, Buffer.alloc(5 * 1024 * 1024 + 1024, 1))).status).toBeGreaterThanOrEqual(400);
  });
});

test.describe('contrato fisico do codigo (so service_role chega ate a tabela)', () => {
  test('`code` e imutavel, nada apaga codigo, void nao volta, digito invalido e recusado', async () => {
    const tag = takeTag();
    const patch = await serviceRequest(`tag_codes?code=eq.${tag.code}`, { method: 'PATCH', body: { code: 'ZZZZZZZZZ' } });
    expect(patch.status).toBeGreaterThanOrEqual(400);
    const del = await serviceRequest(`tag_codes?code=eq.${tag.code}`, { method: 'DELETE' });
    expect(del.status).toBeGreaterThanOrEqual(400);
    expect(((await serviceRest(`tag_codes?code=eq.${seed.void}&select=status`)).body as Array<{ status: string }>)[0].status).toBe('void');
    const back = await serviceRequest(`tag_codes?code=eq.${seed.void}`, { method: 'PATCH', body: { status: 'available' } });
    expect(back.status).toBeGreaterThanOrEqual(400);
    const ins = await serviceRequest('tag_codes', { method: 'POST', body: { code: 'ZZZZZZZZZ', batch_id: seed.batch, status: 'available' } });
    expect(ins.status, 'digito verificador invalido').toBeGreaterThanOrEqual(400);
    expect(((await serviceRest(`tag_codes?code=eq.${tag.code}&select=code`)).body as unknown[]).length).toBe(1);
  });

  test('nenhuma URL de tag usa outro dominio: o QR e HTTPS://TAGFARO.COM.BR/<CODIGO> (so o app valida)', async () => {
    // o dominio e contrato do QR; o link de ativacao do app so aceita esse formato (qr-payload) e o pacote nao traz URL
    const r = await rpc(await newTutor(), 'check_tag_for_link', { p_code: 'HTTPS://EVIL.EXAMPLE/' + seed.available });
    expect(JSON.stringify(r.body)).toMatch(/invalid_code/);
  });
});

test.describe('anti-enumeracao e limites de taxa no servidor (Edge Functions reais)', () => {
  test('inexistente, bloqueada e anulada: corpo, status e cabecalhos identicos; digito invalido nem toca o banco', async () => {
    const calls = await Promise.all([seed.blocked, seed.void, '000000000'].map((c) => resolveAsServer(c)));
    expect(new Set(calls.map((c) => c.text)).size).toBe(1);
    expect(new Set(calls.map((c) => c.status)).size).toBe(1);
    const sig = (h: Headers) => ['content-type', 'cache-control'].map((k) => `${k}=${h.get(k)}`).join('|');
    expect(new Set(calls.map((c) => sig(c.headers))).size).toBe(1);
    for (const c of calls) expect(c.ms, 'piso de 150 ms').toBeGreaterThanOrEqual(145);
    const bad = await resolveAsServer('ZZZZZZZZZ');
    expect(bad.text).toBe(calls[0].text);
    expect(bad.ms).toBeGreaterThanOrEqual(145);
  });

  test('chave do servidor errada ou ausente: 401 de corpo vazio, nunca o resgate', async () => {
    for (const key of ['', 'chave-errada-0123456789-0123456789-abcdef', SSR_KEY + 'x']) {
      const r = await fetch(`${stack.url}/functions/v1/resolve-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(key ? { 'x-faro-ssr-key': key } : {}) },
        body: JSON.stringify({ code: seed.assigned, ip_hash: 'x' }),
      });
      expect(r.status).toBe(401);
      expect(await r.text()).toBe('');
    }
  });

  test('limite por origem: de 33 chamadas em paralelo no mesmo minuto, 30 passam e o resto devolve rate_limited', async () => {
    // em paralelo e dentro de um segundo: a janela do limite e fixa (minuto), e 33 chamadas em serie com o piso de 150 ms
    // poderiam atravessar a virada do minuto e zerar a contagem.
    const ip = 'rl-' + Math.random().toString(36).slice(2);
    const all = await Promise.all(Array.from({ length: 33 }, () => resolveAsServer(seed.available, ip)));
    const limited = all.filter((r) => r.text.includes('rate_limited')).length;
    expect(limited, 'passaram ' + (33 - limited)).toBeGreaterThanOrEqual(3);
    expect(33 - limited).toBeLessThanOrEqual(30);
  });

  test('scan_ip_min: do 21o pedido em diante, 200 sem efeito (nao grava scan)', async () => {
    const t = await newTutor();
    const pet = await createPet(t, 'Limite');
    const tags = [takeTag(), takeTag()];
    for (const tg of tags) await activateViaApi(t, tg, await createPet(t, 'P' + tg.code.slice(0, 3)));
    void pet;
    const ip = 'scan-rl-' + Math.random().toString(36).slice(2);
    const call = async (code: string) =>
      fetch(`${stack.url}/functions/v1/register-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-faro-ssr-key': SSR_KEY },
        body: JSON.stringify({ code, ip_hash: ip }),
      });
    // 20 chamadas ao mesmo codigo (deduplicadas) e depois o outro codigo: estourou, nada novo
    for (let i = 0; i < 20; i++) expect((await call(tags[0].code)).status).toBe(200);
    expect((await call(tags[1].code)).status).toBe(200);
    const rows = (await serviceRest(`scan_events?tag_code=eq.${tags[1].code}&select=id`)).body as unknown[];
    expect(rows, 'o 21o pedido nao grava scan').toHaveLength(0);
    const first = (await serviceRest(`scan_events?tag_code=eq.${tags[0].code}&select=id`)).body as unknown[];
    expect(first).toHaveLength(1);
  });
});

test.describe('servidor do app: /api/scan e cabecalhos da pagina da tag', () => {
  test('corpo de 3 KB: 413; JSON com chave desconhecida: 400; outro tipo de conteudo: 415', async ({ request }) => {
    const base = { headers: { 'x-real-ip': '203.0.113.200', origin: 'http://localhost:4200' } };
    const big = await request.post('/api/scan', { ...base, headers: { ...base.headers, 'content-type': 'application/json' }, data: JSON.stringify({ code: seed.assigned, pad: 'x'.repeat(3000) }) });
    expect(big.status()).toBe(413);
    const unknown = await request.post('/api/scan', { ...base, headers: { ...base.headers, 'content-type': 'application/json' }, data: JSON.stringify({ code: seed.assigned, ip_hash: 'x' }) });
    expect(unknown.status()).toBe(400);
    const wrongType = await request.post('/api/scan', { ...base, headers: { ...base.headers, 'content-type': 'text/plain' }, data: '{"code":"x"}' });
    expect(wrongType.status()).toBe(415);
  });

  test('em /<codigo> nenhum pedido sai para host de terceiro; os cabecalhos da politica "tag" estao la; o link de ativar e navegacao completa', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http')) hosts.add(u.host);
    });
    const res = await page.goto(`/${seed.available}`);
    await expect(page.locator('[data-testid="public-not-activated-code"]')).toBeVisible();
    const h = res!.headers();
    expect(h['cache-control']).toBe('no-store');
    expect(h['x-robots-tag']).toBe('noindex');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['content-security-policy']).toContain("script-src 'self'");
    const allowed = new Set(['localhost:4200']);
    const strangers = [...hosts].filter((x) => !allowed.has(x));
    // o stack local (Supabase 127.0.0.1:54321) nunca e chamado pelo navegador na pagina publica: so o servidor do app fala com ele
    expect(strangers, `hosts: ${[...hosts].join(', ')}`).toEqual([]);
    const href = await page.locator('[data-testid="public-not-activated-activate"]').getAttribute('href');
    expect(href).toBe(`/ativar/${seed.available}`);
    await expect(page.locator('[data-testid="public-not-activated-activate"]')).not.toHaveAttribute('routerlink', /.*/);
  });

  test('o HTML da pagina publica nao carrega o app autenticado nem segredos', async ({ request }) => {
    const html = await (await request.get(`/${seed.assigned}`, { headers: { 'x-real-ip': '203.0.113.201' } })).text();
    for (const forbidden of [SSR_KEY, process.env['E2E_SERVICE_KEY'] ?? 'x', 'service_role', 'FARO_SSR_KEY', 'IP_HASH_SECRET', 'activation_pin_hash', 'ip_hash']) {
      expect(html, forbidden).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/chunk-[A-Za-z0-9]+\.js.*(admin|activation|scans)/i);
  });
});
