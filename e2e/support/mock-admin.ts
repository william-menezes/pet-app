import type { Page } from '@playwright/test';

/**
 * Backend SIMULADO do admin logado, para as telas da 003 (lotes, códigos, detalhe, fila, auditoria).
 *
 * Tudo que vai para `*.supabase.co` é bloqueado (`abort`) e só as respostas de que as telas precisam são simuladas, com
 * códigos SINTÉTICOS dos vetores do contrato e o `lote-900` do seed. Nada daqui escreve no projeto real, e nenhum PIN
 * real existe: o PIN de teste (`K47Q9M`) é inventado. A prova contra o banco de verdade é do QA (`e2e-real/`).
 */
type Json = Record<string, unknown>;

export interface AdminState {
  counters: Json;
  batches: Json[];
  codes: Json[];
  detail: Json;
  queue: Json;
  audit: Json[];
  /** Corpos recebidos, por RPC. */
  calls: Record<string, Json[]>;
  /** Corpos do `admin-create-batch`. */
  batchBodies: Json[];
  blocked: string[];
}

export const PIN_FIXTURE = 'K47Q9M';

export function newAdminState(over: Partial<AdminState> = {}): AdminState {
  return {
    counters: { ok: true, generated: 54, available: 41, active: 12, blocked: 0, void: 1 },
    batches: [
      {
        id: 'lote-900',
        quantity: 54,
        created_at: '2026-11-17T13:00:00Z',
        notes: 'Primeira impressão · rebaixo 22 mm',
        package_downloaded_at: '2026-11-17T13:05:00Z',
        counts: { available: 41, assigned: 12, blocked: 0, void: 1 },
      },
    ],
    codes: [
      { code: '7K3MQ9XAC', batch_id: 'lote-900', status: 'assigned', pet_name: 'Paçoca', tutor: 'Ana S.', last_scan_at: new Date(Date.now() - 3_600_000).toISOString() },
      { code: '2FX8CN73F', batch_id: 'lote-900', status: 'available', pet_name: null, tutor: null, last_scan_at: null },
      { code: '5QQWQ2MM4', batch_id: 'lote-900', status: 'blocked', pet_name: null, tutor: null, last_scan_at: '2026-11-12T12:00:00Z' },
      { code: 'NKCBJV2HM', batch_id: 'lote-900', status: 'void', pet_name: 'Thor', tutor: 'Carla R.', last_scan_at: '2026-11-08T12:00:00Z' },
    ],
    detail: {
      ok: true,
      code: '7K3MQ9XAC',
      batch_id: 'lote-900',
      status: 'assigned',
      created_at: '2026-11-17T13:00:00Z',
      updated_at: '2026-11-17T13:00:00Z',
      assignment: { id: 'a1', started_at: '2026-11-02T21:40:00Z', pet_name: 'Paçoca', tutor: 'Ana S.' },
      history: [],
      scans: [
        { id: 's1', occurred_at: new Date(Date.now() - 3_600_000).toISOString(), status_at_scan: 'assigned', geo_method: 'ip', accuracy_m: null, city: 'São Paulo', region: 'SP', assignment_id: 'a1' },
        { id: 's2', occurred_at: '2026-11-16T12:10:00Z', status_at_scan: 'assigned', geo_method: 'gps', accuracy_m: 15, city: 'São Paulo', region: 'SP', assignment_id: 'a1' },
      ],
      pin: { used: true, used_at: '2026-11-02T21:40:00Z', fail_count_24h: 0, locked_until: null },
      replacement_requests: [{ id: 'r1', kind: 'damaged', status: 'open', created_at: '2026-11-19T12:00:00Z', resolved_at: null }],
    },
    queue: {
      ok: true,
      scans: [
        { id: 'q1', code: '5QQWQ2MM4', status_at_scan: 'blocked', occurred_at: new Date(Date.now() - 7_200_000).toISOString(), geo_method: 'ip', city: 'São Paulo', region: 'SP' },
        { id: 'q2', code: 'NKCBJV2HM', status_at_scan: 'void', occurred_at: '2026-11-24T22:40:00Z', geo_method: 'ip', city: 'Campinas', region: 'SP' },
        { id: 'q3', code: '2FX8CN73F', status_at_scan: 'available', occurred_at: '2026-11-18T11:03:00Z', geo_method: 'none', city: null, region: null },
      ],
      replacements: [{ id: 'r1', code: '7K3MQ9XAC', kind: 'damaged', created_at: '2026-11-19T12:00:00Z' }],
      locked_tags: [{ code: '2FX8CN73F', locked_until: new Date(Date.now() + 36_000_000).toISOString() }],
    },
    audit: [
      { id: 6, at: new Date(Date.now() - 600_000).toISOString(), actor_id: null, actor_role: 'anon', event: 'scan_recorded', entity: 'tag', entity_id: '7K3MQ9XAC', detail: null },
      { id: 5, at: '2026-11-25T14:05:00Z', actor_id: null, actor_role: 'authenticated', event: 'activation_failed', entity: 'tag', entity_id: '2FX8CN73F', detail: { fail_count: 2 } },
      { id: 4, at: '2026-11-20T19:20:00Z', actor_id: null, actor_role: 'authenticated', event: 'pin_reissued', entity: 'tag', entity_id: '2FX8CN73F', detail: { reason: 'lost' } },
      { id: 3, at: '2026-11-19T12:41:00Z', actor_id: null, actor_role: 'authenticated', event: 'tag_status_changed', entity: 'tag', entity_id: '5QQWQ2MM4', detail: { from: 'available', to: 'blocked' } },
      { id: 2, at: '2026-11-17T13:00:00Z', actor_id: null, actor_role: 'authenticated', event: 'batch_created', entity: 'batch', entity_id: 'lote-900', detail: { count: 54 } },
      { id: 1, at: '2026-11-02T21:40:00Z', actor_id: null, actor_role: 'authenticated', event: 'tag_activated', entity: 'tag', entity_id: '7K3MQ9XAC', detail: null },
    ],
    calls: {},
    batchBodies: [],
    blocked: [],
    ...over,
  };
}

