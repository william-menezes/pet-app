import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PetService } from '../../../core/pets/pet.service';
import { TagService } from '../../../core/tags/tag.service';
import { RemovePet } from './remove-pet';

const PET_ID = '11111111-1111-4111-8111-111111111111';

@Component({
  imports: [RemovePet],
  template: `<app-remove-pet [petId]="petId()" petName="Paçoca" [tagCode]="tagCode()" (removed)="removedCount.update((n) => n + 1)" />`,
})
class Host {
  readonly petId = signal(PET_ID);
  readonly tagCode = signal<string | null>(null);
  readonly removedCount = signal(0);
}

describe('RemovePet (T071)', () => {
  let fixture: ComponentFixture<Host>;
  let releaseTag: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  const order: string[] = [];

  const inDialog = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const click = async (id: string) => {
    inDialog(id)!.click();
    await settle();
  };

  async function create(opts: { tagCode?: string | null; releaseResult?: unknown; removeResults?: unknown[] } = {}) {
    order.length = 0;
    releaseTag = vi.fn(async () => {
      order.push('release');
      return opts.releaseResult ?? { ok: true, code: '7K3M-Q9XA-C', newPin: 'K47Q9M' };
    });
    const removeResults = [...(opts.removeResults ?? [{ ok: true }])];
    remove = vi.fn(async () => {
      order.push('remove');
      return removeResults.length > 1 ? removeResults.shift() : removeResults[0];
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TagService, useValue: { releaseTag } },
        { provide: PetService, useValue: { remove } },
      ],
    });
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.tagCode.set(opts.tagCode ?? null);
    fixture.detectChanges();
    await settle();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="remove-pet-open"]')!.click();
    await settle();
  }

  afterEach(() => {
    fixture?.destroy();
    document.querySelectorAll('.cdk-overlay-container > *').forEach((node) => node.remove());
  });

  it('pet sem tag: confirmação simples, remove sem liberar nada e avisa a tela (sem PIN)', async () => {
    await create();
    expect(inDialog('remove-pet-title')?.textContent).toContain('Remover Paçoca?');
    expect(inDialog('remove-pet-text')?.textContent).toContain('Não dá para desfazer');
    expect(inDialog('remove-pet-text')?.textContent).not.toContain('liberada');
    await click('remove-pet-confirm');
    expect(releaseTag).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(PET_ID);
    expect(fixture.componentInstance.removedCount()).toBe(1);
    expect(inDialog('remove-pet-pin')).toBeNull();
  });

  it('pet com tag: a confirmação diz que a tag é liberada; libera ANTES de remover e mostra o PIN novo uma vez', async () => {
    await create({ tagCode: '7K3M-Q9XA-C' });
    expect(inDialog('remove-pet-text')?.textContent).toContain('7K3M-Q9XA-C');
    expect(inDialog('remove-pet-text')?.textContent).toContain('liberada');
    await click('remove-pet-confirm');
    expect(order).toEqual(['release', 'remove']);
    expect(releaseTag).toHaveBeenCalledWith('7K3M-Q9XA-C', 'released');
    expect(inDialog('remove-pet-pin')?.textContent?.trim()).toBe('K47Q9M');
    expect(document.body.textContent).toContain('Anote agora. Ele não aparece de novo.');
    expect(fixture.componentInstance.removedCount()).toBe(0);
    expect(inDialog('remove-pet-pin-warning')?.textContent).toContain('Anote agora. Ele não aparece de novo.');
    // O PIN está numa seção da página, não no overlay do diálogo.
    expect(document.querySelector('.cdk-overlay-container [data-testid="remove-pet-pin"]')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="remove-pet-pin-panel"] [data-testid="remove-pet-pin"]')).not.toBeNull();
    // A tela do PIN só some pelo botão: o botão de abrir sai (não há como "remover de novo").
    expect(inDialog('remove-pet-open')).toBeNull();
    await click('remove-pet-done');
    expect(fixture.componentInstance.removedCount()).toBe(1);
    expect(inDialog('remove-pet-pin')).toBeNull();
  });

  it('Esc não esconde o PIN, e o foco vai para o título da seção', async () => {
    await create({ tagCode: '7K3M-Q9XA-C' });
    await click('remove-pet-confirm');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(inDialog('remove-pet-pin')?.textContent?.trim()).toBe('K47Q9M');
    expect(document.activeElement?.getAttribute('data-testid')).toBe('remove-pet-pin-title');
    expect(fixture.componentInstance.removedCount()).toBe(0);
  });

  it('"Copiar PIN" copia e avisa; trocar de pet apaga o PIN', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await create({ tagCode: '7K3M-Q9XA-C' });
    await click('remove-pet-confirm');
    await click('remove-pet-copy');
    expect(writeText).toHaveBeenCalledWith('K47Q9M');
    expect(inDialog('remove-pet-copied')).not.toBeNull();
    fixture.componentInstance.petId.set('22222222-2222-4222-8222-222222222222');
    await settle();
    expect(inDialog('remove-pet-pin')).toBeNull();
    expect(inDialog('remove-pet-open')).not.toBeNull();
  });

  it('o PIN não vai para storage, URL nem console', async () => {
    const log = vi.spyOn(console, 'log');
    const stored = vi.spyOn(Storage.prototype, 'setItem');
    await create({ tagCode: '7K3M-Q9XA-C' });
    await click('remove-pet-confirm');
    expect(stored.mock.calls.flat()).not.toContain('K47Q9M');
    expect(location.href).not.toContain('K47Q9M');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
    stored.mockRestore();
  });

  it('liberar a tag falhou: mostra o erro, não remove o pet e não há PIN', async () => {
    await create({ tagCode: '7K3M-Q9XA-C', releaseResult: { ok: false, error: 'not_owner' } });
    await click('remove-pet-confirm');
    expect(inDialog('remove-pet-problem')?.textContent).toContain('Não encontramos esta tag na sua conta.');
    expect(remove).not.toHaveBeenCalled();
    expect(inDialog('remove-pet-pin')).toBeNull();
  });

  it('tag liberada mas a remoção falhou: fica no PIN, avisa, e "Tentar de novo" não libera a tag outra vez', async () => {
    await create({ tagCode: '7K3M-Q9XA-C', removeResults: [{ ok: false, error: 'network' }, { ok: true }] });
    await click('remove-pet-confirm');
    expect(inDialog('remove-pet-pin')?.textContent?.trim()).toBe('K47Q9M');
    expect(inDialog('remove-pet-pin-problem')?.textContent).toContain('A tag foi liberada, mas não conseguimos remover Paçoca');
    expect(inDialog('remove-pet-done')).toBeNull();
    await click('remove-pet-retry');
    expect(releaseTag).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(inDialog('remove-pet-done')).not.toBeNull();
  });

  it('cancelar não chama nada', async () => {
    await create({ tagCode: '7K3M-Q9XA-C' });
    await click('remove-pet-cancel');
    expect(releaseTag).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('sem tag e a remoção falhou: mensagem de conexão e nada de PIN', async () => {
    await create({ removeResults: [{ ok: false, error: 'network' }] });
    await click('remove-pet-confirm');
    expect(inDialog('remove-pet-problem')?.textContent).toContain('Não conseguimos remover Paçoca agora.');
    expect(inDialog('remove-pet-pin')).toBeNull();
  });
});
