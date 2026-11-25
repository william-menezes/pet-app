/**
 * Normalizacao de celular brasileiro para E.164 (contracts/shared-edge.contract.md).
 * Mesmas regras de src/app/core/account/phone.ts; os dois arquivos tem a mesma tabela de casos de teste.
 */

export const BR_MOBILE_E164 = /^\+55[1-9][0-9]9[0-9]{8}$/;

/** `(11) 98765-4421` => `+5511987654421`; qualquer entrada invalida => null. */
export function normalizeBrPhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/[^0-9]/g, "");
  let full: string;
  if (digits.length === 13 && digits.startsWith("55")) {
    full = digits;
  } else if (digits.length === 11) {
    full = "55" + digits;
  } else {
    return null;
  }
  const e164 = "+" + full;
  return BR_MOBILE_E164.test(e164) ? e164 : null;
}
