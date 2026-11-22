import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRecentAuth } from "./reauth.ts";
import type { FaroEnv } from "./env.ts";

const ENV = {} as FaroEnv;
const USER = "bbbbbbbb-0000-0000-0000-000000000001";
const NOW = Date.parse("2026-11-22T12:00:00Z");

interface Calls {
  rpc: Array<{ fn: string; args: Record<string, unknown> }>;
  signOut: Array<{ token: string; scope: string }>;
}

type LimitReply = { data: unknown; error: unknown } | "throw";

/** Servico falso: `limit` define a resposta do rate_limit_check; as demais rpc (auditoria) sempre dao certo. */
function fakeSvc(calls: Calls, limit: () => LimitReply): SupabaseClient {
  return {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.rpc.push({ fn, args });
      if (fn === "rate_limit_check") {
        const r = limit();
        if (r === "throw") return Promise.reject(new Error("falha do limitador"));
        return Promise.resolve(r);
      }
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      admin: {
        signOut: (token: string, scope: string) => {
          calls.signOut.push({ token, scope });
          return Promise.resolve({ error: null });
        },
      },
    },
  } as unknown as SupabaseClient;
}

function fakeAnon(ok: boolean, seen: { password?: string } = {}): () => SupabaseClient {
  return () =>
    ({
      auth: {
        signInWithPassword: (c: { email: string; password: string }) => {
          seen.password = c.password;
          return Promise.resolve(
            ok
              ? { data: { session: { access_token: "token-de-conferencia" } }, error: null }
              : { data: { session: null }, error: { message: "invalid" } },
          );
        },
      },
    }) as unknown as SupabaseClient;
}

const allow = (): LimitReply => ({ data: { allowed: true, denied_bucket: null, retry_after_seconds: 0 }, error: null });
const newCalls = (): Calls => ({ rpc: [], signOut: [] });

function base(svc: SupabaseClient, over: Record<string, unknown> = {}) {
  return {
    env: ENV,
    svc,
    userId: USER,
    email: "tutor@faro.test",
    facts: { has_password: true, last_sign_in_at: null as string | null },
    password: "SenhaCerta123" as unknown,
    action: "trocar_celular" as const,
    ipHash: "ip-de-teste",
    userAgent: "ua",
    makeAnonClient: fakeAnon(true),
    now: () => NOW,
    ...over,
  };
}

Deno.test("limite atingido => rate_limited, com retry_after_seconds", async () => {
  const calls = newCalls();
  const svc = fakeSvc(calls, () => ({
    data: { allowed: false, denied_bucket: "reauth:account", retry_after_seconds: 42 },
    error: null,
  }));
  const r = await requireRecentAuth(base(svc));
  assertEquals(r, { ok: false, error: "rate_limited", retry_after_seconds: 42 });
  assertEquals(calls.rpc.length, 1);
  assertEquals(calls.rpc[0].args.p_record, false);
});

Deno.test("erro do limitador (retorno ou excecao) => rate_limited (falha fechada)", async () => {
  for (const mode of ["erro", "throw"] as const) {
    const svc = fakeSvc(newCalls(), () => mode === "throw" ? "throw" : { data: null, error: { message: "x" } });
    const r = await requireRecentAuth(base(svc));
    assertEquals(r.ok, false);
    assertEquals(!r.ok && r.error, "rate_limited");
  }
});

Deno.test("conta com senha sem password valido => reauth_required (sem conferir nada)", async () => {
  for (const password of [undefined, null, "", 123, "x".repeat(73)]) {
    const calls = newCalls();
    const seen: { password?: string } = {};
    const r = await requireRecentAuth(base(fakeSvc(calls, allow), { password, makeAnonClient: fakeAnon(true, seen) }));
    assertEquals(r, { ok: false, error: "reauth_required" });
    assertEquals(seen.password, undefined);
  }
});

Deno.test("senha errada => registra a falha, audita reautenticacao_falha e devolve invalid_password", async () => {
  const calls = newCalls();
  const r = await requireRecentAuth(base(fakeSvc(calls, allow), { makeAnonClient: fakeAnon(false) }));
  assertEquals(r, { ok: false, error: "invalid_password" });
  const rate = calls.rpc.filter((c) => c.fn === "rate_limit_check");
  assertEquals(rate.map((c) => c.args.p_record), [false, true]);
  const audit = calls.rpc.filter((c) => c.fn === "log_auth_event");
  assertEquals(audit.length, 1);
  assertEquals(audit[0].args.p_evento, "reautenticacao_falha");
  assertEquals(audit[0].args.p_ator, USER);
  assertEquals(audit[0].args.p_detalhe, { acao: "trocar_celular" });
  // Nada de senha nem e-mail nas chamadas de auditoria e de limite.
  const dump = JSON.stringify(calls.rpc);
  assertEquals(dump.includes("SenhaCerta123"), false);
  assertEquals(dump.includes("tutor@faro.test"), false);
  assertEquals(calls.signOut.length, 0);
});

Deno.test("senha certa => ok e revoga a sessao criada (escopo local)", async () => {
  const calls = newCalls();
  const seen: { password?: string } = {};
  const r = await requireRecentAuth(base(fakeSvc(calls, allow), { makeAnonClient: fakeAnon(true, seen) }));
  assertEquals(r, { ok: true });
  assertEquals(seen.password, "SenhaCerta123");
  assertEquals(calls.signOut, [{ token: "token-de-conferencia", scope: "local" }]);
  // Acerto nao grava no limitador e nao audita falha.
  assertEquals(calls.rpc.filter((c) => c.fn === "rate_limit_check").map((c) => c.args.p_record), [false]);
  assertEquals(calls.rpc.filter((c) => c.fn === "log_auth_event").length, 0);
});

Deno.test("conta sem senha: login ha 5 min => ok; ha 11 min => reauth_required", async () => {
  const mk = (minutesAgo: number) => ({
    has_password: false,
    last_sign_in_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
  });
  const ok = await requireRecentAuth(base(fakeSvc(newCalls(), allow), { facts: mk(5), password: undefined }));
  assertEquals(ok, { ok: true });
  const old = await requireRecentAuth(base(fakeSvc(newCalls(), allow), { facts: mk(11), password: undefined }));
  assertEquals(old, { ok: false, error: "reauth_required" });
});

Deno.test("conta sem senha e sem last_sign_in_at => reauth_required", async () => {
  const r = await requireRecentAuth(base(fakeSvc(newCalls(), allow), {
    facts: { has_password: false, last_sign_in_at: null },
  }));
  assertEquals(r, { ok: false, error: "reauth_required" });
});
