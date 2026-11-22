/**
 * Clientes Supabase das Edge Functions (contracts/shared-edge.contract.md).
 * A chave service_role vive SOMENTE aqui, no servidor.
 */
import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.108.1";
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
 * Valida o JWT do cabecalho Authorization com auth.getUser().
 * Devolve null para ausencia de token, a chave anonima ou qualquer token invalido.
 */
export async function getCaller(req: Request, env: Pick<FaroEnv, "supabaseUrl" | "anonKey">): Promise<User | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  const token = match[1];
  if (token === env.anonKey) return null;
  const client = createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
