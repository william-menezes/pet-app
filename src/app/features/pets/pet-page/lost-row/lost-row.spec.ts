import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { TagService } from '../../../../core/tags/tag.service';
import { PetLostRow } from './lost-row';

const PET_ID = '11111111-1111-4111-8111-111111111111';

@Component({
  imports: [PetLostRow],
  template: `<app-pet-lost-row
    [petId]="petId"
    petName="Paçoca"
    [lostMode]="lostMode()"
    [lostSince]="since()"
    (found)="foundCount.update((n) => n + 1)" />`,
})
class Host {
  readonly petId = PET_ID;
  readonly lostMode = signal(false);
  readonly since = signal<string | null>(null);
  readonly foundCount = signal(0);
}

describe('PetLostRow (T062)', () => {
  let fixture: ComponentFixture<Host>;
  let el: HTMLElement;
  let setLostMode: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const inDialog = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const sw = () => el.querySelector<HTMLButtonElement>('button[role="switch"]')!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  async function create(opts: { lostMode?: boolean; since?: string | null; result?: unknown } = {}) {
    setLostMode = vi.fn().mockResolvedValue(opts.result ?? { ok: true });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: TagService, useValue: { setLostMode } }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Host);
    el = fixture.nativeElement;
    fixture.componentInstance.lostMode.set(opts.lostMode ?? false);
    fixture.componentInstance.since.set(opts.since ?? null);
    fixture.detectChanges();
    await settle();
  }

  afterEach(() => {
    fixture?.destroy();
    document.querySelectorAll('.cdk-overlay-container > *').forEach((node) => node.remove());
  });

  it('desligado: o interruptor leva à tela do modo perdido e continua desligado', async () => {
    await create();
    expect(byId('lost-row')?.textContent).toContain('Mostra um alerta na página da tag');
    expect(sw().getAttribute('aria-checked')).toBe('false');
    sw().click();
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/app/pets', PET_ID, 'modo-perdido']);
    expect(sw().getAttribute('aria-checked')).toBe('false');
    expect(setLostMode).not.toHaveBeenCalled();
  });

  it('ligado: mostra há quanto tempo; tocar abre a confirmação e o interruptor segue ligado', async () => {
    await create({ lostMode: true, since: new Date(Date.now() - 2 * 3_600_000).toISOString() });
    expect(byId('lost-row')?.textContent).toContain('Ligado há 2 horas');
    expect(sw().getAttribute('aria-checked')).toBe('true');
    sw().click();
    await settle();
    expect(sw().getAttribute('aria-checked')).toBe('true');
    expect(inDialog('lost-row-dialog-title')?.textContent).toContain('Paçoca foi encontrado?');
    expect(setLostMode).not.toHaveBeenCalled();
  });

  it('"Pet encontrado" desliga o modo perdido no servidor e avisa a tela', async () => {
    await create({ lostMode: true, since: new Date().toISOString() });
    sw().click();
    await settle();
    inDialog('lost-row-confirm')!.click();
    await settle();
    expect(setLostMode).toHaveBeenCalledWith({ petId: PET_ID, on: false, showSince: true, showReward: false });
    expect(fixture.componentInstance.foundCount()).toBe(1);
  });

  it('cancelar não chama o servidor nem avisa a tela', async () => {
    await create({ lostMode: true, since: new Date().toISOString() });
    sw().click();
    await settle();
    inDialog('lost-row-cancel')!.click();
    await settle();
    expect(setLostMode).not.toHaveBeenCalled();
    expect(fixture.componentInstance.foundCount()).toBe(0);
    expect(sw().getAttribute('aria-checked')).toBe('true');
  });

  it('erro ao desligar: a mensagem aparece e a tela não é avisada', async () => {
    await create({ lostMode: true, since: new Date().toISOString(), result: { ok: false, error: 'network' } });
    sw().click();
    await settle();
    inDialog('lost-row-confirm')!.click();
    await settle();
    expect(byId('lost-row-problem')?.textContent).toContain('Não conseguimos conectar');
    expect(fixture.componentInstance.foundCount()).toBe(0);
  });
});
