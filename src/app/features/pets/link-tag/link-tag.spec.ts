import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { PetService } from '../../../core/pets/pet.service';
import { tagUrl } from '../../../core/tag-code';
import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet } from '../../../models';
import { LinkTag } from './link-tag';
import { CAMERA_OPENER, QrScanner } from './qr-scanner';

// Códigos sintéticos (contracts/tag-code.vectors.json); nada de lote real.
const CODE = '7K3M-Q9XA-C';
const NORMALIZED = '7K3MQ9XAC';
const WRONG_DIGIT = '7K3M-Q9XA-D';

const pet = (over: Partial<DashboardPet> & Pick<DashboardPet, 'id' | 'name'>): DashboardPet => ({
  species: 'dog',
  photoPath: null,
  lostMode: false,
  lostSince: null,
  hasTag: false,
  tagCode: null,
  tagStatus: null,
  scansMonth: 0,
  lastScan: null,
  visibleShown: 0,
  visibleTotal: 5,
  ...over,
});
const PACOCA = pet({ id: 'p1', name: 'Paçoca' });
const MEL = pet({ id: 'p2', name: 'Mel', species: 'cat' });
const REX = pet({ id: 'p3', name: 'Rex', hasTag: true, tagCode: '2FX8-CN73-F', tagStatus: 'assigned' });

