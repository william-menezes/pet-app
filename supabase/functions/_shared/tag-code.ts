/**
 * Codigo da tag (Principio VIII, contrato fisico). Contrato: specs/003-tag-qr/contracts/tag-code.contract.md.
 *
 * Sem dependencia de Angular, Node ou Deno; sem rede e sem relogio. Este arquivo e copiado byte a byte
 * para `supabase/functions/_shared/tag-code.ts` (teste `tag-code.sync.spec.ts` falha se divergirem).
 * No banco, `tag_normalize`, `tag_is_valid` e `tag_format` (migration 0021) seguem a mesma regra.
 *
 * Regra do digito verificador (Luhn mod 32; research.md secao 2; igual a `luhn_mod_n_check` em
 * tools/tag-generator/gerar_tags.py): percorre o corpo da direita para a esquerda, fator 2 no caractere
 * mais a direita e alternando 2, 1, 2, 1...; para cada caractere soma `floor(a / 32) + a mod 32`, com
 * `a = fator * indice`; o digito e `ALFABETO[(32 - total mod 32) mod 32]`.
 *
 * Normalizacao: maiusculas ASCII (a-z), remove hifen e espacos ASCII (espaco, tab, LF, VT, FF, CR),
 * O vira 0, I e L viram 1. Tudo e ASCII de proposito: o SQL faz o mesmo com `translate`, sem depender
 * de locale nem de dobra de caixa Unicode.
 */

/** Alfabeto Crockford Base32 (sem I, L, O, U). */
export const TAG_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Dominio impresso no QR. Nunca muda (Principio VIII); nenhum outro dominio pode montar URL de tag. */
export const TAG_DOMAIN = 'TAGFARO.COM.BR';

const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{9}$/;
const BODY_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const BODY_LENGTH = 8;

/** Maiusculas; remove hifens e espacos; O vira 0, I e L viram 1. Nao valida. */
export function normalize(input: string): string {
  return input
    .replace(/[a-z]/g, (c) => c.toUpperCase())
    .replace(/[-\t\n\v\f\r ]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** Digito verificador Luhn mod 32 para um corpo de 8 caracteres ja normalizado. */
export function checkDigit(body: string): string {
  if (!BODY_PATTERN.test(body)) {
    throw new RangeError('corpo do codigo deve ter 8 caracteres do alfabeto');
  }
  let factor = 2;
  let total = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    const addend = factor * TAG_ALPHABET.indexOf(body[i]);
    total += Math.floor(addend / 32) + (addend % 32);
    factor = factor === 2 ? 1 : 2;
  }
  return TAG_ALPHABET[(32 - (total % 32)) % 32];
}

/** true se, depois de normalizar, tem 9 caracteres do alfabeto e o digito confere. */
export function isValid(input: string): boolean {
  if (typeof input !== 'string') return false;
  const code = normalize(input);
  if (!CODE_PATTERN.test(code)) return false;
  return checkDigit(code.slice(0, BODY_LENGTH)) === code[BODY_LENGTH];
}

function canonical(input: string): string {
  if (!isValid(input)) throw new RangeError('codigo de tag invalido');
  return normalize(input);
}

/** 'XXXX-XXXX-X' a partir de qualquer entrada valida; lanca erro se invalida. */
export function format(input: string): string {
  const code = canonical(input);
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

/** 'HTTPS://TAGFARO.COM.BR/<CODIGO>' em maiusculas; lanca erro se o codigo for invalido. */
export function tagUrl(input: string): string {
  return `HTTPS://${TAG_DOMAIN}/${canonical(input)}`;
}

/**
 * Codigo novo (corpo aleatorio + digito). So nas Edge Functions e nos scripts de seed.
 * `random(n)` devolve n bytes; `byte & 31` e uniforme porque 256 e multiplo de 32.
 */
export function newCode(random: (n: number) => Uint8Array): string {
  const bytes = random(BODY_LENGTH);
  if (bytes.length < BODY_LENGTH) throw new RangeError('fonte aleatoria devolveu bytes de menos');
  let body = '';
  for (let i = 0; i < BODY_LENGTH; i++) body += TAG_ALPHABET[bytes[i] & 31];
  return body + checkDigit(body);
}
