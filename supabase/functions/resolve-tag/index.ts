/**
 * Edge Function: resolve-tag
 * Endpoint: POST /functions/v1/resolve-tag   (so o servidor SSR do app, com o cabecalho x-faro-ssr-key)
 *
 * A pagina publica `/:code` pergunta aqui o estado da tag. A orquestracao testavel esta em `handler.ts`; este arquivo
 * so liga as dependencias reais.
 *
 * SEGURANCA:
 *   - `verify_jwt = false` (config.toml): o servidor SSR NAO tem chave do Supabase (la ficam so FARO_SSR_KEY e
 *     IP_HASH_SECRET); a autorizacao e a chave `x-faro-ssr-key`, comparada em tempo constante (`_shared/auth.ts`).
 *   - A chave service_role (injetada pelo runtime) vive SOMENTE aqui, no servidor (Principio III).
 *   - `FARO_SSR_KEY` (e, na rotacao, `FARO_SSR_KEY_PREVIOUS`) com 32+ caracteres; senao 500 e a funcao nao atende.
 *
 * Fonte de verdade: specs/003-tag-qr/contracts/public-page.contract.md e security-hardening.contract.md.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { ssrKeysFromEnv } from "../_shared/auth.ts";
import { createResolveHandler, PHOTO_URL_TTL_SECONDS } from "./handler.ts";

const PHOTOS_BUCKET = "pet-photos";

let cached: SupabaseClient | null = null;
function service(): SupabaseClient {
  if (cached === null) {
    cached = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

Deno.serve(createResolveHandler({
  keys: () => ssrKeysFromEnv(),
  rpc: async (fn, args) => {
    const r = await service().rpc(fn, args);
    return { data: r.data, error: r.error };
  },
  signPhoto: async (path) => {
    const { data, error } = await service().storage.from(PHOTOS_BUCKET).createSignedUrl(path, PHOTO_URL_TTL_SECONDS);
    return error ? null : (data?.signedUrl ?? null);
  },
  globalLimit: async (scope, limit, windowSeconds) => {
    const r = await service().rpc("global_rate_hit", { p_scope: scope, p_limit: limit, p_window_seconds: windowSeconds });
    return r.error ? false : r.data === true;
  },
  now: () => Date.now(),
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}));
