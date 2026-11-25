import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, GUARD_ALLOWED_FIELDS, type GuardDeps, type GuardEnv, sanitizeDetail } from "./handler.ts";
import { fakeRpc, type LimitMode, postJson, type RpcCall } from "../_shared/testing.ts";
import { sha256SaltedHex } from "../_shared/hash.ts";

const SALT = "sal-de-teste-0123456789";
const ENV: GuardEnv = { supabaseUrl: "http://supabase.test", serviceRoleKey: "service-key", hashSalt: SALT };
const ACTOR = "bbbbbbbb-0000-0000-0000-000000000001";
const IP = { "x-real-ip": "203.0.113.7" };

function setup(opts: {
  env?: Partial<GuardEnv>;
  limits?: Record<string, LimitMode>;
  attempt?: unknown;
  attemptError?: unknown;
  actor?: string | null;
} = {}) {
  const calls: RpcCall[] = [];
  const deps: GuardDeps = {
    env: () => ({ ...ENV, ...opts.env }),
    svc: () => ({
      rpc: fakeRpc(calls, opts.limits ?? {}, {
        record_login_attempt: { data: opts.attempt === undefined ? "allow" : opts.attempt, error: opts.attemptError },
      }),
    }),
    actorId: () => Promise.resolve(opts.actor === undefined ? null : opts.actor),
  };
  return { calls, handler: createHandler(deps) };
}

const names = (calls: RpcCall[]) => calls.map((c) => c.fn);
const audits = (calls: RpcCall[]) => calls.filter((c) => c.fn === "log_auth_event");

// ── guard:ip:m ──

Deno.test("guard:ip:m: chave e o hash da origem, 60 por 60 s, registrando", async () => {
  const s = setup();
  await s.handler(postJson({ phase: "pre_attempt", email: "a@b.cc" }, IP));
  assertEquals(s.calls[0].fn, "rate_limit_check");
  assertEquals(s.calls[0].args.p_record, true);
  const ipHash = await sha256SaltedHex("203.0.113.7", SALT);
  assertEquals(s.calls[0].args.p_checks, [{ bucket: "guard:ip:m", max: 60, window: 60, key: ipHash }]);
});

Deno.test("estouro de guard:ip:m: backoff com retry_after_seconds, SEM tentativa gravada e SEM auditoria", async () => {
  for (const phase of ["pre_attempt", "post_result"]) {
    const s = setup({ limits: { "guard:ip:m": "deny" } });
    const res = await s.handler(postJson({ phase, email: "a@b.cc", success: false }, IP));
    assertEquals(res.status, 200, phase);
    assertEquals(await res.json(), { decision: "backoff", retry_after_seconds: 37 }, phase);
    assertEquals(names(s.calls), ["rate_limit_check"], phase);
  }
});

Deno.test("guard:ip:m falha ABERTA: erro e excecao do limitador seguem o fluxo normal", async () => {
  for (const mode of ["error", "throw"] as const) {
    const s = setup({ limits: { "guard:ip:m": mode } });
    const res = await s.handler(postJson({ phase: "pre_attempt", email: "a@b.cc" }, IP));
    assertEquals(await res.json(), { decision: "allow", retry_after_seconds: 0 }, mode);
    assertEquals(names(s.calls), ["rate_limit_check", "record_login_attempt"], mode);
  }
});

// ── detail filtrado ──

Deno.test("sanitizeDetail: so metodo e motivo, de 1 a 40 caracteres [a-z_]", () => {
  assertEquals(sanitizeDetail({ metodo: "password", motivo: "rate_limit_pre_check" }), {
    metodo: "password",
    motivo: "rate_limit_pre_check",
  });
  assertEquals(sanitizeDetail({ metodo: "google", email: "a@b.cc", token: "x", extra: { a: 1 } }), { metodo: "google" });
  assertEquals(sanitizeDetail({ metodo: "a".repeat(41) }), {});
  assertEquals(sanitizeDetail({ metodo: "a".repeat(40) }), { metodo: "a".repeat(40) });
  assertEquals(sanitizeDetail({ metodo: "Password" }), {});
  assertEquals(sanitizeDetail({ metodo: "pass word" }), {});
  assertEquals(sanitizeDetail({ metodo: "a1" }), {});
  assertEquals(sanitizeDetail({ metodo: "" }), {});
  assertEquals(sanitizeDetail({ metodo: 5 }), {});
  assertEquals(sanitizeDetail({ metodo: ["password"] }), {});
  assertEquals(sanitizeDetail(null), {});
  assertEquals(sanitizeDetail("texto"), {});
  assertEquals(sanitizeDetail([1]), {});
});

