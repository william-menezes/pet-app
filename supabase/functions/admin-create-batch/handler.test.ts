import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { AdminDeps } from "../_shared/auth.ts";
import { chooseMask } from "../_shared/qr.ts";
import { postJson } from "../_shared/testing.ts";
import { format, isValid, tagUrl } from "../_shared/tag-code.ts";
import { crc32 } from "../_shared/zip.ts";
import { BATCH_HOURLY_LIMIT, type BatchDeps, createBatchHandler, newPin } from "./handler.ts";

const ADMIN_ID = "99999999-9999-9999-9999-999999999999";
const H = { authorization: "Bearer jwt-do-admin" };

type Reply = { data: unknown; error: unknown } | "throw";
const ok = (data: unknown): Reply => ({ data, error: null });

interface Item {
  code: string;
  pin_hash: string;
  qr_mask: number;
}

/**
 * Hash falso com a forma do bcrypt custo 12 (o banco confere a forma), injetivo por PIN e SEM nunca conter o PIN: so letras
 * minusculas, e o alfabeto do PIN e maiusculas e digitos (assim o teste de vazamento de PIN em argumentos nao da falso positivo).
 */
const fakeHash = (pin: string) =>
  "$2a$12$" + Array.from(pin, (c) => String.fromCharCode(97 + (c.charCodeAt(0) % 26), 97 + Math.floor(c.charCodeAt(0) / 26))).join("").padEnd(53, "z");

/** Fonte aleatoria de teste: criptografica de verdade (o contrato exige `crypto.getRandomValues` em producao). */
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function setup(
  opts: {
    origins?: string[];
    isAdmin?: boolean;
    replies?: Record<string, Reply>;
    insert?: (items: Item[], call: number) => Reply;
    hash?: (pins: string[], call: number) => Reply;
  } = {},
) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  let insertCalls = 0;
  let hashCalls = 0;
  let inFlight = 0;
  const stats = { maxInFlight: 0 };
  const admin: AdminDeps = {
    getCaller: (req) => Promise.resolve(req.headers.get("authorization") ? { id: ADMIN_ID } : null),
    isAdmin: () => Promise.resolve(opts.isAdmin ?? true),
  };
  const deps: BatchDeps = {
    admin,
    random,
    now: () => new Date(Date.UTC(2026, 10, 24, 12, 0, 0)),
    allowedOrigins: () => opts.origins ?? [],
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      if (fn === "admin_hash_pins") {
        const callNo = ++hashCalls; // numero fixado na chegada: chamadas concorrentes nao o embaralham
        inFlight++;
        stats.maxInFlight = Math.max(stats.maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1)); // deixa as fatias se sobreporem, como no banco
        inFlight--;
        const pins = args.p_pins as string[];
        const h: Reply = opts.hash ? opts.hash(pins, callNo) : ok(pins.map(fakeHash));
        if (h === "throw") throw new Error("banco fora do ar");
        return h;
      }
      let r: Reply | undefined = opts.replies?.[fn];
      if (fn === "admin_insert_batch") {
        insertCalls++;
        r = r ?? (opts.insert ? opts.insert(args.p_items as Item[], insertCalls) : ok({ ok: true, batch_id: "lote-002" }));
      }
      if (fn === "admin_rate_hit") r = r ?? ok(false);
      r = r ?? ok({ ok: true });
      if (r === "throw") throw new Error("banco fora do ar");
      return r;
    },
  };
  return { handler: createBatchHandler(deps), calls, stats };
}

/** Le o arquivo `pins.csv` de dentro do ZIP de um unico arquivo. */
function readCsv(zip: Uint8Array): { text: string; crcOk: boolean } {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assertEquals(v.getUint32(0, true), 0x04034b50);
  const crc = v.getUint32(14, true);
  const size = v.getUint32(22, true);
  const nameLen = v.getUint16(26, true);
  assertEquals(new TextDecoder().decode(zip.slice(30, 30 + nameLen)), "pins.csv");
  const data = zip.slice(30 + nameLen, 30 + nameLen + size);
  return { text: new TextDecoder().decode(data), crcOk: crc32(data) === crc };
}

Deno.test("sem JWT: 401 de corpo vazio, nenhuma chamada ao banco", async () => {
  const t = setup();
  const res = await t.handler(postJson({ quantity: 5 }));
  assertEquals(res.status, 401);
  assertEquals(await res.text(), "");
  assertEquals(t.calls.length, 0);
});

