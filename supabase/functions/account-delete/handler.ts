/**
 * Orquestracao da Edge Function account-delete, separada do `Deno.serve` para ser testavel com falsos
 * (contracts/account-delete.edge.md e security-hardening.contract.md, secoes 1, 2 e 5).
 *
 * Novos pontos: `acct:delete:h` (10 por hora por conta, contado em TODA chamada, antes de conferir a palavra de
 * confirmacao; falha fechada), corpo de 4 KB so com `confirm`, `password` e `captcha_token`, e o token do desafio
 * repassado a nova prova de identidade.
 */
import { bodyErrorResponse, guardMethod, json, readJsonObject } from "../_shared/http.ts";
import { type FaroEnv, MisconfiguredError } from "../_shared/env.ts";
import { sha256SaltedHex } from "../_shared/hash.ts";
import { getTrustedIp } from "../_shared/ip.ts";
import { checkLimit } from "../_shared/limits.ts";
import { parseCaptchaToken } from "../_shared/captcha.ts";
import {
  reauthFailureBody,
  type ReauthPasswordClient,
  type ReauthService,
  requireRecentAuth,
} from "../_shared/reauth.ts";
import {
  DELETE_ALLOWED_FIELDS,
  DELETE_CALLS_LIMIT,
  isValidConfirm,
  PHOTOS_BUCKET,
  removeFilesUnderPrefix,
  type StorageLike,
} from "./logic.ts";

interface AuthFacts {
  email: string | null;
  has_password: boolean;
  last_sign_in_at: string | null;
}

/** Cliente de servico: RPC, `auth.admin` (signOut da reautenticacao e deleteUser) e storage. */
export interface DeleteService extends ReauthService {
  auth: ReauthService["auth"] & { admin: { deleteUser(id: string): PromiseLike<{ error: unknown }> } };
  storage: StorageLike;
}

export interface DeleteDeps {
  loadEnv(): FaroEnv;
  svc(env: FaroEnv): DeleteService;
  getCaller(req: Request, env: FaroEnv): Promise<{ id: string; email?: string | null } | null>;
  makeAnonClient(env: FaroEnv): ReauthPasswordClient;
}

export function createHandler(deps: DeleteDeps): (req: Request) => Promise<Response> {
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
          console.error(`account-delete: ${e.message}`);
          return json(req, { ok: false, error: "misconfigured" }, 500);
        }
        throw e;
      }

      // 2. Quem chama (o id vem do token) e o corpo (4 KB, so as chaves conhecidas).
      const caller = await deps.getCaller(req, env);
      if (!caller) return json(req, { ok: false, error: "unauthorized" }, 401);
      const parsedBody = await readJsonObject(req, undefined, DELETE_ALLOWED_FIELDS);
      if (!parsedBody.ok) return bodyErrorResponse(req, parsedBody);
      const body = parsedBody.body;
      const captcha = parseCaptchaToken(body.captcha_token);
      if (!captcha.ok) return json(req, { ok: false, error: "bad_request" }, 400);

      const svc = deps.svc(env);
      const userId = caller.id;
      const userAgent = req.headers.get("user-agent") ?? "";
      const ipHash = await sha256SaltedHex(getTrustedIp(req), env.hashSalt);

      // 2A. Limite por conta de TODA chamada, antes da palavra de confirmacao. Falha fechada.
      const limit = await checkLimit(svc, [{ ...DELETE_CALLS_LIMIT, key: userId }], true);
      if (!limit.allowed) {
        return json(req, { ok: false, error: "rate_limited", retry_after_seconds: limit.retryAfter });
      }

      // 3. Palavra de confirmacao.
      if (!isValidConfirm(body.confirm)) return json(req, { ok: false, error: "confirmation_required" });

      // 4. Fatos de autenticacao da conta.
      const factsRes = await svc.rpc("account_auth_facts", { p_user_id: userId });
      if (factsRes.error || !factsRes.data) {
        console.error("account-delete: falha ao ler os fatos da conta");
        return json(req, { ok: false, error: "internal" }, 500);
      }
      const facts = factsRes.data as AuthFacts;

      // 5. Nova prova de identidade (com o token do desafio, repassado ao Auth).
      const reauth = await requireRecentAuth({
        env,
        svc,
        userId,
        email: facts.email ?? caller.email ?? "",
        facts: { has_password: facts.has_password, last_sign_in_at: facts.last_sign_in_at },
        password: body.password,
        captchaToken: captcha.token,
        action: "excluir_conta",
        ipHash,
        userAgent,
        makeAnonClient: () => deps.makeAnonClient(env),
      });
      if (!reauth.ok) return json(req, reauthFailureBody(reauth, facts.has_password));

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
  };
}
