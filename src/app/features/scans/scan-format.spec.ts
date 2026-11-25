import type { Scan } from '../../models';
import { formatRadius, formatScanTime, groupByMonth, monthLabel, scanHasLocation, scanRadiusMeters } from './scan-format';

const scan = (over: Partial<Scan> & Pick<Scan, 'id' | 'occurredAt'>): Scan => ({
  tagCode: '7K3MQ9XAC',
  petId: 'p1',
  geoMethod: 'ip',
  lat: -23.5,
  lng: -46.6,
  accuracyM: null,
  city: null,
  region: null,
  ...over,
});

// 24 de novembro de 2026, 15:00 em Brasília.
const NOW = new Date('2026-11-24T18:00:00Z');

describe('formatScanTime', () => {
  it('hoje, ontem e uma data, no horário de Brasília', () => {
    expect(formatScanTime('2026-11-24T17:32:00Z', NOW)).toBe('Hoje, 14:32');
    expect(formatScanTime('2026-11-23T21:47:00Z', NOW)).toBe('Ontem, 18:47');
    expect(formatScanTime('2026-11-16T12:10:00Z', NOW)).toBe('16 nov, 09:10');
  });

  it('um scan à 01:00 UTC ainda é do dia anterior em Brasília', () => {
    expect(formatScanTime('2026-11-24T01:00:00Z', NOW)).toBe('Ontem, 22:00');
  });
});

describe('monthLabel e groupByMonth', () => {
  it('"Novembro 2026" com a inicial maiúscula', () => {
    expect(monthLabel('2026-11-24T18:00:00Z')).toBe('Novembro 2026');
    expect(monthLabel('2026-03-02T12:00:00Z')).toBe('Março 2026');
  });

  it('agrupa por mês na ordem recebida', () => {
    const groups = groupByMonth([
      scan({ id: 'a', occurredAt: '2026-11-24T18:00:00Z' }),
      scan({ id: 'b', occurredAt: '2026-11-02T18:00:00Z' }),
      scan({ id: 'c', occurredAt: '2026-10-30T18:00:00Z' }),
    ]);
    expect(groups.map((g) => [g.label, g.scans.map((s) => s.id)])).toEqual([
      ['Novembro 2026', ['a', 'b']],
      ['Outubro 2026', ['c']],
    ]);
  });

  it('o mês vem do horário de Brasília', () => {
    // 1º de dezembro 01:00 UTC ainda é 30 de novembro em Brasília.
    expect(groupByMonth([scan({ id: 'a', occurredAt: '2026-12-01T01:00:00Z' })])[0].label).toBe('Novembro 2026');
  });
});

describe('raio e localização', () => {
  it('usa o erro informado; sem ele, 3 km para IP e 50 m para GPS', () => {
    expect(scanRadiusMeters(scan({ id: 'a', occurredAt: 'x', accuracyM: 15, geoMethod: 'gps' }))).toBe(15);
    expect(scanRadiusMeters(scan({ id: 'a', occurredAt: 'x', accuracyM: null, geoMethod: 'ip' }))).toBe(3000);
    expect(scanRadiusMeters(scan({ id: 'a', occurredAt: 'x', accuracyM: null, geoMethod: 'gps' }))).toBe(50);
  });

  it('formata o raio', () => {
    expect(formatRadius(3000, true)).toBe('~3 km');
    expect(formatRadius(2500, true)).toBe('~2,5 km');
    expect(formatRadius(15, false)).toBe('± 15 m');
    expect(formatRadius(1500, false)).toBe('± 1,5 km');
  });

  it('só tem localização com método diferente de none e lat/lng', () => {
    expect(scanHasLocation(scan({ id: 'a', occurredAt: 'x' }))).toBe(true);
    expect(scanHasLocation(scan({ id: 'a', occurredAt: 'x', geoMethod: 'none', lat: null, lng: null }))).toBe(false);
    expect(scanHasLocation(scan({ id: 'a', occurredAt: 'x', lat: null, lng: null }))).toBe(false);
  });
});
