/**
 * phone.ts — T024 (spec 004)
 *
 * Celular brasileiro: normaliza para E.164, formata para exibição e aplica máscara na digitação.
 * Mesmas regras de `supabase/functions/_shared/phone.ts` (a tabela de casos é a mesma nos dois).
 * Só celular: DDD 11–99 e nono dígito 9.
 */
export const BR_MOBILE_E164 = /^\+55[1-9][0-9]9[0-9]{8}$/;

/** `(11) 98765-4421`, `+55 11 98765-4421` ou `11987654421` => `+5511987654421`; inválido => `null`. */
export function normalizeBrPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/\D/g, '');
  let full: string;
  if (digits.length === 13 && digits.startsWith('55')) full = digits;
  else if (digits.length === 11) full = '55' + digits;
  else return null;
  const e164 = '+' + full;
  return BR_MOBILE_E164.test(e164) ? e164 : null;
}

/** `+5511987654421` => `(11) 98765-4421`. Fora do formato, devolve a entrada como veio. */
export function formatBrPhone(e164: string): string {
  if (!BR_MOBILE_E164.test(e164)) return e164;
  const d = e164.slice(3);
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara `(DD) 9XXXX-XXXX` enquanto a pessoa digita (aceita colar com +55). */
export function maskBrPhoneInput(typed: string): string {
  let d = typed.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
