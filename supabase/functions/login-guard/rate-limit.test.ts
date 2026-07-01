/**
 * rate-limit.test.ts — Testes unitários da lógica pura de rate-limit (deno test).
 *
 * Tarefa: T023 (tasks.md)
 * Fonte de verdade: specs/001-login/contracts/login-rate-limit.edge.md §Expectativas de teste
 *
 * Cobre:
 *   - Tabela de casos 0..6 falhas por eixo → decisão correta (SC-005).
 *   - Comportamento assimétrico: identity com 0 falhas + ip com 5 → block.
 *   - Comportamento assimétrico: identity com 5 falhas + ip com 0 → block.
 *   - Backoff progressivo (retryAfterSeconds).
 *
 * Como rodar:
 *   deno test supabase/functions/login-guard/rate-limit.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decide, retryAfterSeconds } from "./rate-limit.ts";

// ─────────────────────────────────────────
// decide() — tabela completa 0..6 por eixo simétrico
// ─────────────────────────────────────────

Deno.test("decide: 0 falhas em ambos os eixos → allow", () => {
  assertEquals(decide(0, 0), "allow");
});

Deno.test("decide: 1 falha identity, 0 ip → allow", () => {
  assertEquals(decide(1, 0), "allow");
});

Deno.test("decide: 2 falhas identity, 0 ip → allow", () => {
  assertEquals(decide(2, 0), "allow");
});

Deno.test("decide: 3 falhas identity, 0 ip → backoff", () => {
  assertEquals(decide(3, 0), "backoff");
});

Deno.test("decide: 4 falhas identity, 0 ip → backoff", () => {
  assertEquals(decide(4, 0), "backoff");
});

Deno.test("decide: 5 falhas identity, 0 ip → block", () => {
  assertEquals(decide(5, 0), "block");
});

Deno.test("decide: 6 falhas identity, 0 ip → block", () => {
  assertEquals(decide(6, 0), "block");
});

// ─────────────────────────────────────────
// decide() — eixo IP prevalece
// ─────────────────────────────────────────

Deno.test("decide: 0 identity, 3 ip → backoff (ip prevalece)", () => {
  assertEquals(decide(0, 3), "backoff");
});

Deno.test("decide: 0 identity, 5 ip → block (ip prevalece)", () => {
  assertEquals(decide(0, 5), "block");
});

Deno.test("decide: 2 identity, 5 ip → block (ip prevalece)", () => {
  assertEquals(decide(2, 5), "block");
});

Deno.test("decide: 5 identity, 0 ip → block (identity prevalece)", () => {
  assertEquals(decide(5, 0), "block");
});

// ─────────────────────────────────────────
// decide() — ambos os eixos contribuem; pior prevalece
// ─────────────────────────────────────────

Deno.test("decide: 3 identity, 3 ip → backoff (ambos no limiar de backoff)", () => {
  assertEquals(decide(3, 3), "backoff");
});

Deno.test("decide: 4 identity, 4 ip → backoff (abaixo de block)", () => {
  assertEquals(decide(4, 4), "backoff");
});

Deno.test("decide: 5 identity, 5 ip → block (ambos no limiar de block)", () => {
  assertEquals(decide(5, 5), "block");
});

Deno.test("decide: 3 identity, 5 ip → block (ip leva ao block)", () => {
  assertEquals(decide(3, 5), "block");
});

Deno.test("decide: 5 identity, 3 ip → block (identity leva ao block)", () => {
  assertEquals(decide(5, 3), "block");
});

// ─────────────────────────────────────────
// retryAfterSeconds() — backoff progressivo
// ─────────────────────────────────────────

Deno.test("retryAfterSeconds: < 3 falhas → 0 segundos (allow, sem espera)", () => {
  assertEquals(retryAfterSeconds(0), 0);
  assertEquals(retryAfterSeconds(1), 0);
  assertEquals(retryAfterSeconds(2), 0);
});

Deno.test("retryAfterSeconds: 3 falhas → 30 segundos (backoff inicial)", () => {
  assertEquals(retryAfterSeconds(3), 30);
});

Deno.test("retryAfterSeconds: 4 falhas → 60 segundos (backoff progressivo)", () => {
  assertEquals(retryAfterSeconds(4), 60);
});

Deno.test("retryAfterSeconds: >= 5 falhas → 0 (block; frontend não usa retry_after para unblock)", () => {
  assertEquals(retryAfterSeconds(5), 0);
  assertEquals(retryAfterSeconds(6), 0);
});
