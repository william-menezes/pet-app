/**
 * Logica pura da Edge Function phone-verify-confirm (contracts/phone-verify-confirm.edge.md).
 */

/** `code` precisa ser string com exatamente 6 digitos. Formato invalido NAO conta tentativa. */
export function isValidCodeFormat(code: unknown): code is string {
  return typeof code === "string" && /^[0-9]{6}$/.test(code);
}

export type ConfirmReply =
  | { ok: true; phone: string }
  | { ok: false; error: "invalid_code"; attempts_left: number }
  | { ok: false; error: "locked"; attempts_left: 0 }
  | { ok: false; error: "expired" }
  | { ok: false; error: "no_active" };

/**
 * Passo 7: mapeia o `status` de phone_verification_confirm para a resposta HTTP 200.
 * `confirmed` => sucesso (com o numero confirmado, que o chamador le de `phone_verification_active` antes);
 * `invalid` => `invalid_code`; `locked`, `expired`, `no_active` => iguais. Status desconhecido => `null`
 * (o chamador responde 500 internal, nunca um sucesso).
 */
export function mapConfirmStatus(result: unknown, phone: string): ConfirmReply | null {
  if (result === null || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  switch (r.status) {
    case "confirmed":
      return { ok: true, phone };
    case "invalid": {
      const left = typeof r.attempts_left === "number" ? r.attempts_left : 0;
      return { ok: false, error: "invalid_code", attempts_left: left };
    }
    case "locked":
      return { ok: false, error: "locked", attempts_left: 0 };
    case "expired":
      return { ok: false, error: "expired" };
    case "no_active":
      return { ok: false, error: "no_active" };
    default:
      return null;
  }
}
