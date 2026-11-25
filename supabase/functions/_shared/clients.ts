/**
 * Clientes Supabase das Edge Functions (contracts/shared-edge.contract.md).
 * A chave service_role vive SOMENTE aqui, no servidor.
 */
import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { resolveCaller } from "./caller.ts";
import type { FaroEnv } from "./env.ts";

export type { SupabaseClient, User };

/** Cliente com service_role: bypassa RLS. Nunca exposto ao navegador. */
export function serviceClient(env: FaroEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente novo com a chave anonima e sem sessao persistida (confere senha em `reauth.ts`). */
export function anonClient(env: FaroEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Usuario do JWT do cabecalho Authorization, validado com auth.getUser() no servidor de Auth, ou null.
 * Ausente, chave publishable, chave anon legada, lixo ou erro => null (regras em `caller.ts`). Nunca lanca.
 */
export function getCaller(req: Request, env: Pick<FaroEnv, "supabaseUrl" | "anonKey">): Promise<User | null> {
  return resolveCaller<User>(req, async (token) => {
    const client = createClient(env.supabaseUrl, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    return error || !data?.user ? null : data.user;
  });
}
