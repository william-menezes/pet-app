/**
 * auth.guard.ts — T017 (001), alterado na T027 (004)
 *
 * CanMatchFn para as rotas que exigem sessão (/app, /auth/termos, ...).
 * Sem sessão:
 *   - quem já entrou neste navegador (`isReturning()`) vai para o login com aviso de sessão
 *     expirada: `/auth/login?returnUrl=…&reason=session_expired` (FR-012);
 *   - quem nunca entrou vai para as boas-vindas: `/auth?returnUrl=…`.
 *
 * IMPORTANTE: este guard é apenas UX. A autorização real dos dados é RLS no banco.
 * Um guard burlado NÃO concede acesso a dados protegidos.
 */
import { inject } from '@angular/core';
import { Router, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';
import { AuthStore } from './auth.store';
import { requestedUrl } from './guard-url';
import { sanitizeReturnUrl } from './return-url';
import { isReturning } from './returning-visitor';

export const authGuard: CanMatchFn = (_route: Route, segments: UrlSegment[]) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (store.isAuthenticated()) {
    return true;
  }

  // Preserva o destino para voltar depois do login (FR-012). Destino inválido (ex.: dentro de
  // /auth) não é guardado.
  const returnUrl = sanitizeReturnUrl(requestedUrl(router, segments));
  const returnQuery = returnUrl === null ? {} : { returnUrl };

  if (isReturning()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { ...returnQuery, reason: 'session_expired' },
    });
  }
  return router.createUrlTree(['/auth'], { queryParams: returnQuery });
};
