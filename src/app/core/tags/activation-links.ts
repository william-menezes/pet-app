/**
 * Endereços do fluxo de ativação (T042). Só montam caminhos internos; o PIN nunca entra em nenhum deles.
 */
import { normalize } from '../tag-code';

/** `/ativar/<código normalizado>`, com `?pet=<id>` quando o pet já foi escolhido. */
export function activationPath(code: string, petId?: string | null): string {
  const base = `/ativar/${normalize(code)}`;
  return petId ? `${base}?pet=${encodeURIComponent(petId)}` : base;
}

/** Destino de `phone_not_confirmed`: `/auth/celular` com a volta para onde o tutor estava. */
export function phoneConfirmationRoute(returnUrl: string): { commands: string[]; queryParams: { returnUrl: string } } {
  return { commands: ['/auth/celular'], queryParams: { returnUrl } };
}

/**
 * Acrescenta `?pet=<id>` a um `returnUrl` interno (volta de `/novo-pet`). Mantém o resto da consulta e troca um
 * `pet` antigo. Devolve `null` se o destino não for um caminho interno simples.
 */
export function withPetParam(returnUrl: string, petId: string): string | null {
  if (!returnUrl.startsWith('/') || returnUrl.startsWith('//') || returnUrl.includes('\\')) return null;
  const url = new URL(returnUrl, 'https://tagfaro.com.br');
  if (url.origin !== 'https://tagfaro.com.br') return null;
  url.searchParams.set('pet', petId);
  return `${url.pathname}${url.search}`;
}
