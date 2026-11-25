/**
 * Rotas da aplicação Faro (tabela em specs/003-tag-qr/contracts/integration-002-004.contract.md §1).
 *
 * Invariantes:
 * - Two-bundle / Rescue-First: rotas em features/public/ NÃO importam core/auth nem painel.
 * - Render mode por rota em app.routes.server.ts (landing=Prerender; resgate=Server; painel=Client).
 * - Guards são só UX; autorização real é RLS no banco.
 * - Princípio VIII: rota fixa de um segmento nunca pode ter 9 caracteres do alfabeto do código depois
 *   de normalizada (teste em app.routes.spec.ts). O código é casado por `tagCodeMatcher`, depois das
 *   fixas; qualquer outro caminho de um segmento cai no `**` do fim.
 */
import { Routes } from '@angular/router';
import { lazyCanMatch } from './core/routing/lazy-guard';
import { tagCodeMatcher } from './core/routing/tag-matcher';
import { resolveTagRoute } from './core/routing/tag-route.resolver';

// Guards carregados sob demanda (T034B): `core/auth` e `core/account` puxam o supabase-js e NÃO podem
// entrar no pacote que a página pública baixa. Nenhum `import` estático deles neste arquivo.
const authGuard = lazyCanMatch(() => import('./core/auth/auth.guard').then((m) => m.authGuard));
const adminGuard = lazyCanMatch(() => import('./core/auth/admin.guard').then((m) => m.adminGuard));
const anonGuard = lazyCanMatch(() => import('./core/auth/anon.guard').then((m) => m.anonGuard));
const termsGuard = lazyCanMatch(() => import('./core/auth/terms.guard').then((m) => m.termsGuard));
const activationGuard = lazyCanMatch(() =>
  import('./core/tags/activation.guard').then((m) => m.activationGuard),
);
const phoneConfirmedGuard = lazyCanMatch(() =>
  import('./core/account/phone-confirmed.guard').then((m) => m.phoneConfirmedGuard),
);

/** Tela "em construção" das rotas cujas telas chegam nas próximas fases da 003. */
const shellFallback = () =>
  import('./shared/shells/shell-fallback/shell-fallback').then((m) => m.ShellFallback);

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
        pathMatch: 'full',
        loadComponent: () => import('./features/pets/pets/pets').then((m) => m.Pets),
        data: { hub: true },
        title: 'Meus pets — Faro',
      },
      {
        path: 'pets',
        pathMatch: 'full',
        loadComponent: shellFallback,
        data: { hub: true, home: '/app' },
        title: $localize`Seus pets — Faro`,
      },
      {
        path: 'pets/:petId',
        pathMatch: 'full',
        loadComponent: shellFallback,
        data: { home: '/app/pets' },
        title: $localize`Pet — Faro`,
      },
      {
        path: 'pets/:petId/editar',
        loadComponent: shellFallback,
        data: { home: '/app/pets' },
        title: $localize`Editar pet — Faro`,
      },
      {
        path: 'pets/:petId/visibilidade',
        loadComponent: () => import('./features/pets/visibility/visibility').then((m) => m.VisibilityPage),
        data: { home: '/app/pets' },
        title: $localize`O que estranhos veem — Faro`,
      },
      {
        path: 'pets/:petId/modo-perdido',
        loadComponent: () => import('./features/pets/lost-mode/lost-mode').then((m) => m.LostMode),
        data: { home: '/app/pets' },
        title: $localize`Modo perdido — Faro`,
      },
      {
        path: 'pets/:petId/tag',
        loadComponent: shellFallback,
        data: { home: '/app/pets' },
        title: $localize`Gerenciar tag — Faro`,
      },
      {
        // Do código da tag ao pet dono dele (o "Editar" da visão do dono só conhece o código).
        path: 'tag/:code',
        loadComponent: () => import('./features/pets/tag-redirect/tag-redirect').then((m) => m.TagRedirect),
        data: { home: '/app' },
        title: $localize`Abrindo a tag — Faro`,
      },
      {
        path: 'scans',
        loadComponent: () => import('./features/scans/scans/scans').then((m) => m.Scans),
        data: { hub: true, home: '/app' },
        title: $localize`Histórico de scans — Faro`,
      },
      {
        path: 'conta',
        loadChildren: () => import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: '**',
        loadComponent: shellFallback,
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
        pathMatch: 'full',
        loadComponent: () => import('./features/admin/admin/admin').then((m) => m.Admin),
        title: 'Administração — Faro',
      },
      {
        path: 'codigos',
        pathMatch: 'full',
        loadComponent: shellFallback,
        data: { home: '/admin' },
        title: $localize`Códigos — Faro`,
      },
      {
        path: 'codigos/:code',
        loadComponent: shellFallback,
        data: { home: '/admin/codigos' },
        title: $localize`Detalhe do código — Faro`,
      },
      {
        path: 'fila',
        loadComponent: shellFallback,
        data: { home: '/admin' },
        title: $localize`Fila — Faro`,
      },
      {
        path: 'auditoria',
        loadComponent: shellFallback,
        data: { home: '/admin' },
        title: $localize`Auditoria — Faro`,
      },
      {
        path: '**',
        loadComponent: shellFallback,
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

  // ── Páginas legais (prerender; dois segmentos de propósito: não colidem com o código da tag) ──
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
  // e o `import()` dentro do ramo some do pacote) · antes do código da tag ──
  ...(ngDevMode
    ? [
        {
          path: 'dev/ui',
          loadChildren: () =>
            import('./features/dev-gallery/dev-gallery.routes').then((m) => m.DEV_GALLERY_ROUTES),
        },
      ]
    : []),

  // ── Fluxos (casca de fluxo, fora do pai `app`; CSR em app.routes.server.ts) ──
  // O guard da ativação vai na frente: o roteador dá prioridade ao primeiro guard que não devolve true, e sem
  // sessão a ativação leva ao cadastro (não à tela de entrada).
  {
    path: 'ativar/:code',
    canMatch: [activationGuard, authGuard, termsGuard, phoneConfirmedGuard],
    loadComponent: () => import('./features/activation/activation').then((m) => m.Activation),
    title: $localize`Ativar tag — Faro`,
  },
  {
    path: 'novo-pet',
    canMatch: [authGuard, termsGuard],
    loadComponent: () => import('./features/pets/new-pet/new-pet').then((m) => m.NewPet),
    title: $localize`Novo pet — Faro`,
  },
  {
    path: 'vincular/:petId',
    canMatch: [authGuard, termsGuard, phoneConfirmedGuard],
    loadComponent: shellFallback,
    data: { home: '/app' },
    title: $localize`Vincular tag — Faro`,
  },

  // ── Página da tag (SSR), `/<código>`: casa só segmento que normalizado tem 9 caracteres do
  // alfabeto. Os dados vêm do resolvedor (servidor: `resolve-tag`; navegador: TransferState). Título
  // genérico: nunca o nome do pet. ──
  {
    matcher: tagCodeMatcher,
    resolve: { resolution: resolveTagRoute },
    loadComponent: () => import('./features/public/tag-page/tag-page').then((m) => m.TagPage),
    title: $localize`Faro · tag de identificação`,
  },

  // ── Qualquer outro caminho: página "não encontrada" (mesma tela da tag inexistente). ──
  {
    path: '**',
    loadComponent: () =>
      import('./features/public/not-found/not-found-page').then((m) => m.NotFoundPage),
    title: $localize`Página não encontrada — Faro`,
  },
];
