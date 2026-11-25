import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { PetService } from '../../../core/pets/pet.service';
import { RescueProfileService } from '../../../core/pets/rescue-profile.service';
import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet, Pet, RescueProfile } from '../../../models';
import { PetPage } from './pet-page';

const PET_ID = '11111111-1111-4111-8111-111111111111';

const dash = (over: Partial<DashboardPet> = {}): DashboardPet => ({
  id: PET_ID,
  name: 'Paçoca',
  species: 'dog',
  photoPath: null,
  lostMode: false,
  lostSince: null,
  hasTag: true,
  tagCode: '7K3M-Q9XA-C',
  tagStatus: 'assigned',
  scansMonth: 3,
  lastScan: { occurredAt: new Date(Date.now() - 3_600_000).toISOString(), geoMethod: 'ip' },
  visibleShown: 2,
  visibleTotal: 5,
  ...over,
});

const pet: Pet = {
  id: PET_ID,
  tutorId: 'u1',
  name: 'Paçoca',
  species: 'dog',
  breed: 'SRD caramelo',
  sex: 'male',
  size: 'medium',
  neutered: true,
  birthMonth: '2022-03-01',
  temperament: [],
  careNotes: null,
  photoPath: null,
  createdAt: 'a',
  updatedAt: 'b',
};

const profile = (over: Partial<RescueProfile> = {}): RescueProfile => ({
  petId: PET_ID,
  showTemperament: true,
  showCare: true,
  showTutorFirstName: false,
  showWhatsapp: true,
  showPhone: false,
  lostMode: false,
  lostSince: null,
  lostMessage: null,
  lostShowSince: true,
  lostShowReward: false,
  lostShowMessage: true,
  ...over,
});

describe('PetPage (T070)', () => {
  let fixture: ComponentFixture<PetPage>;
  let el: HTMLElement;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  async function create(opts: { dash?: DashboardPet | null; dashboardFails?: boolean; profileFails?: boolean } = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        {
          provide: TagService,
          useValue: {
            myDashboard: vi.fn().mockResolvedValue(
              opts.dashboardFails
                ? { ok: false, error: 'network' }
                : { ok: true, dashboard: { pets: opts.dash === null ? [] : [opts.dash ?? dash()], pendingActivation: null } },
            ),
            setLostMode: vi.fn(),
          },
        },
        { provide: PetService, useValue: { get: vi.fn().mockResolvedValue({ ok: true, pet }), photoUrls: vi.fn().mockResolvedValue({}) } },
        {
          provide: RescueProfileService,
          useValue: { get: vi.fn().mockResolvedValue(opts.profileFails ? { ok: false, error: 'network' } : { ok: true, profile: profile() }) },
        },
      ],
    });
    fixture = TestBed.createComponent(PetPage);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('petId', PET_ID);
    fixture.detectChanges();
    await settle();
    await settle();
  }

  afterEach(() => fixture?.destroy());

  describe('tag ativa', () => {
    beforeEach(() => create());

    it('o nome é o título da tela; na capa fica só o texto, com a linha "Cão · raça · nasceu em"', () => {
      expect(byId('screen-header-title')?.textContent).toContain('Paçoca');
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      expect(byId('pet-hero-subtitle')?.textContent).toBe(' Cão · SRD caramelo · nasceu em mar 2022 ');
      expect(byId('pet-hero-name')?.getAttribute('aria-hidden')).toBe('true');
      expect(byId('pet-page-edit')?.getAttribute('aria-label')).toBe('Editar pet');
      expect(byId('pet-page-edit')?.getAttribute('href')).toBe(`/app/pets/${PET_ID}/editar`);
    });

    it('chips de sexo, castração e porte', () => {
      expect([...el.querySelectorAll('[data-testid="pet-page-chips"] li')].map((li) => li.textContent?.trim())).toEqual([
        'Macho',
        'Castrado',
        'Porte médio',
      ]);
    });

    it('linha do modo perdido, cartão da tag e do último scan', () => {
      expect(byId('lost-row')).not.toBeNull();
      expect(byId('pet-page-tag-code')?.textContent?.trim()).toBe('7K3M-Q9XA-C');
      expect(byId('pet-page-tag-card')?.getAttribute('href')).toBe(`/app/pets/${PET_ID}/tag`);
      expect(byId('pet-page-scan-time')?.textContent).toMatch(/(Hoje|Ontem), \d{2}:\d{2}/);
      expect(byId('pet-page-scan-caption')?.textContent).toContain('Localização aproximada');
    });

    it('menu: dados, o que estranhos veem (com o resumo), gerenciar tag e histórico', () => {
      expect(byId('pet-page-menu-edit')?.getAttribute('href')).toBe(`/app/pets/${PET_ID}/editar`);
      expect(byId('pet-page-visibility-hint')?.textContent).toContain('WhatsApp liberado · telefone oculto');
      expect(byId('pet-page-menu-visibility')?.getAttribute('href')).toBe(`/app/pets/${PET_ID}/visibilidade`);
      expect(byId('pet-page-menu-tag')).not.toBeNull();
      expect(byId('pet-page-scans-month')?.textContent).toContain('3 scans este mês');
      expect(byId('pet-page-menu-scans')?.getAttribute('href')).toBe(`/app/scans?pet=${PET_ID}`);
    });
  });

  describe('os três estados da tag', () => {
    it('sem tag: botão "Vincular tag" no lugar do cartão da tag, sem modo perdido nem gerenciar', async () => {
      await create({ dash: dash({ hasTag: false, tagCode: null, tagStatus: null, lastScan: null, scansMonth: 0 }) });
      expect(byId('pet-page-link-tag')?.getAttribute('href')).toBe(`/vincular/${PET_ID}`);
      expect(byId('pet-page-tag-card')).toBeNull();
      expect(byId('lost-row')).toBeNull();
      expect(byId('pet-page-menu-tag')).toBeNull();
      expect(byId('pet-page-scan-time')?.textContent).toContain('—');
      expect(byId('pet-page-scans-month')?.textContent).toContain('Nenhum scan este mês');
    });

    it('tag bloqueada: "Tag bloqueada. Fale com o suporte.", sem modo perdido nem gerenciar nem link da tag', async () => {
      await create({ dash: dash({ tagStatus: 'blocked' }) });
      expect(byId('pet-page-blocked-alert')?.textContent).toContain('Tag bloqueada. Fale com o suporte.');
      expect(byId('pet-page-tag-code')?.textContent?.trim()).toBe('7K3M-Q9XA-C');
      expect(byId('pet-page-tag-card')).toBeNull();
      expect(byId('lost-row')).toBeNull();
      expect(byId('pet-page-menu-tag')).toBeNull();
      expect(byId('pet-page-link-tag')).toBeNull();
    });
  });

  it('perfil que não carregou: a linha do menu perde só o resumo', async () => {
    await create({ profileFails: true });
    expect(byId('pet-page-visibility-hint')?.textContent).toContain('Escolha o que estranhos veem');
    expect(byId('pet-page-error')).toBeNull();
  });

  it('falha de rede e pet que não é do tutor terminam num próximo passo', async () => {
    await create({ dashboardFails: true });
    expect(byId('pet-page-retry')).not.toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
    await create({ dash: null });
    expect(byId('pet-page-missing-pets')?.getAttribute('href')).toBe('/app/pets');
    expect(byId('pet-page-edit')).toBeNull();
  });
});