Deno.test("tutor comum (JWT valido, nao admin): 403 e nenhuma linha criada", async () => {
  const t = setup({ isAdmin: false });
  const res = await t.handler(postJson({ quantity: 5 }, H));
  assertEquals(res.status, 403);
  assertEquals(t.calls.length, 0);
});

Deno.test("metodo diferente de POST: 405", async () => {
  const t = setup();
  const res = await t.handler(new Request("http://x/fn", { method: "GET", headers: H }));
  assertEquals(res.status, 405);
});

Deno.test("entrada invalida: 400 e nada e criado (quantidade 0, 501, decimal, texto; notas longas; corpo invalido)", async () => {
  const t = setup();
  for (const body of [{ quantity: 0 }, { quantity: 501 }, { quantity: 2.5 }, { quantity: "5" }, {}, { quantity: 5, notes: "x".repeat(201) }, { quantity: 5, notes: 3 }, "nao e json", "[1]"]) {
    const res = await t.handler(postJson(body, H));
    assertEquals(res.status, 400);
  }
  assertEquals(t.calls.length, 0);
});

Deno.test("lote de 54: codigos distintos e validos, mascara de 0 a 7 calculada, PINs de 6 caracteres; o CSV traz os mesmos pares enviados ao banco", async () => {
  const logs: string[] = [];
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info, debug: console.debug };
  for (const k of Object.keys(orig) as Array<keyof typeof orig>) console[k] = (...a: unknown[]) => void logs.push(a.join(" "));
  let res: Response;
  const t = setup();
  try {
    res = await t.handler(postJson({ quantity: 54, notes: "teste" }, H));
  } finally {
    Object.assign(console, orig);
  }
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/zip");
  assertEquals(res.headers.get("cache-control"), "no-store");
  assertEquals(res.headers.get("content-disposition"), 'attachment; filename="lote-002.zip"');

  const insert = t.calls.find((c) => c.fn === "admin_insert_batch");
  assert(insert);
  assertEquals(insert.args.p_admin, ADMIN_ID);
  assertEquals(insert.args.p_quantity, 54);
  const items = insert.args.p_items as Item[];
  assertEquals(items.length, 54);
  assertEquals(new Set(items.map((i) => i.code)).size, 54);
  for (const it of items) {
    assert(isValid(it.code), "codigo valido (digito Luhn mod 32)");
    assertEquals(it.code.length, 9);
    assert(/^\$2a\$12\$.{53}$/.test(it.pin_hash));
    assertFalse("pin" in it, "o banco nunca recebe PIN em claro");
    assert(Number.isInteger(it.qr_mask) && it.qr_mask >= 0 && it.qr_mask <= 7);
    assertEquals(it.qr_mask, chooseMask(tagUrl(it.code)));
  }

  // Os PINs sairam so nas chamadas de hash (na ordem dos itens) e valem o hash gravado.
  const pins = t.calls.filter((c) => c.fn === "admin_hash_pins").flatMap((c) => c.args.p_pins as string[]);
  assertEquals(pins.length, 54);
  for (const p of pins) assert(/^[0-9A-HJKMNP-TV-Z]{6}$/.test(p));
  assertEquals(items.map((i) => i.pin_hash), pins.map(fakeHash));

  const { text, crcOk } = readCsv(new Uint8Array(await res.arrayBuffer()));
  assert(crcOk);
  const lines = text.trim().split("\n");
  assertEquals(lines[0], "code,pin");
  assertEquals(lines.length, 55);
  assertEquals(lines.slice(1), items.map((i, n) => `${format(i.code)},${pins[n]}`));

  // Marcou o pacote como baixado, uma vez, e nenhum PIN apareceu em log nem em chamada que nao seja o pedido de hash.
  assertEquals(t.calls.filter((c) => c.fn === "admin_mark_package_downloaded").length, 1);
  assertEquals(t.calls.filter((c) => c.fn === "admin_rate_hit").length, 1);
  assertEquals(logs.length, 0);
  for (const p of pins) assertFalse(logs.join("\n").includes(p));
  for (const c of t.calls.filter((c) => c.fn !== "admin_hash_pins")) {
    for (const p of pins) assertFalse(JSON.stringify(c.args).includes(p));
  }
});

