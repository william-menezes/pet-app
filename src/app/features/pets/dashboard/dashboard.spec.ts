import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { AccountService } from '../../../core/account/account.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PetService } from '../../../core/pets/pet.service';
import { ScanService } from '../../../core/scans/scan.service';
import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet, Pet } from '../../../models';
import { Dashboard, greeting } from './dashboard';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const dash = (over: Partial<DashboardPet> & Pick<DashboardPet, 'id' | 'name'>): DashboardPet => ({
  species: 'dog',
  photoPath: null,
  lostMode: false,
  lostSince: null,
  hasTag: true,
  tagCode: '7K3M-Q9XA-C',
  tagStatus: 'assigned',
  scansMonth: 3,
  lastScan: { occurredAt: hoursAgo(1), geoMethod: 'ip' },
  visibleShown: 2,
  visibleTotal: 5,
  ...over,
});

const row = (id: string, name: string, species: 'dog' | 'cat', breed: string | null, birth: string | null): Pet => ({
  id,
  tutorId: 'u1',
  name,
  species,
  breed,
  sex: null,
  size: null,
  neutered: null,
  birthMonth: birth,
  temperament: [],
  careNotes: null,
  photoPath: null,
  createdAt: 'a',
  updatedAt: 'b',
});

const PACOCA = dash({ id: 'p1', name: 'Paçoca' });
const MEL = dash({ id: 'p2', name: 'Mel', species: 'cat', hasTag: false, tagCode: null, tagStatus: null, scansMonth: 0, lastScan: null, visibleShown: 0 });

