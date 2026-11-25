import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render mode por rota: SSR nas rotas públicas, CSR no app autenticado.
 * - Landing: Prerender (estática, SEO, carga instantânea).
 * - Resgate (`:codigo`, `:codigo/perdido`): Server (vínculo code→pet muda em runtime).
 * - Painel/admin/auth: Client (CSR puro; dados sensíveis, sem ganho de SSR).
 * - auth/** (login, callback, termos, celular, ...): Client. O callback processa o retorno OAuth no
 *   browser (FR-015/US2).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },

  { path: 'app', renderMode: RenderMode.Client },
  { path: 'app/**', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'auth/**', renderMode: RenderMode.Client },
  { path: 'auth', renderMode: RenderMode.Client },

  { path: 'legal/termos', renderMode: RenderMode.Prerender },
  { path: 'legal/privacidade', renderMode: RenderMode.Prerender },

  { path: ':codigo/perdido', renderMode: RenderMode.Server },
  { path: ':codigo', renderMode: RenderMode.Server },

  { path: '**', renderMode: RenderMode.Server },
];
