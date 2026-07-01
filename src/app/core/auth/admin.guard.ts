/**
 * admin.guard.ts — T017
 *
 * CanMatchFn para a rota /admin.
 * Redireciona tutores (não-admin) para /app.
 *
 * IMPORTANTE: guard de UX apenas. Autorização real = RLS via is_admin() no banco.
 * Um guard burlado NÃO concede acesso a dados de admin.
 */
import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { AuthStore } from './auth.store';

export const adminGuard: CanMatchFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (store.isAuthenticated() && store.role() === 'admin') {
    return true;
  }

  // Tutor tentando acessar admin → redireciona ao painel do tutor
  return router.createUrlTree(['/app']);
};
