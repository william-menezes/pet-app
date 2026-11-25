import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type DeleteDeps, type DeleteService } from "./handler.ts";
import { DELETE_ALLOWED_FIELDS } from "./logic.ts";
import { fakeRpc, type LimitMode, postJson, type RpcCall, TEST_ENV } from "../_shared/testing.ts";
import type { ReauthPasswordClient } from "../_shared/reauth.ts";

const USER = "bbbbbbbb-0000-0000-0000-000000000001";
const FACTS = { email: "tutor@faro.test", has_password: true, last_sign_in_at: null };

interface Opts {
  limits?: Record<string, LimitMode>;
  signIn?: "ok" | "wrong" | "captcha_failed";
  caller?: { id: string } | null;
}

function setup(o: Opts = {}) {
  const calls: RpcCall[] = [];
  const credentials: Array<Record<string, unknown>> = [];
  const deleted: string[] = [];
  const svc = {
    rpc: fakeRpc(calls, o.limits ?? {}, { account_auth_facts: { data: FACTS } }),
    auth: {
      admin: {
        signOut: () => Promise.resolve({ error: null }),
        deleteUser: (id: string) => {
          deleted.push(id);
          return Promise.resolve({ error: null });
        },
      },
    },
    storage: {
      from: () => ({
        list: () => Promise.resolve({ data: [], error: null }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    },
  } as unknown as DeleteService;
  const deps: DeleteDeps = {
    loadEnv: () => TEST_ENV,
    svc: () => svc,
    getCaller: () => Promise.resolve(o.caller === undefined ? { id: USER, email: FACTS.email } : o.caller),
    makeAnonClient: () =>
      ({
        auth: {
          signInWithPassword: (c: Record<string, unknown>) => {
            credentials.push(c);
            if (o.signIn === "wrong") {
              return Promise.resolve({ data: { session: null }, error: { code: "invalid_credentials", message: "x" } });
            }
            if (o.signIn === "captcha_failed") {
              return Promise.resolve({ data: { session: null }, error: { code: "captcha_failed", message: "x" } });
            }
            return Promise.resolve({ data: { session: { access_token: "t" } }, error: null });
          },
        },
      }) as unknown as ReauthPasswordClient,
  };
  return { calls, credentials, deleted, handler: createHandler(deps) };
}

const names = (calls: RpcCall[]) => calls.map((c) => c.fn);
const OK_BODY = { confirm: "EXCLUIR", password: "SenhaCerta123" };

Deno.test("acct:delete:h: chave e a conta, 10 por 3600 s, registrando, ANTES da palavra de confirmacao", async () => {
  const s = setup();
  const res = await s.handler(postJson({ confirm: "errado" }));
  assertEquals(await res.json(), { ok: false, error: "confirmation_required" });
  assertEquals(s.calls[0].fn, "rate_limit_check");
  assertEquals(s.calls[0].args.p_record, true);
  assertEquals(s.calls[0].args.p_checks, [{ bucket: "acct:delete:h", max: 10, window: 3600, key: USER }]);
  // confirmation_required parou antes de ler os fatos: so o limite foi consultado.
  assertEquals(names(s.calls), ["rate_limit_check"]);
});

Deno.test("estouro: rate_limited com retry_after_seconds; nada de reautenticacao, dados ou usuario", async () => {
  const s = setup({ limits: { "acct:delete:h": "deny" } });
  const res = await s.handler(postJson(OK_BODY));
  assertEquals(await res.json(), { ok: false, error: "rate_limited", retry_after_seconds: 37 });
  assertEquals(names(s.calls), ["rate_limit_check"]);
  assertEquals(s.credentials.length, 0);
  assertEquals(s.deleted.length, 0);
});

Deno.test("falha fechada: erro e excecao do limitador => rate_limited e nada e excluido", async () => {
  for (const mode of ["error", "throw"] as const) {
    const s = setup({ limits: { "acct:delete:h": mode } });
    const res = await s.handler(postJson(OK_BODY));
    assertEquals((await res.json()).error, "rate_limited", mode);
    assertEquals(names(s.calls), ["rate_limit_check"], mode);
    assertEquals(s.deleted.length, 0, mode);
  }
});

Deno.test("caminho normal: exclui os dados, depois o usuario", async () => {
  const s = setup();
  const res = await s.handler(postJson(OK_BODY));
  assertEquals(await res.json(), { ok: true });
  assertEquals(names(s.calls), ["rate_limit_check", "account_auth_facts", "rate_limit_check", "delete_account_data"]);
  assertEquals(s.deleted, [USER]);
});

Deno.test("captcha_token chega ao Auth da nova prova de identidade", async () => {
  const s = setup();
  await s.handler(postJson({ ...OK_BODY, captcha_token: "token-turnstile" }));
  assertEquals(s.credentials[0].options, { captchaToken: "token-turnstile" });
  const t = setup();
  await t.handler(postJson(OK_BODY));
  assertEquals("options" in t.credentials[0], false);
});

Deno.test("captcha_failed: resposta propria, NAO e invalid_password, nao conta como falha de senha e nada e excluido", async () => {
  const s = setup({ signIn: "captcha_failed" });
  const res = await s.handler(postJson({ ...OK_BODY, captcha_token: "ruim" }));
  assertEquals(await res.json(), { ok: false, error: "captcha_failed" });
  // Nenhum registro de falha (p_record true do reauth:account) e nenhuma auditoria reautenticacao_falha.
  const reauthRecords = s.calls.filter((c) => c.fn === "rate_limit_check" && c.args.p_record === true &&
    (c.args.p_checks as Array<{ bucket: string }>)[0].bucket === "reauth:account");
  assertEquals(reauthRecords.length, 0);
  assertEquals(names(s.calls).includes("log_auth_event"), false);
  assertEquals(s.deleted.length, 0);
});

Deno.test("senha errada continua sendo invalid_password e conta como falha", async () => {
  const s = setup({ signIn: "wrong" });
  const res = await s.handler(postJson(OK_BODY));
  assertEquals(await res.json(), { ok: false, error: "invalid_password" });
  assertEquals(names(s.calls).includes("log_auth_event"), true);
  assertEquals(s.deleted.length, 0);
});

Deno.test("captcha_token com 2049 caracteres => 400 e nenhum limite consultado", async () => {
  const s = setup();
  const res = await s.handler(postJson({ ...OK_BODY, captcha_token: "t".repeat(2049) }));
  assertEquals(res.status, 400);
  assertEquals(s.calls.length, 0);
});

Deno.test("corpo de 5 KB => 413; chave desconhecida => 400 unknown_field", async () => {
  const a = setup();
  const r1 = await a.handler(postJson({ ...OK_BODY, password: "p".repeat(5 * 1024) }));
  assertEquals(r1.status, 413);
  assertEquals(await r1.json(), { ok: false, error: "payload_too_large" });
  assertEquals(a.calls.length, 0);

  const b = setup();
  const r2 = await b.handler(postJson({ ...OK_BODY, user_id: "de-outra-conta" }));
  assertEquals(r2.status, 400);
  assertEquals(await r2.json(), { ok: false, error: "unknown_field" });
  assertEquals(b.calls.length, 0);
});

Deno.test("sem usuario: 401; so POST e OPTIONS: GET => 405 com CORS", async () => {
  const a = setup({ caller: null });
  assertEquals((await a.handler(postJson(OK_BODY))).status, 401);
  const s = setup();
  const res = await s.handler(new Request("http://x/fn", { method: "DELETE" }));
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});

Deno.test("campos aceitos: confirm, password e captcha_token", () => {
  assertEquals([...DELETE_ALLOWED_FIELDS], ["confirm", "password", "captcha_token"]);
});
