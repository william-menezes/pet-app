import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { EmailMessage, EmailSender } from "../_shared/email.ts";
import { postJson } from "../_shared/testing.ts";
import { createRegisterHandler, RESEND_BATCH, type RegisterDeps } from "./handler.ts";

// Chave de teste (descartavel, 32+ caracteres). Nenhum segredo real.
const KEY = "chave-de-teste-register-0123456789-ab";
const H = { "x-faro-ssr-key": KEY };
const CODE = "ABCDEFGHV";
const OWNER_ID = "11111111-1111-1111-1111-111111111111";

const NOTIFY = {
  scan_id: "22222222-2222-2222-2222-222222222222",
  to: "ana@faro.test",
  pet_name: "Paçoca",
  tutor_first_name: "Ana",
  occurred_at: "2026-11-22T17:05:00Z",
  geo_method: "ip",
  city: "São Paulo",
  region: "SP",
};

type Reply = { data: unknown; error: unknown } | "throw";
const ok = (data: unknown): Reply => ({ data, error: null });

interface Setup {
  handler: (req: Request) => Promise<Response>;
  calls: Array<{ fn: string; args: Record<string, unknown> }>;
  sent: EmailMessage[];
  deferred: Promise<unknown>[];
  flush(): Promise<void>;
}

function setup(
  replies: Record<string, Reply>,
  opts: {
    sender?: EmailSender | null;
    getViewer?: (jwt: string) => Promise<string | null>;
  } = {},
): Setup {
  const calls: Setup["calls"] = [];
  const sent: EmailMessage[] = [];
  const deferred: Promise<unknown>[] = [];
  const defaultSender: EmailSender = {
    send: (msg) => {
      sent.push(msg);
      return Promise.resolve({ ok: true });
    },
  };
  const deps: RegisterDeps = {
    keys: () => [KEY],
    rpc: (fn, args) => {
      calls.push({ fn, args });
      const r = replies[fn] ?? ok({ ok: true });
      return r === "throw" ? Promise.reject(new Error("banco fora do ar")) : Promise.resolve(r);
    },
    getViewer: opts.getViewer ?? ((jwt) => Promise.resolve(jwt === "jwt-do-dono" ? OWNER_ID : null)),
    sender: () => (opts.sender === undefined ? defaultSender : opts.sender),
    siteUrl: "https://app.faro.test",
    defer: (p) => void deferred.push(p),
  };
  return {
    handler: createRegisterHandler(deps),
    calls,
    sent,
    deferred,
    flush: async () => void (await Promise.all(deferred)),
  };
}

const NEW_SCAN = ok({
  ok: true, owner: false, recorded: true, duplicate: false,
  scan_id: NOTIFY.scan_id, scan_token: "a".repeat(64), notify: NOTIFY,
});

async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text());
}

Deno.test("sem a chave: 401 de corpo vazio e nada e chamado", async () => {
  const t = setup({});
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }));
  assertEquals(res.status, 401);
  assertEquals(await res.text(), "");
  assertEquals(t.calls.length, 0);
});

Deno.test("chave errada: 401; metodo diferente de POST: 405", async () => {
  const t = setup({});
  assertEquals((await t.handler(postJson({ code: CODE, ip_hash: "h" }, { "x-faro-ssr-key": KEY + "x" }))).status, 401);
  assertEquals((await t.handler(new Request("http://x/fn", { method: "GET", headers: H }))).status, 405);
  assertEquals(t.calls.length, 0);
});

Deno.test("dono logado: devolve owner true e NAO envia aviso", async () => {
  const t = setup({ register_scan: ok({ ok: true, owner: true }) });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h", user_jwt: "jwt-do-dono" }, H));
  assertEquals(await bodyOf(res), { owner: true });
  assertEquals(t.calls[0].args.p_viewer, OWNER_ID);
  await t.flush();
  assertEquals(t.sent.length, 0);
  assertEquals(t.calls.length, 1);
});

