/**
 * Logica pura da Edge Function phone-verify-start (contracts/phone-verify-start.edge.md).
 * Sem rede, sem env, sem banco: tudo testavel com `deno test` sem permissoes.
 */
import { normalizeBrPhone } from "../_shared/phone.ts";

export type TargetPhone = { ok: true; phone: string } | { ok: false };

/**
 * Passo 5: `phone` do corpo, se veio (qualquer valor diferente de undefined/null conta como "veio" e
 * precisa ser valido); senao o numero pendente da conta. Sem numero valido => `{ ok: false }`.
 */
export function pickTargetPhone(bodyPhone: unknown, pendingPhone: string | null): TargetPhone {
  if (bodyPhone !== undefined && bodyPhone !== null) {
    const phone = normalizeBrPhone(bodyPhone);
    return phone === null ? { ok: false } : { ok: true, phone };
  }
  if (pendingPhone === null || pendingPhone === undefined) return { ok: false };
  const phone = normalizeBrPhone(pendingPhone);
  return phone === null ? { ok: false } : { ok: true, phone };
}

/** Passo 6: o alvo e o celular que a conta ja confirmou. */
export function isSameNumber(target: string, confirmedPhone: string | null): boolean {
  return confirmedPhone !== null && confirmedPhone !== undefined && target === confirmedPhone;
}

/** Passo 8: e troca quando a conta ja tem celular confirmado. */
export function isPhoneChange(confirmedPhone: string | null): boolean {
  return confirmedPhone !== null && confirmedPhone !== undefined;
}

export type DeniedReply =
  | { error: "cooldown"; retry_after_seconds: number }
  | { error: "rate_limited"; retry_after_seconds: number }
  | { error: "sms_unavailable" };

/**
 * Passo 10: mapeia o `denied_bucket` de rate_limit_check. O teto global responde `sms_unavailable`, sem
 * `retry_after_seconds`, para nao revelar o volume do sistema.
 */
export function mapDeniedBucket(deniedBucket: string | null, retryAfterSeconds: number): DeniedReply {
  const retry = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 1 ? Math.ceil(retryAfterSeconds) : 1;
  if (deniedBucket === "sms:cooldown") return { error: "cooldown", retry_after_seconds: retry };
  if (deniedBucket === "sms:global:d") return { error: "sms_unavailable" };
  return { error: "rate_limited", retry_after_seconds: retry };
}

export interface RateCheck {
  bucket: string;
  key: string;
  max: number;
  window: number;
}

/** Os 6 limites `sms:*` de data-model.md §3, na ordem que define qual `denied_bucket` aparece primeiro. */
export function buildSmsLimits(args: {
  userId: string;
  phoneHash: string;
  ipHash: string;
  dailyCap: number;
}): RateCheck[] {
  return [
    { bucket: "sms:cooldown", key: args.userId, max: 1, window: 60 },
    { bucket: "sms:account:h", key: args.userId, max: 5, window: 3600 },
    { bucket: "sms:account:d", key: args.userId, max: 10, window: 86400 },
    { bucket: "sms:phone:d", key: args.phoneHash, max: 5, window: 86400 },
    { bucket: "sms:ip:h", key: args.ipHash, max: 30, window: 3600 },
    { bucket: "sms:global:d", key: "global", max: args.dailyCap, window: 86400 },
  ];
}

export type BeginError = "terms_required" | "invalid_phone" | "same_number";

/** Passo 12: erros de negocio de phone_verification_begin mapeados; qualquer outro => null (500 internal). */
export function mapBeginError(message: unknown): BeginError | null {
  if (message === "terms_required" || message === "invalid_phone" || message === "same_number") {
    return message;
  }
  return null;
}

/** Campos aceitos no corpo (security-hardening.contract.md, secao 5): qualquer outro => 400 unknown_field. */
export const START_ALLOWED_FIELDS = ["phone", "password", "captcha_token"] as const;
