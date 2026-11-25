/**
 * Orquestracao da Edge Function phone-verify-confirm, separada do `Deno.serve` para ser testavel com falsos
 * (contracts/phone-verify-confirm.edge.md e security-hardening.contract.md, secoes 2 e 5).
 *
 * Novo passo: `otp:confirm:h` (30 por hora por conta), contado em TODA chamada (inclusive `invalid_format` e
 * `no_active`), antes de qualquer conferencia. No estouro responde `rate_limited` e NAO consulta nem grava nada de
 * verificacao. Falha fechada: erro no limitador tambem nega.
 */
import { bodyErrorResponse, guardMethod, json, readJsonObject } from "../_shared/http.ts";
import { type FaroEnv, MisconfiguredError } from "../_shared/env.ts";
import { codeHashInput, hmacSha256Hex, sha256SaltedHex } from "../_shared/hash.ts";
import { getTrustedIp } from "../_shared/ip.ts";
import type { RpcClient } from "../_shared/audit.ts";
import { checkLimit } from "../_shared/limits.ts";
import { CONFIRM_ALLOWED_FIELDS, CONFIRM_CALLS_LIMIT, isValidCodeFormat, mapConfirmStatus } from "./logic.ts";

/** Parte do cliente de servico que a funcao usa. */
export interface ConfirmService extends RpcClient {
  auth: {
    admin: {
      updateUserById(id: string, attrs: { user_metadata: Record<string, unknown> }): PromiseLike<{ error: unknown }>;
    };
  };
}

export interface ConfirmDeps {
  loadEnv(): FaroEnv;
  svc(env: FaroEnv): ConfirmService;
  /** Usuario do `Authorization`, ou null (chave anonima, token invalido). */
  getCaller(req: Request, env: FaroEnv): Promise<{ id: string } | null>;
}

export function createHandler(deps: ConfirmDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      // 1. CORS, metodo, ambiente.
      const early = guardMethod(req);
      if (early) return early;

      let env: FaroEnv;
      try {
        env = deps.loadEnv();
      } catch (e) {
        if (e instanceof MisconfiguredError) {
          console.error(`phone-verify-confirm: ${e.message}`);
          return json(req, { ok: false, error: "misconfigured" }, 500);
        }
        throw e;
      }

      // 2. Quem chama e o corpo (4 KB, so a chave `code`).
      const caller = await deps.getCaller(req, env);
      if (!caller) return json(req, { ok: false, error: "unauthorized" }, 401);
      const parsedBody = await readJsonObject(req, undefined, CONFIRM_ALLOWED_FIELDS);
      if (!parsedBody.ok) return bodyErrorResponse(req, parsedBody);
      const body = parsedBody.body;

      const svc = deps.svc(env);
      const userId = caller.id;

      // 3. Limite por conta de TODA chamada, antes de qualquer conferencia. Falha fechada.
      const limit = await checkLimit(svc, [{ ...CONFIRM_CALLS_LIMIT, key: userId }], true);
      if (!limit.allowed) {
        return json(req, { ok: false, error: "rate_limited", retry_after_seconds: limit.retryAfter });
      }

      // 4. Formato do codigo (nao conta tentativa de codigo).
      const code = body.code;
      if (!isValidCodeFormat(code)) return json(req, { ok: false, error: "invalid_format" });

      // 5. Verificacao aberta da conta.
      const openRes = await svc.rpc("phone_verification_active", { p_user_id: userId });
      if (openRes.error) {
        console.error("phone-verify-confirm: falha ao ler a verificacao aberta");
        return json(req, { ok: false, error: "internal" }, 500);
      }
      const open = openRes.data as { verification_id: string; phone_e164: string } | null;
      if (!open) return json(req, { ok: false, error: "no_active" });

      // 6. Hash com chave do codigo informado.
      const codeHash = await hmacSha256Hex(env.otpPepper, codeHashInput(userId, open.phone_e164, code));

      // 7. Conferencia e contagem, na mesma chamada. Erro => 500 (nunca um sucesso).
      const ipHash = await sha256SaltedHex(getTrustedIp(req), env.hashSalt);
      const confirmRes = await svc.rpc("phone_verification_confirm", {
        p_user_id: userId,
        p_verification_id: open.verification_id,
        p_code_hash: codeHash,
        p_ip_hash: ipHash,
        p_user_agent: (req.headers.get("user-agent") ?? "").substring(0, 256),
      });
      if (confirmRes.error) {
        console.error("phone-verify-confirm: falha ao conferir o codigo");
        return json(req, { ok: false, error: "internal" }, 500);
      }

      // 8. Resposta por status.
      const reply = mapConfirmStatus(confirmRes.data, open.phone_e164);
      if (reply === null) {
        console.error("phone-verify-confirm: status inesperado");
        return json(req, { ok: false, error: "internal" }, 500);
      }

      // 9. Em sucesso, remove o telefone dos metadados do Auth. Falha so em log.
      if (reply.ok) {
        try {
          const { error } = await svc.auth.admin.updateUserById(userId, { user_metadata: { phone: null } });
          if (error) console.error("phone-verify-confirm: falha ao limpar os metadados");
        } catch {
          console.error("phone-verify-confirm: falha ao limpar os metadados");
        }
      }
      return json(req, reply);
    } catch {
      console.error("phone-verify-confirm: erro inesperado");
      return json(req, { ok: false, error: "internal" }, 500);
    }
  };
}
