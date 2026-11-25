import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ScanService } from '../../../core/scans/scan.service';
import type { Scan } from '../../../models';
import { LEAFLET_LOADER } from '../scan-map/scan-map';
import { Scans } from './scans';

const scan = (over: Partial<Scan> & Pick<Scan, 'id' | 'occurredAt'>): Scan => ({
  tagCode: '7K3MQ9XAC',
  petId: 'p1',
  geoMethod: 'ip',
  lat: -23.55,
  lng: -46.63,
  accuracyM: 3000,
  city: 'São Paulo',
  region: 'SP',
  ...over,
});

// Datas relativas a agora, para o rótulo "Hoje" não depender do dia em que o teste roda.
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const makeList = (): Scan[] => [
  scan({ id: 's1', occurredAt: hoursAgo(1) }),
  scan({ id: 's2', occurredAt: hoursAgo(24 * 40), geoMethod: 'gps', accuracyM: 15, city: null, region: null }),
  scan({ id: 's3', occurredAt: hoursAgo(24 * 41), geoMethod: 'none', lat: null, lng: null, accuracyM: null, city: null, region: null }),
];

/** Leaflet de mentira: registra o que seria desenhado. */
function fakeLeaflet() {
  const drawn = { circles: [] as { center: unknown; radius: number }[], markers: 0, fitted: 0, removed: 0 };
  const layer = { addTo: () => layer, clearLayers: () => undefined };
  const map = { remove: () => (drawn.removed += 1), fitBounds: () => (drawn.fitted += 1), setView: () => map };
  const L = {
    map: () => map,
    tileLayer: () => ({ addTo: () => undefined }),
    layerGroup: () => ({ addTo: () => layer, clearLayers: () => undefined }),
    circle: (center: unknown, opts: { radius: number }) => {
      drawn.circles.push({ center, radius: opts.radius });
      const circle = { addTo: () => circle, getBounds: () => ({}) };
      return circle;
    },
    marker: () => ({ addTo: () => (drawn.markers += 1) }),
    divIcon: () => ({}),
  };
  return { L, drawn };
}

