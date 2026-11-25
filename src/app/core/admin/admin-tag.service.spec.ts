import { TestBed } from '@angular/core/testing';

import { SupabaseService } from '../supabase/supabase.service';
import { AdminTagService } from './admin-tag.service';
import { FileSaver } from './save-file';

// Códigos sintéticos de `contracts/tag-code.vectors.json`.
const CODE = '7K3M-Q9XA-C';

describe('AdminTagService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let getSession: ReturnType<typeof vi.fn>;
  let service: AdminTagService;

  beforeEach(() => {
    rpc = vi.fn();
    getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'jwt-do-admin' } } });
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc, auth: { getSession } } } }],
    });
    service = TestBed.inject(AdminTagService);
  });

  afterEach(() => vi.unstubAllGlobals());

  describe('erros de negócio', () => {
    it('forbidden volta como erro, não como exceção', async () => {
      rpc.mockResolvedValue({ data: { ok: false, error: 'forbidden' }, error: null });
      expect(await service.counters()).toEqual({ ok: false, error: 'forbidden' });
    });

    it('rede, exceção e código de erro desconhecido viram network (sem expor a mensagem)', async () => {
      rpc.mockResolvedValueOnce({ data: null, error: { message: 'segredo do banco' } });
      expect(await service.counters()).toEqual({ ok: false, error: 'network' });
      rpc.mockRejectedValueOnce(new Error('boom'));
      expect(await service.counters()).toEqual({ ok: false, error: 'network' });
      rpc.mockResolvedValueOnce({ data: { ok: false, error: 'algo_novo' }, error: null });
      expect(await service.counters()).toEqual({ ok: false, error: 'network' });
    });
  });

  describe('lotes e contadores', () => {
    it('mapeia contadores e lotes', async () => {
      rpc.mockResolvedValueOnce({ data: { ok: true, generated: 54, available: 41, active: 12, blocked: 0, void: 1 }, error: null });
      expect(await service.counters()).toEqual({ ok: true, counters: { generated: 54, available: 41, active: 12, blocked: 0, void: 1 } });

      rpc.mockResolvedValueOnce({
        data: {
          ok: true,
          batches: [
            { id: 'lote-900', quantity: 54, created_at: '2026-11-17T10:00:00Z', notes: 'Primeira impressão', package_downloaded_at: null, counts: { available: 41, assigned: 12, blocked: 0, void: 1 } },
          ],
        },
        error: null,
      });
      const res = await service.listBatches();
      expect(res).toEqual({
        ok: true,
        batches: [
          { id: 'lote-900', quantity: 54, createdAt: '2026-11-17T10:00:00Z', notes: 'Primeira impressão', packageDownloadedAt: null, counts: { available: 41, assigned: 12, blocked: 0, void: 1 } },
        ],
      });
    });

    it('linha fora do formato derruba a lista para network', async () => {
      rpc.mockResolvedValue({ data: { ok: true, batches: [{ id: 5 }] }, error: null });
      expect(await service.listBatches()).toEqual({ ok: false, error: 'network' });
    });
  });

  describe('códigos', () => {
    it('manda busca vazia como nulo, limite limitado a 100 e o código na forma de exibição na resposta', async () => {
      rpc.mockResolvedValue({
        data: { ok: true, total: 1, rows: [{ code: '7K3MQ9XAC', batch_id: 'lote-900', status: 'assigned', pet_name: 'Paçoca', tutor: 'Ana S.', last_scan_at: null }] },
        error: null,
      });
      const res = await service.listCodes({ search: '   ', status: 'assigned', limit: 500, offset: -3 });
      expect(rpc).toHaveBeenCalledWith('admin_list_codes', { p_search: null, p_status: 'assigned', p_batch: null, p_limit: 100, p_offset: 0 });
      expect(res).toEqual({
        ok: true,
        page: { total: 1, rows: [{ code: CODE, batchId: 'lote-900', status: 'assigned', petName: 'Paçoca', tutor: 'Ana S.', lastScanAt: null }] },
      });
    });

    it('detalhe confere o dígito antes de chamar o banco e normaliza o código', async () => {
      expect(await service.codeDetail('7K3M-Q9XA-D')).toEqual({ ok: false, error: 'invalid_code' });
      expect(rpc).not.toHaveBeenCalled();

      rpc.mockResolvedValue({
        data: {
          ok: true,
          code: CODE,
          batch_id: 'lote-900',
          status: 'assigned',
          created_at: '2026-11-17T10:00:00Z',
          assignment: { id: 'a1', started_at: '2026-11-02T18:40:00Z', pet_name: 'Paçoca', tutor: 'Ana S.' },
          history: [],
          scans: [{ id: 's1', occurred_at: '2026-11-25T14:32:00Z', status_at_scan: 'assigned', geo_method: 'ip', accuracy_m: null, city: 'São Paulo', region: 'SP', assignment_id: 'a1' }],
          pin: { used: true, used_at: '2026-11-02T18:40:00Z', fail_count_24h: 0, locked_until: null },
          replacement_requests: [],
        },
        error: null,
      });
      const res = await service.codeDetail('7k3m q9xa c');
      expect(rpc).toHaveBeenCalledWith('admin_code_detail', { p_code: '7K3MQ9XAC' });
      expect(res.ok && res.detail.assignment?.petName).toBe('Paçoca');
      expect(res.ok && res.detail.scans[0].geoMethod).toBe('ip');
      expect(res.ok && res.detail.pin).toEqual({ used: true, usedAt: '2026-11-02T18:40:00Z', failCount24h: 0, lockedUntil: null });
    });

    it('setStatus devolve a situação final e rejeita código inválido sem chamar o banco', async () => {
      expect(await service.setStatus('XXXX', 'blocked')).toEqual({ ok: false, error: 'invalid_code' });
      rpc.mockResolvedValue({ data: { ok: true, code: CODE, status: 'blocked' }, error: null });
      expect(await service.setStatus(CODE, 'blocked', '  teste  ')).toEqual({ ok: true, status: 'blocked' });
      expect(rpc).toHaveBeenCalledWith('admin_set_status', { p_code: '7K3MQ9XAC', p_status: 'blocked', p_note: 'teste' });
    });

    it('invalid_transition (sair de void) chega como erro', async () => {
      rpc.mockResolvedValue({ data: { ok: false, error: 'invalid_transition' }, error: null });
      expect(await service.setStatus(CODE, 'available')).toEqual({ ok: false, error: 'invalid_transition' });
    });
  });

  describe('PIN novo (uma vez)', () => {
    it('reissuePin e endAssignment devolvem o PIN só na resposta', async () => {
      rpc.mockResolvedValue({ data: { ok: true, code: CODE, new_pin: 'K47Q9M' }, error: null });
      expect(await service.reissuePin(CODE)).toEqual({ ok: true, code: CODE, newPin: 'K47Q9M' });
      expect(rpc).toHaveBeenLastCalledWith('admin_reissue_pin', { p_code: '7K3MQ9XAC' });
      expect(await service.endAssignment(CODE, 'lost')).toEqual({ ok: true, code: CODE, newPin: 'K47Q9M' });
      expect(rpc).toHaveBeenLastCalledWith('admin_end_assignment', { p_code: '7K3MQ9XAC', p_reason: 'lost' });
    });

    it('tag_not_available e too_many_requests chegam como erro', async () => {
      rpc.mockResolvedValueOnce({ data: { ok: false, error: 'tag_not_available' }, error: null });
      expect(await service.reissuePin(CODE)).toEqual({ ok: false, error: 'tag_not_available' });
      rpc.mockResolvedValueOnce({ data: { ok: false, error: 'too_many_requests' }, error: null });
      expect(await service.endAssignment(CODE)).toEqual({ ok: false, error: 'too_many_requests' });
    });

    it('o serviço não guarda o PIN: nada nas propriedades da instância', async () => {
      rpc.mockResolvedValue({ data: { ok: true, code: CODE, new_pin: 'K47Q9M' }, error: null });
      await service.reissuePin(CODE);
      expect(JSON.stringify(Object.values(service as object))).not.toContain('K47Q9M');
    });
  });

  describe('fila e auditoria', () => {
    it('mapeia as três seções da fila', async () => {
      rpc.mockResolvedValue({
        data: {
          ok: true,
          scans: [{ id: 's1', code: '7K3MQ9XAC', status_at_scan: 'blocked', occurred_at: '2026-11-25T10:12:00Z', geo_method: 'ip', city: 'São Paulo', region: 'SP' }],
          replacements: [{ id: 'r1', code: '7K3MQ9XAC', kind: 'damaged', created_at: '2026-11-19T10:00:00Z' }],
          locked_tags: [{ code: '7K3MQ9XAC', locked_until: '2026-11-26T09:15:00Z' }],
        },
        error: null,
      });
      const res = await service.scanQueue();
      expect(res.ok && res.queue.scans[0]).toMatchObject({ code: CODE, statusAtScan: 'blocked', city: 'São Paulo' });
      expect(res.ok && res.queue.replacements[0]).toMatchObject({ id: 'r1', kind: 'damaged' });
      expect(res.ok && res.queue.lockedTags[0]).toEqual({ code: CODE, lockedUntil: '2026-11-26T09:15:00Z' });
    });

    it('auditoria: o id vem como número do banco (bigint) e vira texto; fila aceita id numérico', async () => {
      rpc.mockResolvedValueOnce({ data: { ok: true, rows: [{ id: 42, at: '2026-11-25T14:32:00Z', actor_id: null, actor_role: 'authenticated', event: 'pin_reissued', entity: 'tag', entity_id: '7K3MQ9XAC', detail: {} }] }, error: null });
      const res = await service.audit();
      expect(res.ok && res.rows[0].id).toBe('42');
      expect(res.ok && res.rows[0].actorRole).toBe('authenticated');
    });

    it('resolveReplacement manda o pedido e o desfecho', async () => {
      rpc.mockResolvedValue({ data: { ok: true }, error: null });
      expect(await service.resolveReplacement('r1', 'done')).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledWith('admin_resolve_replacement', { p_request: 'r1', p_status: 'done' });
    });

    it('auditoria: filtros nulos quando vazios e limite dentro de 1..200', async () => {
      rpc.mockResolvedValue({ data: { ok: true, rows: [{ id: '1', at: '2026-11-25T14:32:00Z', actor_id: null, actor_role: 'admin', event: 'pin_reissued', entity: 'tag', entity_id: '7K3MQ9XAC', detail: { reason: 'x' } }] }, error: null });
      const res = await service.audit({ event: null, entityId: '  ', limit: 999 });
      expect(rpc).toHaveBeenCalledWith('admin_audit', { p_event: null, p_entity_id: null, p_limit: 200, p_offset: 0 });
      expect(res.ok && res.rows[0]).toMatchObject({ event: 'pin_reissued', actorRole: 'admin', detail: { reason: 'x' } });
    });
  });

  describe('exportar códigos', () => {
    it('só pede lote com a forma lote-NNN', async () => {
      expect(await service.exportCodes("lote-1; drop")).toEqual({ ok: false, error: 'not_found' });
      rpc.mockResolvedValue({ data: { ok: true, batch_id: 'lote-900', count: 2, csv: 'code,qr_version,qr_mask\n' }, error: null });
      expect(await service.exportCodes('lote-900')).toEqual({ ok: true, batchId: 'lote-900', count: 2, csv: 'code,qr_version,qr_mask\n' });
    });
  });

  describe('createBatch', () => {
    const okResponse = () =>
      new Response('PK', { status: 200, headers: { 'Content-Type': 'application/zip', 'X-Batch-Id': 'lote-003' } });

    it('recusa quantidade e observação fora do contrato sem chamar a função', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      expect(await service.createBatch(0)).toEqual({ ok: false, error: 'invalid_input' });
      expect(await service.createBatch(501)).toEqual({ ok: false, error: 'invalid_input' });
      expect(await service.createBatch(1.5)).toEqual({ ok: false, error: 'invalid_input' });
      expect(await service.createBatch(10, 'x'.repeat(201))).toEqual({ ok: false, error: 'invalid_input' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('chama a função com o JWT do admin e devolve o pacote com o id do lote', async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal('fetch', fetchMock);
      const res = await service.createBatch(54, '  primeira  ');
      expect(res.ok && res.batchId).toBe('lote-003');
      expect(res.ok && res.blob.size).toBe(2);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/functions\/v1\/admin-create-batch$/);
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-do-admin');
      expect(JSON.parse(init.body as string)).toEqual({ quantity: 54, notes: 'primeira' });
    });

    it('sem sessão: forbidden e nenhuma chamada', async () => {
      getSession.mockResolvedValue({ data: { session: null } });
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      expect(await service.createBatch(10)).toEqual({ ok: false, error: 'forbidden' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      [401, 'forbidden'],
      [403, 'forbidden'],
      [429, 'too_many_requests'],
      [400, 'invalid_input'],
      [409, 'batch_range_exhausted'],
      [500, 'network'],
    ])('status %i vira %s', async (status, error) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
      expect(await service.createBatch(10)).toEqual({ ok: false, error });
    });

    it('200 sem X-Batch-Id legível NUNCA joga o pacote fora (os PINs só existem nele): batchId nulo', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('PK', { status: 200 })));
      const res = await service.createBatch(10);
      expect(res.ok && res.batchId).toBeNull();
      expect(res.ok && res.blob.size).toBe(2);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('PK', { status: 200, headers: { 'X-Batch-Id': 'qualquer coisa' } })));
      const odd = await service.createBatch(10);
      expect(odd.ok && odd.batchId).toBeNull();
    });

    it('queda de rede vira network', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      expect(await service.createBatch(10)).toEqual({ ok: false, error: 'network' });
    });
  });
});

describe('FileSaver', () => {
  it('baixa pelo link e revoga o endereço temporário (o arquivo não fica em memória)', async () => {
    const create = vi.fn().mockReturnValue('blob:teste');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    TestBed.inject(FileSaver).save(new Blob(['x']), 'lote-003.zip');

    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    expect(revoke).toHaveBeenCalledWith('blob:teste');
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
