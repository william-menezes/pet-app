/**
 * Edge Function: phone-verify-confirm
 * Endpoint: POST /functions/v1/phone-verify-confirm
 *
 * Confere o codigo de 6 digitos e, se certo, promove o numero pendente a celular confirmado. A conferencia
 * e a contagem de tentativas acontecem NO SERVIDOR, na mesma chamada (phone_verification_confirm).
 * Contrato e passos: specs/004-conta-tutor/contracts/phone-verify-confirm.edge.md.
 *
 * SEGURANCA: nenhum hash, id de verificacao, pepper ou codigo sai na resposta ou em log. A resposta nao
 * distingue "codigo de outra conta" de "sem codigo": ambos sao `no_active`.
 */
import { getCaller, serviceClient } from "../_shared/clients.ts";
import { type FaroEnv, loadEnv, MisconfiguredError } from "../_shared/env.ts";
import { handleOptions, json, readJsonObject } from "../_shared/http.ts";
import { codeHashInput, hmacSha256Hex, sha256SaltedHex } from "../_shared/hash.ts";
import { getTrustedIp } from "../_shared/ip.ts";
import { isValidCodeFormat, mapConfirmStatus } from "./logic.ts";

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
        console.error(`phone-verify-confirm: ${e.message}`);
        return json(req, { ok: false, error: "misconfigured" }, 500);
      }
      throw e;
    }

    // 2. Quem chama e o corpo.
    const caller = await getCaller(req, env);
    if (!caller) return json(req, { ok: false, error: "unauthorized" }, 401);
    const body = await readJsonObject(req);
    if (!body) return json(req, { ok: false, error: "bad_request" }, 400);

    // 3. Formato do codigo (nao conta tentativa).
    const code = body.code;
    if (!isValidCodeFormat(code)) return json(req, { ok: false, error: "invalid_format" });

    const svc = serviceClient(env);
    const userId = caller.id;

    // 4. Verificacao aberta da conta.
    const openRes = await svc.rpc("phone_verification_active", { p_user_id: userId });
    if (openRes.error) {
      console.error("phone-verify-confirm: falha ao ler a verificacao aberta");
      return json(req, { ok: false, error: "internal" }, 500);
    }
    const open = openRes.data as { verification_id: string; phone_e164: string } | null;
    if (!open) return json(req, { ok: false, error: "no_active" });

    // 5. Hash com chave do codigo informado.
    const codeHash = await hmacSha256Hex(env.otpPepper, codeHashInput(userId, open.phone_e164, code));

    // 6. Conferencia e contagem, na mesma chamada. Erro => 500 (nunca um sucesso).
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

    // 7. Resposta por status.
    const reply = mapConfirmStatus(confirmRes.data, open.phone_e164);
    if (reply === null) {
      console.error("phone-verify-confirm: status inesperado");
      return json(req, { ok: false, error: "internal" }, 500);
    }

    // 8. Em sucesso, remove o telefone dos metadados do Auth. Falha so em log.
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
});