Deno.test("limite de 10 lotes por hora por admin: o 11o devolve 429 sem gerar nada", async () => {
  const t = setup({ replies: { admin_rate_hit: ok(true) } });
  const res = await t.handler(postJson({ quantity: 5 }, H));
  assertEquals(res.status, 429);
  assertEquals(await res.json(), { ok: false, error: "too_many_requests" });
  const hit = t.calls.find((c) => c.fn === "admin_rate_hit");
  assertEquals(hit?.args, { p_admin: ADMIN_ID, p_scope: "admin_batch_hour", p_limit: BATCH_HOURLY_LIMIT, p_window_seconds: 3600 });
  assertEquals(t.calls.filter((c) => c.fn === "admin_insert_batch").length, 0);
});

Deno.test("colisao de codigo: troca so os codigos que colidiram e repete", async () => {
  let firstItems: Item[] = [];
  const t = setup({
    insert: (items, call) => {
      if (call === 1) {
        firstItems = items.map((i) => ({ ...i }));
        return ok({ ok: false, error: "code_collision", codes: [items[0].code, items[3].code] });
      }
      return ok({ ok: true, batch_id: "lote-003" });
    },
  });
  const res = await t.handler(postJson({ quantity: 6 }, H));
  assertEquals(res.status, 200);
  const calls = t.calls.filter((c) => c.fn === "admin_insert_batch");
  assertEquals(calls.length, 2);
  const second = calls[1].args.p_items as Item[];
  assertEquals(second.length, 6);
  assert(second[0].code !== firstItems[0].code && second[3].code !== firstItems[3].code);
  assertEquals([second[1], second[2], second[4], second[5]], [firstItems[1], firstItems[2], firstItems[4], firstItems[5]]);
  assertEquals(new Set(second.map((i) => i.code)).size, 6);

  // Hash: uma fatia de 6 na primeira rodada; na segunda, so os 2 itens trocados (PIN novo => hash novo); os outros 4 reaproveitam.
  const hashCalls = t.calls.filter((c) => c.fn === "admin_hash_pins");
  assertEquals(hashCalls.map((c) => (c.args.p_pins as string[]).length), [6, 2]);
  const newPins = hashCalls[1].args.p_pins as string[];
  assertEquals([second[0].pin_hash, second[3].pin_hash], newPins.map(fakeHash));
  assert(second[0].pin_hash !== firstItems[0].pin_hash && second[3].pin_hash !== firstItems[3].pin_hash);
  // O limite de lotes por hora e tocado uma vez so, mesmo com a rodada de colisao.
  assertEquals(t.calls.filter((c) => c.fn === "admin_rate_hit").length, 1);
});

Deno.test("colisao sem fim: desiste depois das rodadas e devolve erro sem pacote", async () => {
  const t = setup({ insert: (items) => ok({ ok: false, error: "code_collision", codes: [items[0].code] }) });
  const res = await t.handler(postJson({ quantity: 2 }, H));
  assertEquals(res.status, 500);
  assertEquals(t.calls.filter((c) => c.fn === "admin_insert_batch").length, 6);
  assertEquals(t.calls.filter((c) => c.fn === "admin_mark_package_downloaded").length, 0);
});

Deno.test("hash em fatias de 10 com 3 em voo: 500 codigos = 50 fatias; todos os itens vao com hash, um unico insert", async () => {
  const t = setup();
  const res = await t.handler(postJson({ quantity: 500 }, H));
  assertEquals(res.status, 200);
  const hashCalls = t.calls.filter((c) => c.fn === "admin_hash_pins");
  assertEquals(hashCalls.length, 50);
  for (const c of hashCalls) assertEquals((c.args.p_pins as string[]).length, 10);
  assertEquals(t.stats.maxInFlight, 3);
  const inserts = t.calls.filter((c) => c.fn === "admin_insert_batch");
  assertEquals(inserts.length, 1);
  const items = inserts[0].args.p_items as Item[];
  assertEquals(items.length, 500);
  assert(items.every((i) => i.pin_hash.startsWith("$2a$12$")));
  assertEquals(t.calls.filter((c) => c.fn === "admin_rate_hit").length, 1);
});

Deno.test("quantidade que nao divide por 10: a ultima fatia leva o resto (54 = 5x10 + 4)", async () => {
  const t = setup();
  assertEquals((await t.handler(postJson({ quantity: 54 }, H))).status, 200);
  assertEquals(t.calls.filter((c) => c.fn === "admin_hash_pins").map((c) => (c.args.p_pins as string[]).length), [10, 10, 10, 10, 10, 4]);
});

