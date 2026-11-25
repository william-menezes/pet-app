import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardAlertDialogImports } from '@/shared/components/alert-dialog';
import { ZardButtonComponent } from '@/shared/components/button';

import { PetService } from '../../../core/pets/pet.service';
import { tagErrorMessage } from '../../../core/tags/tag-errors';
import { TagService } from '../../../core/tags/tag.service';

/**
 * "Remover pet" (T071): botão e diálogo de confirmação. Pet com tag ativa: a confirmação diz que a tag será liberada,
 * a tag é liberada ANTES de o pet ser apagado (a chave estrangeira do vínculo é `ON DELETE SET NULL`: apagar primeiro
 * deixaria um vínculo ativo sem pet) e o PIN novo que a liberação gera aparece uma única vez.
 *
 * O PIN NÃO fica num diálogo (o `z-alert-dialog` fecha com Esc e esta é a única vez em que o PIN é mostrado): fica numa
 * seção da página, para a qual a tela rola e o foco vai depois que o diálogo de confirmação termina de fechar
 * (`zAfterClose`: o overlay devolve a rolagem de antes ao sair e desfaria o foco). Ele só some quando o tutor conclui
 * (botão), ao trocar de pet ou ao sair da rota. Vive só neste componente (um signal): nunca em storage, URL ou log.
 *
 * Se a tag foi liberada e a remoção do pet falhou, a seção continua com o PIN (ele já existe e é a única chance de vê-lo)
 * e oferece "Tentar remover de novo", que não libera a tag outra vez.
 */
