/**
 * Edge Function: password-recovery
 * Endpoint: POST /functions/v1/password-recovery
 *
 * Recebe o pedido "Esqueci a senha". Responde SEMPRE igual ({ "ok": true }), exista ou nao uma conta, depois de um
 * tempo minimo fixo; aplica o limite por e-mail e por origem; audita; e dispara o e-mail do Supabase Auth em
 * segundo plano. Contrato e ordem dos 8 passos: specs/004-conta-tutor/contracts/password-recovery.edge.md.
 *
 * SEGURANCA: nunca revela se o e-mail existe (nem pelo corpo, nem pelo tempo: o envio nao e aguardado e ha um piso
 * de 600 ms). E-mail, IP e link nunca vao a log nem a auditoria (so hashes). `captcha_token` e aceito e ignorado
 * (TODO(CAPTCHA)). Limites falham fechados: erro no limitador = nada enviado, mesma resposta.
 */
import { anonClient, serviceClient } from "../_shared/clients.ts";
import { type FaroEnv, loadEnv, MisconfiguredError } from "../_shared/env.ts";
import { handleOptions, json, readJsonObject } from "../_shared/http.ts";
import { sha256SaltedHex } from "../_shared/hash.ts";
import { getTrustedIp } from "../_shared/ip.ts";
import { logEvent } from "../_shared/audit.ts";
import { buildRecoveryLimits, isRecoveryAllowed, parseRecoveryEmail, remainingWaitMs } from "./logic.ts";

/** Roda uma promessa depois da resposta (EdgeRuntime.waitUntil); sem o runtime, so a dispara. */
function runInBackground(task: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(task);
  }
  // Sem runtime, a promessa ja esta em andamento; o catch dela esta no chamador.
}

Deno.serve(async (req: Request) => {
  try {
    // 1. CORS, metodo, relogio e ambiente.
    const preflight = handleOptions(req);
    if (preflight) return preflight;
    if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);
    const inicio = Date.now();

    let env: FaroEnv;
    try {
      env = loadEnv({});
    } catch (e) {
      if (e instanceof MisconfiguredError) {
        console.error(`password-recovery: ${e.message}`);
        return json(req, { ok: false, error: "misconfigured" }, 500);
      }
      throw e;
    }

    // 2. Corpo: o unico caso que nao e 200.
    const body = await readJsonObject(req);
    if (!body) return json(req, { ok: false, error: "bad_request" }, 400);

    // 3. E-mail normalizado e formato. `captcha_token` (body.captcha_token) e ignorado.
    const { email, valido } = parseRecoveryEmail(body.email);

    // 4. Hashes da origem e da identidade (nunca o valor em claro).
    const svc = serviceClient(env);
    const ipHash = await sha256SaltedHex(getTrustedIp(req), env.hashSalt);
    const identityHash = await sha256SaltedHex(email, env.hashSalt);
    const userAgent = req.headers.get("user-agent") ?? "";

    // 5. Limites (3/h por e-mail, 10/h por origem). Erro = negado.
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

    // 6. Auditoria do pedido: sem e-mail no detalhe.
    await logEvent(svc, "senha_recuperacao_solicitada", null, ipHash, userAgent, {
      origem: "pedido",
      permitido,
    });

    // 7. Envio em segundo plano: o tempo de resposta nao depende de a conta existir.
    if (permitido) {
      const sending = (async () => {
        try {
          const { error } = await anonClient(env).auth.resetPasswordForEmail(email);
          if (error) console.error("password-recovery: falha no envio do e-mail de recuperacao");
        } catch {
          console.error("password-recovery: falha no envio do e-mail de recuperacao");
        }
      })();
      runInBackground(sending);
    }

    // 8. Piso de tempo e resposta unica.
    const espera = remainingWaitMs(inicio, Date.now());
    if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
    return json(req, { ok: true });
  } catch {
    console.error("password-recovery: erro inesperado");
    return json(req, { ok: false, error: "internal" }, 500);
  }
});
