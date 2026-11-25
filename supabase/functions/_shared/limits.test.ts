import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkLimit, FALLBACK_RETRY_SECONDS } from "./limits.ts";
import type { RpcClient } from "./audit.ts";

const CHECKS = [{ bucket: "b", key: "k", max: 1, window: 60 }];

function client(reply: () => Promise<{ data?: unknown; error: unknown }>, seen: Array<Record<string, unknown>> = []): RpcClient {
  return {
    rpc: (fn: string, args?: Record<string, unknown>) => {
      seen.push({ fn, ...(args ?? {}) });
      return reply();
    },
  };
}

Deno.test("permitido: allowed true, sem falha", async () => {
  const seen: Array<Record<string, unknown>> = [];
  const r = await checkLimit(
    client(() => Promise.resolve({ data: { allowed: true, denied_bucket: null, retry_after_seconds: 0 }, error: null }), seen),
    CHECKS,
    true,
  );
  assertEquals(r, { allowed: true, failed: false, deniedBucket: null, retryAfter: 0 });
  assertEquals(seen, [{ fn: "rate_limit_check", p_checks: CHECKS, p_record: true }]);
});

Deno.test("negado: devolve o balde e a espera (minimo 1, arredondada para cima)", async () => {
  const r = await checkLimit(
    client(() => Promise.resolve({ data: { allowed: false, denied_bucket: "b", retry_after_seconds: 41.2 }, error: null })),
    CHECKS,
    true,
  );
  assertEquals(r, { allowed: false, failed: false, deniedBucket: "b", retryAfter: 42 });
  const zero = await checkLimit(
    client(() => Promise.resolve({ data: { allowed: false, denied_bucket: "b", retry_after_seconds: 0 }, error: null })),
    CHECKS,
    true,
  );
  assertEquals(zero.retryAfter, 1);
});

Deno.test("erro, excecao e resposta estranha: negado e marcado como falha (quem chama decide fechar ou abrir)", async () => {
  const replies: Array<() => Promise<{ data?: unknown; error: unknown }>> = [
    () => Promise.resolve({ data: null, error: { message: "x" } }),
    () => Promise.reject(new Error("rede")),
    () => Promise.resolve({ data: null, error: null }),
    () => Promise.resolve({ data: { allowed: "sim" }, error: null }),
  ];
  for (const reply of replies) {
    const r = await checkLimit(client(reply), CHECKS, true);
    assertEquals(r.allowed, false);
    assertEquals(r.failed, true);
    assertEquals(r.retryAfter, FALLBACK_RETRY_SECONDS);
  }
});
