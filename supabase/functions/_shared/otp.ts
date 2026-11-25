/**
 * Codigo de 6 digitos do SMS (contracts/shared-edge.contract.md).
 * O codigo so existe em memoria durante o pedido: nunca em log, banco ou resposta.
 */
import type { FaroEnv } from "./env.ts";

/** Maior multiplo de 1.000.000 abaixo de 2^32 e 4.294.000.000: valores acima sao descartados (sem vies). */
const LIMIT = 4_294_000_000;

/** 6 digitos, `crypto.getRandomValues`, amostragem por rejeicao, com zeros a esquerda. */
export function generateCode(): string {
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= LIMIT);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/**
 * Codigo fixo SOMENTE com `smsDriver = 'stub'` e `faroEnv` em local/test; em qualquer outro caso, aleatorio.
 */
export function resolveCode(
  env: Pick<FaroEnv, "smsDriver" | "smsStubCode" | "faroEnv">,
): string {
  if (
    env.smsDriver === "stub" &&
    (env.faroEnv === "local" || env.faroEnv === "test") &&
    env.smsStubCode !== null &&
    /^[0-9]{6}$/.test(env.smsStubCode)
  ) {
    return env.smsStubCode;
  }
  return generateCode();
}
