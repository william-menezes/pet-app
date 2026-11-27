/**
 * server-tag-resolver.ts — T029 (spec 003; `public-page.contract.md`)
 *
 * Resolvedor que roda só no servidor SSR: calcula o `ip_hash`, chama a Edge Function `resolve-tag` com
 * `x-faro-ssr-key` e converte a resposta. Qualquer falha (variável ausente, rede, tempo, status
 * diferente de 200, JSON inválido) vira `contingency`, SEM exceção.
 *
 * Variável ausente = nenhuma chamada de rede: não se cai para `environment.supabaseUrl` nem para
 * outra URL. A chave nunca é registrada em log nem devolvida.
 */
import type { TagResolution } from '../../../models';
import type { ServerTagResolver } from '../tag-resolver.token';
import { clientIp, ipHash, UNKNOWN_IP, type HeaderReader } from './client-ip';
import { parseResolveResponse } from './resolve-response';
import type { ServerEnv } from './server-env';

export interface ServerResolverOptions {
  env: ServerEnv;
  /** Cabeçalhos do pedido que o navegador fez ao servidor (para o IP). */
  headers: HeaderReader | null;
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Corta a chamada de rede; a página tem o próprio limite de 2,5 s por cima. */
  timeoutMs?: number;
}

const CONTINGENCY: TagResolution = { state: 'contingency' };

export function createServerTagResolver(options: ServerResolverOptions): ServerTagResolver {
  const { env, headers, fetchFn = fetch, now = Date.now, timeoutMs = 2500 } = options;
  return async (code) => {
    if (env.functionsUrl === null || env.ssrKey === null || env.ipHashSecret === null) return CONTINGENCY;
    try {
      const hash = ipHash(env.ipHashSecret, headers ? clientIp(headers) : UNKNOWN_IP);
      const response = await fetchFn(`${env.functionsUrl}/resolve-tag`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-faro-ssr-key': env.ssrKey },
        body: JSON.stringify({ code, ip_hash: hash }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status !== 200) return CONTINGENCY;
      return parseResolveResponse(await response.json(), now());
    } catch {
      return CONTINGENCY;
    }
  };
}
