/**
 * session-bootstrap.ts — correção de produção: a sessão não era restaurada ao recarregar.
 *
 * `AuthService.restoreSession()` nunca era chamado: a cada carga da página o `AuthStore` nascia sem
 * sessão e os guards mandavam a pessoa ao login, mesmo com a sessão do Supabase gravada no navegador.
 *
 * Regras:
 *  - no servidor não faz nada;
 *  - sem chave `sb-…-auth-token` em `localStorage` nem em `sessionStorage`, resolve na hora, SEM
 *    importar nada (a página pública não paga o supabase-js);
 *  - com chave, importa o `AuthService` por `import()` dinâmico e aguarda `restoreSession()`;
 *  - erro nunca lança: o visitante segue como anônimo.
 */
import { Injector, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { findPersistedStorage } from './session-persistence';

interface SessionRestorer {
  restoreSession(): Promise<void>;
}
type RestorerLoader = () => Promise<{ AuthService: new (...args: never[]) => SessionRestorer }>;

/** Chamar em contexto de injeção (inicializador do app). O `load` existe para os testes. */
export function bootstrapSession(
  load: RestorerLoader = () => import('./auth.service'),
): Promise<void> {
  const platformId = inject(PLATFORM_ID);
  const injector = inject(Injector);
  if (!isPlatformBrowser(platformId) || !findPersistedStorage()) return Promise.resolve();
  return load()
    .then((m) => injector.get(m.AuthService).restoreSession())
    .catch(() => undefined);
}