Deno.test("post_result: o detalhe auditado so tem metodo e motivo; o resto do detail do cliente some", async () => {
  const s = setup({ actor: ACTOR });
  await s.handler(postJson({
    phase: "post_result",
    email: "a@b.cc",
    success: true,
    detail: { metodo: "password", email: "a@b.cc", senha: "x", motivo: "rate_limit_pre_check;drop", url: "http://evil" },
  }, IP));
  assertEquals(audits(s.calls)[0].args.p_detalhe, { metodo: "password" });
  assertEquals(JSON.stringify(s.calls).includes("senha"), false);
});

// ── user_id ignorado ──

Deno.test("user_id do corpo e ignorado: sem JWT de usuario o ator e nulo", async () => {
  const s = setup({ actor: null });
  await s.handler(postJson({ phase: "post_result", email: "a@b.cc", success: true, user_id: "cccccccc-0000-0000-0000-00000000dead" }, IP));
  assertEquals(audits(s.calls)[0].args.p_ator, null);
  assertEquals(JSON.stringify(s.calls).includes("dead"), false);
});

Deno.test("o ator da auditoria e o usuario do JWT, mesmo se o corpo disser outro", async () => {
  const s = setup({ actor: ACTOR });
  await s.handler(postJson({ phase: "post_result", email: "a@b.cc", success: true, user_id: "cccccccc-0000-0000-0000-00000000dead" }, IP));
  assertEquals(audits(s.calls)[0].args.p_ator, ACTOR);
  assertEquals(audits(s.calls)[0].args.p_evento, "login_sucesso");
});

// ── corpo ──

Deno.test("corpo acima de 2 KB => 413 e nada alem do limite por IP foi consultado", async () => {
  const s = setup();
  const res = await s.handler(postJson({ phase: "pre_attempt", email: "a@b.cc", user_agent: "u".repeat(2100) }, IP));
  assertEquals(res.status, 413);
  assertEquals(await res.json(), { ok: false, error: "payload_too_large" });
  assertEquals(names(s.calls), ["rate_limit_check"]);
});

Deno.test("corpo de exatamente ate 2 KB passa", async () => {
  const s = setup();
  const res = await s.handler(postJson({ phase: "pre_attempt", email: "a@b.cc", user_agent: "u".repeat(1500) }, IP));
  assertEquals(res.status, 200);
});

Deno.test("chave desconhecida => 400 unknown_field; as chaves que o app da 001 manda continuam aceitas", async () => {
  const a = setup();
  const r1 = await a.handler(postJson({ phase: "pre_attempt", email: "a@b.cc", role: "admin" }, IP));
  assertEquals(r1.status, 400);
  assertEquals(await r1.json(), { ok: false, error: "unknown_field" });
  assertEquals(names(a.calls), ["rate_limit_check"]);

  assertEquals([...GUARD_ALLOWED_FIELDS], ["phase", "email", "success", "user_id", "user_agent", "detail"]);
  const b = setup();
  const r2 = await b.handler(postJson({
    phase: "post_result",
    email: "a@b.cc",
    success: false,
    user_id: undefined,
    user_agent: "ua",
    detail: { metodo: "password" },
  }, IP));
  assertEquals(r2.status, 200);
});

Deno.test("fase ou e-mail ausentes, fase desconhecida e success ausente => 400", async () => {
  for (const body of [{ phase: "pre_attempt" }, { email: "a@b.cc" }, { phase: "outra", email: "a@b.cc" }, { phase: "post_result", email: "a@b.cc" }]) {
    const s = setup();
    const res = await s.handler(postJson(body, IP));
    assertEquals(res.status, 400, JSON.stringify(body));
    assertEquals(audits(s.calls).length, 0);
  }
});