@Component({
  selector: 'app-remove-pet',
  imports: [ZardAlertComponent, ZardAlertDialogImports, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
    @if (pin() === null) {
      <button type="button" z-button zType="danger" class="w-full" (click)="start()" data-testid="remove-pet-open" i18n>
        Remover pet
      </button>
    }

    <z-alert-dialog [(zVisible)]="visible" (zAfterClose)="onDialogClosed()">
      <z-alert-dialog-header>
        <z-alert-dialog-title data-testid="remove-pet-title">{{ title() }}</z-alert-dialog-title>
        <z-alert-dialog-description data-testid="remove-pet-text">{{ description() }}</z-alert-dialog-description>
      </z-alert-dialog-header>
      <div aria-live="polite">
        @if (problem(); as text) {
          <z-alert zType="danger" [zRole]="'status'" [zDescription]="text" data-testid="remove-pet-problem" />
        }
      </div>
      <z-alert-dialog-footer>
        <button type="button" z-button zType="outline" zSize="lg" [zDisabled]="working()" (click)="cancel()" data-testid="remove-pet-cancel" i18n>
          Cancelar
        </button>
        <button
          type="button"
          z-button
          zType="destructive"
          zSize="lg"
          [zLoading]="working()"
          [zDisabled]="working()"
          (click)="confirm()"
          data-testid="remove-pet-confirm"
          i18n>
          Remover pet
        </button>
      </z-alert-dialog-footer>
    </z-alert-dialog>

    @if (pin(); as pinValue) {
      <section class="flex w-full flex-col gap-3 rounded-2xl bg-card p-5" aria-labelledby="remove-pet-pin-title" data-testid="remove-pet-pin-panel">
        <h2
          id="remove-pet-pin-title"
          tabindex="-1"
          class="font-display text-[22px] font-semibold text-foreground outline-none"
          data-testid="remove-pet-pin-title">
          {{ pinTitle() }}
        </h2>
        <p class="text-[15px] leading-[1.45] text-text" i18n>A tag {{ tagCode() }} voltou a ficar livre. Este é o PIN novo dela.</p>
        <p
          class="rounded-xl bg-inset px-4 py-3 text-center font-display text-[32px] leading-none font-bold tracking-[0.2em] text-foreground"
          data-testid="remove-pet-pin">
          {{ pinValue }}
        </p>
        <p class="text-center text-[15px] font-semibold text-foreground" data-testid="remove-pet-pin-warning" i18n>
          Anote agora. Ele não aparece de novo.
        </p>
        <div aria-live="polite">
          @if (problem(); as text) {
            <z-alert zType="danger" [zRole]="'status'" [zDescription]="text" data-testid="remove-pet-pin-problem" />
          }
          @if (copied()) {
            <p class="text-center text-[13px] font-semibold text-muted-foreground" role="status" data-testid="remove-pet-copied" i18n>PIN copiado.</p>
          }
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="button" z-button zType="outline" zSize="lg" (click)="copy()" data-testid="remove-pet-copy" i18n>Copiar PIN</button>
          @if (petRemoved()) {
            <button type="button" z-button zSize="lg" (click)="finish()" data-testid="remove-pet-done" i18n>Concluir</button>
          } @else {
            <button
              type="button"
              z-button
              zSize="lg"
              [zLoading]="working()"
              [zDisabled]="working()"
              (click)="retry()"
              data-testid="remove-pet-retry"
              i18n>
              Tentar remover de novo
            </button>
          }
        </div>
      </section>
    }
  `,
})
export class RemovePet {
  private readonly tags = inject(TagService);
  private readonly pets = inject(PetService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly petId = input.required<string>();
  readonly petName = input.required<string>();
  /** Tag ativa do pet (`XXXX-XXXX-X`) ou `null`. */
  readonly tagCode = input<string | null>(null);

  /** Emitido quando o pet foi removido (e, se havia tag, depois de o tutor ter concluído a tela do PIN novo). */
  readonly removed = output<void>();

  protected readonly visible = signal(false);
  protected readonly working = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly copied = signal(false);
  /** PIN novo da tag liberada; só existe depois da liberação e some ao concluir, ao trocar de pet e ao destruir. */
  protected readonly pin = signal<string | null>(null);
  protected readonly petRemoved = signal(false);
  private tagReleased = false;

  protected readonly title = computed(() => $localize`Remover ${this.petName()}:name:?`);
  protected readonly pinTitle = computed(() => (this.petRemoved() ? $localize`${this.petName()}:name: foi removido` : $localize`A tag foi liberada`));
  protected readonly description = computed(() => {
    const name = this.petName();
    const code = this.tagCode();
    return code === null
      ? $localize`Os dados e a foto de ${name}:name: são apagados. Não dá para desfazer.`
      : $localize`Os dados e a foto de ${name}:name: são apagados e a tag ${code}:code: é liberada: ela volta a ficar livre e pode ser usada em outro pet. Você vai ver o PIN novo dela uma única vez. Não dá para desfazer.`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pin.set(null));
    // Outro pet: nada do estado do anterior (principalmente o PIN) fica.
    effect(() => {
      this.petId();
      untracked(() => this.reset());
    });
  }

  private reset(): void {
    this.pin.set(null);
    this.copied.set(false);
    this.problem.set(null);
    this.petRemoved.set(false);
    this.tagReleased = false;
    this.visible.set(false);
  }

  protected start(): void {
    this.problem.set(null);
    this.visible.set(true);
  }

  protected cancel(): void {
    this.visible.set(false);
  }

  protected async confirm(): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    this.problem.set(null);

    const code = this.tagCode();
    if (code !== null && !this.tagReleased) {
      const released = await this.tags.releaseTag(code, 'released');
      if (!released.ok) {
        this.working.set(false);
        this.problem.set(tagErrorMessage(released.error, released.retryAfterSeconds));
        return;
      }
      this.tagReleased = true;
      this.copied.set(false);
      this.pin.set(released.newPin);
    }
    await this.removePet();
  }

  /** "Tentar remover de novo": a tag já foi liberada, só falta o pet. */
  protected async retry(): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    this.problem.set(null);
    await this.removePet();
  }

  private async removePet(): Promise<void> {
    const removed = await this.pets.remove(this.petId());
    this.working.set(false);
    if (!removed.ok) {
      this.problem.set(
        this.tagReleased
          ? $localize`A tag foi liberada, mas não conseguimos remover ${this.petName()}:name:. Anote o PIN e tente de novo.`
          : $localize`Não conseguimos remover ${this.petName()}:name: agora. Verifique sua conexão e tente de novo.`,
      );
      // Tag liberada: o PIN já existe; fecha o diálogo e deixa o PIN (e o erro) à vista na página.
      if (this.tagReleased) this.closeToPin();
      return;
    }
    this.petRemoved.set(true);
    if (this.pin() === null) {
      this.visible.set(false);
      this.removed.emit();
      return;
    }
    this.closeToPin();
  }

  private closeToPin(): void {
    this.visible.set(false);
    this.focusPin();
  }

  /** O diálogo terminou de fechar: o overlay devolve a rolagem de antes e desfaria a primeira chamada; leva a seção do PIN à tela de novo. */
  protected onDialogClosed(): void {
    if (this.pin() !== null) this.focusPin();
  }

  /** O botão que abriu o diálogo sai do DOM e a tela pode estar rolada até ele: leva a seção e o foco para o PIN. */
  private focusPin(): void {
    afterNextRender(
      () => {
        const title = this.host.nativeElement.querySelector<HTMLElement>('#remove-pet-pin-title');
        title?.scrollIntoView?.({ block: 'center' });
        title?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  protected async copy(): Promise<void> {
    const pin = this.pin();
    if (pin === null) return;
    try {
      await navigator.clipboard.writeText(pin);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  /** Concluir: o PIN sai da memória e a tela segue. */
  protected finish(): void {
    this.pin.set(null);
    this.copied.set(false);
    this.visible.set(false);
    this.removed.emit();
  }
}
