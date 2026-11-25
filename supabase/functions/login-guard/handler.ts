/**
 * Orquestracao da Edge Function login-guard, separada do `Deno.serve` para ser testavel com falsos.
 * Fonte: specs/001-login/contracts/login-rate-limit.edge.md e specs/004-conta-tutor/contracts/security-hardening.contract.md
 * (secao 2, "login-guard"). A logica de decisao (`rate-limit.ts`, `record_login_attempt`) nao muda.
 *
 * Endurecimento da 004:
 *  - `guard:ip:m`: 60 chamadas por minuto por IP (hash). No estouro responde `backoff` SEM gravar tentativa nem auditoria.
 *    Falha ABERTA (e disponibilidade; atras ha o desafio e os limites nativos do Auth).
 *  - `detail` do cliente: so as chaves `metodo` e `motivo`, de ate 40 caracteres `[a-z_]`; o resto e descartado.
 *  - `user_id` do corpo e IGNORADO: o ator da auditoria e o usuario do JWT (quando ha JWT de usuario valido), senao nulo.
 *  - Corpo acima de 2 KB: 413. Chave desconhecida: 400. Sem HASH_SALT (ou com menos de 16 caracteres): 500 e nenhum registro.
 *  - So POST e OPTIONS.
 *
 * SEGURANCA: IP vem do runtime (nunca do corpo); e-mail e IP sao hasheados; zero SQL dinamico; sem e-mail, senha ou
 * token em log ou auditoria.
 */
import { bodyErrorResponse, guardMethod, json, readJsonObject } from "../_shared/http.ts";
import { sha256SaltedHex } from "../_shared/hash.ts";
import { getTrustedIp } from "../_shared/ip.ts";
import type { RpcClient } from "../_shared/audit.ts";
import { checkLimit } from "../_shared/limits.ts";
import { retryAfterSeconds } from "./rate-limit.ts";

/** Corpo ate 2 KB (contrato de endurecimento, secao 2). */
export const GUARD_MAX_BODY_BYTES = 2048;

/** Chaves que o cliente pode mandar. `user_id` continua aceito (o `AuthService` da 001 ainda o envia), mas e ignorado. */
export const GUARD_ALLOWED_FIELDS = ["phase", "email", "success", "user_id", "user_agent", "detail"] as const;

/** Limite por IP de toda chamada ao guard. */
export const GUARD_CALLS_LIMIT = { bucket: "guard:ip:m", max: 60, window: 60 } as const;

/** Tamanho minimo do sal (igual a `loadEnv`). */
export const MIN_SALT_LENGTH = 16;

const DETAIL_KEYS = ["metodo", "motivo"] as const;
const DETAIL_VALUE = /^[a-z_]{1,40}$/;

/** `detail` do cliente filtrado: so `metodo` e `motivo`, texto de 1 a 40 caracteres `[a-z_]`. Nunca lanca. */
export function sanitizeDetail(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return out;
  const source = raw as Record<string, unknown>;
  for (const key of DETAIL_KEYS) {
    const value = source[key];
    if (typeof value === "string" && DETAIL_VALUE.test(value)) out[key] = value;
  }
  return out;
}

export interface GuardEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  hashSalt: string;
}

export interface GuardDeps {
  /** Variaveis do servidor; chaves ausentes vem como string vazia. */
  env(): GuardEnv;
  svc(env: GuardEnv): RpcClient;
  /** Id do usuario do JWT do `Authorization`, ou null (chave anonima, token invalido, sem token). */
  actorId(req: Request, env: GuardEnv): Promise<string | null>;
}

type Decision = "allow" | "backoff" | "block";

function reply(req: Request, decision: Decision, retryAfter: number): Response {
  return json(req, { decision, retry_after_seconds: retryAfter }, 200);
}

function failure(req: Request, error: string, status: number): Response {
  return json(req, { error }, status);
}

