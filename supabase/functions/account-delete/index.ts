/**
 * Edge Function: account-delete
 * Endpoint: POST /functions/v1/account-delete
 *
 * Exclui a conta do PROPRIO titular (LGPD) sem apagar nenhum codigo de tag. O id vem do token, nunca do corpo.
 * Contrato e ordem dos 9 passos: specs/004-conta-tutor/contracts/account-delete.edge.md.
 *
 * Ordem (parte do contrato): dados e vinculos primeiro, usuario por ultimo. Se algo falhar no meio, ainda existe
 * uma conta que consegue entrar e REPETIR o pedido; todos os passos sao idempotentes.
 *
 * SEGURANCA: exige nova prova de identidade (senha, ou login recente para quem so tem o Google), a palavra de
 * confirmacao e falha fechada se a spec 003 criou os vinculos sem a operacao que os encerra
 * (`deletion_hook_missing` vira `deletion_unavailable`, nada e apagado). Senha, e-mail e IP nunca vao a log.
 */
import { anonClient, getCaller, serviceClient } from "../_shared/clients.ts";
import { type FaroEnv, loadEnv, MisconfiguredError } from "../_shared/env.ts";
import { handleOptions, json, readJsonObject } from "../_shared/http.ts";
import { sha256SaltedHex } from "../_shared/hash.ts";
import { getTrustedIp } from "../_shared/ip.ts";
import { requireRecentAuth } from "../_shared/reauth.ts";
import { isValidConfirm, PHOTOS_BUCKET, removeFilesUnderPrefix } from "./logic.ts";

interface AuthFacts {
  email: string | null;
  has_password: boolean;
  last_sign_in_at: string | null;
}

Deno.serve(async (req: Request) => {
  try {
    // 1. CORS, metodo, ambiente.
    const preflight = handleOptions(req);
    if (preflight) return preflight;
    if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);

    let env: FaroEnv;
    try {
      env = loadEnv({});
    } catch (e) {
      if (e instanceof MisconfiguredError) {
        console.error(`account-delete: ${e.message}`);
        return json(req, { ok: false, error: "misconfigured" }, 500);
      }
      throw e;
    }

    // 2. Quem chama (o id vem do token) e o corpo.
    const caller = await getCaller(req, env);
    if (!caller) return json(req, { ok: false, error: "unauthorized" }, 401);
    const body = await readJsonObject(req);
    if (!body) return json(req, { ok: false, error: "bad_request" }, 400);

    // 3. Palavra de confirmacao.
    if (!isValidConfirm(body.confirm)) return json(req, { ok: false, error: "confirmation_required" });

    const svc = serviceClient(env);
    const userId = caller.id;
    const userAgent = req.headers.get("user-agent") ?? "";
    const ipHash = await sha256SaltedHex(getTrustedIp(req), env.hashSalt);

    // 4. Fatos de autenticacao da conta.
    const factsRes = await svc.rpc("account_auth_facts", { p_user_id: userId });
    if (factsRes.error || !factsRes.data) {
      console.error("account-delete: falha ao ler os fatos da conta");
      return json(req, { ok: false, error: "internal" }, 500);
    }
    const facts = factsRes.data as AuthFacts;

    // 5. Nova prova de identidade.
    const reauth = await requireRecentAuth({
      env,
      svc,
      userId,
      email: facts.email ?? caller.email ?? "",
      facts: { has_password: facts.has_password, last_sign_in_at: facts.last_sign_in_at },
      password: body.password,
      action: "excluir_conta",
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

    // 6. Dados e vinculos. Qualquer erro: nada foi excluido; para aqui.
    try {
      const { error } = await svc.rpc("delete_account_data", {
        p_user_id: userId,
        p_ip_hash: ipHash,
        p_user_agent: userAgent.substring(0, 256),
      });
      if (error) {
        console.error("account-delete: falha na etapa de dados");
        return json(req, { ok: false, error: "deletion_unavailable" });
      }
    } catch {
      console.error("account-delete: falha na etapa de dados");
      return json(req, { ok: false, error: "deletion_unavailable" });
    }

    // 7. Fotos sob `<uid>/` (bucket inexistente: segue). Falha: tente de novo.
    try {
      const photos = await removeFilesUnderPrefix(svc.storage, PHOTOS_BUCKET, userId);
      if (!photos.ok) {
        console.error("account-delete: falha ao remover as fotos");
        return json(req, { ok: false, error: "deletion_incomplete" });
      }
    } catch {
      console.error("account-delete: falha ao remover as fotos");
      return json(req, { ok: false, error: "deletion_incomplete" });
    }

    // 8. Usuario (por ultimo).
    try {
      const { error } = await svc.auth.admin.deleteUser(userId);
      if (error) {
        console.error("account-delete: falha ao remover o usuario");
        return json(req, { ok: false, error: "deletion_incomplete" });
      }
    } catch {
      console.error("account-delete: falha ao remover o usuario");
      return json(req, { ok: false, error: "deletion_incomplete" });
    }

    // 9. Pronto.
    return json(req, { ok: true });
  } catch {
    console.error("account-delete: erro inesperado");
    return json(req, { ok: false, error: "internal" }, 500);
  }
});
