/**
 * Edge Function: phone-verify-start
 * Endpoint: POST /functions/v1/phone-verify-start
 *
 * Envia (ou reenvia) o codigo de 6 digitos por SMS. E o UNICO ponto do sistema que fala com o provedor
 * de SMS. Contrato e ordem dos 16 passos: specs/004-conta-tutor/contracts/phone-verify-start.edge.md.
 *
 * SEGURANCA: o codigo vive so na memoria desta funcao (nunca em log, auditoria ou resposta, salvo o driver
 * `log` em FARO_ENV local/test). PHONE_OTP_PEPPER nao vai ao banco. Limites falham fechado.
 */
import { anonClient, getCaller, serviceClient } from "../_shared/clients.ts";
import { type FaroEnv, loadEnv, MisconfiguredError } from "../_shared/env.ts";
import { handleOptions, json, readJsonObject } from "../_shared/http.ts";
import { codeHashInput, hmacSha256Hex, phoneHashInput, sha256SaltedHex } from "../_shared/hash.ts";
import { getTrustedIp } from "../_shared/ip.ts";
import { resolveCode } from "../_shared/otp.ts";
import { requireRecentAuth } from "../_shared/reauth.ts";
import { buildOtpMessage, resolveSender } from "../_shared/sms/sender.ts";
import { logEvent } from "../_shared/audit.ts";
import {
  buildSmsLimits,
  isPhoneChange,
  isSameNumber,
  mapBeginError,
  mapDeniedBucket,
  pickTargetPhone,
} from "./logic.ts";

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

interface AuthFacts {
  email: string | null;
  email_confirmed: boolean;
  has_password: boolean;
  last_sign_in_at: string | null;
  terms_accepted: boolean;
  phone: string | null;
  pending_phone: string | null;
}

