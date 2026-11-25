import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type RecoveryDeps } from "./handler.ts";
import { RECOVERY_ALLOWED_FIELDS } from "./logic.ts";
import { fakeClock, fakeRpc, type LimitMode, postJson, type RpcCall, TEST_ENV } from "../_shared/testing.ts";
import { sha256SaltedHex } from "../_shared/hash.ts";

interface Setup {
  calls: RpcCall[];
  sent: Array<{ email: string; options: unknown }>;
  clock: ReturnType<typeof fakeClock>;
  handler: (req: Request) => Promise<Response>;
}

function setup(
  limits: Record<string, LimitMode> = {},
  authError: unknown = null,
  authNeverReturns = false,
): Setup {
  const calls: RpcCall[] = [];
  const sent: Setup["sent"] = [];
  const clock = fakeClock();
  const deps: RecoveryDeps = {
    loadEnv: () => TEST_ENV,
    svc: () => ({ rpc: fakeRpc(calls, limits) }),
    anon: () => ({
      auth: {
        resetPasswordForEmail: (email: string, options?: { captchaToken?: string }) => {
          sent.push({ email, options });
          if (authNeverReturns) return new Promise(() => {});
          return Promise.resolve({ data: {}, error: authError });
        },
      },
    }),
    now: clock.now,
    sleep: clock.sleep,
    background: () => {},
  };
  return { calls, sent, clock, handler: createHandler(deps) };
}

const IP_HEADER = { "x-real-ip": "203.0.113.7" };
const fnNames = (calls: RpcCall[]) => calls.map((c) => c.fn);

Deno.test("recover:calls:ip: chave e o hash da origem (nunca o IP), 30 por 3600 s, registrando", async () => {
  const s = setup();
  await s.handler(postJson({ email: "ana@email.com" }, IP_HEADER));
  const first = s.calls[0];
  assertEquals(first.fn, "rate_limit_check");
  assertEquals(first.args.p_record, true);
  const ipHash = await sha256SaltedHex("203.0.113.7", TEST_ENV.hashSalt);
  assertEquals(first.args.p_checks, [{ bucket: "recover:calls:ip", max: 30, window: 3600, key: ipHash }]);
});

Deno.test("estouro de recover:calls:ip: { ok: true }, sem auditoria, sem e-mail e sem limites por e-mail", async () => {
  const s = setup({ "recover:calls:ip": "deny" });
  const res = await s.handler(postJson({ email: "ana@email.com" }, IP_HEADER));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
  assertEquals(fnNames(s.calls), ["rate_limit_check"]);
  assertEquals(s.sent.length, 0);
  assertEquals(s.clock.state.slept.length > 0, true, "o piso de tempo tambem vale no estouro");
});

Deno.test("recover:calls:ip falha fechada: erro e excecao do limitador => { ok: true } sem auditoria nem e-mail", async () => {
  for (const mode of ["error", "throw"] as const) {
    const s = setup({ "recover:calls:ip": mode });
    const res = await s.handler(postJson({ email: "ana@email.com" }, IP_HEADER));
    assertEquals(await res.json(), { ok: true }, mode);
    assertEquals(fnNames(s.calls), ["rate_limit_check"], mode);
    assertEquals(s.sent.length, 0, mode);
  }
});

Deno.test("toda chamada conta, inclusive e-mail invalido (nenhum e-mail e enviado)", async () => {
  const s = setup();
  const res = await s.handler(postJson({ email: "isto-nao-e-email" }, IP_HEADER));
  assertEquals(await res.json(), { ok: true });
  assertEquals(s.calls[0].args.p_checks, [
    { bucket: "recover:calls:ip", max: 30, window: 3600, key: await sha256SaltedHex("203.0.113.7", TEST_ENV.hashSalt) },
  ]);
  assertEquals(s.sent.length, 0);
});

Deno.test("caminho normal: limite da origem, limites por e-mail e origem, auditoria sem e-mail, um envio", async () => {
  const s = setup();
  const res = await s.handler(postJson({ email: "Ana@Email.com " }, IP_HEADER));
  assertEquals(await res.json(), { ok: true });
  assertEquals(fnNames(s.calls), ["rate_limit_check", "rate_limit_check", "log_auth_event"]);
  assertEquals(s.sent.map((x) => x.email), ["ana@email.com"]);
  assertEquals(s.calls[2].args.p_detalhe, { origem: "pedido", permitido: true });
  assertEquals(JSON.stringify(s.calls).includes("ana@email.com"), false, "o e-mail nunca vai ao banco em claro");
});

