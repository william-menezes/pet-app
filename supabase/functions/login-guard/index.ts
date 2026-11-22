/**
 * Edge Function: login-guard
 * Endpoint: POST /functions/v1/login-guard
 *
 * Reforco de rate-limit anti-bruteforce para o fluxo de login por e-mail/senha (FR-018) e auditoria dos eventos
 * de autenticacao (FR-020). A orquestracao, testavel, esta em `handler.ts`; este arquivo so liga as dependencias reais.
 *
 * SEGURANCA:
 *   - IP vem do header confiavel do runtime (nao do corpo: anti-spoofing). E-mail e IP sao hasheados (LGPD FR-021).
 *   - Segredos (SUPABASE_SERVICE_ROLE_KEY, HASH_SALT) SOMENTE no servidor (Principio III). Sem HASH_SALT valido: 500.
 *   - SQL via RPC tipada; zero SQL dinamico (FR-016).
 *
 * Fonte de verdade: specs/001-login/contracts/login-rate-limit.edge.md, auth-audit.contract.md e
 *                   specs/004-conta-tutor/contracts/security-hardening.contract.md (secao 2).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { getCaller } from "../_shared/clients.ts";
import { createHandler, type GuardEnv } from "./handler.ts";

function readEnv(): GuardEnv {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    hashSalt: Deno.env.get("HASH_SALT") ?? "",
  };
}

Deno.serve(createHandler({
  env: readEnv,
  // Cliente com service_role: bypassa RLS para gravar audit/attempts. SOMENTE aqui no servidor.
  svc: (env) => createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } }),
  actorId: async (req, env) => {
    try {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const user = await getCaller(req, { supabaseUrl: env.supabaseUrl, anonKey });
      return user?.id ?? null;
    } catch {
      return null;
    }
  },
}));
