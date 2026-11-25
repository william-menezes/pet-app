/**
 * client-ip.ts — IP do visitante e `ip_hash` (contrato `security-hardening` §3; `public-page` §`/api/scan`).
 *
 * O IP vem SÓ dos cabeçalhos que a Vercel define (`x-vercel-forwarded-for`, depois `x-real-ip`): nunca
 * do corpo nem de um `x-forwarded-for` que o cliente possa ter escrito. O IP cru nunca sai do servidor
 * do app: o que segue para as Edge Functions é o HMAC-SHA256 dele.
 */
import { createHmac } from 'node:crypto';

export interface HeaderReader {
  get(name: string): string | null | undefined;
}

/** Valor usado quando nenhum cabeçalho confiável veio (desenvolvimento local): um balde só, nunca vazio. */
export const UNKNOWN_IP = 'unknown';

/** Primeiro endereço de um cabeçalho que a Vercel preenche; `null` se vazio. */
function first(value: string | null | undefined): string | null {
  const head = value?.split(',')[0]?.trim();
  return head ? head : null;
}

export function clientIp(headers: HeaderReader): string {
  return first(headers.get('x-vercel-forwarded-for')) ?? first(headers.get('x-real-ip')) ?? UNKNOWN_IP;
}

export function ipHash(secret: string, ip: string): string {
  return createHmac('sha256', secret).update(ip).digest('hex');
}
