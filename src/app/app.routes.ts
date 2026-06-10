import { Routes } from '@angular/router';

export const routes: Routes = [
  // ── Público (SSR/prerender) · Rescue-First: não depende de assinatura ativa ──
  {
    path: '',
    loadComponent: () => import('./features/public/landing/landing').then((m) => m.Landing),
    title: 'Faro — cuidado, saúde e resgate de pets',
  },

  // ── Painel / admin / auth (CSR lazy) — ANTES do `:codigo` para não serem capturados por ele ──
  {
    path: 'app',
    loadComponent: () => import('./features/pets/pets/pets').then((m) => m.Pets),
    title: 'Meus pets — Faro',
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin/admin').then((m) => m.Admin),
    title: 'Administração — Faro',
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Entrar — Faro',
  },

  // ── Resgate público dinâmico (SSR) · `:codigo/perdido` antes de `:codigo` (mais específico) ──
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
