/**
 * Edge Function: admin-create-batch
 * Endpoint: POST /functions/v1/admin-create-batch   (so admin, com o JWT dele)
 *
 * Cria um lote de tags e devolve o pacote (ZIP com `pins.csv`). A orquestracao testavel esta em `handler.ts`; este arquivo so
 * liga as dependencias reais.
 *
 * ATENCAO: so desenvolvimento ate a T011 (lote-001 contra `isValid`) e a T085 (mascara do QR contra o script de referencia)
 * passarem. Nao fazer deploy em producao nem gerar lote real antes disso.
 *
 * SEGURANCA:
 *   - `verify_jwt = true` (config.toml) e, alem disso, o JWT e o papel de admin sao conferidos dentro da funcao
 *     (`requireAdmin`: valida o token e chama `is_admin()` com ele). O guard de rota do app e so conveniencia.
 *   - A chave service_role (injetada pelo runtime) vive SOMENTE aqui, no servidor (Principio III).
 *   - PIN nunca em log: esta funcao nao escreve log.
 *
 * Fonte de verdade: specs/003-tag-qr/contracts/admin.contract.md e security-hardening.contract.md.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { adminDeps } from "../_shared/supabase.ts";
import { createBatchHandler } from "./handler.ts";

let cached: SupabaseClient | null = null;
function service(): SupabaseClient {
  if (cached === null) {
    cached = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

const env = () => ({
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
});

Deno.serve(createBatchHandler({
  admin: adminDeps(env()),
  rpc: async (fn, args) => {
    const r = await service().rpc(fn, args);
    return { data: r.data, error: r.error };
  },
  random: (n) => crypto.getRandomValues(new Uint8Array(n)),
  now: () => new Date(),
}));
