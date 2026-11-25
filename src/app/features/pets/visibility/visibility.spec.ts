import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { ZardSonnerService } from '@/shared/components/sonner';
import { faroIcons } from '@/shared/icons/faro-icons';

import { AccountService } from '../../../core/account/account.service';
import { PetService } from '../../../core/pets/pet.service';
import { RescueProfileService } from '../../../core/pets/rescue-profile.service';
import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet, Pet, RescueProfile } from '../../../models';
import { VisibilityPage } from './visibility';

const PET_ID = '11111111-1111-4111-8111-111111111111';

const dashboardPet = (over: Partial<DashboardPet> = {}): DashboardPet => ({
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
  visibleShown: 2,
  visibleTotal: 5,
  ...over,
});

const pet: Pet = {
  id: PET_ID,
  tutorId: 'u1',
  name: 'Paçoca',
  species: 'dog',
  breed: null,
  sex: null,
  size: null,
  neutered: null,
  birthMonth: null,
  temperament: ['Dócil com pessoas', 'Medo de barulho'],
  careNotes: 'Toma remédio para alergia',
  photoPath: null,
  createdAt: 'a',
  updatedAt: 'b',
};

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

const account = (confirmed: boolean) => ({
  nome: 'Ana Souza',
  celular: '+5511987654421',
  celularConfirmadoEm: confirmed ? '2026-11-21T12:03:00Z' : null,
});