Deno.test("scan novo de tag vinculada: devolve o token, envia o aviso FORA do caminho da resposta e marca notified_at", async () => {
  const t = setup({ register_scan: NEW_SCAN });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h", geo: { lat: -23.5, lng: -46.6, city: "São Paulo", region: "SP" } }, H));
  assertEquals(res.status, 200);
  assertEquals(await bodyOf(res), { owner: false, scan_token: "a".repeat(64) });
  assertEquals(t.deferred.length, 1);
  await t.flush();
  assertEquals(t.sent.length, 1);
  assertEquals(t.sent[0].to, "ana@faro.test");
  assertEquals(t.sent[0].subject, "A tag do Paçoca foi escaneada");
  assertEquals(t.calls.map((c) => c.fn), ["register_scan", "scan_notice_sent"]);
  assertEquals(t.calls[1].args, { p_scan_id: NOTIFY.scan_id });
  assertEquals(t.calls[0].args, {
    p_code: CODE, p_ip_hash: "h", p_viewer: null, p_geo_lat: -23.5, p_geo_lng: -46.6, p_geo_city: "São Paulo", p_geo_region: "SP",
  });
});

Deno.test("a resposta do scan nunca carrega scan_id, notify, e-mail nem ip_hash", async () => {
  const t = setup({ register_scan: NEW_SCAN });
  const text = await (await t.handler(postJson({ code: CODE, ip_hash: "hash-secreto" }, H))).text();
  for (const forbidden of ["scan_id", "notify", "ana@faro.test", "hash-secreto", NOTIFY.scan_id, "Paçoca"]) {
    assertFalse(text.includes(forbidden), `nao pode conter ${forbidden}`);
  }
});

Deno.test("o aviso nao atrasa a resposta: a resposta volta mesmo com o envio pendente", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let started = 0;
  const sender: EmailSender = { send: async () => { started++; await gate; return { ok: true }; } };
  const t = setup({ register_scan: NEW_SCAN }, { sender });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(await bodyOf(res), { owner: false, scan_token: "a".repeat(64) });
  assertEquals(started, 1);
  assertEquals(t.calls.map((c) => c.fn), ["register_scan"]); // notified_at so depois do envio
  release();
  await t.flush();
  assertEquals(t.calls.map((c) => c.fn), ["register_scan", "scan_notice_sent"]);
});

Deno.test("scan duplicado (a RPC nao devolve notify): nao envia e-mail; devolve o token novo se houver", async () => {
  const t = setup({ register_scan: ok({ ok: true, owner: false, recorded: true, duplicate: true, scan_id: NOTIFY.scan_id, scan_token: "b".repeat(64) }) });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(await bodyOf(res), { owner: false, scan_token: "b".repeat(64) });
  await t.flush();
  assertEquals(t.sent.length, 0);
  assertEquals(t.deferred.length, 0);
});

Deno.test("duplicado com localizacao precisa ja enviada: sem token na resposta", async () => {
  const t = setup({ register_scan: ok({ ok: true, owner: false, recorded: true, duplicate: true, scan_id: NOTIFY.scan_id }) });
  assertEquals(await bodyOf(await t.handler(postJson({ code: CODE, ip_hash: "h" }, H))), { owner: false });
});

Deno.test("tag bloqueada, anulada ou disponivel: a RPC grava sem notify e a funcao NAO envia e-mail", async () => {
  const t = setup({ register_scan: ok({ ok: true, owner: false, recorded: true, duplicate: false, scan_id: NOTIFY.scan_id, scan_token: "c".repeat(64) }) });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(await bodyOf(res), { owner: false, scan_token: "c".repeat(64) });
  await t.flush();
  assertEquals(t.sent.length, 0);
});

Deno.test("falha de envio: o scan fica com notified_at nulo (scan_notice_sent nao e chamada) e a resposta nao muda", async () => {
  const sender: EmailSender = { send: () => Promise.resolve({ ok: false }) };
  const t = setup({ register_scan: NEW_SCAN }, { sender });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(await bodyOf(res), { owner: false, scan_token: "a".repeat(64) });
  await t.flush();
  assertEquals(t.calls.map((c) => c.fn), ["register_scan"]);
});

Deno.test("excecao no envio: nao derruba o scan, nao marca notified_at e a promessa adiada nao rejeita", async () => {
  const sender: EmailSender = { send: () => Promise.reject(new Error("provedor fora do ar")) };
  const t = setup({ register_scan: NEW_SCAN }, { sender });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(res.status, 200);
  await t.flush(); // se rejeitasse, o teste falharia aqui
  assertEquals(t.calls.map((c) => c.fn), ["register_scan"]);
});

Deno.test("sem provedor de e-mail (TODO(EMAIL_PROVIDER)): o scan e gravado e a resposta e a mesma, sem envio", async () => {
  const t = setup({ register_scan: NEW_SCAN }, { sender: null });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(await bodyOf(res), { owner: false, scan_token: "a".repeat(64) });
  assertEquals(t.deferred.length, 0);
  assertEquals(t.calls.map((c) => c.fn), ["register_scan"]);
});

