import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { PetService } from '../../../core/pets/pet.service';
import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet } from '../../../models';
import { loadPetOverview } from '../pet-overview';
import { PetList } from './pet-list';

const dash = (id: string, name: string, hasTag: boolean, over: Partial<DashboardPet> = {}): DashboardPet => ({
  id,
  name,
  species: 'dog',
  photoPath: null,
  lostMode: false,
  lostSince: null,
  hasTag,
  tagCode: hasTag ? '7K3M-Q9XA-C' : null,
  tagStatus: hasTag ? 'assigned' : null,
  scansMonth: 0,
  lastScan: null,
  visibleShown: 0,
  visibleTotal: 5,
  ...over,
});

describe('PetList (T069)', () => {
  let fixture: ComponentFixture<PetList>;
  let el: HTMLElement;
  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  async function create(dashboard: unknown, petsList: unknown = { ok: true, pets: [] }) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        { provide: TagService, useValue: { myDashboard: vi.fn().mockResolvedValue(dashboard) } },
        { provide: PetService, useValue: { list: vi.fn().mockResolvedValue(petsList), photoUrls: vi.fn().mockResolvedValue({}) } },
      ],
    });
    fixture = TestBed.createComponent(PetList);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  it('lista os pets com a situação da tag, o resumo "2 pets · 1 tag ativa" e "Adicionar pet"', async () => {
    await create({ ok: true, dashboard: { pets: [dash('p1', 'Paçoca', true), dash('p2', 'Mel', false)], pendingActivation: null } });
    expect(el.querySelector('h1')?.textContent).toContain('Seus pets');
    expect(byId('pet-list-count')?.textContent).toContain('2 pets · 1 tag ativa');
    expect([...el.querySelectorAll('[data-testid="pet-card-link"]')].map((a) => a.getAttribute('href'))).toEqual(['/app/pets/p1', '/app/pets/p2']);
    expect([...el.querySelectorAll('[data-testid="pet-card-badge"]')].map((b) => b.textContent?.trim())).toEqual(['Tag ativa', 'Sem tag']);
    expect(byId('pet-list-add')?.getAttribute('href')).toBe('/novo-pet');
  });

  it('modo perdido e tag bloqueada aparecem no cartão sem usar vermelho', async () => {
    await create({
      ok: true,
      dashboard: {
        pets: [dash('p1', 'Paçoca', true, { lostMode: true }), dash('p2', 'Mel', true, { tagStatus: 'blocked' })],
        pendingActivation: null,
      },
    });
    const badges = [...el.querySelectorAll<HTMLElement>('[data-testid="pet-card-badge"]')];
    expect(badges.map((b) => b.textContent?.trim())).toEqual(['Modo perdido', 'Tag bloqueada']);
    expect(badges[0].className).toContain('text-warning-foreground');
    expect(badges[1].className).not.toContain('danger');
  });

  it('um pet só e nenhum pet: texto no singular e no vazio, sempre com "Adicionar pet"', async () => {
    await create({ ok: true, dashboard: { pets: [dash('p1', 'Paçoca', true)], pendingActivation: null } });
    expect(byId('pet-list-count')?.textContent).toContain('1 pet · 1 tag ativa');
    fixture.destroy();
    TestBed.resetTestingModule();
    await create({ ok: true, dashboard: { pets: [], pendingActivation: null } });
    expect(byId('pet-list-count')?.textContent).toContain('Nenhum pet ainda');
    expect(byId('pet-list-add')).not.toBeNull();
  });

  it('falha de rede: aviso e "Tentar de novo"', async () => {
    await create({ ok: false, error: 'network' });
    expect(byId('pet-list-error')).not.toBeNull();
    expect(byId('pet-list-retry')).not.toBeNull();
  });
});

describe('loadPetOverview', () => {
  it('só o my_dashboard é indispensável: sem os dados dos pets a lista segue, sem raça nem idade', async () => {
    const tags = { myDashboard: vi.fn().mockResolvedValue({ ok: true, dashboard: { pets: [dash('p1', 'Paçoca', true, { photoPath: 'u/p/a.webp' })], pendingActivation: '7K3M-Q9XA-C' } }) };
    const pets = { list: vi.fn().mockResolvedValue({ ok: false, error: 'network' }), photoUrls: vi.fn().mockResolvedValue({ 'u/p/a.webp': 'https://x.test/a.webp' }) };
    const res = await loadPetOverview(tags as unknown as TagService, pets as unknown as PetService);
    expect(res).toEqual({
      ok: true,
      pendingActivation: '7K3M-Q9XA-C',
      items: [{ dash: expect.objectContaining({ id: 'p1' }), pet: null, photoUrl: 'https://x.test/a.webp' }],
    });
  });

  it('sem o my_dashboard não há lista', async () => {
    const tags = { myDashboard: vi.fn().mockResolvedValue({ ok: false, error: 'network' }) };
    const pets = { list: vi.fn().mockResolvedValue({ ok: true, pets: [] }), photoUrls: vi.fn() };
    expect(await loadPetOverview(tags as unknown as TagService, pets as unknown as PetService)).toEqual({ ok: false, error: 'network' });
  });
});
