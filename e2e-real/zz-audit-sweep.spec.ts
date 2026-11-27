import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { serviceRest } from './support/stack';

/**
 * Varredura final (rodada de QA da spec 003). O nome `zz-` faz este arquivo rodar por ULTIMO (ordem alfabetica, um processo so):
 * depois de todos os outros testes, le TODAS as linhas de `audit_log` e `auth_audit_log` que a rodada produziu e prova que nenhuma
 * tem PIN do pool, e-mail, telefone ou IP cru. E a prova "em campo" do que o pgTAP `auditoria_eventos` prova no cenario fechado.
 */
const POOLS = [join(tmpdir(), 'faro-e2e-pool.json'), join(tmpdir(), 'faro-e2e-pool-lote500.json')];
const IPV4 = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
const KEYS_OK = new Set([
  'fail_count', 'fail_count_24h', 'pet_id', 'reason', 'kind', 'from', 'to', 'note', 'request_id', 'status', 'count', 'quantity',
  'assignments_ended', 'scope', 'limit', 'window_seconds',
]);

test('audit_log: nenhuma linha com PIN do pool, e-mail, telefone ou IP; so chaves conhecidas', async () => {
  const pins: string[] = [];
  for (const f of POOLS) if (existsSync(f)) for (const t of JSON.parse(readFileSync(f, 'utf8')).tags) pins.push(t.pin);
  expect(pins.length, 'o pool do E2E existe').toBeGreaterThan(0);

  const r = await serviceRest('audit_log?select=id,event,entity,entity_id,actor_role,detail&order=id.asc&limit=20000');
  expect(r.status).toBe(200);
  const rows = r.body as { id: number; event: string; entity: string | null; entity_id: string | null; actor_role: string | null; detail: Record<string, unknown> }[];
  expect(rows.length).toBeGreaterThan(0);
  const re = pins.length ? new RegExp(`\\b(${pins.join('|')})\\b`) : null;
  const bad: string[] = [];
  for (const row of rows) {
    const text = `${JSON.stringify(row.detail)} ${row.entity ?? ''} ${row.entity_id ?? ''} ${row.actor_role ?? ''}`;
    if (re?.test(text)) bad.push(`#${row.id} ${row.event}: PIN do pool`);
    if (/@|\+55|\b55\d{10,11}\b|\b119\d{8}\b/.test(text)) bad.push(`#${row.id} ${row.event}: e-mail ou telefone`);
    if (IPV4.test(text)) bad.push(`#${row.id} ${row.event}: IP cru`);
    for (const k of Object.keys(row.detail)) if (!KEYS_OK.has(k)) bad.push(`#${row.id} ${row.event}: chave "${k}" fora da lista`);
  }
  expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
  console.log(`audit_log: ${rows.length} linhas varridas contra ${pins.length} PINs`);
});

test('auth_audit_log: nenhuma linha com e-mail, telefone ou IP cru; ip_hash so em hex', async () => {
  const r = await serviceRest('auth_audit_log?select=id,evento,ip_hash,detalhe&order=id.asc&limit=20000');
  expect(r.status).toBe(200);
  const rows = r.body as { id: number; evento: string; ip_hash: string; detalhe: unknown }[];
  expect(rows.length).toBeGreaterThan(0);
  const bad: string[] = [];
  for (const row of rows) {
    const text = JSON.stringify(row.detalhe ?? {});
    if (/@|\+55|\b119\d{8}\b/.test(text)) bad.push(`#${row.id} ${row.evento}: e-mail ou telefone no detalhe`);
    if (IPV4.test(text)) bad.push(`#${row.id} ${row.evento}: IP cru no detalhe`);
    if (row.ip_hash !== '' && !/^[0-9a-f]{64}$/.test(row.ip_hash)) bad.push(`#${row.id} ${row.evento}: ip_hash fora do formato`);
  }
  expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
  console.log(`auth_audit_log: ${rows.length} linhas varridas`);
});
