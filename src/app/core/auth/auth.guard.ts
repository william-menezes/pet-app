/**
 * auth.guard.ts — T017
 *
 * CanMatchFn para a rota /app.
 * Redireciona usuários não autenticados para /auth/login?returnUrl=...
 * preservando o destino pretendido (FR-012).
 *
 * IMPORTANTE: este guard é apenas UX. A autorização real dos dados é RLS no banco.
 * Um guard burlado NÃO concede acesso a dados protegidos.
 */
import { inject } from '@angular/core';
import { Router, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';
import { AuthStore } from './auth.store';

export const authGuard: CanMatchFn = (route: Route, segments: UrlSegment[]) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (store.isAuthenticated()) {
    return true;
  }

  // Preserva o returnUrl para voltar ao destino pretendido após login (FR-012)
  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl, reason: 'session_expired' },
  });
};
