import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardAlertDialogImports } from '@/shared/components/alert-dialog';
import { ZardButtonComponent } from '@/shared/components/button';

import { PetService } from '../../../core/pets/pet.service';
import { tagErrorMessage } from '../../../core/tags/tag-errors';
import { TagService } from '../../../core/tags/tag.service';

type Phase = 'confirm' | 'pin';

/**
 * "Remover pet" (T071): botão e diálogo de confirmação. Pet com tag ativa: a confirmação diz que a tag será liberada,
 * a tag é liberada ANTES de o pet ser apagado (a chave estrangeira do vínculo é `ON DELETE SET NULL`: apagar primeiro
 * deixaria um vínculo ativo sem pet) e o PIN novo que a liberação gera aparece uma única vez, com "Anote agora. Ele
 * não aparece de novo." O PIN vive só neste componente (um signal que é apagado ao concluir e ao destruir): nunca em
 * storage, URL ou log.
 *
 * Se a tag foi liberada e a remoção do pet falhou, a tela continua no passo do PIN (ele já existe e é a única chance
 * de vê-lo) e oferece "Tentar remover de novo", que não libera a tag outra vez.
 */
@Component({
  selector: 'app-remove-pet',
  imports: [ZardAlertComponent, ZardAlertDialogImports, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <button type="button" z-button zType="danger" class="w-full" (click)="start()" data-testid="remove-pet-open" i18n>
      Remover pet
    </button>

    <z-alert-dialog [(zVisible)]="visible">
      @if (phase() === 'confirm') {
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
      } @else {
        <z-alert-dialog-header>
          <z-alert-dialog-title data-testid="remove-pet-pin-title">{{ pinTitle() }}</z-alert-dialog-title>
          <z-alert-dialog-description i18n>
            A tag {{ tagCode() }} voltou a ficar livre. Este é o PIN novo dela. Anote agora. Ele não aparece de novo.
          </z-alert-dialog-description>
        </z-alert-dialog-header>
        <p class="rounded-xl bg-inset px-4 py-3 text-center font-display text-[32px] leading-none font-bold tracking-[0.2em] text-foreground" data-testid="remove-pet-pin">
          {{ pin() }}
        </p>
        <div aria-live="polite">
          @if (problem(); as text) {
            <z-alert zType="danger" [zRole]="'status'" [zDescription]="text" data-testid="remove-pet-problem" />
          }
          @if (copied()) {
            <p class="text-center text-[13px] font-semibold text-muted-foreground" role="status" data-testid="remove-pet-copied" i18n>PIN copiado.</p>
          }
        </div>
        <z-alert-dialog-footer>
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
              (click)="confirm()"
              data-testid="remove-pet-retry"
              i18n>
              Tentar remover de novo
            </button>
          }
        </z-alert-dialog-footer>
      }
    </z-alert-dialog>
  `,
})
export class RemovePet {
  private readonly tags = inject(TagService);
  private readonly pets = inject(PetService);

  readonly petId = input.required<string>();
  readonly petName = input.required<string>();
  /** Tag ativa do pet (`XXXX-XXXX-X`) ou `null`. */
  readonly tagCode = input<string | null>(null);

  /** Emitido quando o pet foi removido (e, se havia tag, depois de o tutor ter visto o PIN novo). */
  readonly removed = output<void>();

  protected readonly visible = signal(false);
  protected readonly phase = signal<Phase>('confirm');
  protected readonly working = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly copied = signal(false);
  /** PIN novo da tag liberada; só existe no passo do PIN. */
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
  }

  protected start(): void {
    this.problem.set(null);
    this.phase.set('confirm');
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
      this.pin.set(released.newPin);
    }

    const removed = await this.pets.remove(this.petId());
    this.working.set(false);
    if (!removed.ok) {
      this.problem.set(
        this.tagReleased
          ? $localize`A tag foi liberada, mas não conseguimos remover ${this.petName()}:name:. Anote o PIN e tente de novo.`
          : $localize`Não conseguimos remover ${this.petName()}:name: agora. Verifique sua conexão e tente de novo.`,
      );
      if (this.tagReleased) this.phase.set('pin');
      return;
    }
    this.petRemoved.set(true);
    if (this.pin() === null) {
      this.visible.set(false);
      this.removed.emit();
      return;
    }
    this.phase.set('pin');
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

  protected finish(): void {
    this.pin.set(null);
    this.visible.set(false);
    this.removed.emit();
  }
}
