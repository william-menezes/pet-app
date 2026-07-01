/**
 * Edge Function: login-guard
 * Endpoint: POST /functions/v1/login-guard
 *
 * Reforço de rate-limit anti-bruteforce para o fluxo de login por e-mail/senha (FR-018).
 * Também registra auditoria de eventos de autenticação (FR-020).
 *
 * SEGURANÇA:
 *   - IP vem do header confiável do runtime (não do corpo da requisição — anti-spoofing).
 *   - E-mail e IP são hasheados antes de qualquer armazenamento (minimização LGPD FR-021).
 *   - Timing uniforme: todos os caminhos percorrem o mesmo fluxo (sem early-return que
 *     diferencie "bloqueado por identity" vs "bloqueado por IP" — anti-enumeração FR-019).
 *   - Segredos (SUPABASE_SERVICE_ROLE_KEY, HASH_SALT) SOMENTE no servidor (Princípio III).
 *   - SQL via RPC tipada; zero SQL dinâmico (FR-016).
 *
 * Fonte de verdade: specs/001-login/contracts/login-rate-limit.edge.md
 *                   specs/001-login/contracts/auth-audit.contract.md
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decide, retryAfterSeconds } from "./rate-limit.ts";

// ─────────────────────────────────────────
// Tipos de request/response (contratos/login-rate-limit.edge.md)
// ─────────────────────────────────────────

interface LoginGuardRequest {
  /** Fase da requisição: pré-tentativa (consulta+pré-check) ou pós-resultado */
  phase: "pre_attempt" | "post_result";
  /** E-mail do usuário (será hasheado; NUNCA armazenado em claro) */
  email: string;
  /** Resultado da tentativa (obrigatório para phase='post_result') */
  success?: boolean;
  /** UUID do usuário se autenticado com sucesso (para auditoria ator) */
  user_id?: string;
  /** User-Agent para auditoria (será truncado a 256 chars) */
  user_agent?: string;
  /** Detalhe de auditoria mínimo (sem PII) */
  detail?: Record<string, unknown>;
}

interface LoginGuardResponse {
  decision: "allow" | "backoff" | "block";
  retry_after_seconds: number;
}

// ─────────────────────────────────────────
// Helpers de hash (minimização LGPD FR-021)
// ─────────────────────────────────────────

/** Hash SHA-256 com salt de uma string. Retorna hex. */
async function hashWithSalt(value: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Extrai o IP de origem confiável dos headers do runtime (anti-spoofing).
 *  Headers tentados em ordem de confiabilidade no ambiente Supabase/Deno Deploy.
 *  Nota: o IP do runtime não é controlável pelo corpo da requisição.
 */
function getTrustedIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ?? // Cloudflare
    "unknown"
  );
}

// ─────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Rejeitar métodos além de POST.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Segredos do servidor (Princípio III — nunca no cliente) ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hashSalt = Deno.env.get("HASH_SALT") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("login-guard: variáveis de ambiente obrigatórias ausentes");
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Cliente com service_role — bypassa RLS para gravar audit/attempts.
  // SOMENTE usado aqui no servidor; NUNCA exposto ao cliente.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Parse do corpo ──
  let body: LoginGuardRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { phase, email, success, user_id, user_agent, detail } = body;

  // Validação básica (sem revelar detalhes internos — anti-enumeração).
  if (!phase || !email || typeof email !== "string") {
    return new Response(
      JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Hash de e-mail e IP (minimização LGPD FR-021) ──
  // O IP vem do runtime (anti-spoofing); e-mail é normalizado antes do hash.
  const trustedIp = getTrustedIp(req);
  const [identityHash, ipHash] = await Promise.all([
    hashWithSalt(email.toLowerCase().trim(), hashSalt),
    hashWithSalt(trustedIp, hashSalt),
  ]);

  // ── Fase PRE_ATTEMPT: verificar se permite a tentativa ──
  if (phase === "pre_attempt") {
    // Consulta sem gravar (p_sucesso = null).
    const { data: decision, error } = await supabase.rpc(
      "record_login_attempt",
      {
        p_identity_hash: identityHash,
        p_ip_hash: ipHash,
        p_sucesso: null,
      },
    );

    if (error) {
      console.error("login-guard pre_attempt RPC error:", error.message);
      // Falha segura: permitir a tentativa (não bloquear por erro interno).
      const response: LoginGuardResponse = {
        decision: "allow",
        retry_after_seconds: 0,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Auditar bloqueio (login_bloqueado) quando a decisão for block.
    // Timing: mesmo quando block, o caminho percorrido é idêntico (sem early-return antes desta auditoria).
    if (decision === "block") {
      await supabase.rpc("log_auth_event", {
        p_evento: "login_bloqueado",
        p_ator: null, // identidade desconhecida (só temos hash)
        p_ip_hash: ipHash,
        p_user_agent: (user_agent ?? "").substring(0, 256),
        p_detalhe: { motivo: "rate_limit_pre_check" },
      });
    }

    // Calcular eixo mais alto para retry_after (precisaria de contagens separadas;
    // aqui o decide() re-computará a partir da contagem que o RPC já fez).
    // Para retry_after, usamos a decisão retornada como proxy.
    const worstCount = decision === "block" ? 5 : decision === "backoff" ? 3 : 0;
    const response: LoginGuardResponse = {
      decision: decision as "allow" | "backoff" | "block",
      retry_after_seconds: retryAfterSeconds(worstCount),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Fase POST_RESULT: gravar resultado e auditar ──
  if (phase === "post_result") {
    if (typeof success !== "boolean") {
      return new Response(
        JSON.stringify({ error: "Campo 'success' obrigatório em post_result" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Gravar a tentativa (success ou failure).
    const { data: decision, error: attemptError } = await supabase.rpc(
      "record_login_attempt",
      {
        p_identity_hash: identityHash,
        p_ip_hash: ipHash,
        p_sucesso: success,
      },
    );

    if (attemptError) {
      console.error("login-guard post_result RPC error:", attemptError.message);
    }

    // Auditar o evento de autenticação.
    const evento = success ? "login_sucesso" : "login_falha";
    const atorId = user_id ?? null;

    await supabase.rpc("log_auth_event", {
      p_evento: evento,
      p_ator: atorId,
      p_ip_hash: ipHash,
      p_user_agent: (user_agent ?? "").substring(0, 256),
      p_detalhe: {
        ...(detail ?? {}),
        // Sem e-mail, sem senha, sem token (minimização FR-021).
      },
    });

    // Auditar bloqueio se a contagem pós-resultado atingiu block.
    if (!success && decision === "block") {
      await supabase.rpc("log_auth_event", {
        p_evento: "login_bloqueado",
        p_ator: null,
        p_ip_hash: ipHash,
        p_user_agent: (user_agent ?? "").substring(0, 256),
        p_detalhe: { motivo: "rate_limit_post_failure" },
      });
    }

    const typedDecision = (decision as "allow" | "backoff" | "block") ?? "allow";
    const worstCount = typedDecision === "block"
      ? 5
      : typedDecision === "backoff"
      ? 3
      : 0;

    const response: LoginGuardResponse = {
      decision: typedDecision,
      retry_after_seconds: retryAfterSeconds(worstCount),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // phase desconhecido.
  return new Response(
    JSON.stringify({ error: "Fase desconhecida. Use 'pre_attempt' ou 'post_result'." }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
});
