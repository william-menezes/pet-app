import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render mode por rota (ver docs/architecture.md §2.1 e docs/frontend.md §3.1).
 * - Landing: Prerender (estática, SEO, carga instantânea).
 * - Resgate (`:codigo`, `:codigo/perdido`): Server (vínculo code→pet muda em runtime).
 * - Painel/admin/auth: Client (CSR puro; dados sensíveis, sem ganho de SSR).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },

  { path: 'app', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'auth/login', renderMode: RenderMode.Client },

  { path: ':codigo/perdido', renderMode: RenderMode.Server },
  { path: ':codigo', renderMode: RenderMode.Server },

  { path: '**', renderMode: RenderMode.Server },
];
