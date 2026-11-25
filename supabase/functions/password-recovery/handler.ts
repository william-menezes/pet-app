/**
 * Orquestracao da Edge Function password-recovery, separada do `Deno.serve` para ser testavel com falsos
 * (contracts/password-recovery.edge.md e security-hardening.contract.md, secoes 1, 2 e 5).
 *
 * Passos: metodo => ambiente => limite da origem (`recover:calls:ip`, 30/h, falha fechada) => corpo (4 KB, chaves
 * conhecidas) => e-mail => limites por e-mail e origem => auditoria => envio com o token do desafio => piso de 600 ms.
 *
 * Resposta unica `{ ok: true }`, exista ou nao a conta. Duas excecoes que nao revelam a conta: erro de corpo (4xx) e
 * `captcha_failed` (o Auth confere o desafio antes de procurar a conta).
 */
import { bodyErrorResponse, guardMethod, json, readJsonObject } from "../_shared/http.ts";
import { type FaroEnv, MisconfiguredError } from "../_shared/env.ts";
import { sha256SaltedHex } from "../_shared/hash.ts";
import { getTrustedIp } from "../_shared/ip.ts";
import { logEvent, type RpcClient } from "../_shared/audit.ts";
import { checkLimit } from "../_shared/limits.ts";
import { isCaptchaFailure, parseCaptchaToken } from "../_shared/captcha.ts";
import {
  buildRecoveryLimits,
  isRecoveryAllowed,
  parseRecoveryEmail,
  RECOVERY_ALLOWED_FIELDS,
  RECOVERY_CALLS_LIMIT,
  remainingWaitMs,
} from "./logic.ts";

/** Cliente anonimo que dispara o e-mail de recuperacao (estrutural: nada de tipo de esm.sh aqui). */
export interface RecoveryAnonClient {
  auth: {
    resetPasswordForEmail(
      email: string,
      options?: { captchaToken?: string },
    ): PromiseLike<{ data?: unknown; error: unknown }>;
  };
}

export interface RecoveryDeps {
  loadEnv(): FaroEnv;
  svc(env: FaroEnv): RpcClient;
  anon(env: FaroEnv): RecoveryAnonClient;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Roda uma promessa depois da resposta (EdgeRuntime.waitUntil). */
  background(task: Promise<unknown>): void;
}

export function createHandler(deps: RecoveryDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      // 1. CORS e metodo. 2. Relogio e ambiente.
      const early = guardMethod(req);
      if (early) return early;
      const inicio = deps.now();

      let env: FaroEnv;
      try {
        env = deps.loadEnv();
      } catch (e) {
        if (e instanceof MisconfiguredError) {
          console.error(`password-recovery: ${e.message}`);
          return json(req, { ok: false, error: "misconfigured" }, 500);
        }
        throw e;
      }

      const svc = deps.svc(env);
      const ipHash = await sha256SaltedHex(getTrustedIp(req), env.hashSalt);

      // Espera ate o piso de tempo e responde igual; usado em todo desfecho que nao revela nada.
      const respondUniform = async (): Promise<Response> => {
        const espera = remainingWaitMs(inicio, deps.now());
        if (espera > 0) await deps.sleep(espera);
        return json(req, { ok: true });
      };

      // 3. Limite de TODA chamada por origem. Estouro ou erro (falha fechada): mesma resposta, sem auditoria, sem e-mail.
      const calls = await checkLimit(svc, [{ ...RECOVERY_CALLS_LIMIT, key: ipHash }], true);
      if (!calls.allowed) return await respondUniform();

      // 4. Corpo: 4 KB, so as chaves conhecidas.
      const parsedBody = await readJsonObject(req, undefined, RECOVERY_ALLOWED_FIELDS);
      if (!parsedBody.ok) return bodyErrorResponse(req, parsedBody);
      const body = parsedBody.body;
      const captcha = parseCaptchaToken(body.captcha_token);
      if (!captcha.ok) return json(req, { ok: false, error: "bad_request" }, 400);

      // 5. E-mail normalizado e hashes (nunca o valor em claro).
      const { email, valido } = parseRecoveryEmail(body.email);
      const identityHash = await sha256SaltedHex(email, env.hashSalt);
      const userAgent = req.headers.get("user-agent") ?? "";

      // 6. Limites por e-mail e por origem (3/h e 10/h). Erro = negado.
      let permitido = false;
      if (valido) {
        try {
          const res = await svc.rpc("rate_limit_check", {
            p_checks: buildRecoveryLimits(identityHash, ipHash),
            p_record: true,
          });
          permitido = isRecoveryAllowed(res);
        } catch {
          permitido = false;
        }
      }

      // 7. Auditoria do pedido: sem e-mail e sem token no detalhe.
      await logEvent(svc, "senha_recuperacao_solicitada", null, ipHash, userAgent, {
        origem: "pedido",
        permitido,
      });

      // 8. Envio com o token do desafio (repassado ao Auth, que valida). Nao e aguardado alem do piso de tempo, para o
      //    tempo de resposta nao depender de a conta existir. Se o Auth recusar o desafio dentro do piso, e o unico
      //    desfecho diferente: o Auth confere o desafio antes de procurar a conta, entao nao revela nada sobre ela.
      let outcome: "done" | "captcha_failed" | "pending" = "done";
      let timer: Promise<void> = Promise.resolve();
      if (permitido) {
        const sending = (async (): Promise<"done" | "captcha_failed"> => {
          try {
            const { error } = await deps.anon(env).auth.resetPasswordForEmail(
              email,
              captcha.token ? { captchaToken: captcha.token } : undefined,
            );
            if (error) {
              if (isCaptchaFailure(error)) return "captcha_failed";
              console.error("password-recovery: falha no envio do e-mail de recuperacao");
            }
          } catch {
            console.error("password-recovery: falha no envio do e-mail de recuperacao");
          }
          return "done";
        })();
        deps.background(sending);
        timer = deps.sleep(remainingWaitMs(inicio, deps.now()));
        outcome = await Promise.race([sending, timer.then((): "pending" => "pending")]);
      }

      // 9. Piso de tempo (sempre) e resposta.
      await timer;
      const resto = remainingWaitMs(inicio, deps.now());
      if (resto > 0) await deps.sleep(resto);
      if (outcome === "captcha_failed") return json(req, { ok: false, error: "captcha_failed" });
      return json(req, { ok: true });
    } catch {
      console.error("password-recovery: erro inesperado");
      return json(req, { ok: false, error: "internal" }, 500);
    }
  };
}
