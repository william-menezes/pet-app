import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render mode por rota: SSR nas rotas públicas, CSR no app autenticado.
 * - Landing: Prerender (estática, SEO, carga instantânea).
 * - Página da tag (`/<código>`, casada por `UrlMatcher`) e o `**` final: Server. O vínculo código→pet muda
 *   em runtime e a página precisa de uma chamada ao `resolve-tag` a cada visita. Rota com `matcher` vira
 *   `**` aqui (o Angular a trata assim): a regra final cobre as duas.
 * - Painel/admin/auth: Client (CSR puro; dados sensíveis, sem ganho de SSR).
 * - auth/** (login, callback, termos, celular, ...): Client. O callback processa o retorno OAuth no
 *   browser (FR-015/US2).
 * - Fluxos `ativar/**`, `novo-pet` e `vincular/**`: Client, ANTES do `**`. Sem isso, recarregar
 *   `/ativar/<código>` (a volta da confirmação do e-mail) rodaria o guard no servidor, onde não há
 *   sessão, e mandaria o tutor de volta ao cadastro (contrato de integração §1.2).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },

  { path: 'app', renderMode: RenderMode.Client },
  { path: 'app/**', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'auth/**', renderMode: RenderMode.Client },
  { path: 'auth', renderMode: RenderMode.Client },
  { path: 'ativar/**', renderMode: RenderMode.Client },
  { path: 'novo-pet', renderMode: RenderMode.Client },
  { path: 'vincular/**', renderMode: RenderMode.Client },

  { path: 'legal/termos', renderMode: RenderMode.Prerender },
  { path: 'legal/privacidade', renderMode: RenderMode.Prerender },

  { path: '**', renderMode: RenderMode.Server },
];
