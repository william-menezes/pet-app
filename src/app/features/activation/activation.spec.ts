import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import type { DashboardPet } from '../../models';
import { PetService } from '../../core/pets/pet.service';
import { TagService, type TagResult, type ActivationResult } from '../../core/tags/tag.service';
import { Activation } from './activation';

// Códigos e ids sintéticos (contracts/tag-code.vectors.json); nada de lote real.
const CODE = '7K3M-Q9XA-C';
const NORMALIZED = '7K3MQ9XAC';

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
const MEL = pet({ id: 'p2', name: 'Mel', species: 'cat', hasTag: true, tagCode: '2FX8-CN73-F', tagStatus: 'assigned' });

const OK: TagResult<ActivationResult> = { ok: true, code: CODE, petId: 'p1', petName: 'Paçoca', whatsappEnabled: true };

describe('Activation', () => {
  let fixture: ComponentFixture<Activation>;
  let el: HTMLElement;
  let myDashboard: ReturnType<typeof vi.fn>;
  let activate: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const text = () => el.textContent ?? '';
  const click = (id: string) => (byId(id) as HTMLElement).click();

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(
    opts: { code?: string; petParam?: string; pets?: DashboardPet[] | 'error'; activateResult?: TagResult<ActivationResult> } = {},
  ) {
    myDashboard = vi
      .fn()
      .mockResolvedValue(
        opts.pets === 'error'
          ? { ok: false, error: 'network' }
          : { ok: true, dashboard: { pets: opts.pets ?? [PACOCA, MEL], pendingActivation: null } },
      );
    activate = vi.fn().mockResolvedValue(opts.activateResult ?? OK);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TagService, useValue: { myDashboard, activate } },
        { provide: PetService, useValue: { photoUrls: vi.fn().mockResolvedValue({}) } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Activation);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('code', opts.code ?? NORMALIZED);
    if (opts.petParam !== undefined) fixture.componentRef.setInput('pet', opts.petParam);
    fixture.detectChanges();
    await settle();
    await settle();
  }

  async function pickPet(id: string) {
    (el.querySelector(`[data-testid="activation-pet-${id}"] input`) as HTMLInputElement).click();
    await settle();
    click('activation-continue');
    await settle();
  }

  async function typePin(pin: string) {
    const first = byId('activation-pin-cell-1') as HTMLInputElement;
    first.value = pin;
    first.dispatchEvent(new Event('input'));
    await settle();
    await settle();
  }

  async function submitPin() {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    await settle();
  }

  describe('passo 1: escolher o pet (T043)', () => {
    it('mostra o código na forma de exibição e os pets, com "sem tag" e "com tag"', async () => {
      await create();
      expect(byId('activation-code')?.textContent).toContain(CODE);
      expect(text()).toContain('Para qual pet é esta tag?');
      expect(byId('activation-pet-p1')?.textContent).toContain('Paçoca');
      expect(byId('activation-pet-p1')?.textContent).toContain('Cão · sem tag');
      expect(byId('activation-pet-p2')?.textContent).toContain('Gato · com tag');
    });

    it('Continuar só habilita depois de escolher; pet sem tag vai direto para o PIN, sem pedir troca', async () => {
      await create();
      expect((byId('activation-continue') as HTMLButtonElement).disabled).toBe(true);
      await pickPet('p1');
      expect(byId('activation-replace')).toBeNull();
      expect(text()).toContain('Agora, o PIN do cartão');
    });

    it('pet com tag pede confirmação antes do PIN, e "Escolher outro pet" desfaz', async () => {
      await create();
      (el.querySelector('[data-testid="activation-pet-p2"] input') as HTMLInputElement).click();
      await settle();
      click('activation-continue');
      await settle();
      expect(byId('activation-replace')?.textContent).toContain('2FX8-CN73-F');
      expect(text()).not.toContain('Agora, o PIN do cartão');
      click('activation-replace-cancel');
      await settle();
      expect(byId('activation-replace')).toBeNull();
      expect(byId('activation-continue')).not.toBeNull();
    });

    it('confirmada a troca, o envio leva replace = true', async () => {
      await create();
      (el.querySelector('[data-testid="activation-pet-p2"] input') as HTMLInputElement).click();
      await settle();
      click('activation-continue');
      await settle();
      click('activation-replace-confirm');
      await settle();
      await typePin('K47Q9M');
      await submitPin();
      expect(activate).toHaveBeenCalledWith(expect.objectContaining({ petId: 'p2', replace: true }));
    });

    it('?pet=<id> pré-seleciona o pet (volta de "Novo pet")', async () => {
      await create({ petParam: 'p1' });
      expect((el.querySelector('[data-testid="activation-pet-p1"] input') as HTMLInputElement).checked).toBe(true);
      expect((byId('activation-continue') as HTMLButtonElement).disabled).toBe(false);
    });

    it('"Cadastrar um pet novo" abre /novo-pet com a volta para a ativação', async () => {
      await create();
      click('activation-add-pet');
      expect(navigate).toHaveBeenCalledWith(['/novo-pet'], { queryParams: { returnUrl: `/ativar/${NORMALIZED}` } });
    });

    it('sem pets: mensagem e o caminho para cadastrar; erro de carga: tentar de novo', async () => {
      await create({ pets: [] });
      expect(byId('activation-no-pets')).not.toBeNull();
      expect(byId('activation-add-pet')).not.toBeNull();
      TestBed.resetTestingModule();
      await create({ pets: 'error' });
      expect(byId('activation-pets-error')).not.toBeNull();
      myDashboard.mockResolvedValue({ ok: true, dashboard: { pets: [PACOCA], pendingActivation: null } });
      click('activation-retry');
      await settle();
      await settle();
      expect(byId('activation-pet-p1')).not.toBeNull();
    });

    it('código inválido na URL: mesma mensagem do contrato e o painel como próximo passo', async () => {
      await create({ code: '7K3M-Q9XA-D' });
      expect(byId('activation-invalid-text')?.textContent).toBe('Confira o código. Ele fica embaixo do QR.');
      expect(byId('activation-invalid-panel')).not.toBeNull();
      expect(myDashboard).not.toHaveBeenCalled();
    });
  });

  describe('passo 2: PIN (T046)', () => {
    beforeEach(async () => {
      await create();
      await pickPet('p1');
    });

    it('seis células, resumo com "Trocar" e o aviso do WhatsApp visível, com o controle marcado', () => {
      for (let n = 1; n <= 6; n += 1) expect(byId(`activation-pin-cell-${n}`), `cell-${n}`).not.toBeNull();
      expect(byId('activation-summary')?.textContent).toContain('Paçoca');
      expect(byId('activation-summary')?.textContent).toContain(CODE);
      expect(byId('activation-change-pet')).not.toBeNull();
      const box = byId('activation-whatsapp')?.querySelector('input') as HTMLInputElement;
      expect(box.checked).toBe(true);
      expect(byId('activation-whatsapp')?.textContent).toContain('Quero que quem achar Paçoca possa me chamar no WhatsApp');
      expect(byId('activation-whatsapp-notice')?.textContent).toContain(
        'Seu WhatsApp vai aparecer na página de Paçoca para quem escanear a tag.',
      );
    });

    it('Ativar tag só habilita com seis caracteres', async () => {
      expect((byId('activation-submit') as HTMLButtonElement).disabled).toBe(true);
      await typePin('K47Q9');
      expect((byId('activation-submit') as HTMLButtonElement).disabled).toBe(true);
      await typePin('K47Q9M');
      expect((byId('activation-submit') as HTMLButtonElement).disabled).toBe(false);
    });

    it('envia o WhatsApp marcado de forma explícita, o PIN uma vez, e apaga as células', async () => {
      await typePin('K47Q9M');
      await submitPin();
      expect(activate).toHaveBeenCalledTimes(1);
      expect(activate).toHaveBeenCalledWith({
        code: NORMALIZED,
        pin: 'K47Q9M',
        petId: 'p1',
        replace: false,
        enableWhatsapp: true,
      });
    });

    it('com o controle desmarcado envia enableWhatsapp = false', async () => {
      (byId('activation-whatsapp')?.querySelector('input') as HTMLInputElement).click();
      await settle();
      await typePin('K47Q9M');
      await submitPin();
      expect(activate).toHaveBeenCalledWith(expect.objectContaining({ enableWhatsapp: false }));
    });

    it('wrong_pin: mensagem do contrato, células apagadas, continua no passo do PIN', async () => {
      activate.mockResolvedValue({ ok: false, error: 'wrong_pin' });
      await typePin('K47Q9M');
      await submitPin();
      expect(byId('activation-pin-error')?.textContent).toContain('PIN incorreto. Confira o cartão.');
      expect((byId('activation-pin-cell-1') as HTMLInputElement).value).toBe('');
      expect((byId('activation-submit') as HTMLButtonElement).disabled).toBe(true);
      expect(byId('activation-pin-cell-1')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('locked: mensagem com o tempo que o servidor informou', async () => {
      activate.mockResolvedValue({ ok: false, error: 'locked', retryAfterSeconds: 540 });
      await typePin('K47Q9M');
      await submitPin();
      expect(byId('activation-pin-error')?.textContent).toContain('Muitas tentativas. Tente de novo em 9 minutos.');
    });

    it('phone_not_confirmed: leva a /auth/celular e volta para a ativação com o pet, sem PIN na URL', async () => {
      activate.mockResolvedValue({ ok: false, error: 'phone_not_confirmed' });
      await typePin('K47Q9M');
      await submitPin();
      expect(navigate).toHaveBeenCalledWith(['/auth/celular'], {
        queryParams: { returnUrl: `/ativar/${NORMALIZED}?pet=p1` },
      });
      const calls = JSON.stringify(navigate.mock.calls);
      expect(calls).not.toContain('K47Q9M');
    });

    it('tag_unavailable e rede também terminam numa mensagem, sem sair do passo', async () => {
      activate.mockResolvedValue({ ok: false, error: 'tag_unavailable' });
      await typePin('K47Q9M');
      await submitPin();
      expect(byId('activation-pin-error')?.textContent).toContain('Não é possível usar esta tag. Fale com o suporte.');
      activate.mockResolvedValue({ ok: false, error: 'network' });
      await typePin('K47Q9M');
      await submitPin();
      expect(byId('activation-pin-error')?.textContent).toContain('Não conseguimos conectar');
    });

    it('pet_has_tag (lista velha): volta ao passo 1 pedindo a confirmação da troca', async () => {
      activate.mockResolvedValue({ ok: false, error: 'pet_has_tag' });
      await typePin('K47Q9M');
      await submitPin();
      expect(byId('activation-replace')).not.toBeNull();
      expect(text()).toContain('já tem uma tag');
    });

    it('pet_not_found: volta ao passo 1 com o aviso e recarrega a lista', async () => {
      activate.mockResolvedValue({ ok: false, error: 'pet_not_found' });
      myDashboard.mockClear();
      await typePin('K47Q9M');
      await submitPin();
      expect(byId('activation-notice')?.textContent).toContain('Não encontramos este pet.');
      expect(myDashboard).toHaveBeenCalledTimes(1);
    });

    it('"Trocar" volta ao passo 1', async () => {
      click('activation-change-pet');
      await settle();
      expect(text()).toContain('Para qual pet é esta tag?');
    });
  });

  describe('passo final: Tag ativa! (T047)', () => {
    async function activateOk(result: TagResult<ActivationResult>) {
      await create({ activateResult: result });
      await pickPet('p1');
      await typePin('K47Q9M');
      await submitPin();
    }

    it('mostra o nome do pet, o código e "WhatsApp liberado para quem escanear"', async () => {
      await activateOk(OK);
      expect(text()).toContain('Tag ativa!');
      expect(byId('activation-done-text')?.textContent).toContain(CODE);
      expect(byId('activation-done-text')?.textContent).toContain('Paçoca');
      expect(byId('activation-done-whatsapp')?.textContent).toContain('WhatsApp liberado para quem escanear');
      expect(byId('activation-done-whatsapp-on')).toBeNull();
    });

    it('sem WhatsApp: "WhatsApp desligado" e o atalho "Ligar agora" para O que estranhos veem', async () => {
      await activateOk({ ...OK, whatsappEnabled: false } as TagResult<ActivationResult>);
      expect(byId('activation-done-whatsapp')?.textContent).toContain('WhatsApp desligado');
      expect(byId('activation-done-whatsapp-on')?.getAttribute('href')).toBe('/app/pets/p1/visibilidade');
    });

    it('"Ver a página" é um link simples (<a href>) para /<código>', async () => {
      await activateOk(OK);
      const link = byId('activation-view-page') as HTMLAnchorElement;
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toBe(`/${NORMALIZED}`);
      expect(link.textContent).toContain('Ver a página de Paçoca');
      expect(byId('activation-go-panel')?.getAttribute('href')).toBe('/app');
    });
  });
});