describe('Dashboard (T069)', () => {
  let fixture: ComponentFixture<Dashboard>;
  let el: HTMLElement;
  let scanList: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
  // `load()` encadeia várias promessas: um turno de macrotarefa deixa todas terminarem antes de ler a tela.
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };

  async function create(opts: { pets?: DashboardPet[]; pending?: string | null; fails?: boolean | { error: string; retryAfterSeconds?: number }; scans?: unknown[] } = {}) {
    scanList = vi.fn().mockResolvedValue({ ok: true, scans: opts.scans ?? [] });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        {
          provide: TagService,
          useValue: {
            myDashboard: vi.fn().mockResolvedValue(
              opts.fails
                ? { ok: false, ...(typeof opts.fails === 'object' ? opts.fails : { error: 'network' }) }
                : { ok: true, dashboard: { pets: opts.pets ?? [PACOCA, MEL], pendingActivation: opts.pending ?? null } },
            ),
          },
        },
        {
          provide: PetService,
          useValue: {
            list: vi.fn().mockResolvedValue({
              ok: true,
              pets: [row('p1', 'Paçoca', 'dog', 'vira-lata', '2022-03-01'), row('p2', 'Mel', 'cat', 'siamesa', '2024-05-01')],
            }),
            photoUrls: vi.fn().mockResolvedValue({}),
          },
        },
        { provide: ScanService, useValue: { list: scanList } },
        { provide: AccountService, useValue: { ensureLoaded: vi.fn().mockResolvedValue({ nome: 'Ana Souza' }) } },
        { provide: AuthStore, useValue: { user: () => null } },
      ],
    });
    fixture = TestBed.createComponent(Dashboard);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  it('pets-home existe já enquanto carrega e quando dá erro (o teste de sessão espera por ele)', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        { provide: TagService, useValue: { myDashboard: () => new Promise(() => undefined) } },
        { provide: PetService, useValue: { list: () => new Promise(() => undefined), photoUrls: vi.fn() } },
        { provide: ScanService, useValue: { list: vi.fn() } },
        { provide: AccountService, useValue: { ensureLoaded: () => new Promise(() => undefined) } },
        { provide: AuthStore, useValue: { user: () => null } },
      ],
    });
    fixture = TestBed.createComponent(Dashboard);
    el = fixture.nativeElement;
    fixture.detectChanges();
    expect(byId('pets-home')).not.toBeNull();
    expect(byId('dashboard-loading')).not.toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
    await create({ fails: true });
    expect(byId('pets-home')).not.toBeNull();
    expect(byId('dashboard-error')).not.toBeNull();
    expect(byId('dashboard-retry')).not.toBeNull();
  });

  it('limite de chamadas (too_many_requests): o painel diz para aguardar, não para verificar a conexão, e tem "Tentar de novo"', async () => {
    await create({ fails: { error: 'too_many_requests', retryAfterSeconds: 30 } });
    const text = byId('dashboard-error')?.textContent ?? '';
    expect(text).toContain('Muitas ações em pouco tempo. Aguarde 30 segundos.');
    expect(text).not.toContain('Verifique sua conexão');
    expect(byId('dashboard-retry')).not.toBeNull();
  });

  it('sem o tempo do servidor, o limite usa o texto do contrato: "Aguarde um minuto."', async () => {
    await create({ fails: { error: 'too_many_requests' } });
    expect(byId('dashboard-error')?.textContent).toContain('Muitas ações em pouco tempo. Aguarde um minuto.');
  });

  it('falha de rede continua com o texto de conexão', async () => {
    await create({ fails: true });
    expect(byId('dashboard-error')?.textContent).toContain('Verifique sua conexão');
  });

  describe('com pets e scan recente', () => {
    beforeEach(() => create());

    it('saudação com o primeiro nome, capa do primeiro pet e a tag', () => {
      expect(el.querySelector('h1')?.textContent).toContain('Ana');
      expect(el.querySelector('h1')?.textContent).not.toContain('Souza');
      expect(byId('pet-hero-name')?.textContent).toContain('Paçoca');
      expect(byId('pet-hero-name')?.tagName).toBe('H2');
      expect(byId('pet-hero-subtitle')?.textContent).toContain('Tag ativa · 7K3M-Q9XA-C');
      expect(byId('dashboard-cover')?.getAttribute('href')).toBe('/app/pets/p1');
    });

    it('cartão lima do último scan, com o dia, a hora, a localização e o caminho para o mapa', () => {
      expect(byId('dashboard-scan-card')?.textContent).toContain('Alguém escaneou a tag de Paçoca');
      expect(byId('dashboard-scan-text')?.textContent).toMatch(/(Hoje|Ontem) às \d{2}:\d{2}, localização aproximada\./);
      expect(byId('dashboard-scan-map')?.getAttribute('href')).toBe('/app/scans?pet=p1');
    });

    it('cartões de número: scans do mês e "estranhos veem X de 5"', () => {
      const tiles = all('stat-tile-value').map((t) => t.textContent?.trim());
      expect(tiles).toEqual(['3', '2 de 5']);
      expect(byId('dashboard-scans-tile')?.textContent).toMatch(/O último foi (hoje|ontem)/);
      expect(byId('dashboard-visible-tile')?.textContent).toContain('Dados de Paçoca');
      expect(el.querySelector('[data-testid="dashboard-visible-tile"] a')?.getAttribute('href')).toBe('/app/pets/p1/visibilidade');
    });

    it('atalho do modo perdido leva à tela dele', () => {
      expect(byId('dashboard-lost-link')?.textContent).toContain('Paçoca sumiu?');
      expect(byId('dashboard-lost-link')?.getAttribute('href')).toBe('/app/pets/p1/modo-perdido');
    });

    it('"Seus pets" com raça e idade e "Adicionar pet"', () => {
      const cards = all('pet-card-link');
      expect(cards).toHaveLength(2);
      expect(all('pet-card-summary')[0].textContent).toMatch(/^Cão · vira-lata · \d+ anos?$/);
      expect(all('pet-card-badge').map((b) => b.textContent?.trim())).toEqual(['Tag ativa', 'Sem tag']);
      expect(byId('dashboard-add-pet')?.getAttribute('href')).toBe('/novo-pet');
    });

    it('com mais de um pet há seletor; trocar muda a capa e troca o atalho por "Vincular tag" quando o pet não tem tag', async () => {
      const select = byId('dashboard-pet-select') as HTMLSelectElement;
      expect(select.getAttribute('aria-label')).toBe('Escolher o pet');
      select.value = 'p2';
      select.dispatchEvent(new Event('change'));
      await settle();
      expect(byId('pet-hero-name')?.textContent).toContain('Mel');
      expect(byId('pet-hero-subtitle')?.textContent).toContain('Sem tag');
      expect(byId('dashboard-scan-card')).toBeNull();
      expect(byId('dashboard-lost-link')).toBeNull();
      expect(byId('dashboard-link-tag')?.getAttribute('href')).toBe('/vincular/p2');
      expect(byId('dashboard-scans-tile')?.textContent).toContain('Nenhum scan este mês');
      expect(scanList).toHaveBeenLastCalledWith({ petId: 'p2', limit: 3 });
    });
  });

  it('scan com mais de 48 h não vira cartão lima; o cartão de número diz o dia', async () => {
    await create({ pets: [dash({ id: 'p1', name: 'Paçoca', lastScan: { occurredAt: hoursAgo(24 * 9), geoMethod: 'gps' } })] });
    expect(byId('dashboard-scan-card')).toBeNull();
    expect(byId('dashboard-scans-tile')?.textContent).toMatch(/O último foi \d{2} [a-z]{3}/);
  });

  it('um pet só: sem seletor', async () => {
    await create({ pets: [PACOCA] });
    expect(byId('dashboard-pet-select')).toBeNull();
  });

  it('modo perdido ligado: o atalho mostra há quanto tempo', async () => {
    await create({ pets: [dash({ id: 'p1', name: 'Paçoca', lostMode: true, lostSince: hoursAgo(5) })] });
    expect(byId('dashboard-lost-link')?.textContent).toContain('Modo perdido ligado');
    expect(byId('dashboard-lost-hint')?.textContent).toContain('Ligado há 5 horas');
  });

  it('ativação pendente: cartão com o código e o caminho para continuar', async () => {
    await create({ pending: '7K3M-Q9XA-C' });
    expect(byId('dashboard-pending')?.textContent).toContain('7K3M-Q9XA-C');
    expect(byId('dashboard-pending-continue')?.getAttribute('href')).toBe('/ativar/7K3MQ9XAC');
  });

  it('sem pets: convite para cadastrar o primeiro', async () => {
    await create({ pets: [] });
    expect(byId('dashboard-empty')?.textContent).toContain('Cadastre o seu primeiro pet');
    expect(byId('dashboard-empty-add')?.getAttribute('href')).toBe('/novo-pet');
    expect(byId('dashboard-cover')).toBeNull();
  });

  it('sem pets mas com ativação pendente: o cartão da ativação também aparece', async () => {
    await create({ pets: [], pending: '7K3M-Q9XA-C' });
    expect(byId('dashboard-pending')).not.toBeNull();
    expect(byId('dashboard-empty')).not.toBeNull();
  });

  it('falha ao carregar os scans não derruba o painel (a lista só some)', async () => {
    await create();
    scanList.mockResolvedValue({ ok: false, error: 'network' });
    expect(byId('dashboard-error')).toBeNull();
    expect(byId('dashboard-cover')).not.toBeNull();
  });
});

describe('greeting', () => {
  it('bom dia, boa tarde e boa noite pela hora local', () => {
    expect(greeting(7)).toBe('Bom dia');
    expect(greeting(14)).toBe('Boa tarde');
    expect(greeting(20)).toBe('Boa noite');
    expect(greeting(2)).toBe('Boa noite');
  });
});