export function createHandler(deps: GuardDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // CORS e metodo (so POST e OPTIONS; o 405 mantem o formato `{ error }` da 001).
    const early = guardMethod(req, { error: "method_not_allowed" });
    if (early) return early;

    // Segredos do servidor. Sem sal (ou sal curto): 500 e nenhum registro, em vez de hash com sal vazio.
    const env = deps.env();
    if (!env.supabaseUrl || !env.serviceRoleKey || env.hashSalt.length < MIN_SALT_LENGTH) {
      console.error("login-guard: configuracao do servidor incompleta");
      return failure(req, "misconfigured", 500);
    }
    const svc = deps.svc(env);

    // Limite por IP de TODA chamada, antes de ler o corpo. Estouro => backoff sem gravar nada. Falha aberta.
    const ipHash = await sha256SaltedHex(getTrustedIp(req), env.hashSalt);
    const guard = await checkLimit(svc, [{ ...GUARD_CALLS_LIMIT, key: ipHash }], true);
    if (!guard.failed && !guard.allowed) return reply(req, "backoff", guard.retryAfter);

    // Corpo: 2 KB, so as chaves conhecidas.
    const parsed = await readJsonObject(req, GUARD_MAX_BODY_BYTES, GUARD_ALLOWED_FIELDS);
    if (!parsed.ok) return bodyErrorResponse(req, parsed);
    const body = parsed.body;

    const phase = body.phase;
    const email = body.email;
    if (typeof phase !== "string" || phase === "" || typeof email !== "string" || email === "") {
      return failure(req, "bad_request", 400);
    }
    const userAgent = typeof body.user_agent === "string" ? body.user_agent.substring(0, 256) : "";
    const identityHash = await sha256SaltedHex(email.toLowerCase().trim(), env.hashSalt);

    if (phase === "pre_attempt") {
      // Consulta sem gravar (p_sucesso = null).
      const { data, error } = await svc.rpc("record_login_attempt", {
        p_identity_hash: identityHash,
        p_ip_hash: ipHash,
        p_sucesso: null,
      });
      if (error) {
        console.error("login-guard: falha na consulta de tentativas");
        // Falha segura: permitir a tentativa (o desafio e os limites do Auth continuam atras).
        return reply(req, "allow", 0);
      }
      const decision = (data as Decision | null) ?? "allow";
      if (decision === "block") {
        await svc.rpc("log_auth_event", {
          p_evento: "login_bloqueado",
          p_ator: null,
          p_ip_hash: ipHash,
          p_user_agent: userAgent,
          p_detalhe: { motivo: "rate_limit_pre_check" },
        });
      }
      const worst = decision === "block" ? 5 : decision === "backoff" ? 3 : 0;
      return reply(req, decision, retryAfterSeconds(worst));
    }

    if (phase === "post_result") {
      const success = body.success;
      if (typeof success !== "boolean") return failure(req, "bad_request", 400);

      const { data, error } = await svc.rpc("record_login_attempt", {
        p_identity_hash: identityHash,
        p_ip_hash: ipHash,
        p_sucesso: success,
      });
      if (error) console.error("login-guard: falha ao gravar a tentativa");

      // O ator vem do JWT, nunca do corpo; `detail` so com as chaves permitidas.
      const actor = await deps.actorId(req, env);
      await svc.rpc("log_auth_event", {
        p_evento: success ? "login_sucesso" : "login_falha",
        p_ator: actor,
        p_ip_hash: ipHash,
        p_user_agent: userAgent,
        p_detalhe: sanitizeDetail(body.detail),
      });

      const decision = (!error && (data as Decision | null)) || "allow";
      if (!success && decision === "block") {
        await svc.rpc("log_auth_event", {
          p_evento: "login_bloqueado",
          p_ator: null,
          p_ip_hash: ipHash,
          p_user_agent: userAgent,
          p_detalhe: { motivo: "rate_limit_post_failure" },
        });
      }
      const worst = decision === "block" ? 5 : decision === "backoff" ? 3 : 0;
      return reply(req, decision, retryAfterSeconds(worst));
    }

    return failure(req, "bad_request", 400);
  };
}
