/**
 * Ligacao real com o Supabase para as Edge Functions de tag (spec 003, T023). Este arquivo importa o supabase-js e
 * por isso NAO e importado por nenhum modulo que tenha teste: a logica testavel fica em `auth.ts` e nos `handler.ts`,
 * que recebem estas dependencias por injecao (padrao da 004).
 *
 * A chave service_role vive SOMENTE aqui, no servidor (Principio III).
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import type { AdminDeps } from "./auth.ts";
import { getCaller } from "./clients.ts";
import { type FaroEnv, loadEnv } from "./env.ts";

/** Cliente com a role de servico (bypassa RLS). Sem sessao persistida. */
export function serviceRoleClient(env: Pick<FaroEnv, "supabaseUrl" | "serviceRoleKey">): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente que age COMO o usuario: usa a chave publica e manda o JWT dele (a RLS e as funcoes veem `auth.uid()`). */
export function userClient(env: Pick<FaroEnv, "supabaseUrl" | "anonKey">, token: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Dependencias reais de `requireAdmin`: valida o JWT e pergunta `is_admin()` ao banco com ele. */
export function adminDeps(env: Pick<FaroEnv, "supabaseUrl" | "anonKey">): AdminDeps {
  return {
    getCaller: (req) => getCaller(req, env),
    isAdmin: async (token) => {
      const { data, error } = await userClient(env, token).rpc("is_admin");
      if (error) throw new Error("is_admin falhou");
      return data === true;
    },
  };
}

/** Ambiente das funcoes de tag: o `loadEnv` da 004 (sem o pepper de SMS) mais o cliente de servico. */
export function loadTagFunctionContext(): { env: FaroEnv; service: SupabaseClient } {
  const env = loadEnv({ pepper: false });
  return { env, service: serviceRoleClient(env) };
}
