import { TestBed } from '@angular/core/testing';

import { SupabaseService } from '../supabase/supabase.service';
import { SCAN_LIMIT, ScanService, startOfMonthIso } from './scan.service';

const ROW = {
  id: 's1',
  tag_code: '7K3MQ9XAC',
  pet_id: 'p1',
  occurred_at: '2026-11-20T17:32:00Z',
  geo_method: 'ip',
  lat: -23.55,
  lng: -46.63,
  accuracy_m: 3000,
  city: 'São Paulo',
  region: 'SP',
};

function setup(result: { data: unknown; error: unknown }) {
  const calls: { op: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const op of ['select', 'order', 'limit', 'gte', 'eq']) {
    chain[op] = (...args: unknown[]) => {
      calls.push({ op, args });
      return chain;
    };
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => resolve(result);
  const from = vi.fn(() => chain);
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { from } } }] });
  return { service: TestBed.inject(ScanService), calls, from };
}

describe('ScanService', () => {
  it('lê a visão my_scans, do mais novo para o mais antigo, e converte as colunas', async () => {
    const { service, calls, from } = setup({ data: [ROW], error: null });
    const res = await service.list();
    expect(from).toHaveBeenCalledWith('my_scans');
    expect(calls.find((c) => c.op === 'order')?.args).toEqual(['occurred_at', { ascending: false }]);
    expect(calls.find((c) => c.op === 'limit')?.args).toEqual([SCAN_LIMIT]);
    expect(res).toEqual({
      ok: true,
      scans: [
        {
          id: 's1',
          tagCode: '7K3MQ9XAC',
          petId: 'p1',
          occurredAt: '2026-11-20T17:32:00Z',
          geoMethod: 'ip',
          lat: -23.55,
          lng: -46.63,
          accuracyM: 3000,
          city: 'São Paulo',
          region: 'SP',
        },
      ],
    });
  });

  it('nunca pede ip_hash nem token (só as colunas da visão)', async () => {
    const { service, calls } = setup({ data: [], error: null });
    await service.list();
    const columns = String(calls.find((c) => c.op === 'select')?.args[0]);
    expect(columns).not.toMatch(/ip_hash|token/);
  });

  it('sem filtros não filtra nada', async () => {
    const { service, calls } = setup({ data: [], error: null });
    await service.list();
    expect(calls.some((c) => c.op === 'gte' || c.op === 'eq')).toBe(false);
  });

  it('filtros: este mês, localização precisa e pet', async () => {
    const { service, calls } = setup({ data: [], error: null });
    await service.list({ period: 'month', preciseOnly: true, petId: 'p1' }, new Date('2026-11-24T15:00:00Z'));
    expect(calls.find((c) => c.op === 'gte')?.args).toEqual(['occurred_at', '2026-11-01T00:00:00-03:00']);
    expect(calls.filter((c) => c.op === 'eq').map((c) => c.args)).toEqual([
      ['geo_method', 'gps'],
      ['pet_id', 'p1'],
    ]);
  });

  it('erro do banco, corpo estranho e geo_method desconhecido viram network', async () => {
    expect(await setup({ data: null, error: { message: 'segredo' } }).service.list()).toEqual({ ok: false, error: 'network' });
    TestBed.resetTestingModule();
    expect(await setup({ data: 'x', error: null }).service.list()).toEqual({ ok: false, error: 'network' });
    TestBed.resetTestingModule();
    expect(await setup({ data: [{ ...ROW, geo_method: 'wifi' }], error: null }).service.list()).toEqual({
      ok: false,
      error: 'network',
    });
  });
});

describe('startOfMonthIso', () => {
  it('usa o mês de Brasília, não o do UTC', () => {
    // 1º de dezembro 01:00 UTC ainda é 30 de novembro 22:00 em Brasília.
    expect(startOfMonthIso(new Date('2026-12-01T01:00:00Z'))).toBe('2026-11-01T00:00:00-03:00');
    expect(startOfMonthIso(new Date('2026-12-01T04:00:00Z'))).toBe('2026-12-01T00:00:00-03:00');
  });
});
