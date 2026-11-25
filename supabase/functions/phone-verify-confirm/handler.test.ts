import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type ConfirmDeps, createHandler } from "./handler.ts";
import { CONFIRM_ALLOWED_FIELDS } from "./logic.ts";
import { fakeRpc, type LimitMode, postJson, type RpcCall, TEST_ENV } from "../_shared/testing.ts";

const USER = "bbbbbbbb-0000-0000-0000-000000000001";
const OPEN = { verification_id: "v-1", phone_e164: "+5511987654421" };

function setup(
  limits: Record<string, LimitMode> = {},
  opts: { open?: unknown; confirm?: unknown; caller?: { id: string } | null } = {},
) {
  const calls: RpcCall[] = [];
  const meta: unknown[] = [];
  const deps: ConfirmDeps = {
    loadEnv: () => TEST_ENV,
    svc: () => ({
      rpc: fakeRpc(calls, limits, {
        phone_verification_active: { data: opts.open === undefined ? OPEN : opts.open },
        phone_verification_confirm: { data: opts.confirm === undefined ? { status: "confirmed" } : opts.confirm },
      }),
      auth: {
        admin: {
          updateUserById: (_id: string, attrs: unknown) => {
            meta.push(attrs);
            return Promise.resolve({ error: null });
          },
        },
      },
    }),
    getCaller: () => Promise.resolve(opts.caller === undefined ? { id: USER } : opts.caller),
  };
  return { calls, meta, handler: createHandler(deps) };
}

const names = (calls: RpcCall[]) => calls.map((c) => c.fn);

Deno.test("otp:confirm:h: chave e a conta, 30 por 3600 s, registrando, e e a primeira coisa depois do corpo", async () => {
  const s = setup();
  await s.handler(postJson({ code: "123456" }));
  assertEquals(s.calls[0].fn, "rate_limit_check");
  assertEquals(s.calls[0].args.p_record, true);
  assertEquals(s.calls[0].args.p_checks, [{ bucket: "otp:confirm:h", max: 30, window: 3600, key: USER }]);
});

Deno.test("estouro: rate_limited com retry_after_seconds e NADA de verificacao e consultado nem gravado", async () => {
  const s = setup({ "otp:confirm:h": "deny" });
  const res = await s.handler(postJson({ code: "123456" }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: false, error: "rate_limited", retry_after_seconds: 37 });
  assertEquals(names(s.calls), ["rate_limit_check"]);
  assertEquals(s.meta.length, 0);
});

Deno.test("falha fechada: erro e excecao do limitador => rate_limited, sem tocar na verificacao", async () => {
  for (const mode of ["error", "throw"] as const) {
    const s = setup({ "otp:confirm:h": mode });
    const res = await s.handler(postJson({ code: "123456" }));
    const body = await res.json();
    assertEquals(body.error, "rate_limited", mode);
    assertEquals(names(s.calls), ["rate_limit_check"], mode);
  }
});

Deno.test("toda chamada conta: invalid_format e no_active tambem consultam o limite", async () => {
  const a = setup();
  const r1 = await a.handler(postJson({ code: "12" }));
  assertEquals(await r1.json(), { ok: false, error: "invalid_format" });
  assertEquals(names(a.calls), ["rate_limit_check"]);

  const b = setup({}, { open: null });
  const r2 = await b.handler(postJson({ code: "123456" }));
  assertEquals(await r2.json(), { ok: false, error: "no_active" });
  assertEquals(names(b.calls), ["rate_limit_check", "phone_verification_active"]);
});

Deno.test("caminho normal: limite, verificacao aberta, conferencia e limpeza dos metadados", async () => {
  const s = setup();
  const res = await s.handler(postJson({ code: "123456" }));
  assertEquals(await res.json(), { ok: true, phone: "+5511987654421" });
  assertEquals(names(s.calls), ["rate_limit_check", "phone_verification_active", "phone_verification_confirm"]);
  assertEquals(s.meta, [{ user_metadata: { phone: null } }]);
  // O codigo e o hash dele nunca vao na resposta; o RPC recebe so o hash com chave.
  const confirm = s.calls[2].args;
  assertEquals(JSON.stringify(confirm).includes("123456"), false);
});

Deno.test("sem usuario (chave anonima): 401 e nenhum limite consultado", async () => {
  const s = setup({}, { caller: null });
  const res = await s.handler(postJson({ code: "123456" }));
  assertEquals(res.status, 401);
  assertEquals(s.calls.length, 0);
});

Deno.test("corpo de 5 KB => 413; chave desconhecida => 400 unknown_field; nenhum dos dois consulta o limite", async () => {
  const a = setup();
  const r1 = await a.handler(postJson({ code: "1".repeat(5 * 1024) }));
  assertEquals(r1.status, 413);
  assertEquals(await r1.json(), { ok: false, error: "payload_too_large" });
  assertEquals(a.calls.length, 0);

  const b = setup();
  const r2 = await b.handler(postJson({ code: "123456", user_id: "outro" }));
  assertEquals(r2.status, 400);
  assertEquals(await r2.json(), { ok: false, error: "unknown_field" });
  assertEquals(b.calls.length, 0);
});

Deno.test("so POST e OPTIONS: GET => 405 com CORS; OPTIONS => 204", async () => {
  const s = setup();
  const res = await s.handler(new Request("http://x/fn", { method: "GET" }));
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assertEquals((await s.handler(new Request("http://x/fn", { method: "OPTIONS" }))).status, 204);
  assertEquals(s.calls.length, 0);
});

Deno.test("campo aceito: exatamente code", () => {
  assertEquals([...CONFIRM_ALLOWED_FIELDS], ["code"]);
});