Deno.test("RPC com excecao ou erro: {owner:false} em 200 (a pagina nunca quebra)", async () => {
  for (const r of ["throw", { data: null, error: { message: "x" } }, ok(null), ok({ ok: false })] as Reply[]) {
    const t = setup({ register_scan: r });
    const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
    assertEquals(res.status, 200);
    assertEquals(await bodyOf(res), { owner: false });
  }
});

Deno.test("codigo invalido ou inexistente (recorded false): {owner:false}, sem e-mail", async () => {
  const t = setup({ register_scan: ok({ ok: true, owner: false, recorded: false }) });
  assertEquals(await bodyOf(await t.handler(postJson({ code: "7K3MQ9XAD", ip_hash: "h" }, H))), { owner: false });
  await t.flush();
  assertEquals(t.sent.length, 0);
});

Deno.test("entrada fora do formato: {owner:false} sem chamar o banco", async () => {
  const t = setup({ register_scan: NEW_SCAN });
  for (const input of ["nao e json", "[]", {}, { code: CODE }, { ip_hash: "h" }, { code: 5, ip_hash: "h" }, { code: CODE, ip_hash: "h".repeat(129) }, { code: CODE, ip_hash: "h", pad: "x".repeat(5000) }]) {
    const res = await t.handler(postJson(input, H));
    assertEquals(res.status, 200);
    assertEquals(await bodyOf(res), { owner: false });
  }
  assertEquals(t.calls.length, 0);
});

Deno.test("JWT que nao vale (ou a validacao lanca): o visitante e tratado como estranho", async () => {
  const t = setup({ register_scan: NEW_SCAN }, { getViewer: () => Promise.reject(new Error("auth fora do ar")) });
  await t.handler(postJson({ code: CODE, ip_hash: "h", user_jwt: "qualquer" }, H));
  assertEquals(t.calls[0].args.p_viewer, null);
  const t2 = setup({ register_scan: NEW_SCAN });
  await t2.handler(postJson({ code: CODE, ip_hash: "h", user_jwt: "token-invalido" }, H));
  assertEquals(t2.calls[0].args.p_viewer, null);
});

Deno.test("geolocalizacao: coordenadas incompletas ou de tipo errado viram nulas", async () => {
  const t = setup({ register_scan: NEW_SCAN });
  await t.handler(postJson({ code: CODE, ip_hash: "h", geo: { lat: -23.5 } }, H));
  await t.handler(postJson({ code: CODE, ip_hash: "h", geo: { lat: "x", lng: "y", city: 5 } }, H));
  await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  for (const c of t.calls.filter((x) => x.fn === "register_scan")) {
    assertEquals([c.args.p_geo_lat, c.args.p_geo_lng, c.args.p_geo_city], [null, null, null]);
  }
});

Deno.test("location: token valido grava e envia o aviso de localizacao (e NAO marca notified_at)", async () => {
  const t = setup({ set_scan_location: ok({ ok: true, updated: true, notify: NOTIFY }) });
  const res = await t.handler(postJson({ action: "location", scan_token: "t".repeat(64), lat: -23.5614, lng: -46.6559, accuracy_m: 11.6 }, H));
  assertEquals(await bodyOf(res), { updated: true });
  assertEquals(t.calls[0], { fn: "set_scan_location", args: { p_token: "t".repeat(64), p_lat: -23.5614, p_lng: -46.6559, p_accuracy_m: 12 } });
  await t.flush();
  assertEquals(t.sent.length, 1);
  assertEquals(t.sent[0].subject, "Quem achou o Paçoca enviou a localização");
  assertEquals(t.calls.map((c) => c.fn), ["set_scan_location"]);
});

Deno.test("location: token invalido ou vencido: 200 {updated:false} sem e-mail", async () => {
  const t = setup({ set_scan_location: ok({ ok: true, updated: false }) });
  const res = await t.handler(postJson({ action: "location", scan_token: "t".repeat(64), lat: -23.5, lng: -46.6, accuracy_m: 10 }, H));
  assertEquals(res.status, 200);
  assertEquals(await bodyOf(res), { updated: false });
  await t.flush();
  assertEquals(t.sent.length, 0);
});

