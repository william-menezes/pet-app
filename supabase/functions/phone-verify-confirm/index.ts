/**
 * Edge Function: phone-verify-confirm
 * Endpoint: POST /functions/v1/phone-verify-confirm
 *
 * Confere o codigo de 6 digitos e, se certo, promove o numero pendente a celular confirmado. A conferencia
 * e a contagem de tentativas acontecem NO SERVIDOR, na mesma chamada (phone_verification_confirm).
 * Contrato e passos: specs/004-conta-tutor/contracts/phone-verify-confirm.edge.md; limite por conta de toda chamada:
 * security-hardening.contract.md, secao 2. Orquestracao e testes em `handler.ts`.
 *
 * SEGURANCA: nenhum hash, id de verificacao, pepper ou codigo sai na resposta ou em log. A resposta nao
 * distingue "codigo de outra conta" de "sem codigo": ambos sao `no_active`.
 */
import { getCaller, serviceClient } from "../_shared/clients.ts";
import { loadEnv } from "../_shared/env.ts";
import { createHandler } from "./handler.ts";

Deno.serve(createHandler({
  loadEnv: () => loadEnv({ pepper: true }),
  svc: (env) => serviceClient(env),
  getCaller: (req, env) => getCaller(req, env),
}));
