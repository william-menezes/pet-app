/**
 * Token do desafio anti-robo (Cloudflare Turnstile), security-hardening.contract.md secao 1.
 * A funcao NAO valida o token: repassa ao Supabase Auth, que valida. O token nunca vai a log nem a auditoria.
 */

/** Limite do campo `captcha_token` (acima disso: 400 bad_request). */
export const MAX_CAPTCHA_TOKEN_LENGTH = 2048;

export type CaptchaParse = { ok: true; token: string | undefined } | { ok: false };

/** Ausente, null ou vazio => sem token. String de ate 2048 caracteres => o token. Qualquer outra coisa => recusa (400). */
export function parseCaptchaToken(raw: unknown): CaptchaParse {
  if (raw === undefined || raw === null || raw === "") return { ok: true, token: undefined };
  if (typeof raw !== "string" || raw.length > MAX_CAPTCHA_TOKEN_LENGTH) return { ok: false };
  return { ok: true, token: raw };
}

/** Erro de desafio do Supabase Auth: codigo `captcha_failed` (ou mensagem que cite captcha). */
export function isCaptchaFailure(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === "captcha_failed") return true;
  return typeof e.message === "string" && /captcha/i.test(e.message);
}
