/**
 * Prova recente de identidade antes de acoes sensiveis (trocar celular, excluir conta).
 * Contrato: specs/004-conta-tutor/contracts/shared-edge.contract.md (`reauth.ts`).
 *
 * Os clientes entram por parametro para o modulo ser testavel com falsos. Desvio do contrato, acrescimo:
 * `makeAnonClient` (fabrica do cliente novo, com a chave anonima e persistSession false, que confere a
 * senha) e `now` (relogio, opcional). Nunca escreve senha, e-mail ou IP em log.
 */
import type { FaroEnv } from "./env.ts";
import { logEvent, type RpcClient } from "./audit.ts";

/** Parte do cliente de servico que `reauth.ts` usa (estrutural, para testar com falsos). */
export interface ReauthService extends RpcClient {
  auth: { admin: { signOut(jwt: string, scope: "local"): PromiseLike<{ error: unknown }> } };
}

/** Parte do cliente anonimo que confere a senha. */
export interface ReauthPasswordClient {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): PromiseLike<{
      data: { session: { access_token: string } | null } | null;
      error: unknown;
    }>;
  };
}

export type ReauthResult =
  | { ok: true }
  | {
    ok: false;
    error: "reauth_required" | "invalid_password" | "rate_limited";
    retry_after_seconds?: number;
  };

export type ReauthAction = "trocar_celular" | "excluir_conta";

export const REAUTH_BUCKET = "reauth:account";
const REAUTH_MAX = 5;
const REAUTH_WINDOW_SECONDS = 900;
/** Sem senha (Google): o login deve ser dos ultimos 10 minutos. */
const RECENT_LOGIN_SECONDS = 600;

export async function requireRecentAuth(args: {
  env: FaroEnv;
  svc: ReauthService;
  userId: string;
  email: string;
  facts: { has_password: boolean; last_sign_in_at: string | null };
  password: unknown;
  action: ReauthAction;
  ipHash: string;
  userAgent: string;
  makeAnonClient: () => ReauthPasswordClient;
  now?: () => number;
}): Promise<ReauthResult> {
  const { svc, userId, facts, action } = args;
  const now = args.now ?? Date.now;
  const checks = [{ bucket: REAUTH_BUCKET, key: userId, max: REAUTH_MAX, window: REAUTH_WINDOW_SECONDS }];

  // 1. Limite de provas falhas, antes de conferir. Erro do limitador => negado (falha fechada).
  const limit = await rateCheck(svc, checks, false);
  if (!limit.allowed) {
    return { ok: false, error: "rate_limited", retry_after_seconds: limit.retryAfter };
  }

  // 2. Conta com senha.
  if (facts.has_password) {
    const password = args.password;
    if (typeof password !== "string" || password.length < 1 || password.length > 72) {
      return { ok: false, error: "reauth_required" };
    }
    let accessToken: string | null = null;
    try {
      const { data, error } = await args.makeAnonClient().auth.signInWithPassword({
        email: args.email,
        password,
      });
      if (!error && data?.session?.access_token) accessToken = data.session.access_token;
    } catch {
      accessToken = null;
    }

    if (accessToken !== null) {
      // Sucesso: a sessao criada so serviu para conferir a senha; revoga.
      try {
        await svc.auth.admin.signOut(accessToken, "local");
      } catch {
        console.error("reauth: falha ao revogar a sessao de conferencia");
      }
      return { ok: true };
    }

    // Falha: registra no limitador e audita (sem a senha, sem o e-mail).
    await rateCheck(svc, checks, true);
    await logEvent(svc, "reautenticacao_falha", userId, args.ipHash, args.userAgent, { acao: action });
    return { ok: false, error: "invalid_password" };
  }

  // 3. Conta sem senha: login recente.
  const last = facts.last_sign_in_at ? Date.parse(facts.last_sign_in_at) : NaN;
  if (Number.isFinite(last) && now() - last <= RECENT_LOGIN_SECONDS * 1000) {
    return { ok: true };
  }
  return { ok: false, error: "reauth_required" };
}

async function rateCheck(
  svc: RpcClient,
  checks: Array<{ bucket: string; key: string; max: number; window: number }>,
  record: boolean,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const { data: raw, error } = await svc.rpc("rate_limit_check", { p_checks: checks, p_record: record });
    const data = raw as { allowed?: unknown; retry_after_seconds?: unknown } | null | undefined;
    if (error || !data || data.allowed !== true) {
      const retry = typeof data?.retry_after_seconds === "number" && data.retry_after_seconds > 0
        ? data.retry_after_seconds
        : undefined;
      return { allowed: false, retryAfter: retry };
    }
    return { allowed: true };
  } catch {
    return { allowed: false };
  }
}
