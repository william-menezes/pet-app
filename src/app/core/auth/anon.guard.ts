/**
 * anon.guard.ts — T017
 *
 * CanMatchFn para /auth/** (login, callback).
 * Usuário já autenticado acessando /auth → redireciona ao destino do papel (FR-011).
 * Evita que o formulário de login apareça para quem já está logado.
 */
import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { AuthStore } from './auth.store';
import { roleRedirect } from './role-redirect';

export const anonGuard: CanMatchFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (!store.isAuthenticated()) {
    return true; // Não autenticado → pode acessar /auth
  }

  // Já logado → redireciona ao destino do papel (FR-011)
  const destination = roleRedirect(store.role());
  return router.createUrlTree([destination]);
};
