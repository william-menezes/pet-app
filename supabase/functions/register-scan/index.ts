/**
 * Edge Function: register-scan
 * Endpoint: POST /functions/v1/register-scan   (so o servidor SSR do app e o pg_cron, com o cabecalho x-faro-ssr-key)
 *
 * Registra o scan, devolve o token de localizacao, atualiza a localizacao precisa e avisa o tutor por e-mail. A
 * orquestracao testavel esta em `handler.ts`; este arquivo so liga as dependencias reais.
 *
 * SEGURANCA:
 *   - `verify_jwt = false` (config.toml): o servidor SSR NAO tem chave do Supabase; a autorizacao e a chave
 *     `x-faro-ssr-key` (tempo constante, `_shared/auth.ts`). O JWT do tutor (`user_jwt`, no corpo) e validado aqui com
 *     `auth.getUser`, so para descobrir se quem abriu a pagina e o dono.
 *   - A chave service_role (injetada pelo runtime) vive SOMENTE aqui, no servidor (Principio III).
 *   - E-mail: `EMAIL_DRIVER` (`log`/`stub` so com FARO_ENV local ou test). Sem provedor, nada e enviado.
 *
 * Fonte de verdade: specs/003-tag-qr/contracts/public-page.contract.md.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { ssrKeysFromEnv } from "../_shared/auth.ts";
import { getCaller } from "../_shared/clients.ts";
import { faroEnvFrom, resolveEmailSender } from "../_shared/email.ts";
import { createRegisterHandler } from "./handler.ts";

let cached: SupabaseClient | null = null;
function service(): SupabaseClient {
  if (cached === null) {
    cached = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

// `EdgeRuntime.waitUntil` mantem a promessa viva depois da resposta (o aviso sai fora do caminho do scan).
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(createRegisterHandler({
  keys: () => ssrKeysFromEnv(),
  rpc: async (fn, args) => {
    const r = await service().rpc(fn, args);
    return { data: r.data, error: r.error };
  },
  getViewer: async (jwt) => {
    const req = new Request("http://internal/", { headers: { authorization: `Bearer ${jwt}` } });
    const user = await getCaller(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    });
    return user?.id ?? null;
  },
  sender: () =>
    resolveEmailSender({
      emailDriver: (Deno.env.get("EMAIL_DRIVER") ?? "").trim(),
      faroEnv: faroEnvFrom(Deno.env.get("FARO_ENV")),
    }),
  siteUrl: (Deno.env.get("SITE_URL") ?? "").trim() || "https://tagfaro.com.br",
  defer: (p) => {
    const safe = p.catch(() => undefined);
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(safe);
  },
}));
