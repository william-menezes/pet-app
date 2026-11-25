/**
 * phone-confirmed.guard.ts — T055 (spec 004)
 *
 * CanMatchFn para as rotas que exigem celular confirmado (as da `003`, como ativar uma tag). Quem não
 * tem o celular confirmado é levado a `/auth/celular?returnUrl=<rota>`. Admin passa. Falha ao carregar
 * a conta também passa (mesma escolha do `termsGuard`: não trancar o app por erro de rede; a regra de
 * verdade é `phone_is_confirmed` no banco).
 *
 * IMPORTANTE: guard é só experiência. A autorização real está no banco.
 *
 * O `AccountService` entra por `import()` dinâmico: se o guard for registrado em `app.routes.ts`, ele
 * vive no pacote inicial, e um import estático arrastaria o `@supabase/supabase-js` para ele.
 */
import { Injector, inject } from '@angular/core';
import { Router, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';
import { AuthStore } from '../auth/auth.store';
import { requestedUrl } from '../auth/guard-url';
import { sanitizeReturnUrl } from '../auth/return-url';

export const phoneConfirmedGuard: CanMatchFn = async (_route: Route, segments: UrlSegment[]) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const injector = inject(Injector);

  // Sem sessão quem decide é o authGuard (os guards de canMatch rodam em paralelo).
  if (!authStore.isAuthenticated()) return true;

  const { AccountService } = await import('./account.service');
  const account = await injector.get(AccountService).ensureLoaded();
  if (account === null) return true;
  if (account.papel === 'admin' || authStore.role() === 'admin') return true;
  if (account.celular !== null && account.celularConfirmadoEm !== null) return true;

  const returnUrl = sanitizeReturnUrl(requestedUrl(router, segments));
  return router.createUrlTree(['/auth/celular'], {
    queryParams: returnUrl === null ? {} : { returnUrl },
  });
};
