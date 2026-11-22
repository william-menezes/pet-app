/**
 * terms.guard.ts — T027 (spec 004)
 *
 * CanMatchFn de `/app` (e de `/auth/celular`, `/auth/confirmar-celular`): tutor que ainda não
 * aceitou os Termos é levado a `/auth/termos?returnUrl=<rota>`. Admin passa. Falha ao carregar a
 * conta também passa: a RLS protege os dados e não se tranca o app por erro de rede.
 *
 * IMPORTANTE: guard é só experiência. A regra de verdade está no banco.
 *
 * O `AccountService` entra por `import()` dinâmico: o guard vive no pacote inicial (está em
 * `app.routes.ts`) e importar o serviço de forma estática arrastaria o `@supabase/supabase-js`
 * (cerca de 200 kB) para ele. O token é o mesmo, então os testes podem substituí-lo normalmente.
 */
import { Injector, inject } from '@angular/core';
import { Router, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';
import { AuthStore } from './auth.store';
import { requestedUrl } from './guard-url';
import { sanitizeReturnUrl } from './return-url';

export const termsGuard: CanMatchFn = async (_route: Route, segments: UrlSegment[]) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const injector = inject(Injector);

  // Sem sessão quem decide é o authGuard (os guards de canMatch rodam em paralelo).
  if (!authStore.isAuthenticated()) return true;

  const { AccountService } = await import('../account/account.service');
  const account = await injector.get(AccountService).ensureLoaded();
  if (account === null) return true;
  if (account.papel === 'admin' || authStore.role() === 'admin') return true;
  if (account.termosAceitosEm !== null) return true;

  const returnUrl = sanitizeReturnUrl(requestedUrl(router, segments));
  return router.createUrlTree(['/auth/termos'], {
    queryParams: returnUrl === null ? {} : { returnUrl },
  });
};