Deno.test("limite por e-mail estourado: { ok: true }, auditado com permitido false e sem envio", async () => {
  const s = setup({ "recovery:identity:h": "deny" });
  const res = await s.handler(postJson({ email: "ana@email.com" }, IP_HEADER));
  assertEquals(await res.json(), { ok: true });
  assertEquals(s.sent.length, 0);
  assertEquals(s.calls[2].args.p_detalhe, { origem: "pedido", permitido: false });
});

Deno.test("captcha_token chega ao Auth em options.captchaToken; sem token, sem options", async () => {
  const a = setup();
  await a.handler(postJson({ email: "ana@email.com", captcha_token: "token-turnstile" }, IP_HEADER));
  assertEquals(a.sent[0].options, { captchaToken: "token-turnstile" });

  const b = setup();
  await b.handler(postJson({ email: "ana@email.com", captcha_token: null }, IP_HEADER));
  assertEquals(b.sent[0].options, undefined);
});

Deno.test("o token do desafio nunca aparece na auditoria nem nos limites", async () => {
  const s = setup();
  await s.handler(postJson({ email: "ana@email.com", captcha_token: "segredo-do-desafio" }, IP_HEADER));
  assertEquals(JSON.stringify(s.calls).includes("segredo-do-desafio"), false);
});

Deno.test("Auth recusa o desafio dentro do piso: captcha_failed (HTTP 200), depois do piso de tempo", async () => {
  const s = setup({}, { code: "captcha_failed", message: "captcha verification process failed" });
  const res = await s.handler(postJson({ email: "ana@email.com", captcha_token: "ruim" }, IP_HEADER));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: false, error: "captcha_failed" });
  assertEquals(s.clock.state.slept.length > 0, true);
});

Deno.test("Auth lento (nao responde dentro do piso): { ok: true }, igual a conta inexistente", async () => {
  const s = setup({}, null, true);
  const res = await s.handler(postJson({ email: "ana@email.com" }, IP_HEADER));
  assertEquals(await res.json(), { ok: true });
});

Deno.test("outro erro do Auth (ex.: limite de e-mail) nao vira captcha_failed: { ok: true }", async () => {
  const s = setup({}, { code: "over_email_send_rate_limit", message: "x" });
  const res = await s.handler(postJson({ email: "ana@email.com" }, IP_HEADER));
  assertEquals(await res.json(), { ok: true });
});

Deno.test("corpo de 5 KB => 413 payload_too_large; so o limite da origem foi consultado", async () => {
  const s = setup();
  const res = await s.handler(postJson({ email: "ana@email.com", captcha_token: "t".repeat(5 * 1024) }, IP_HEADER));
  assertEquals(res.status, 413);
  assertEquals(await res.json(), { ok: false, error: "payload_too_large" });
  assertEquals(fnNames(s.calls), ["rate_limit_check"]);
  assertEquals(s.sent.length, 0);
});

Deno.test("chave desconhecida => 400 unknown_field, sem auditoria e sem e-mail", async () => {
  const s = setup();
  const res = await s.handler(postJson({ email: "ana@email.com", redirectTo: "https://evil.example" }, IP_HEADER));
  assertEquals(res.status, 400);
  assertEquals(await res.json(), { ok: false, error: "unknown_field" });
  assertEquals(fnNames(s.calls), ["rate_limit_check"]);
  assertEquals(s.sent.length, 0);
});

Deno.test("corpo que nao e objeto JSON => 400 bad_request; captcha_token com 2049 caracteres => 400", async () => {
  const a = setup();
  const r1 = await a.handler(postJson("[1,2]", IP_HEADER));
  assertEquals(r1.status, 400);
  assertEquals(await r1.json(), { ok: false, error: "bad_request" });
  const b = setup();
  const r2 = await b.handler(postJson({ email: "ana@email.com", captcha_token: "t".repeat(2049) }, IP_HEADER));
  assertEquals(r2.status, 400);
  assertEquals(b.sent.length, 0);
});

Deno.test("so POST e OPTIONS: GET/PUT/DELETE => 405 com CORS; OPTIONS => 204; nada e consultado", async () => {
  const s = setup();
  for (const method of ["GET", "PUT", "DELETE"]) {
    const res = await s.handler(new Request("http://x/fn", { method }));
    assertEquals(res.status, 405, method);
    assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS", method);
  }
  const pre = await s.handler(new Request("http://x/fn", { method: "OPTIONS" }));
  assertEquals(pre.status, 204);
  assertEquals(s.calls.length, 0);
});

Deno.test("campos aceitos: exatamente email e captcha_token", () => {
  assertEquals([...RECOVERY_ALLOWED_FIELDS], ["email", "captcha_token"]);
});
