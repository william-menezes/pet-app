/**
 * Rotas da aplicação Faro.
 *
 * Invariantes:
 * - Two-bundle / Rescue-First: rotas em features/public/ NÃO importam core/auth nem painel.
 * - Render mode por rota em app.routes.server.ts (landing=Prerender; resgate=Server; painel=Client).
 * - Guards são só UX; autorização real é RLS no banco.
 */
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';
import { anonGuard } from './core/auth/anon.guard';

export const routes: Routes = [
  // ── Público (SSR/prerender) · Rescue-First: não depende de assinatura ativa ──
  {
    path: '',
    loadComponent: () => import('./features/public/landing/landing').then((m) => m.Landing),
    title: 'Faro — cuidado, saúde e resgate de pets',
  },

  // ── Painel autenticado (CSR lazy, protegido por authGuard) ──
  {
    path: 'app',
    canMatch: [authGuard],
    loadComponent: () => import('./features/pets/pets/pets').then((m) => m.Pets),
    title: 'Meus pets — Faro',
  },

  // ── Backoffice admin (CSR lazy, protegido por authGuard + adminGuard) ──
  {
    path: 'admin',
    canMatch: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin/admin/admin').then((m) => m.Admin),
    title: 'Administração — Faro',
  },

  // ── Auth (CSR lazy) — anonGuard impede acesso se já logado (FR-011) ──
  {
    path: 'auth',
    canMatch: [anonGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
        title: 'Entrar — Faro',
      },
      {
        path: 'callback',
        loadComponent: () =>
          import('./features/auth/callback/oauth-callback').then((m) => m.OAuthCallback),
        title: 'Verificando — Faro',
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  // ── Resgate público dinâmico (SSR) · `:codigo/perdido` antes de `:codigo` ──
  {
    path: ':codigo/perdido',
    loadComponent: () =>
      import('./features/public/rescue-page/rescue-page').then((m) => m.RescuePage),
    data: { perdido: true },
    title: 'Pet perdido — Faro',
  },
  {
    path: ':codigo',
    loadComponent: () =>
      import('./features/public/rescue-page/rescue-page').then((m) => m.RescuePage),
    title: 'Perfil de resgate — Faro',
  },
];
