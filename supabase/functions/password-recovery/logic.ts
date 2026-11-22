/**
 * Logica pura da Edge Function password-recovery (contracts/password-recovery.edge.md).
 */

/** Piso de tempo da resposta: nao depende de a conta existir (passo 8). */
export const RESPONSE_FLOOR_MS = 600;

/** Limites do passo 5 (o limitador e `rate_limit_check`; tudo ou nada). */
export const RECOVERY_LIMITS = {
  identity: { bucket: "recovery:identity:h", max: 3, window: 3600 },
  ip: { bucket: "recovery:ip:h", max: 10, window: 3600 },
} as const;

/** Passo 3: e-mail em minusculas, sem espacos nas pontas; `valido` so confere o formato e o tamanho. */
export function parseRecoveryEmail(raw: unknown): { email: string; valido: boolean } {
  const email = String(raw ?? "").trim().toLowerCase();
  const valido = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return { email, valido };
}

/** Passo 5: os dois limites, na ordem do contrato (por e-mail, depois por origem). */
export function buildRecoveryLimits(identityHash: string, ipHash: string) {
  return [
    {
      bucket: RECOVERY_LIMITS.identity.bucket,
      key: identityHash,
      max: RECOVERY_LIMITS.identity.max,
      window: RECOVERY_LIMITS.identity.window,
    },
    {
      bucket: RECOVERY_LIMITS.ip.bucket,
      key: ipHash,
      max: RECOVERY_LIMITS.ip.max,
      window: RECOVERY_LIMITS.ip.window,
    },
  ];
}

/** Passo 5 (resultado): so `allowed === true` permite; erro, resposta estranha ou ausente negam (falha fechada). */
export function isRecoveryAllowed(result: { data?: unknown; error?: unknown } | null | undefined): boolean {
  if (!result || result.error) return false;
  const data = result.data as { allowed?: unknown } | null | undefined;
  return data?.allowed === true;
}

/** Passo 8: milissegundos que faltam para o piso. Nunca negativo, mesmo com relogio andando para tras. */
export function remainingWaitMs(startMs: number, nowMs: number, floorMs: number = RESPONSE_FLOOR_MS): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) return floorMs;
  const elapsed = nowMs - startMs;
  const wait = floorMs - (elapsed < 0 ? 0 : elapsed);
  return wait > 0 ? wait : 0;
}
