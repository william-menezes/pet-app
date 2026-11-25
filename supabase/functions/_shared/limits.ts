/**
 * Chamada ao limitador (`rate_limit_check`, contracts/rate-limit.rpc.md) com a decisao ja interpretada.
 * `failed = true` quando a chamada em si falhou (erro, resposta estranha): o chamador decide se falha fechado
 * (SMS, exclusao, exportacao, PIN) ou aberto (disponibilidade, com outro controle atras).
 */
import type { RpcClient } from "./audit.ts";

export interface RateCheck {
  bucket: string;
  key: string;
  max: number;
  window: number;
}

export interface LimitDecision {
  /** So `true` quando o limitador respondeu `allowed: true`. */
  allowed: boolean;
  /** A chamada falhou (erro, excecao ou resposta fora do formato). */
  failed: boolean;
  deniedBucket: string | null;
  retryAfter: number;
}

/** Espera sugerida quando a chamada falha e nao ha `retry_after_seconds`. */
export const FALLBACK_RETRY_SECONDS = 60;

export async function checkLimit(svc: RpcClient, checks: RateCheck[], record: boolean): Promise<LimitDecision> {
  try {
    const { data, error } = await svc.rpc("rate_limit_check", { p_checks: checks, p_record: record });
    const d = data as { allowed?: unknown; denied_bucket?: unknown; retry_after_seconds?: unknown } | null | undefined;
    if (error || !d || typeof d.allowed !== "boolean") {
      return { allowed: false, failed: true, deniedBucket: null, retryAfter: FALLBACK_RETRY_SECONDS };
    }
    const retry = typeof d.retry_after_seconds === "number" && d.retry_after_seconds >= 1
      ? Math.ceil(d.retry_after_seconds)
      : 1;
    return {
      allowed: d.allowed,
      failed: false,
      deniedBucket: typeof d.denied_bucket === "string" ? d.denied_bucket : null,
      retryAfter: d.allowed ? 0 : retry,
    };
  } catch {
    return { allowed: false, failed: true, deniedBucket: null, retryAfter: FALLBACK_RETRY_SECONDS };
  }
}