describe('Scans', () => {
  // Só o relógio é falso (não os temporizadores): o rótulo "Hoje" não depende da hora em que o teste roda.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T18:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  let fixture: ComponentFixture<Scans>;
  let el: HTMLElement;
  let list: ReturnType<typeof vi.fn>;
  let drawn: ReturnType<typeof fakeLeaflet>['drawn'];

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(opts: { result?: unknown; pet?: string } = {}) {
    list = vi.fn().mockResolvedValue(opts.result ?? { ok: true, scans: makeList() });
    const fake = fakeLeaflet();
    drawn = fake.drawn;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ScanService, useValue: { list } },
        { provide: LEAFLET_LOADER, useValue: () => Promise.resolve(fake.L) },
      ],
    });
    fixture = TestBed.createComponent(Scans);
    el = fixture.nativeElement;
    if (opts.pet !== undefined) fixture.componentRef.setInput('pet', opts.pet);
    fixture.detectChanges();
    await settle();
    await settle();
  }

  const chip = (label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('[data-testid="scans-filters"] button')].find((b) => b.textContent?.trim() === label)!;

  it('lista os scans por mês, com a hora e a precisão de cada um', async () => {
    await create();
    expect(all('scans-row')).toHaveLength(3);
    expect(all('scans-group').length).toBeGreaterThanOrEqual(2);
    const badges = all('scans-row-badge').map((b) => b.textContent?.trim());
    expect(badges).toEqual(['Aproximada', 'Precisa · ± 15 m', 'Sem local']);
    expect(all('scans-row')[0].textContent).toContain('Hoje,');
    expect(all('scans-row')[0].textContent).toContain('Quem escaneou não liberou o GPS');
    expect(all('scans-row')[0].textContent).toContain('São Paulo, SP');
    expect(all('scans-row')[1].textContent).toContain('Quem escaneou enviou a localização');
    expect(all('scans-row')[2].textContent).toContain('Não foi possível saber onde foi');
  });

  it('mostra a nota de privacidade e chama o serviço sem filtros', async () => {
    await create();
    expect(byId('scans-privacy')?.textContent).toContain('Os scans ficam com você');
    expect(list).toHaveBeenCalledWith({});
  });

  it('o mapa mostra o scan mais recente com local: círculo de ~3 km para o aproximado, marcado como "Último"', async () => {
    await create();
    expect(byId('scans-map')).not.toBeNull();
    expect(byId('scans-map-latest')).not.toBeNull();
    expect(byId('scans-map-radius')?.textContent).toContain('Raio de ~3 km');
    expect(byId('scans-map')?.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain('área aproximada');
    expect(drawn.circles).toEqual([{ center: [-23.55, -46.63], radius: 3000 }]);
    expect(drawn.markers).toBe(0);
    expect(byId('scans-map-attribution')?.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright');
  });

  it('scan preciso no topo: pino com o raio do erro', async () => {
    await create({
      result: { ok: true, scans: [scan({ id: 'g', occurredAt: hoursAgo(1), geoMethod: 'gps', accuracyM: 15 })] },
    });
    expect(drawn.circles).toEqual([{ center: [-23.55, -46.63], radius: 15 }]);
    expect(drawn.markers).toBe(1);
    expect(byId('scans-map-radius')?.textContent).toContain('± 15 m');
  });

  it('o scan mais novo sem local: o mapa mostra o anterior com local, sem a marca "Último"', async () => {
    await create({
      result: {
        ok: true,
        scans: [
          scan({ id: 'n', occurredAt: hoursAgo(1), geoMethod: 'none', lat: null, lng: null, accuracyM: null, city: null, region: null }),
          scan({ id: 'o', occurredAt: hoursAgo(5) }),
        ],
      },
    });
    expect(byId('scans-map')).not.toBeNull();
    expect(byId('scans-map-latest')).toBeNull();
  });

  it('nenhum scan com local: sem cartão de mapa (o Leaflet nem é pedido)', async () => {
    await create({
      result: {
        ok: true,
        scans: [scan({ id: 'n', occurredAt: hoursAgo(1), geoMethod: 'none', lat: null, lng: null, accuracyM: null, city: null, region: null })],
      },
    });
    expect(byId('scans-map')).toBeNull();
    expect(drawn.circles).toHaveLength(0);
  });

  it('os filtros chamam o serviço: este mês, localização precisa e de volta a todos', async () => {
    await create();
    chip('Este mês').click();
    await settle();
    await settle();
    expect(list).toHaveBeenLastCalledWith({ period: 'month' });
    chip('Localização precisa').click();
    await settle();
    await settle();
    expect(list).toHaveBeenLastCalledWith({ preciseOnly: true });
    chip('Todos').click();
    await settle();
    await settle();
    expect(list).toHaveBeenLastCalledWith({});
  });

  it('?pet=<id> filtra por pet e oferece "Ver todos"', async () => {
    await create({ pet: 'p9' });
    expect(list).toHaveBeenCalledWith({ petId: 'p9' });
    expect(byId('scans-pet-clear')?.getAttribute('href')).toBe('/app/scans');
  });

  it('sem scans e sem filtro: estado vazio com o caminho de volta ao painel', async () => {
    await create({ result: { ok: true, scans: [] } });
    expect(byId('scans-empty')?.textContent).toContain('Ninguém escaneou a tag ainda');
    expect(byId('scans-empty-panel')?.getAttribute('href')).toBe('/app');
    expect(byId('scans-map')).toBeNull();
  });

  it('sem scans com um filtro: "Ver todos os scans" desfaz o filtro', async () => {
    await create();
    list.mockResolvedValue({ ok: true, scans: [] });
    chip('Localização precisa').click();
    await settle();
    await settle();
    expect(byId('scans-empty')?.textContent).toContain('Nenhum scan com este filtro');
    list.mockResolvedValue({ ok: true, scans: makeList() });
    byId('scans-empty-all')!.click();
    await settle();
    await settle();
    expect(list).toHaveBeenLastCalledWith({});
    expect(all('scans-row')).toHaveLength(3);
  });

  it('erro: mensagem e "Tentar de novo"', async () => {
    await create({ result: { ok: false, error: 'network' } });
    expect(byId('scans-error')).not.toBeNull();
    list.mockResolvedValue({ ok: true, scans: makeList() });
    byId('scans-retry')!.click();
    await settle();
    await settle();
    expect(all('scans-row')).toHaveLength(3);
    expect(byId('scans-error')).toBeNull();
  });
});
