import { expect, test } from '@playwright/test';

import { serviceRequest, stack } from './support/stack';
import { newTutor } from './support/tags';

/**
 * Eventos de autenticacao pela pilha real (rodada de QA da spec 003; constituicao, Principio VII). Antes, `login_sucesso` e
 * `login_falha` so eram provados com falsos (supabase/functions/login-guard/handler.test.ts). Aqui a Edge Function roda de verdade e
 * o evento aparece em `auth_audit_log`, com o ator vindo do JWT, o IP so como hash e nenhum dado pessoal no detalhe.
 * Uma falha so: o eixo por IP do login-guard e compartilhado, e as tentativas desta chamada sao apagadas no fim.
 */
const RAW_IP = '203.0.113.77'; // documentacao (RFC 5737); o servidor so pode guardar o hash dele

async function guard(token: string | null, body: Record<string, unknown>) {
  const res = await fetch(`${stack.url}/functions/v1/login-guard`, {
    method: 'POST',
    headers: {
      apikey: stack.anonKey,
      Authorization: `Bearer ${token ?? stack.anonKey}`,
      'Content-Type': 'application/json',
      'x-real-ip': RAW_IP,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('login_sucesso e login_falha: gravados pela funcao real, com ator do JWT, IP so como hash e sem e-mail no detalhe', async () => {
  const t = await newTutor();
  const marker = `qa-audit-${Date.now()}`;

  const ok = await guard(t.token, { phase: 'post_result', email: t.email, success: true, user_agent: marker });
  expect(ok.status).toBe(200);
  expect(ok.body.decision).toBe('allow');
  const okRows = await serviceRequest(`auth_audit_log?evento=eq.login_sucesso&ator=eq.${t.id}&select=ator,ip_hash,user_agent,detalhe`);
  expect(okRows.body, 'um login_sucesso para o ator do JWT').toHaveLength(1);
  const row = okRows.body[0];
  expect(row.ip_hash, 'IP so como hash (SHA-256 em hex)').toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(row)).not.toContain(RAW_IP);
  expect(JSON.stringify(row), 'nem e-mail nem telefone').not.toMatch(new RegExp(`${t.email.replace(/[+.]/g, '\\$&')}|${t.phoneDigits}|@`));

  const bad = await guard(null, { phase: 'post_result', email: t.email, success: false, user_agent: marker, detail: { email: t.email, phone: t.phoneDigits } });
  expect(bad.status).toBe(200);
  const badRows = await serviceRequest(`auth_audit_log?evento=eq.login_falha&ip_hash=eq.${row.ip_hash}&user_agent=eq.${marker}&select=ator,ip_hash,detalhe`);
  expect(badRows.body, 'um login_falha').toHaveLength(1);
  expect(badRows.body[0].ator, 'falha sem sessao: ator nulo (nunca o do corpo)').toBeNull();
  expect(JSON.stringify(badRows.body[0]), 'o detalhe enviado no corpo nao grava e-mail nem telefone').not.toMatch(new RegExp(`${t.phoneDigits}|@`));

  // Limpeza: a falha deste teste nao pode bloquear os logins dos outros (eixo por IP compartilhado).
  const del = await serviceRequest(`auth_login_attempts?ip_hash=eq.${row.ip_hash}`, { method: 'DELETE' });
  expect(del.status).toBeLessThan(300);
});