describe('VisibilityPage (T065, T066)', () => {
  let fixture: ComponentFixture<VisibilityPage>;
  let el: HTMLElement;
  let save: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let success: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const switchOf = (id: string) => el.querySelector<HTMLButtonElement>(`[data-testid="${id}"] button[role="switch"]`)!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const toggle = async (id: string) => {
    switchOf(id).click();
    await settle();
  };

  async function create(
    opts: {
      confirmed?: boolean;
      noAccount?: boolean;
      profile?: RescueProfile;
      dashboardPet?: DashboardPet | null;
      saveResult?: unknown;
      dashboardFails?: boolean;
    } = {},
  ) {
    save = vi.fn().mockResolvedValue(opts.saveResult ?? { ok: true, profile: profile({ showCare: false }) });
    success = vi.fn();
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
                : { ok: true, dashboard: { pets: opts.dashboardPet === null ? [] : [opts.dashboardPet ?? dashboardPet()], pendingActivation: null } },
            ),
          },
        },
        { provide: PetService, useValue: { get: vi.fn().mockResolvedValue({ ok: true, pet }), photoUrls: vi.fn().mockResolvedValue({}) } },
        { provide: RescueProfileService, useValue: { get: vi.fn().mockResolvedValue({ ok: true, profile: opts.profile ?? profile() }), save } },
        { provide: AccountService, useValue: { ensureLoaded: vi.fn().mockResolvedValue(opts.noAccount ? null : account(opts.confirmed ?? true)) } },
        { provide: ZardSonnerService, useValue: { success } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(VisibilityPage);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('petId', PET_ID);
    fixture.detectChanges();
    await settle();
    await settle();
  }

  afterEach(() => fixture?.destroy());

  it('três grupos; "Nome e foto" fica travado em "Sempre"; o celular aparece mascarado e confirmado', async () => {
    await create();
    expect(el.textContent).toContain('Sobre o pet');
    expect(el.textContent).toContain('Contato');
    expect(el.textContent).toContain('Só no modo perdido');
    expect(byId('visibility-name')?.textContent).toContain('Paçoca');
    expect(byId('visibility-name')?.querySelector('button[role="switch"]')).toBeNull();
    expect(byId('visibility-name')?.textContent).toContain('Sempre');
    expect(byId('visibility-temperament')?.textContent).toContain('Dócil com pessoas, Medo de barulho');
    expect(byId('visibility-phone')?.textContent).toContain('(11) 9••••-4421 · confirmado');
    expect(byId('visibility-first-name')?.textContent).toContain('Ana');
    expect(switchOf('visibility-temperament').getAttribute('aria-checked')).toBe('true');
    expect(switchOf('visibility-whatsapp').getAttribute('aria-checked')).toBe('false');
    expect(switchOf('visibility-lost-since').getAttribute('aria-checked')).toBe('true');
  });

  it('Salvar manda só o que mudou e volta para a página do pet com um aviso', async () => {
    await create();
    await toggle('visibility-care');
    await toggle('visibility-lost-reward');
    byId('visibility-save')!.click();
    await settle();
    expect(save).toHaveBeenCalledWith(PET_ID, { showCare: false, lostShowReward: true });
    expect(success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/app/pets', PET_ID]);
  });

  it('sem nenhuma mudança, Salvar só volta (nada é gravado)', async () => {
    await create();
    byId('visibility-save')!.click();
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/app/pets', PET_ID]);
  });

  describe('celular não confirmado (T065)', () => {
    it('ligar o WhatsApp não liga: o interruptor volta, o aviso aparece e leva à confirmação', async () => {
      await create({ confirmed: false });
      expect(byId('visibility-phone')?.textContent).toContain('ainda não confirmado');
      expect(byId('visibility-phone-notice')).toBeNull();
      await toggle('visibility-whatsapp');
      expect(switchOf('visibility-whatsapp').getAttribute('aria-checked')).toBe('false');
      expect(byId('visibility-phone-notice')?.textContent).toContain('Confirme seu celular para continuar.');
      const link = byId('visibility-confirm-phone') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(`/auth/celular?returnUrl=%2Fapp%2Fpets%2F${PET_ID}%2Fvisibilidade`);
      // Nada foi mudado: salvar não grava.
      byId('visibility-save')!.click();
      await settle();
      expect(save).not.toHaveBeenCalled();
    });

    it('o telefone também; o resto continua livre', async () => {
      await create({ confirmed: false });
      await toggle('visibility-phone');
      expect(switchOf('visibility-phone').getAttribute('aria-checked')).toBe('false');
      expect(byId('visibility-phone-notice')).not.toBeNull();
      await toggle('visibility-care');
      expect(switchOf('visibility-care').getAttribute('aria-checked')).toBe('false');
    });

    it('conta que não carregou conta como não confirmada (o banco continua sendo a regra)', async () => {
      await create({ noAccount: true });
      expect(byId('visibility-phone')?.textContent).toContain('Nenhum celular cadastrado');
      await toggle('visibility-whatsapp');
      expect(byId('visibility-phone-notice')).not.toBeNull();
    });

    it('desligar o que já estava ligado funciona mesmo sem celular confirmado', async () => {
      await create({ confirmed: false, profile: profile({ showWhatsapp: true }) });
      await toggle('visibility-whatsapp');
      expect(switchOf('visibility-whatsapp').getAttribute('aria-checked')).toBe('false');
      expect(byId('visibility-phone-notice')).toBeNull();
      byId('visibility-save')!.click();
      await settle();
      expect(save).toHaveBeenCalledWith(PET_ID, { showWhatsapp: false });
    });

    it('o banco recusou (celular deixou de estar confirmado): contato volta ao salvo e o aviso aparece', async () => {
      await create({ saveResult: { ok: false, error: 'phone_not_confirmed' } });
      await toggle('visibility-whatsapp');
      expect(switchOf('visibility-whatsapp').getAttribute('aria-checked')).toBe('true');
      byId('visibility-save')!.click();
      await settle();
      expect(switchOf('visibility-whatsapp').getAttribute('aria-checked')).toBe('false');
      expect(byId('visibility-phone-notice')).not.toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('prévia (T066)', () => {
    const open = async () => {
      byId('visibility-preview-open')!.click();
      await settle();
    };

    it('mostra a página de resgate na visão do dono, sem "Editar", com o que está ligado', async () => {
      await create();
      await open();
      expect(byId('visibility-preview')?.classList.contains('faro-light')).toBe(true);
      expect(byId('public-owner-banner')).not.toBeNull();
      expect(byId('public-owner-edit')).toBeNull();
      expect(byId('public-rescue-title')?.textContent).toContain('Paçoca');
      expect(byId('public-rescue-temperament')?.textContent).toContain('Medo de barulho');
      expect(byId('public-rescue-care')?.textContent).toContain('Toma remédio para alergia');
    });

    it('reflete um interruptor alterado SEM salvar (e nada foi gravado)', async () => {
      await create();
      await toggle('visibility-care');
      await toggle('visibility-first-name');
      await open();
      expect(byId('public-rescue-care')).toBeNull();
      expect(byId('public-rescue-lead')?.textContent).toContain('avise Ana');
      expect(save).not.toHaveBeenCalled();
    });

    it('o telefone ligado aparece na prévia; o WhatsApp é botão desativado, nunca um link com o número', async () => {
      await create();
      await toggle('visibility-whatsapp');
      await toggle('visibility-phone');
      await open();
      expect(byId('public-rescue-phone')?.textContent).toContain('(11) 98765-4421');
      const whats = byId('public-rescue-whatsapp') as HTMLButtonElement;
      expect(whats.tagName).toBe('BUTTON');
      expect(whats.disabled).toBe(true);
      expect(el.querySelector('a[href*="wa.me"]')).toBeNull();
    });

    it('pet em modo perdido: a prévia mostra o bloco âmbar com as opções de agora', async () => {
      await create({
        dashboardPet: dashboardPet({ lostMode: true, lostSince: '2026-11-23T10:00:00Z' }),
        profile: profile({ lostMode: true, lostSince: '2026-11-23T10:00:00Z', lostMessage: 'Fale baixo.', lostShowReward: true }),
      });
      await toggle('visibility-lost-reward');
      await toggle('visibility-lost-message');
      await open();
      expect(byId('public-rescue-lost')).not.toBeNull();
      expect(byId('public-rescue-reward')).toBeNull();
      expect(byId('public-rescue-message')).toBeNull();
      expect(byId('public-rescue-elapsed')).not.toBeNull();
    });

    it('fecha com o botão e com Esc, e a prévia não existe fechada', async () => {
      await create();
      expect(byId('visibility-preview')).toBeNull();
      await open();
      byId('visibility-preview-close')!.click();
      await settle();
      expect(byId('visibility-preview')).toBeNull();
      await open();
      byId('visibility-preview')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(byId('visibility-preview')).toBeNull();
    });
  });

  it('falha de rede e pet que não é do tutor terminam num próximo passo', async () => {
    await create({ dashboardFails: true });
    expect(byId('visibility-error')).not.toBeNull();
    expect(byId('visibility-retry')).not.toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
    await create({ dashboardPet: null });
    expect(byId('visibility-missing-pets')?.getAttribute('href')).toBe('/app/pets');
  });
});
