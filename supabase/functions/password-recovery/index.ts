/**
 * Edge Function: password-recovery
 * Endpoint: POST /functions/v1/password-recovery
 *
 * Recebe o pedido "Esqueci a senha". Responde SEMPRE igual ({ "ok": true }), exista ou nao uma conta, depois de um
 * tempo minimo fixo; aplica os limites (por origem de toda chamada, por e-mail e por origem); audita; e dispara o
 * e-mail do Supabase Auth repassando o token do desafio anti-robo. Orquestracao e testes em `handler.ts`.
 * Contratos: specs/004-conta-tutor/contracts/password-recovery.edge.md e security-hardening.contract.md.
 *
 * SEGURANCA: nunca revela se o e-mail existe (nem pelo corpo, nem pelo tempo). E-mail, IP, token e link nunca vao
 * a log nem a auditoria (so hashes). Limites falham fechados: erro no limitador = nada enviado, mesma resposta.
 */
import { anonClient, serviceClient } from "../_shared/clients.ts";
import { loadEnv } from "../_shared/env.ts";
import { createHandler } from "./handler.ts";

/** Roda uma promessa depois da resposta (EdgeRuntime.waitUntil); sem o runtime, so a dispara. */
function runInBackground(task: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(task);
  }
  // Sem runtime, a promessa ja esta em andamento; o catch dela esta no handler.
}

Deno.serve(createHandler({
  loadEnv: () => loadEnv({}),
  svc: (env) => serviceClient(env),
  anon: (env) => anonClient(env),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  background: runInBackground,
}));