Deno.serve(async (req: Request) => {
  try {
    // 1. CORS, metodo, ambiente.
    const preflight = handleOptions(req);
    if (preflight) return preflight;
    if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);

    let env: FaroEnv;
    try {
      env = loadEnv({ pepper: true });
    } catch (e) {
      if (e instanceof MisconfiguredError) {
        // Registra so o NOME da variavel, nunca o valor.
        console.error(`phone-verify-start: ${e.message}`);
        return json(req, { ok: false, error: "misconfigured" }, 500);
      }
      throw e;
    }

    // 2. Quem chama e o corpo.
    const caller = await getCaller(req, env);
    if (!caller) return json(req, { ok: false, error: "unauthorized" }, 401);
    const body = await readJsonObject(req);
    if (!body) return json(req, { ok: false, error: "bad_request" }, 400);

    const svc = serviceClient(env);
    const userId = caller.id;
    const userAgent = req.headers.get("user-agent") ?? "";

    // 3. E-mail confirmado. 4. Termos aceitos.
    const factsRes = await svc.rpc("account_auth_facts", { p_user_id: userId });
    if (factsRes.error || !factsRes.data) {
      console.error("phone-verify-start: falha ao ler os fatos da conta");
      return json(req, { ok: false, error: "internal" }, 500);
    }
    const facts = factsRes.data as AuthFacts;
    if (!facts.email_confirmed) return json(req, { ok: false, error: "email_not_confirmed" });
    if (!facts.terms_accepted) return json(req, { ok: false, error: "terms_required" });

    // 5. Numero alvo. 6. Igual ao ja confirmado.
    const target = pickTargetPhone(body.phone, facts.pending_phone);
    if (!target.ok) return json(req, { ok: false, error: "invalid_phone" });
    const phone = target.phone;
    if (isSameNumber(phone, facts.phone)) return json(req, { ok: false, error: "same_number" });

    // 7. Provedor. Sem provedor: recusa ANTES de consumir limites.
    const sender = resolveSender(env);
    if (sender === null) return json(req, { ok: false, error: "sms_unavailable" });

    const ipHash = await sha256SaltedHex(getTrustedIp(req), env.hashSalt);

    // 8. Troca de celular ja confirmado: nova prova de identidade.
    const isChange = isPhoneChange(facts.phone);
    if (isChange) {
      const reauth = await requireRecentAuth({
        env,
        svc,
        userId,
        email: facts.email ?? caller.email ?? "",
        facts: { has_password: facts.has_password, last_sign_in_at: facts.last_sign_in_at },
        password: body.password,
        action: "trocar_celular",
        ipHash,
        userAgent,
        makeAnonClient: () => anonClient(env),
      });
      if (!reauth.ok) {
        if (reauth.error === "reauth_required") {
          return json(req, {
            ok: false,
            error: "reauth_required",
            method: facts.has_password ? "password" : "google",
          });
        }
        if (reauth.error === "rate_limited") {
          return json(req, { ok: false, error: "rate_limited", retry_after_seconds: reauth.retry_after_seconds ?? 1 });
        }
        return json(req, { ok: false, error: "invalid_password" });
      }
    }

    // 9. Hashes do numero e do IP.
    const phoneHash = await hmacSha256Hex(env.otpPepper, phoneHashInput(phone));

    // 10. Limites de envio (6 eixos, tudo ou nada). Erro => falha fechada.
    const limitRes = await svc.rpc("rate_limit_check", {
      p_checks: buildSmsLimits({ userId, phoneHash, ipHash, dailyCap: env.smsDailyCap }),
      p_record: true,
    });
    if (limitRes.error || !limitRes.data || typeof limitRes.data.allowed !== "boolean") {
      return json(req, { ok: false, error: "sms_unavailable" });
    }
    if (limitRes.data.allowed !== true) {
      const bucket: string | null = typeof limitRes.data.denied_bucket === "string" ? limitRes.data.denied_bucket : null;
      await logEvent(svc, "celular_bloqueado", userId, ipHash, userAgent, {
        motivo: "limite_envio",
        bucket,
      });
      return json(req, { ok: false, ...mapDeniedBucket(bucket, Number(limitRes.data.retry_after_seconds)) });
    }

    // 11. Codigo e seu hash com chave. O codigo nao sai desta funcao.
    const code = resolveCode(env);
    const codeHash = await hmacSha256Hex(env.otpPepper, codeHashInput(userId, phone, code));

    // 12. Registra a verificacao.
    const beginRes = await svc.rpc("phone_verification_begin", {
      p_user_id: userId,
      p_phone_e164: phone,
      p_phone_hash: phoneHash,
      p_code_hash: codeHash,
      p_ttl_seconds: 600,
      p_max_attempts: MAX_ATTEMPTS,
    });
    if (beginRes.error || !beginRes.data) {
      const mapped = mapBeginError(beginRes.error?.message);
      if (mapped) return json(req, { ok: false, error: mapped });
      console.error("phone-verify-start: falha ao registrar a verificacao");
      return json(req, { ok: false, error: "internal" }, 500);
    }
    const verificationId = String(beginRes.data.verification_id);
    const expiresAt = String(beginRes.data.expires_at);

    // 13. Envio. Falha ou excecao: invalida a verificacao; a cota do passo 10 nao e devolvida.
    let sent = false;
    try {
      const result = await sender.send(phone, buildOtpMessage(code));
      sent = result.ok === true;
    } catch {
      sent = false;
    }
    if (!sent) {
      await svc.rpc("phone_verification_send_failed", { p_verification_id: verificationId });
      return json(req, { ok: false, error: "sms_send_failed" });
    }

    // 14. Remove o telefone dos metadados do Auth. Falha so em log (sem dado pessoal).
    try {
      const { error } = await svc.auth.admin.updateUserById(userId, { user_metadata: { phone: null } });
      if (error) console.error("phone-verify-start: falha ao limpar os metadados");
    } catch {
      console.error("phone-verify-start: falha ao limpar os metadados");
    }

    // 15. Auditoria.
    await logEvent(svc, "celular_codigo_enviado", userId, ipHash, userAgent, { troca: isChange });

    // 16. Sucesso. O codigo nunca aparece na resposta.
    return json(req, {
      ok: true,
      phone,
      expires_at: expiresAt,
      resend_available_at: new Date(Date.now() + RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
      attempts_left: MAX_ATTEMPTS,
    });
  } catch {
    console.error("phone-verify-start: erro inesperado");
    return json(req, { ok: false, error: "internal" }, 500);
  }
});
