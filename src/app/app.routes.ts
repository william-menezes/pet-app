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
import { termsGuard } from './core/auth/terms.guard';

export const routes: Routes = [
  // ── Público (SSR/prerender) · Rescue-First: não depende de assinatura ativa ──
  {
    path: '',
    loadComponent: () => import('./features/public/landing/landing').then((m) => m.Landing),
    title: 'Faro — O caminho de volta para casa',
  },

  // ── Painel autenticado (CSR lazy, protegido por authGuard) ──
  {
    path: 'app',
    canMatch: [authGuard, termsGuard],
    loadComponent: () => import('./features/pets/tutor-app/tutor-app').then((m) => m.TutorApp),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/pets/pets/pets').then((m) => m.Pets),
        data: { hub: true },
        title: 'Meus pets — Faro',
      },
      {
        path: 'conta',
        loadChildren: () => import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./shared/shells/shell-fallback/shell-fallback').then((m) => m.ShellFallback),
        data: { home: '/app' },
        title: 'Em construção — Faro',
      },
    ],
  },

  // ── Backoffice admin (CSR lazy, protegido por authGuard + adminGuard) ──
  {
    path: 'admin',
    canMatch: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin/admin-app/admin-app').then((m) => m.AdminApp),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/admin/admin').then((m) => m.Admin),
        title: 'Administração — Faro',
      },
      {
        path: '**',
        loadComponent: () =>
          import('./shared/shells/shell-fallback/shell-fallback').then((m) => m.ShellFallback),
        data: { home: '/admin' },
        title: 'Em construção — Faro',
      },
    ],
  },

  // ── Auth (CSR lazy) — o anonGuard vale só onde faz sentido (login): confirmar e-mail, nova senha,
  // callback e o aceite dos termos precisam abrir também com sessão (spec 004, contrato §1) ──
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        canMatch: [anonGuard],
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
        title: $localize`Entrar — Faro`,
      },
      {
        path: 'callback',
        loadComponent: () =>
          import('./features/auth/callback/oauth-callback').then((m) => m.OAuthCallback),
        title: $localize`Verificando — Faro`,
      },
      {
        path: 'termos',
        canMatch: [authGuard],
        loadComponent: () =>
          import('./features/auth/accept-terms/accept-terms').then((m) => m.AcceptTerms),
        title: $localize`Termos — Faro`,
      },
      {
        path: 'celular',
        canMatch: [authGuard, termsGuard],
        loadComponent: () =>
          import('./features/auth/phone-entry/phone-entry').then((m) => m.PhoneEntry),
        title: $localize`Celular — Faro`,
      },
      {
        path: 'confirmar-celular',
        canMatch: [authGuard, termsGuard],
        loadComponent: () =>
          import('./features/auth/confirm-phone/confirm-phone').then((m) => m.ConfirmPhone),
        title: $localize`Confirmar celular — Faro`,
      },
      {
        path: 'criar-conta',
        canMatch: [anonGuard],
        loadComponent: () => import('./features/auth/signup/signup').then((m) => m.Signup),
        title: $localize`Criar conta — Faro`,
      },
      {
        path: 'confirmar-email',
        loadComponent: () =>
          import('./features/auth/confirm-email/confirm-email').then((m) => m.ConfirmEmail),
        title: $localize`Confirmar e-mail — Faro`,
      },
      {
        path: 'recuperar-senha',
        canMatch: [anonGuard],
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
        title: $localize`Esqueci a senha — Faro`,
      },
      {
        path: 'nova-senha',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
        title: $localize`Nova senha — Faro`,
      },
      {
        path: '',
        pathMatch: 'full',
        canMatch: [anonGuard],
        loadComponent: () => import('./features/auth/welcome/welcome').then((m) => m.Welcome),
        title: $localize`Bem-vindo — Faro`,
      },
    ],
  },

  // ── Páginas legais (prerender; dois segmentos de propósito: não colidem com `/:codigo`) ──
  {
    path: 'legal/termos',
    loadComponent: () => import('./features/legal/terms/terms').then((m) => m.Terms),
    title: $localize`Termos de uso — Faro`,
  },
  {
    path: 'legal/privacidade',
    loadComponent: () =>
      import('./features/legal/privacy-policy/privacy-policy').then((m) => m.PrivacyPolicy),
    title: $localize`Política de privacidade — Faro`,
  },

  // ── Galeria de desenvolvimento (só em dev: o CLI troca `ngDevMode` por `false` em produção,
  // e o `import()` dentro do ramo some do pacote) · antes de `:codigo/perdido` e `:codigo` ──
  ...(ngDevMode
    ? [
        {
          path: 'dev/ui',
          loadChildren: () =>
            import('./features/dev-gallery/dev-gallery.routes').then((m) => m.DEV_GALLERY_ROUTES),
        },
      ]
    : []),

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
