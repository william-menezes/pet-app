import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render mode por rota (ver docs/architecture.md §2.1 e docs/frontend.md §3.1).
 * - Landing: Prerender (estática, SEO, carga instantânea).
 * - Resgate (`:codigo`, `:codigo/perdido`): Server (vínculo code→pet muda em runtime).
 * - Painel/admin/auth: Client (CSR puro; dados sensíveis, sem ganho de SSR).
 * - auth/callback: Client (CSR — processa retorno OAuth no browser, FR-015/US2).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },

  { path: 'app', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'auth/login', renderMode: RenderMode.Client },
  { path: 'auth/callback', renderMode: RenderMode.Client },
  { path: 'auth', renderMode: RenderMode.Client },

  { path: ':codigo/perdido', renderMode: RenderMode.Server },
  { path: ':codigo', renderMode: RenderMode.Server },

  { path: '**', renderMode: RenderMode.Server },
];