Deno.test("location: localizacao de vinculo encerrado (sem notify): grava e nao envia", async () => {
  const t = setup({ set_scan_location: ok({ ok: true, updated: true }) });
  const res = await t.handler(postJson({ action: "location", scan_token: "t".repeat(64), lat: 1, lng: 2, accuracy_m: 3 }, H));
  assertEquals(await bodyOf(res), { updated: true });
  await t.flush();
  assertEquals(t.sent.length, 0);
});

Deno.test("location: entrada fora do formato nao chama o banco", async () => {
  const t = setup({});
  for (const input of [{ action: "location" }, { action: "location", scan_token: "t", lat: "1", lng: 2, accuracy_m: 3 }, { action: "location", scan_token: "t", lat: 1, lng: 2 }]) {
    assertEquals(await bodyOf(await t.handler(postJson(input, H))), { updated: false });
  }
  assertEquals(t.calls.length, 0);
});

Deno.test("location: RPC com excecao: {updated:false}", async () => {
  const t = setup({ set_scan_location: "throw" });
  const res = await t.handler(postJson({ action: "location", scan_token: "t".repeat(64), lat: 1, lng: 2, accuracy_m: 3 }, H));
  assertEquals(res.status, 200);
  assertEquals(await bodyOf(res), { updated: false });
});

Deno.test("resend: sem provedor nao reserva os scans (nem chama a RPC)", async () => {
  const t = setup({}, { sender: null });
  assertEquals(await bodyOf(await t.handler(postJson({ action: "resend" }, H))), { sent: 0, failed: 0, skipped: true });
  assertEquals(t.calls.length, 0);
});

Deno.test("resend: envia os pendentes, marca so os enviados e conta os que falharam", async () => {
  const second = { ...NOTIFY, scan_id: "33333333-3333-3333-3333-333333333333", to: "beto@faro.test" };
  const sender: EmailSender = {
    send: (msg) => Promise.resolve({ ok: msg.to !== "beto@faro.test" }),
  };
  const t = setup({ scan_notices_pending: ok({ ok: true, items: [NOTIFY, second, { lixo: true }] }) }, { sender });
  const res = await t.handler(postJson({ action: "resend" }, H));
  assertEquals(await bodyOf(res), { sent: 1, failed: 1 });
  assertEquals(t.calls[0], { fn: "scan_notices_pending", args: { p_limit: RESEND_BATCH } });
  assertEquals(t.calls.filter((c) => c.fn === "scan_notice_sent").map((c) => c.args.p_scan_id), [NOTIFY.scan_id]);
});

Deno.test("resend: RPC com erro ou lixo: {sent:0,failed:0}", async () => {
  for (const r of ["throw", { data: null, error: { message: "x" } }, ok({ ok: true })] as Reply[]) {
    const t = setup({ scan_notices_pending: r });
    assertEquals(await bodyOf(await t.handler(postJson({ action: "resend" }, H))), { sent: 0, failed: 0 });
  }
});

Deno.test("acao desconhecida: 200 com unknown_action (sem chamar o banco)", async () => {
  const t = setup({});
  const res = await t.handler(postJson({ action: "apagar-tudo" }, H));
  assertEquals(res.status, 200);
  assertEquals(await bodyOf(res), { ok: false, error: "unknown_action" });
  assertEquals(t.calls.length, 0);
});

Deno.test("o e-mail enviado nao carrega ip_hash, coordenadas nem dado de quem escaneou", async () => {
  const t = setup({ register_scan: NEW_SCAN });
  await t.handler(postJson({ code: CODE, ip_hash: "hash-secreto", geo: { lat: -23.123456, lng: -46.654321, city: "São Paulo", region: "SP" } }, H));
  await t.flush();
  const all = `${t.sent[0].subject}\n${t.sent[0].html}\n${t.sent[0].text}`;
  for (const forbidden of ["hash-secreto", "-23.123456", "-46.654321"]) assertFalse(all.includes(forbidden));
  assert(all.includes("São Paulo, SP"));
});

Deno.test("a funcao nao escreve log", async () => {
  const original = console.log;
  const lines: unknown[][] = [];
  console.log = (...a: unknown[]) => void lines.push(a);
  try {
    const t = setup({ register_scan: NEW_SCAN });
    await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
    await t.flush();
    const t2 = setup({ register_scan: "throw" });
    await t2.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  } finally {
    console.log = original;
  }
  assertEquals(lines.length, 0);
});
