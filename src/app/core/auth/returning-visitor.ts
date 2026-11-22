/**
 * returning-visitor.ts — T023 (spec 004)
 *
 * Marca, só neste navegador, que a pessoa já entrou antes. O `authGuard` usa a marca para escolher
 * entre as boas-vindas (`/auth`) e o login com aviso de sessão expirada. A marca não é dado pessoal
 * e não dá acesso a nada.
 *
 * Sem argumento, as funções usam `inject(PLATFORM_ID)` e exigem contexto de injeção (guard,
 * construtor). Depois de um `await`, passe o `platformId` já injetado.
 */
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const KEY = 'faro.returning';

export function markReturning(platformId: object = inject(PLATFORM_ID)): void {
  if (!isPlatformBrowser(platformId)) return;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // armazenamento bloqueado: sem marca
  }
}

export function isReturning(platformId: object = inject(PLATFORM_ID)): boolean {
  if (!isPlatformBrowser(platformId)) return false;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Usada só na limpeza local da exclusão de conta (`PrivacyService`). */
export function clearReturning(platformId: object = inject(PLATFORM_ID)): void {
  if (!isPlatformBrowser(platformId)) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada a limpar
  }
}
