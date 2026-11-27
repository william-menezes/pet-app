import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ZardSonnerService } from '@/shared/components/sonner';

import { RescueProfileService } from '../../../core/pets/rescue-profile.service';
import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet, RescueProfile } from '../../../models';
import { LostMode } from './lost-mode';

const PET_ID = '11111111-1111-4111-8111-111111111111';

const pet = (over: Partial<DashboardPet> = {}): DashboardPet => ({
  id: PET_ID,
  name: 'Paçoca',
  species: 'dog',
  photoPath: null,
  lostMode: false,
  lostSince: null,
  hasTag: true,
  tagCode: '7K3M-Q9XA-C',
  tagStatus: 'assigned',
  scansMonth: 0,
  lastScan: null,
  visibleShown: 0,
  visibleTotal: 5,
  ...over,
});

const profile = (over: Partial<RescueProfile> = {}): RescueProfile => ({
  petId: PET_ID,
  showTemperament: true,
  showCare: true,
  showTutorFirstName: false,
  showWhatsapp: false,
  showPhone: false,
  lostMode: false,
  lostSince: null,
  lostMessage: null,
  lostShowSince: true,
  lostShowReward: false,
  lostShowMessage: true,
  ...over,
});

describe('LostMode (T060)', () => {
  let fixture: ComponentFixture<LostMode>;
  let el: HTMLElement;
  let setLostMode: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let success: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function create(
    opts: {
      pet?: DashboardPet | null;
      profile?: RescueProfile;
      dashboardFails?: boolean;
      setResult?: unknown;
    } = {},
  ) {
    setLostMode = vi.fn().mockResolvedValue(opts.setResult ?? { ok: true });
    success = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: TagService,
          useValue: {
            setLostMode,
            myDashboard: vi.fn().mockResolvedValue(
              opts.dashboardFails
                ? { ok: false, error: 'network' }
                : { ok: true, dashboard: { pets: opts.pet === null ? [] : [opts.pet ?? pet()], pendingActivation: null } },
            ),
          },
        },
        { provide: RescueProfileService, useValue: { get: vi.fn().mockResolvedValue({ ok: true, profile: opts.profile ?? profile() }) } },
        { provide: ZardSonnerService, useValue: { success } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(LostMode);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('petId', PET_ID);
    fixture.detectChanges();
    await settle();
    await settle();
  }

  async function typeMessage(value: string) {
    const area = byId('lost-mode-message') as HTMLTextAreaElement;
    area.value = value;
    area.dispatchEvent(new Event('input'));
    await settle();
  }

  const toggle = async (id: string) => {
    el.querySelector<HTMLButtonElement>(`[data-testid="${id}"] button[role="switch"]`)!.click();
    await settle();
  };

  it('abre com o rascunho do recado, o contador e as opções guardadas', async () => {
    await create({ profile: profile({ lostMessage: 'Fale baixo.', lostShowReward: true }) });
    expect(byId('lost-mode-title')?.textContent).toContain('Paçoca sumiu?');
    expect((byId('lost-mode-message') as HTMLTextAreaElement).value).toBe('Fale baixo.');
    expect(byId('lost-mode-count')?.textContent).toContain('11/280');
    expect(el.querySelector('[data-testid="lost-mode-since"] button')?.getAttribute('aria-checked')).toBe('true');
    expect(el.querySelector('[data-testid="lost-mode-reward"] button')?.getAttribute('aria-checked')).toBe('true');
  });

  it('o contador acompanha a digitação e passa de 280: erro e botão desativado', async () => {
    await create();
    await typeMessage('a'.repeat(281));
    expect(byId('lost-mode-count')?.textContent).toContain('281/280');
    expect(byId('lost-mode-count')?.className).toContain('text-destructive');
    expect(el.querySelector('[data-testid="lost-mode-submit"]')?.hasAttribute('disabled')).toBe(true);
    await typeMessage('a'.repeat(280));
    expect(el.querySelector('[data-testid="lost-mode-submit"]')?.hasAttribute('disabled')).toBe(false);
  });

  it('a prévia segue os interruptores e o recado, com os textos da página pública', async () => {
    await create();
    expect(byId('lost-mode-preview-title')?.textContent).toContain('Sou Paçoca.');
    expect(byId('lost-mode-preview-title')?.textContent).toContain('Me perdi de casa.');
    expect(byId('lost-mode-preview-since')).not.toBeNull();
    expect(byId('lost-mode-preview-reward')).toBeNull();
    await toggle('lost-mode-reward');
    await toggle('lost-mode-since');
    expect(byId('lost-mode-preview-since')).toBeNull();
    expect(byId('lost-mode-preview-reward')).not.toBeNull();
    expect(byId('lost-mode-preview-message')).toBeNull();
    await typeMessage('  Me chame.  ');
    expect(byId('lost-mode-preview-message')?.textContent?.trim()).toBe('Me chame.');
  });

  it('"Ativar modo perdido" manda recado e opções, avisa e volta para a página do pet', async () => {
    await create();
    await typeMessage('Ele se assusta.');
    await toggle('lost-mode-reward');
    (byId('lost-mode-submit') as HTMLElement).click();
    await settle();
    await settle();
    expect(setLostMode).toHaveBeenCalledWith({
      petId: PET_ID,
      on: true,
      message: 'Ele se assusta.',
      showSince: true,
      showReward: true,
    });
    expect(success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/app/pets', PET_ID]);
  });

  it('erro do servidor aparece na tela, sem sair dela', async () => {
    await create({ setResult: { ok: false, error: 'no_active_tag' } });
    (byId('lost-mode-submit') as HTMLElement).click();
    await settle();
    await settle();
    expect(byId('lost-mode-problem')?.textContent).toContain('Vincule uma tag a este pet primeiro.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('pet sem tag: aviso e caminho para vincular, e o botão fica desativado', async () => {
    await create({ pet: pet({ hasTag: false, tagCode: null, tagStatus: null }) });
    expect(byId('lost-mode-no-tag-alert')?.textContent).toContain('Vincule uma tag a este pet primeiro.');
    expect(byId('lost-mode-link-tag')?.getAttribute('href')).toBe(`/vincular/${PET_ID}`);
    expect(el.querySelector('[data-testid="lost-mode-submit"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('modo perdido já ligado: título e botão de atualizar', async () => {
    await create({ pet: pet({ lostMode: true, lostSince: '2026-11-20T10:00:00Z' }) });
    expect(byId('lost-mode-title')?.textContent).toContain('O alerta de Paçoca está ligado');
    expect(byId('lost-mode-submit')?.textContent).toContain('Salvar alterações');
  });

  it('pet que não é do tutor e falha de rede terminam num próximo passo', async () => {
    await create({ pet: null });
    expect(byId('lost-mode-missing')).not.toBeNull();
    expect(byId('lost-mode-missing-pets')?.getAttribute('href')).toBe('/app/pets');
    TestBed.resetTestingModule();
    await create({ dashboardFails: true });
    expect(byId('lost-mode-error')).not.toBeNull();
    expect(byId('lost-mode-retry')).not.toBeNull();
  });
});
