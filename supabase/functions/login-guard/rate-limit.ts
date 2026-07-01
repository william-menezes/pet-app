/**
 * rate-limit.ts — Lógica pura de decisão de rate-limit (testável isolada via deno test).
 *
 * Fonte de verdade: specs/001-login/contracts/login-rate-limit.edge.md
 *
 * Regras (FR-018):
 *   - >= 5 falhas em qualquer eixo (identity OU ip) na janela de 15 min → 'block'
 *   - >= 3 falhas → 'backoff' (backoff progressivo)
 *   - < 3 falhas → 'allow'
 *
 * Esta função não tem efeitos colaterais; toda E/S está no index.ts.
 * Testável via: deno test supabase/functions/login-guard/rate-limit.test.ts
 */

export type RateLimitDecision = "allow" | "backoff" | "block";

/**
 * Computa a decisão de rate-limit a partir das contagens de falhas na janela.
 *
 * @param failIdentity - número de falhas na janela para a identidade (hash do e-mail)
 * @param failIp       - número de falhas na janela para o IP (hash)
 * @returns decisão: 'allow' | 'backoff' | 'block'
 */
export function decide(
  failIdentity: number,
  failIp: number,
): RateLimitDecision {
  const worst = Math.max(failIdentity, failIp);

  if (worst >= 5) return "block";
  if (worst >= 3) return "backoff";
  return "allow";
}

/**
 * Calcula o tempo de espera sugerido (em segundos) para decisões 'backoff'.
 * Backoff progressivo baseado no número de falhas acumuladas.
 *
 * @param failCount - número de falhas no eixo mais alto
 * @returns segundos para aguardar (0 se allow/block; backoff progressivo se backoff)
 */
export function retryAfterSeconds(failCount: number): number {
  if (failCount < 3) return 0;
  if (failCount < 4) return 30;
  if (failCount < 5) return 60;
  return 0; // block: frontend não deve usar retry_after para unblock automático
}