Deno.test("fatia de hash falha (erro, excecao ou resposta torta): 500, nada gravado, limite tocado uma vez, sem detalhe", async () => {
  const variantes: Array<(pins: string[], call: number) => Reply> = [
    (p, call) => (call === 3 ? { data: null, error: { message: "segredo interno" } } : ok(p.map(fakeHash))),
    (p, call) => (call === 2 ? "throw" : ok(p.map(fakeHash))),
    (p, call) => (call === 4 ? ok(p.slice(1).map(fakeHash)) : ok(p.map(fakeHash))), // menos hashes que PINs
    (p, call) => (call === 1 ? ok("nao e lista") : ok(p.map(fakeHash))),
  ];
  for (const hash of variantes) {
    const t = setup({ hash });
    const res = await t.handler(postJson({ quantity: 54 }, H));
    assertEquals(res.status, 500);
    assertFalse((await res.text()).includes("segredo"));
    assert(!(res.headers.get("content-type") ?? "").includes("zip"));
    assertEquals(t.calls.filter((c) => c.fn === "admin_insert_batch").length, 0);
    assertEquals(t.calls.filter((c) => c.fn === "admin_mark_package_downloaded").length, 0);
    assertEquals(t.calls.filter((c) => c.fn === "admin_rate_hit").length, 1);
  }
});

Deno.test("hash falha na rodada de colisao: 500 e nao tenta gravar de novo", async () => {
  const t = setup({
    insert: (items) => ok({ ok: false, error: "code_collision", codes: [items[0].code] }),
    hash: (pins, call) => (call === 2 ? { data: null, error: { message: "x" } } : ok(pins.map(fakeHash))),
  });
  const res = await t.handler(postJson({ quantity: 3 }, H));
  assertEquals(res.status, 500);
  assertEquals(t.calls.filter((c) => c.fn === "admin_insert_batch").length, 1);
  assertEquals(t.calls.filter((c) => c.fn === "admin_mark_package_downloaded").length, 0);
  assertEquals(t.calls.filter((c) => c.fn === "admin_rate_hit").length, 1);
});

Deno.test("segundo pedido do pacote (banco recusa a marcacao): erro, nenhum corpo com PIN", async () => {
  const t = setup({ replies: { admin_mark_package_downloaded: ok({ ok: false, error: "package_already_downloaded" }) } });
  const res = await t.handler(postJson({ quantity: 3 }, H));
  assertEquals(res.status, 500);
  assert(!(res.headers.get("content-type") ?? "").includes("zip"));
  assertFalse((await res.text()).includes("pin"));
});

Deno.test("falha do banco em qualquer passo: 500 sem detalhe", async () => {
  for (const fn of ["admin_rate_hit", "admin_insert_batch"]) {
    const t = setup({ replies: { [fn]: { data: null, error: { message: "segredo interno" } } } });
    const res = await t.handler(postJson({ quantity: 3 }, H));
    assertEquals(res.status, 500);
    assertFalse((await res.text()).includes("segredo"));
  }
  const thrown = setup({ replies: { admin_rate_hit: "throw" } });
  assertEquals((await thrown.handler(postJson({ quantity: 3 }, H))).status, 500);
  // Falha do insert: o limite foi tocado uma vez e nada mais (sem pacote).
  const ins = setup({ replies: { admin_insert_batch: { data: null, error: { message: "x" } } } });
  assertEquals((await ins.handler(postJson({ quantity: 3 }, H))).status, 500);
  assertEquals(ins.calls.filter((c) => c.fn === "admin_rate_hit").length, 1);
  assertEquals(ins.calls.filter((c) => c.fn === "admin_mark_package_downloaded").length, 0);
});

Deno.test("newPin: 6 caracteres do alfabeto, uniforme em 5000 amostras (sem caractere ausente)", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 5000; i++) {
    const p = newPin(random);
    assert(/^[0-9A-HJKMNP-TV-Z]{6}$/.test(p));
    for (const c of p) seen.add(c);
  }
  assertEquals(seen.size, 32);
});

// --- CORS (a tela do admin chama esta funcao direto do navegador) ---
const APP = "https://app.faro.test";
const cors = { origins: [APP] };
const withOrigin = (origin: string, extra: Record<string, string> = {}) => ({ origin, ...extra });