// ── HASH_SALT ──

Deno.test("sem HASH_SALT (ou com menos de 16 caracteres) => 500 e NENHUM registro", async () => {
  for (const hashSalt of ["", "curto-15-chars!"]) {
    const s = setup({ env: { hashSalt } });
    const res = await s.handler(postJson({ phase: "post_result", email: "a@b.cc", success: false }, IP));
    assertEquals(res.status, 500, hashSalt);
    assertEquals(s.calls.length, 0, hashSalt);
  }
  const ok = setup({ env: { hashSalt: "x".repeat(16) } });
  assertEquals((await ok.handler(postJson({ phase: "pre_attempt", email: "a@b.cc" }, IP))).status, 200);
});

Deno.test("sem URL ou chave de servico => 500 e nenhum registro", async () => {
  for (const env of [{ supabaseUrl: "" }, { serviceRoleKey: "" }]) {
    const s = setup({ env });
    assertEquals((await s.handler(postJson({ phase: "pre_attempt", email: "a@b.cc" }, IP))).status, 500);
    assertEquals(s.calls.length, 0);
  }
});

// ── metodos ──

Deno.test("so POST e OPTIONS: GET/PUT/DELETE => 405 { error } com CORS; OPTIONS => 204; nada e consultado", async () => {
  const s = setup();
  for (const method of ["GET", "PUT", "DELETE"]) {
    const res = await s.handler(new Request("http://x/fn", { method }));
    assertEquals(res.status, 405, method);
    assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS", method);
    assertEquals(await res.json(), { error: "method_not_allowed" }, method);
  }
  assertEquals((await s.handler(new Request("http://x/fn", { method: "OPTIONS" }))).status, 204);
  assertEquals(s.calls.length, 0);
});

// ── comportamento da 001 preservado ──

Deno.test("pre_attempt: consulta sem gravar (p_sucesso nulo) e traduz a decisao; block audita login_bloqueado", async () => {
  const a = setup({ attempt: "backoff" });
  const r1 = await a.handler(postJson({ phase: "pre_attempt", email: "A@B.cc " }, IP));
  assertEquals(await r1.json(), { decision: "backoff", retry_after_seconds: 30 });
  const rec = a.calls.find((c) => c.fn === "record_login_attempt");
  assertEquals(rec?.args.p_sucesso, null);
  assertEquals(rec?.args.p_identity_hash, await sha256SaltedHex("a@b.cc", SALT));
  assertEquals(audits(a.calls).length, 0);

  const b = setup({ attempt: "block" });
  const r2 = await b.handler(postJson({ phase: "pre_attempt", email: "a@b.cc" }, IP));
  assertEquals(await r2.json(), { decision: "block", retry_after_seconds: 0 });
  assertEquals(audits(b.calls).map((c) => c.args.p_evento), ["login_bloqueado"]);
  assertEquals(audits(b.calls)[0].args.p_ator, null);
});

Deno.test("pre_attempt: erro no banco => allow (falha segura da 001)", async () => {
  const s = setup({ attempt: null, attemptError: { message: "x" } });
  const res = await s.handler(postJson({ phase: "pre_attempt", email: "a@b.cc" }, IP));
  assertEquals(await res.json(), { decision: "allow", retry_after_seconds: 0 });
});

Deno.test("post_result: grava a tentativa, audita login_falha e, no bloqueio, login_bloqueado; e-mail e IP so como hash", async () => {
  const s = setup({ attempt: "block" });
  const res = await s.handler(postJson({ phase: "post_result", email: "a@b.cc", success: false, user_agent: "u".repeat(400) }, IP));
  assertEquals(await res.json(), { decision: "block", retry_after_seconds: 0 });
  const rec = s.calls.find((c) => c.fn === "record_login_attempt");
  assertEquals(rec?.args.p_sucesso, false);
  assertEquals(audits(s.calls).map((c) => c.args.p_evento), ["login_falha", "login_bloqueado"]);
  assertEquals((audits(s.calls)[0].args.p_user_agent as string).length, 256);
  const all = JSON.stringify(s.calls);
  assertEquals(all.includes("a@b.cc"), false);
  assertEquals(all.includes("203.0.113.7"), false);
});