export async function mockAdminBackend(page: Page, state: AdminState): Promise<AdminState> {
  await page.route(/\.supabase\.co\//, (route) => {
    state.blocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.abort();
  });
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const record = (name: string, body: unknown) => {
    (state.calls[name] ??= []).push((body ?? {}) as Json);
  };

  await page.route('**/rest/v1/rpc/current_user_role', (route) => route.fulfill(json('admin')));
  await page.route('**/rest/v1/rpc/my_account', (route) =>
    route.fulfill(
      json({
        id: 'u1',
        nome: 'Admin Faro',
        email: 'admin@faro.test',
        papel: 'admin',
        celular: null,
        celular_confirmado_em: null,
        celular_pendente: null,
        termos_aceitos_em: '2026-11-22T09:00:00Z',
        termos_versao: '2026-11',
        tem_senha: true,
        provedores: ['email'],
        criado_em: '2026-11-22T09:00:00Z',
      }),
    ),
  );
  const rpc = (name: string, reply: (body: Json) => unknown) =>
    page.route(`**/rest/v1/rpc/${name}`, (route) => {
      const body = (route.request().postDataJSON() ?? {}) as Json;
      record(name, body);
      return route.fulfill(json(reply(body)));
    });

  await rpc('admin_dashboard_counters', () => state.counters);
  await rpc('admin_list_batches', () => ({ ok: true, batches: state.batches }));
  await rpc('admin_list_codes', (body) => {
    const status = body['p_status'] as string | null;
    const search = ((body['p_search'] as string | null) ?? '').toLowerCase();
    const rows = state.codes.filter(
      (c) => (status === null || c['status'] === status) && (search === '' || JSON.stringify(c).toLowerCase().includes(search.replaceAll('-', ''))),
    );
    return { ok: true, total: rows.length, rows };
  });
  await rpc('admin_code_detail', () => state.detail);
  await rpc('admin_set_status', (body) => ({ ok: true, code: body['p_code'], status: body['p_status'] }));
  await rpc('admin_reissue_pin', (body) => ({ ok: true, code: body['p_code'], new_pin: PIN_FIXTURE }));
  await rpc('admin_end_assignment', (body) => ({ ok: true, code: body['p_code'], new_pin: PIN_FIXTURE }));
  await rpc('admin_resolve_replacement', () => ({ ok: true }));
  await rpc('admin_scan_queue', () => state.queue);
  await rpc('admin_audit', (body) => {
    const entity = ((body['p_entity_id'] as string | null) ?? '').replaceAll('-', '').toUpperCase();
    const rows = entity === '' ? state.audit : state.audit.filter((r) => String(r['entity_id']).toUpperCase() === entity || r['entity_id'] === body['p_entity_id']);
    return { ok: true, rows };
  });
  await rpc('admin_export_codes', (body) => ({ ok: true, batch_id: body['p_batch'], count: 2, csv: 'code,qr_version,qr_mask\n7K3M-Q9XA-C,3,2\n2FX8-CN73-F,3,5\n' }));

  await page.route('**/functions/v1/admin-create-batch', (route) => {
    state.batchBodies.push((route.request().postDataJSON() ?? {}) as Json);
    return route.fulfill({
      // Sem `Access-Control-Expose-Headers`: como o navegador entrega a resposta de outra origem, `X-Batch-Id` não é legível
      // pelo app (o pior caso para o serviço, que não pode jogar o pacote fora). Hoje a função nem tem CORS (bloqueio de [BE]).
      status: 200,
      headers: { 'Content-Type': 'application/zip', 'X-Batch-Id': 'lote-901', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
      body: 'PK-simulado',
    });
  });
  return state;
}
