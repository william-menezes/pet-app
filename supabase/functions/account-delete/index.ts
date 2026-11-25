/**
 * Edge Function: account-delete
 * Endpoint: POST /functions/v1/account-delete
 *
 * Exclui a conta do PROPRIO titular (LGPD) sem apagar nenhum codigo de tag. O id vem do token, nunca do corpo.
 * Contrato e ordem dos 9 passos: specs/004-conta-tutor/contracts/account-delete.edge.md; limite por conta e
 * desafio anti-robo: security-hardening.contract.md. Orquestracao e testes em `handler.ts`.
 *
 * Ordem (parte do contrato): dados e vinculos primeiro, usuario por ultimo. Se algo falhar no meio, ainda existe
 * uma conta que consegue entrar e REPETIR o pedido; todos os passos sao idempotentes.
 *
 * SEGURANCA: exige nova prova de identidade (senha, ou login recente para quem so tem o Google), a palavra de
 * confirmacao e falha fechada se a spec 003 criou os vinculos sem a operacao que os encerra
 * (`deletion_hook_missing` vira `deletion_unavailable`, nada e apagado). Senha, e-mail, IP e token nunca vao a log.
 */
import { anonClient, getCaller, serviceClient } from "../_shared/clients.ts";
import { loadEnv } from "../_shared/env.ts";
import { createHandler } from "./handler.ts";

Deno.serve(createHandler({
  loadEnv: () => loadEnv({}),
  svc: (env) => serviceClient(env),
  getCaller: (req, env) => getCaller(req, env),
  makeAnonClient: (env) => anonClient(env),
}));
