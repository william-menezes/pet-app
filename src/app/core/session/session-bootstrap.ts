/**
 * session-bootstrap.ts — correção de defeito da 001, pedida pela sessão principal em 2026-11-22
 *
 * `AuthService.restoreSession()` nunca era chamado: a cada carga da página o `AuthStore` nascia sem
 * sessão e os guards tratavam a pessoa como deslogada, mesmo com a sessão do Supabase gravada no
 * navegador. Este inicializador a restaura antes de o roteador decidir.
 *
 * Regras:
 *  - no servidor não faz nada;
 *  - no navegador procura a chave `sb-…-auth-token` em `localStorage` e em `sessionStorage`
 *    (a sessão vai para um ou outro conforme "Manter conectado");
 *  - sem chave resolve na hora, SEM importar nada (a página pública não paga o supabase-js);
 *  - com chave, importa o `AuthService` por `import()` dinâmico e aguarda `restoreSession()`;
 *  - erro nunca lança: o visitante segue como anônimo.
 */
import { Injector, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const SESSION_KEY = /^sb-.+-auth-token$/;

interface SessionRestorer {
  restoreSession(): Promise<void>;
}
type RestorerLoader = () => Promise<{ AuthService: new (...args: never[]) => SessionRestorer }>;

function hasKey(storage: Storage): boolean {
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && SESSION_KEY.test(key)) return true;
  }
  return false;
}

/** Há uma sessão do Supabase gravada neste navegador? */
export function hasPersistedSession(): boolean {
  try {
    return hasKey(localStorage) || hasKey(sessionStorage);
  } catch {
    return false;
  }
}

/** Chamar em contexto de injeção (inicializador do app). O `load` existe para os testes. */
export function bootstrapSession(
  load: RestorerLoader = () => import('../auth/auth.service'),
): Promise<void> {
  const platformId = inject(PLATFORM_ID);
  const injector = inject(Injector);
  if (!isPlatformBrowser(platformId) || !hasPersistedSession()) return Promise.resolve();
  return load()
    .then((m) => injector.get(m.AuthService).restoreSession())
    .catch(() => undefined);
}