describe('LinkTag (T072, T073)', () => {
  let fixture: ComponentFixture<LinkTag>;
  let el: HTMLElement;
  let checkForLink: ReturnType<typeof vi.fn>;
  let activate: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const text = () => el.textContent ?? '';
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };

  async function create(
    opts: {
      petId?: string;
      pets?: DashboardPet[];
      check?: unknown;
      activateResult?: unknown;
      camera?: () => Promise<MediaStream | null>;
      dashboardFails?: boolean;
    } = {},
  ) {
    checkForLink = vi.fn().mockResolvedValue(opts.check ?? { ok: true, code: CODE });
    activate = vi.fn().mockResolvedValue(opts.activateResult ?? { ok: true, code: CODE, petId: 'p1', petName: 'Paçoca', whatsappEnabled: true });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        {
          provide: TagService,
          useValue: {
            checkForLink,
            activate,
            myDashboard: vi.fn().mockResolvedValue(
              opts.dashboardFails
                ? { ok: false, error: 'network' }
                : { ok: true, dashboard: { pets: opts.pets ?? [PACOCA, MEL, REX], pendingActivation: null } },
            ),
          },
        },
        { provide: PetService, useValue: { photoUrls: vi.fn().mockResolvedValue({}) } },
        { provide: CAMERA_OPENER, useValue: opts.camera ?? (async () => null) },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(LinkTag);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('petId', opts.petId ?? 'p1');
    fixture.detectChanges();
    await settle();
    await settle();
  }

  async function type(value: string) {
    const input = byId('link-code') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
    await settle();
  }

  async function pickTab(label: string) {
    [...el.querySelectorAll<HTMLButtonElement>('[data-testid="link-tabs"] button')].find((b) => b.textContent?.trim() === label)!.click();
    await settle();
  }

  async function typePin(pin: string) {
    const first = byId('activation-pin-cell-1') as HTMLInputElement;
    first.value = pin;
    first.dispatchEvent(new Event('input'));
    await settle();
    await settle();
  }

  async function toPinStep() {
    await type(CODE);
    byId('link-continue')!.click();
    await settle();
  }

  afterEach(() => fixture?.destroy());

  describe('passo 1: o código e o pet', () => {
    it('abas "Escanear QR" e "Digitar código" (a segunda aberta), e só os pets sem tag, com o da rota escolhido', async () => {
      await create();
      expect(text()).toContain('Qual tag você vai usar?');
      expect(el.querySelector('[data-testid="link-tabs"] [data-state="on"]')?.textContent?.trim()).toBe('Digitar código');
      expect(byId('link-pet-p1')?.textContent).toContain('Cão · sem tag');
      expect(byId('link-pet-p2')?.textContent).toContain('Gato · sem tag');
      expect(byId('link-pet-p3')).toBeNull();
      expect((el.querySelector('[data-testid="link-pet-p1"] input') as HTMLInputElement).checked).toBe(true);
      expect((byId('link-continue') as HTMLButtonElement).disabled).toBe(true);
    });

    it('código com o dígito errado: mensagem do contrato, nenhuma chamada, Continuar desligado', async () => {
      await create();
      await type(WRONG_DIGIT);
      expect(byId('link-code-problem')?.textContent).toContain('Confira o código. Ele fica embaixo do QR.');
      expect(checkForLink).not.toHaveBeenCalled();
      expect((byId('link-continue') as HTMLButtonElement).disabled).toBe(true);
      expect(byId('link-code')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('código incompleto não diz nada nem chama nada', async () => {
      await create();
      await type('7K3M-Q9');
      expect(byId('link-code-problem')).toBeNull();
      expect(byId('link-code-ok')).toBeNull();
      expect(checkForLink).not.toHaveBeenCalled();
    });

    it('código certo (em qualquer forma): confere no banco com o código normalizado e mostra "Código válido · tag disponível"', async () => {
      await create();
      await type('7k3m q9xa c');
      expect(checkForLink).toHaveBeenCalledTimes(1);
      expect(checkForLink).toHaveBeenCalledWith(NORMALIZED);
      expect(byId('link-code-ok')?.textContent).toContain('Código válido · tag disponível');
      expect((byId('link-code') as HTMLInputElement).value).toBe(CODE);
      expect((byId('link-continue') as HTMLButtonElement).disabled).toBe(false);
    });

    it('tag que não dá para usar: a mensagem única do contrato, sem dizer por quê', async () => {
      await create({ check: { ok: false, error: 'tag_unavailable' } });
      await type(CODE);
      expect(byId('link-code-problem')?.textContent).toContain('Não é possível usar esta tag. Fale com o suporte.');
      expect((byId('link-continue') as HTMLButtonElement).disabled).toBe(true);
    });

    it('limite de consultas: avisa o tempo de espera', async () => {
      await create({ check: { ok: false, error: 'locked', retryAfterSeconds: 120 } });
      await type(CODE);
      expect(byId('link-code-problem')?.textContent).toContain('2 minutos');
    });

    it('sem escolher pet, Continuar não habilita; trocar de pet vale para o PIN', async () => {
      await create();
      (el.querySelector('[data-testid="link-pet-p2"] input') as HTMLInputElement).click();
      await settle();
      await toPinStep();
      expect(byId('activation-summary')?.textContent).toContain('Mel');
    });
  });

  describe('escanear o QR (T072)', () => {
    async function openScanner() {
      await pickTab('Escanear QR');
      return fixture.debugElement.query(By.directive(QrScanner)).componentInstance as QrScanner;
    }

    it('QR da tag preenche o código, volta para "Digitar código" e confere', async () => {
      await create({ camera: async () => ({ getTracks: () => [] }) as unknown as MediaStream });
      const scanner = await openScanner();
      scanner.detected.emit(tagUrl(NORMALIZED));
      await settle();
      await settle();
      expect((byId('link-code') as HTMLInputElement).value).toBe(CODE);
      expect(checkForLink).toHaveBeenCalledWith(NORMALIZED);
      expect(byId('link-code-ok')).not.toBeNull();
    });

    it('QR de outro domínio ou de outro assunto: avisa e segue escaneando, sem chamar o banco', async () => {
      await create({ camera: async () => ({ getTracks: () => [] }) as unknown as MediaStream });
      const scanner = await openScanner();
      scanner.detected.emit(`https://evil.example/${NORMALIZED}`);
      await settle();
      expect(byId('link-notice')?.textContent).toContain('Esse QR não é de uma tag do Faro');
      expect(byId('link-scanner')).not.toBeNull();
      scanner.detected.emit('Olá');
      await settle();
      expect(checkForLink).not.toHaveBeenCalled();
    });

    it('câmera indisponível cai em "Digitar código", com o motivo e o caminho', async () => {
      await create({ camera: async () => null });
      await pickTab('Escanear QR');
      await new Promise((resolve) => setTimeout(resolve, 20));
      await settle();
      expect(el.querySelector('[data-testid="link-tabs"] [data-state="on"]')?.textContent?.trim()).toBe('Digitar código');
      expect(byId('link-notice')?.textContent).toContain('Não conseguimos usar a câmera. Digite o código');
      expect(byId('link-code')).not.toBeNull();
      expect(byId('link-scanner')).toBeNull();
    });

    it('câmera negada tem texto próprio', async () => {
      await create({
        camera: async () => {
          throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
        },
      });
      await pickTab('Escanear QR');
      await new Promise((resolve) => setTimeout(resolve, 20));
      await settle();
      expect(byId('link-notice')?.textContent).toContain('A câmera não foi liberada');
    });
  });

  describe('passo 2: o PIN com o mesmo componente da ativação (T073)', () => {
    it('título da barra, texto e resumo da variante de vincular; o código e o pet escolhidos', async () => {
      await create();
      await toPinStep();
      expect(text()).toContain('Vincular tag');
      expect(text()).toContain('Digite o PIN do cartão');
      expect(byId('activation-summary')?.textContent).toContain('Paçoca');
      expect(byId('activation-summary-code')?.textContent?.trim()).toBe(`Tag ${CODE}`);
      expect(byId('activation-summary-code')?.textContent).not.toContain('lida pelo QR');
      expect(byId('steps-text')?.textContent).toContain('Passo 2 de 2');
    });

    it('"Trocar" volta ao código, que continua preenchido', async () => {
      await create();
      await toPinStep();
      byId('activation-change-pet')!.click();
      await settle();
      expect(text()).toContain('Qual tag você vai usar?');
      expect((byId('link-code') as HTMLInputElement).value).toBe(CODE);
    });

    it('vincula: manda o código normalizado, o pet, sem troca e o WhatsApp explícito (começa desligado: Princípio II)', async () => {
      await create();
      await toPinStep();
      expect((el.querySelector('[data-testid="activation-whatsapp"] input') as HTMLInputElement).checked).toBe(false);
      expect(byId('activation-whatsapp-notice')?.textContent).toContain('Se você marcar');
      expect(byId('activation-whatsapp-notice')?.textContent).not.toContain('Você pode desligar');
      await typePin('K47Q9M');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      await settle();
      expect(activate).toHaveBeenCalledWith({ code: CODE, pin: 'K47Q9M', petId: 'p1', replace: false, enableWhatsapp: false });
      expect(text()).toContain('tem como');
      expect(byId('activation-done-page')?.getAttribute('href') ?? el.querySelector('a[href="/7K3MQ9XAC"]')?.getAttribute('href')).toBe('/7K3MQ9XAC');
    });

    it('marcar o WhatsApp manda true', async () => {
      await create();
      await toPinStep();
      (el.querySelector('[data-testid="activation-whatsapp"] input') as HTMLInputElement).click();
      await settle();
      await typePin('K47Q9M');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      expect(activate).toHaveBeenCalledWith(expect.objectContaining({ enableWhatsapp: true }));
    });

    it('PIN errado: mensagem do contrato, continua no passo do PIN', async () => {
      await create({ activateResult: { ok: false, error: 'wrong_pin' } });
      await toPinStep();
      await typePin('K47Q9M');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      await settle();
      expect(byId('activation-pin-error')?.textContent).toContain('PIN incorreto. Confira o cartão.');
      expect(text()).toContain('Digite o PIN do cartão');
    });

    it('celular sem confirmação: leva à confirmação e volta para este fluxo', async () => {
      await create({ activateResult: { ok: false, error: 'phone_not_confirmed' } });
      await toPinStep();
      await typePin('K47Q9M');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      await settle();
      expect(navigate).toHaveBeenCalledWith(['/auth/celular'], { queryParams: { returnUrl: '/vincular/p1' } });
    });

    it('o PIN não aparece em nenhum lugar da tela depois de enviado', async () => {
      await create({ activateResult: { ok: false, error: 'wrong_pin' } });
      await toPinStep();
      await typePin('K47Q9M');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      await settle();
      expect(el.innerHTML).not.toContain('K47Q9M');
      expect([...el.querySelectorAll('input')].some((i) => i.value === 'K47Q9M')).toBe(false);
    });
  });

  describe('estados', () => {
    it('pet que já tem tag: avisa e leva a "Gerenciar tag"', async () => {
      await create({ petId: 'p3' });
      expect(byId('link-taken')?.textContent).toContain('2FX8-CN73-F');
      expect(byId('link-taken-manage')?.getAttribute('href')).toBe('/app/pets/p3/tag');
    });

    it('pet que não é do tutor: caminho para a lista de pets', async () => {
      await create({ petId: 'outro' });
      expect(byId('link-missing-pets')?.getAttribute('href')).toBe('/app/pets');
    });

    it('falha de rede: "Tentar de novo"', async () => {
      await create({ dashboardFails: true });
      expect(byId('link-error')).not.toBeNull();
      expect(byId('link-retry')).not.toBeNull();
    });
  });
});
