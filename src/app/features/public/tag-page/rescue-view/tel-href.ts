/**
 * Link `tel:` a partir do telefone de exibição do `resolve-tag` (`(11) 98765-4421`). O contrato só traz
 * o texto de exibição, sem DDI: o Faro vende no Brasil (E.164 `+55`). Devolve `null` se não houver
 * 10 ou 11 dígitos (aí o número aparece só como texto, sem link).
 */
export function telHref(display: string): string | null {
  const digits = display.replace(/\D/g, '');
  const national = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11 ? `tel:+55${national}` : null;
}
