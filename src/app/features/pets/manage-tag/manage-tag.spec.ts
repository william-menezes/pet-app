import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import { ZardSonnerService } from '@/shared/components/sonner';

import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet } from '../../../models';
import { ManageTag } from './manage-tag';

const CODE = '7K3M-Q9XA-C';

const pet = (over: Partial<DashboardPet> = {}): DashboardPet => ({
  id: 'p1',
  name: 'Paçoca',
  species: 'dog',
  photoPath: null,
  lostMode: false,
  lostSince: null,
  hasTag: true,
  tagCode: CODE,
  tagStatus: 'assigned',
  scansMonth: 0,
  lastScan: null,
  visibleShown: 2,
  visibleTotal: 5,
  ...over,
});

describe('ManageTag (T088 a T090)', () => {
  let fixture: ComponentFixture<ManageTag>;
  let el: HTMLElement;
  let tags: Record<'myDashboard' | 'assignmentStart' | 'releaseTag' | 'requestReplacement', ReturnType<typeof vi.fn>>;
  let sonner: { success: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const inDialog = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const clickEl = async (id: string) => {
    byId(id)!.click();
    await settle();
  };
  const clickDialog = async (id: string) => {
    inDialog(id)!.click();
    await settle();
  };

  async function create(over: Partial<typeof tags> = {}, dash: DashboardPet = pet()) {
    tags = {
      myDashboard: vi.fn().mockResolvedValue({ ok: true, dashboard: { pets: [dash], pendingActivation: null } }),
      assignmentStart: vi.fn().mockResolvedValue('2026-11-02T21:40:00Z'),
      releaseTag: vi.fn().mockResolvedValue({ ok: true, code: CODE, newPin: 'K47Q9M' }),
      requestReplacement: vi.fn().mockResolvedValue({ ok: true, requestId: 'req-1' }),
      ...over,
    };
    sonner = { success: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        { provide: TagService, useValue: tags },
        { provide: ZardSonnerService, useValue: sonner },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ManageTag);
    fixture.componentRef.setInput('petId', 'p1');
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  afterEach(() => {
    fixture?.destroy();
    document.querySelectorAll('.cdk-overlay-container > *').forEach((node) => node.remove());
  });

  it('mostra o cartão do código, desde quando e as quatro ações', async () => {
    await create();
    expect(byId('screen-header-title')?.textContent).toContain('Tag de Paçoca');
    expect(byId('manage-tag-code')?.textContent).toContain(CODE);
    expect(byId('manage-tag-since')?.textContent).toContain('Vinculada a Paçoca desde');
    expect(tags.assignmentStart).toHaveBeenCalledWith(CODE);
    for (const kind of ['transfer', 'damaged', 'lost', 'release']) expect(byId(`manage-tag-${kind}`), kind).not.toBeNull();
    expect(byId('manage-tag-transfer')?.textContent).toContain('Gera um PIN novo para o próximo dono');
    expect(byId('manage-tag-lost')?.textContent).toContain('Código novo; o antigo deixa de funcionar');
    expect(byId('manage-tag-release')?.textContent).toContain('Desvincular tag de Paçoca');
  });

  it('sem a data do vínculo, a tela segue sem ela', async () => {
    await create({ assignmentStart: vi.fn().mockResolvedValue(null) });
    expect(byId('manage-tag-since')?.textContent?.trim()).toBe('Vinculada a Paçoca');
  });

  describe('passar adiante e desvincular (T089)', () => {
    it('passar adiante: confirma, libera como "transferred" e mostra o PIN novo uma vez', async () => {
      await create();
      await clickEl('manage-tag-transfer');
      expect(inDialog('manage-tag-confirm-title')?.textContent).toContain(`Passar a tag ${CODE} adiante?`);
      expect(tags.releaseTag).not.toHaveBeenCalled();
      await clickDialog('manage-tag-confirm');
      expect(tags.releaseTag).toHaveBeenCalledWith(CODE, 'transferred');
      expect(byId('manage-tag-pin')?.textContent?.trim()).toBe('K47Q9M');
      expect(byId('manage-tag-pin-warning')?.textContent).toContain('Anote agora. Ele não aparece de novo.');
    });

    it('desvincular: libera como "released"', async () => {
      await create();
      await clickEl('manage-tag-release');
      expect(inDialog('manage-tag-confirm-text')?.textContent).toContain('Quem escanear não vê mais os dados de Paçoca');
      await clickDialog('manage-tag-confirm');
      expect(tags.releaseTag).toHaveBeenCalledWith(CODE, 'released');
      expect(byId('manage-tag-pin-title')?.textContent).toContain('desvinculada');
    });

    it('o PIN não fica em nenhum estado depois de concluir', async () => {
      await create();
      await clickEl('manage-tag-transfer');
      await clickDialog('manage-tag-confirm');
      expect(byId('manage-tag-pin')).not.toBeNull();
      await clickEl('manage-tag-done');
      expect((fixture.componentInstance as unknown as { pin: () => string | null }).pin()).toBeNull();
      expect(document.body.textContent).not.toContain('K47Q9M');
      expect(navigate).toHaveBeenCalledWith(['/app/pets', 'p1']);
      expect(sonner.success).toHaveBeenCalled();
    });

    it('o PIN não fica em nenhum estado depois de sair da tela (destruição) nem na URL', async () => {
      await create();
      await clickEl('manage-tag-transfer');
      await clickDialog('manage-tag-confirm');
      const component = fixture.componentInstance as unknown as { pin: () => string | null };
      expect(component.pin()).toBe('K47Q9M');
      fixture.destroy();
      expect(component.pin()).toBeNull();
      expect(location.href).not.toContain('K47Q9M');
    });

    it('"Copiar PIN" copia o PIN e avisa', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await create();
      await clickEl('manage-tag-transfer');
      await clickDialog('manage-tag-confirm');
      await clickEl('manage-tag-copy');
      expect(writeText).toHaveBeenCalledWith('K47Q9M');
      expect(byId('manage-tag-copied')).not.toBeNull();
    });

    it('cancelar a confirmação não libera nada', async () => {
      await create();
      await clickEl('manage-tag-transfer');
      await clickDialog('manage-tag-cancel');
      expect(tags.releaseTag).not.toHaveBeenCalled();
    });

    it('erro (not_owner, too_many_requests) fica na confirmação e nenhum PIN aparece', async () => {
      await create({ releaseTag: vi.fn().mockResolvedValue({ ok: false, error: 'too_many_requests', retryAfterSeconds: 60 }) });
      await clickEl('manage-tag-transfer');
      await clickDialog('manage-tag-confirm');
      expect(inDialog('manage-tag-problem')?.textContent).toContain('Muitas ações em pouco tempo. Aguarde 1 minuto.');
      expect(byId('manage-tag-pin')).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('2ª via (T090)', () => {
    it('danificada: confirma e mostra "Pedido registrado" com a tag continuando a funcionar', async () => {
      await create();
      await clickEl('manage-tag-damaged');
      expect(inDialog('manage-tag-confirm-text')?.textContent).toContain('A tag continua funcionando');
      await clickDialog('manage-tag-confirm');
      expect(tags.requestReplacement).toHaveBeenCalledWith(CODE, 'damaged');
      expect(byId('manage-tag-registered-title')?.textContent).toContain('Pedido registrado');
      expect(byId('manage-tag-registered-text')?.textContent).toContain('A tag continua funcionando');
      expect(tags.releaseTag).not.toHaveBeenCalled();
      await clickEl('manage-tag-registered-done');
      expect(navigate).toHaveBeenCalledWith(['/app/pets', 'p1']);
    });

    it('perdida: a confirmação explica que o endereço antigo para de funcionar, e o desfecho diz que foi anulado', async () => {
      await create();
      await clickEl('manage-tag-lost');
      const text = inDialog('manage-tag-confirm-text')?.textContent ?? '';
      expect(text).toContain('deixa de funcionar agora e não volta');
      expect(text).toContain('Não dá para desfazer');
      expect(tags.requestReplacement).not.toHaveBeenCalled();
      await clickDialog('manage-tag-confirm');
      expect(tags.requestReplacement).toHaveBeenCalledWith(CODE, 'lost');
      expect(byId('manage-tag-registered-text')?.textContent).toContain('O código antigo foi anulado');
    });

    it('replacement_limit mostra o limite com um próximo passo e não registra', async () => {
      await create({ requestReplacement: vi.fn().mockResolvedValue({ ok: false, error: 'replacement_limit' }) });
      await clickEl('manage-tag-damaged');
      await clickDialog('manage-tag-confirm');
      expect(inDialog('manage-tag-problem')?.textContent).toContain('Fale com o suporte');
      expect(byId('manage-tag-registered-title')).toBeNull();
    });
  });

  it('tag bloqueada: sem ações, com o aviso do suporte', async () => {
    await create({}, pet({ tagStatus: 'blocked' }));
    expect(byId('manage-tag-blocked')?.textContent).toContain('Tag bloqueada. Fale com o suporte.');
    expect(byId('manage-tag-actions')).toBeNull();
  });

  it('pet sem tag: convite para vincular', async () => {
    await create({}, pet({ hasTag: false, tagCode: null, tagStatus: null }));
    expect(byId('manage-tag-none')).not.toBeNull();
    expect(byId('manage-tag-link')?.getAttribute('href')).toBe('/vincular/p1');
  });

  it('limite de chamadas ao carregar: diz para aguardar e mantém "Tentar de novo"', async () => {
    await create({ myDashboard: vi.fn().mockResolvedValue({ ok: false, error: 'too_many_requests', retryAfterSeconds: 60 }) });
    expect(byId('manage-tag-error')?.textContent).toContain('Muitas ações em pouco tempo. Aguarde 1 minuto.');
    expect(byId('manage-tag-retry')).not.toBeNull();
  });

  it('pet que não é do tutor: "Não encontramos este pet"; erro de rede tem "Tentar de novo"', async () => {
    await create({ myDashboard: vi.fn().mockResolvedValue({ ok: true, dashboard: { pets: [], pendingActivation: null } }) });
    expect(byId('manage-tag-missing')).not.toBeNull();

    fixture.destroy();
    TestBed.resetTestingModule();
    await create({ myDashboard: vi.fn().mockResolvedValueOnce({ ok: false, error: 'network' }).mockResolvedValue({ ok: true, dashboard: { pets: [pet()], pendingActivation: null } }) });
    expect(byId('manage-tag-error')).not.toBeNull();
    await clickEl('manage-tag-retry');
    expect(byId('manage-tag-code')).not.toBeNull();
  });
});

describe('ManageTag: o PIN novo não está num diálogo (Esc não o tira da tela)', () => {
  it('Esc depois de liberar a tag não esconde o PIN: ele continua na página até o tutor concluir', async () => {
    const tags = {
      myDashboard: vi.fn().mockResolvedValue({ ok: true, dashboard: { pets: [pet()], pendingActivation: null } }),
      assignmentStart: vi.fn().mockResolvedValue(null),
      releaseTag: vi.fn().mockResolvedValue({ ok: true, code: CODE, newPin: 'K47Q9M' }),
      requestReplacement: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideIcons(faroIcons),
        { provide: TagService, useValue: tags },
        { provide: ZardSonnerService, useValue: { success: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ManageTag);
    fixture.componentRef.setInput('petId', 'p1');
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    fixture.detectChanges();
    await settle();
    await settle();
    el.querySelector<HTMLElement>('[data-testid="manage-tag-transfer"]')!.click();
    await settle();
    document.querySelector<HTMLElement>('[data-testid="manage-tag-confirm"]')!.click();
    await settle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(el.querySelector('[data-testid="manage-tag-pin"]')?.textContent?.trim()).toBe('K47Q9M');
    // O PIN está na página, dentro do componente, e não em overlay: nada de `document.body` o carrega.
    expect(el.contains(el.querySelector('[data-testid="manage-tag-pin"]'))).toBe(true);
    fixture.destroy();
  });
});
