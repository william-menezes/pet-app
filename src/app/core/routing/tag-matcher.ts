/**
 * tag-matcher.ts — T024 (spec 003; research §15, contrato de integração §1)
 *
 * `UrlMatcher` da rota `/<código>`. Casa só um segmento que, depois de normalizado (maiúsculas, sem
 * `-` nem espaço, `O→0`, `I→1`, `L→1`), tem exatamente 9 caracteres do alfabeto do código. O dígito
 * verificador NÃO é conferido aqui: código com dígito errado é "tag não encontrada" e quem decide é a
 * própria página, sem consultar o banco. Qualquer outro caminho de um segmento cai no `**`.
 *
 * Importa só `core/tag-code` (função pura) e o roteador: entra no pacote inicial.
 */
import type { UrlMatcher, UrlMatchResult, UrlSegment } from '@angular/router';
import { normalize, TAG_ALPHABET } from '../tag-code/tag-code';

const CODE_LENGTH = 9;

/** O segmento, depois de normalizado, tem 9 caracteres do alfabeto do código? */
export function looksLikeTagCode(segment: string): boolean {
  const code = normalize(segment);
  if (code.length !== CODE_LENGTH) return false;
  for (const char of code) {
    if (!TAG_ALPHABET.includes(char)) return false;
  }
  return true;
}

export const tagCodeMatcher: UrlMatcher = (segments: UrlSegment[]): UrlMatchResult | null => {
  const [only] = segments;
  if (segments.length !== 1 || !looksLikeTagCode(only.path)) return null;
  return { consumed: segments, posParams: { codigo: only } };
};