Deno.test("CORS: preflight com origem permitida => 204 sem corpo, com Allow-Origin, Methods, Headers, Expose e Vary", async () => {
  const t = setup(cors);
  const res = await t.handler(
    new Request("http://x/fn", {
      method: "OPTIONS",
      headers: { origin: APP, "access-control-request-method": "POST", "access-control-request-headers": "authorization,apikey,content-type" },
    }),
  );
  assertEquals(res.status, 204);
  assertEquals(await res.text(), "");
  assertEquals(res.headers.get("access-control-allow-origin"), APP);
  assertEquals(res.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assertEquals(res.headers.get("access-control-allow-headers"), "authorization, x-client-info, apikey, content-type");
  assertEquals(res.headers.get("access-control-expose-headers"), "X-Batch-Id, Content-Disposition");
  assertEquals(res.headers.get("vary"), "Origin");
  assertEquals(t.calls.length, 0);
});

Deno.test("CORS: preflight de origem fora da lista (ou sem origem) nao recebe Allow-Origin nem Expose; nunca '*'", async () => {
  const t = setup(cors);
  for (const headers of [withOrigin("https://evil.test"), withOrigin("null"), {}]) {
    const res = await t.handler(new Request("http://x/fn", { method: "OPTIONS", headers }));
    assertEquals(res.status, 204);
    assertEquals(res.headers.get("access-control-allow-origin"), null);
    assertEquals(res.headers.get("access-control-expose-headers"), null);
    assertEquals(res.headers.get("vary"), "Origin");
  }
  const semLista = setup();
  const res = await semLista.handler(new Request("http://x/fn", { method: "OPTIONS", headers: withOrigin(APP) }));
  assertEquals(res.headers.get("access-control-allow-origin"), null);
});

Deno.test("CORS: POST de sucesso com origem permitida expoe X-Batch-Id e Content-Disposition e mantem o zip", async () => {
  const t = setup(cors);
  const res = await t.handler(postJson({ quantity: 3 }, { ...H, ...withOrigin(APP) }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), APP);
  assertEquals(res.headers.get("access-control-expose-headers"), "X-Batch-Id, Content-Disposition");
  assertEquals(res.headers.get("vary"), "Origin");
  assertEquals(res.headers.get("x-batch-id"), "lote-002");
  assertEquals(res.headers.get("content-disposition"), 'attachment; filename="lote-002.zip"');
  assertEquals(res.headers.get("content-type"), "application/zip");
  assertEquals(res.headers.get("cache-control"), "no-store");
  assertEquals(readCsv(new Uint8Array(await res.arrayBuffer())).crcOk, true);
});

Deno.test("CORS: POST sem origem e POST de origem nao permitida: sem Allow-Origin (a resposta nao muda de resto)", async () => {
  const t = setup(cors);
  for (const extra of [{}, withOrigin("https://evil.test")]) {
    const res = await t.handler(postJson({ quantity: 3 }, { ...H, ...extra }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("access-control-allow-origin"), null);
    assertEquals(res.headers.get("access-control-expose-headers"), null);
    assertEquals(res.headers.get("vary"), "Origin");
    assertEquals(res.headers.get("x-batch-id"), "lote-002");
  }
});

Deno.test("CORS: respostas de erro (401, 403, 400, 405, 429, 500) tambem levam os cabecalhos de CORS", async () => {
  const o = withOrigin(APP);
  const casos: Array<[number, Response]> = [
    [401, await setup(cors).handler(postJson({ quantity: 5 }, o))],
    [403, await setup({ ...cors, isAdmin: false }).handler(postJson({ quantity: 5 }, { ...H, ...o }))],
    [400, await setup(cors).handler(postJson({ quantity: 0 }, { ...H, ...o }))],
    [405, await setup(cors).handler(new Request("http://x/fn", { method: "GET", headers: o }))],
    [429, await setup({ ...cors, replies: { admin_rate_hit: ok(true) } }).handler(postJson({ quantity: 3 }, { ...H, ...o }))],
    [500, await setup({ ...cors, replies: { admin_rate_hit: "throw" } }).handler(postJson({ quantity: 3 }, { ...H, ...o }))],
  ];
  for (const [status, res] of casos) {
    assertEquals(res.status, status);
    assertEquals(res.headers.get("access-control-allow-origin"), APP, `status ${status}`);
    assertEquals(res.headers.get("vary"), "Origin", `status ${status}`);
  }
});

Deno.test("CORS nao e autorizacao: origem permitida sem JWT continua 401 e nenhuma chamada ao banco", async () => {
  const t = setup(cors);
  const res = await t.handler(postJson({ quantity: 5 }, withOrigin(APP)));
  assertEquals(res.status, 401);
  assertEquals(await res.text(), "");
  assertEquals(t.calls.length, 0);
});
