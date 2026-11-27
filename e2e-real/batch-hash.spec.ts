import { randomBytes } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { SEED, apiSignIn, stack } from './support/stack';
import { adminSession, newTutor } from './support/tags';

/**
 * Migration 0036 (rodada de QA da spec 003): `admin_hash_pins` por HTTP real.
 *
 * ATENCAO ao formato da chamada: o gate-security chama todas as RPCs com corpo `{}`. Para uma funcao com argumento obrigatorio
 * o PostgREST pode responder 404 (assinatura nao encontrada) ANTES de olhar privilegio, e `denied()` aceita 404: a prova ficaria
 * vazia. Aqui a chamada tem o formato certo (`{ p_pins: [...] }`), entao o que nega e o privilegio (42501), nunca o 404.
 */

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const randomPin = () => Array.from(randomBytes(6), (b) => ALPHA[b % 32]).join('');
const url = () => `${stack.url}/rest/v1/rpc/admin_hash_pins`;

async function call(bearer: string, body: unknown, apikey = stack.anonKey) {
  const res = await fetch(url(), {
    method: 'POST',
    headers: { apikey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

test('admin_hash_pins com a chamada no formato certo: anon, tutor, tutor do seed e admin logado recebem permissao negada (42501), nunca 404', async () => {
  const pin = randomPin();
  const t = await newTutor();
  const seedTutor = await apiSignIn(SEED.tutorA.email, SEED.password);
  const admin = await adminSession();
  const who: [string, string][] = [
    ['anon (chave publica)', stack.anonKey],
    ['tutor novo', t.token],
    ['tutor do seed', seedTutor.session!.access_token],
    ['admin logado', admin.access_token],
  ];
  for (const [name, bearer] of who) {
    const r = await call(bearer, { p_pins: [pin] });
    expect([401, 403], `${name}: HTTP ${r.status} ${r.text.slice(0, 120)}`).toContain(r.status);
    expect(r.status, `${name}: nao pode ser 404 (prova vazia)`).not.toBe(404);
    expect(r.text, `${name}: a resposta nao ecoa o PIN enviado`).not.toContain(pin);
    expect(r.text, `${name}: nenhum hash na resposta`).not.toMatch(/\$2[aby]\$/);
  }
  // Controle: a MESMA chamada com a chave de servico funciona (o formato esta certo; so o privilegio nega).
  const ok = await call(stack.serviceKey, { p_pins: [pin] }, stack.serviceKey);
  expect(ok.status).toBe(200);
  const hashes = JSON.parse(ok.text) as string[];
  expect(hashes).toHaveLength(1);
  expect(hashes[0]).toMatch(/^\$2[aby]\$12\$/);
  expect(ok.text).not.toContain(pin);
});

test('admin_hash_pins com entrada invalida (service_role): erro 22023 que NAO ecoa o que foi enviado', async () => {
  // Valores reconheciveis na resposta, se vazassem: minusculas, fora do alfabeto, tamanho errado, tipo errado.
  const marks = ['zqx9wv', 'ABCDEO', 'QQQQQ'];
  const bodies: unknown[] = [
    { p_pins: [marks[0]] },
    { p_pins: [marks[1]] },
    { p_pins: [marks[2]] },
    { p_pins: ['KKKKKK', marks[0]] },
    { p_pins: Array.from({ length: 11 }, () => 'KKKKKK') },
    { p_pins: [null] },
    { p_pins: [] },
  ];
  for (const b of bodies) {
    const r = await call(stack.serviceKey, b, stack.serviceKey);
    expect(r.status, `${JSON.stringify(b).slice(0, 60)}: HTTP ${r.status} ${r.text.slice(0, 160)}`).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    for (const m of marks) expect(r.text, `a resposta nao ecoa "${m}" (${JSON.stringify(b).slice(0, 40)})`).not.toContain(m);
    expect(r.text).not.toMatch(/\$2[aby]\$/);
  }
  // O erro de dominio e o 22023 sem valor.
  const dom = await call(stack.serviceKey, { p_pins: [marks[0]] }, stack.serviceKey);
  expect(JSON.parse(dom.text).code).toBe('22023');
});

// Tipo errado (string no lugar de array): quem rejeita e o CAST do PostgREST/Postgres ("malformed array literal: "<valor>""), antes de a
// funcao rodar, e ele ecoa o valor. Nao e codigo do produto e so o service_role chega a esse ponto (a Edge Function admin-create-batch
// so manda text[] montado por ela). O que se prova: os demais papeis recebem 403 SEM eco, e o eco do service_role e registrado.
test('admin_hash_pins com tipo errado: anon, tutor e admin logado: permissao negada sem eco; service_role: eco do cast registrado', async () => {
  const mark = 'zqx9wv';
  const t = await newTutor();
  const admin = await adminSession();
  for (const [name, bearer] of [['anon', stack.anonKey], ['tutor', t.token], ['admin logado', admin.access_token]] as [string, string][]) {
    for (const body of [{ p_pins: mark }, { p_pins: `{${mark}}` }, { p_pins: { a: mark } }]) {
      const r = await call(bearer, body);
      expect([401, 403], `${name}: HTTP ${r.status} ${r.text.slice(0, 120)}`).toContain(r.status);
      expect(r.text, `${name}: sem eco`).not.toContain(mark);
    }
  }
  const svc = await call(stack.serviceKey, { p_pins: mark }, stack.serviceKey);
  expect(svc.status).toBe(400);
  expect(JSON.parse(svc.text).code, 'erro do cast, nao da funcao').toBe('22P02');
  console.log('R-HASH-1: service_role com tipo errado recebe eco do valor (cast do PostgREST, 22P02); inalcancavel pela Edge Function');
});
