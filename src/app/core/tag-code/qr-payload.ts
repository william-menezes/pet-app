import { TAG_DOMAIN, isValid, normalize } from './tag-code';

/**
 * Código da tag (9 caracteres normalizados) a partir do texto lido de um QR, ou `null`.
 *
 * Só vale o que a etiqueta imprime: `HTTPS://TAGFARO.COM.BR/<CODIGO>`. Outro protocolo, outro domínio (nem
 * subdomínio, nem `usuario@`), outra porta, mais de um segmento no caminho ou um código com o dígito errado não
 * são uma tag do Faro: o app não vai atrás deles. O código passa por `normalize` e `isValid` como toda entrada.
 */
export function codeFromQr(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toUpperCase() !== TAG_DOMAIN) return null;
  if (url.username !== '' || url.password !== '' || url.port !== '') return null;
  const segments = url.pathname.split('/').filter((s) => s !== '');
  if (segments.length !== 1) return null;
  let segment: string;
  try {
    segment = decodeURIComponent(segments[0]);
  } catch {
    return null;
  }
  const code = normalize(segment);
  return isValid(code) ? code : null;
}
