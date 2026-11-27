import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardAlertDialogImports } from '@/shared/components/alert-dialog';
import { ZardButtonComponent } from '@/shared/components/button';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { SwitchRow } from '@/shared/components/faro/switch-row/switch-row';

import { tagErrorMessage } from '../../../../core/tags/tag-errors';
import { TagService } from '../../../../core/tags/tag.service';
import { lostElapsedLabel } from '../../lost-elapsed';

/**
 * Linha "Modo perdido" da página do pet (T062; referência `V2-pet*.dc.html`).
 *
 * Desligado: tocar no interruptor leva à tela do modo perdido (ligar pede recado e opções), e o interruptor
 * volta a desligado. Ligado: tocar abre a confirmação "Pet encontrado" (diálogo de decisão, só dentro do app);
 * só confirmando o alerta sai da página da tag. Cancelar deixa tudo como estava.
 */
@Component({
  selector: 'app-pet-lost-row',
  imports: [IconTile, SwitchRow, ZardAlertComponent, ZardAlertDialogImports, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-center overflow-hidden rounded-2xl bg-card" data-testid="lost-row">
      <app-icon-tile class="ml-3.5" icon="warn" tone="warning" />
      <app-switch-row
        class="min-w-0 flex-1"
        [label]="label()"
        [hint]="hint()"
        [checked]="lostMode()"
        (toggled)="onToggle($event)"
        data-testid="lost-row-switch" />
    </div>

    @if (problem(); as text) {
      <z-alert class="mt-2" zType="danger" [zRole]="'status'" [zDescription]="text" data-testid="lost-row-problem" />
    }

    <z-alert-dialog [(zVisible)]="confirming">
      <z-alert-dialog-header>
        <z-alert-dialog-title data-testid="lost-row-dialog-title">{{ dialogTitle() }}</z-alert-dialog-title>
        <z-alert-dialog-description i18n>
          O alerta sai da página da tag. Você continua recebendo um aviso a cada scan.
        </z-alert-dialog-description>
      </z-alert-dialog-header>
      <z-alert-dialog-footer>
        <button
          type="button"
          z-button
          zType="outline"
          zSize="lg"
          [zDisabled]="saving()"
          (click)="cancel()"
          data-testid="lost-row-cancel"
          i18n>
          Cancelar
        </button>
        <button
          type="button"
          z-button
          zSize="lg"
          [zLoading]="saving()"
          [zDisabled]="saving()"
          (click)="confirm()"
          data-testid="lost-row-confirm"
          i18n>
          Pet encontrado
        </button>
      </z-alert-dialog-footer>
    </z-alert-dialog>
  `,
})
export class PetLostRow {
  private readonly tags = inject(TagService);
  private readonly router = inject(Router);
  private readonly row = viewChild.required(SwitchRow);

  readonly petId = input.required<string>();
  readonly petName = input.required<string>();
  readonly lostMode = input(false);
  /** Quando o alerta foi ligado (ISO 8601). */
  readonly lostSince = input<string | null>(null);

  /** Emitido depois que o modo perdido foi desligado no servidor. */
  readonly found = output<void>();

  protected readonly confirming = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<string | null>(null);

  protected readonly label = computed(() => $localize`Modo perdido`);
  protected readonly hint = computed(() => {
    const since = this.lostSince();
    if (!this.lostMode()) return $localize`Mostra um alerta na página da tag`;
    const elapsed = since === null ? null : lostElapsedLabel(since);
    return elapsed === null ? $localize`Alerta ligado na página da tag` : $localize`Ligado ${elapsed}:elapsed:`;
  });
  protected readonly dialogTitle = computed(() => $localize`${this.petName()}:name: foi encontrado?`);

  protected onToggle(value: boolean): void {
    this.problem.set(null);
    // O interruptor virou sozinho; quem decide o valor é o servidor, depois da tela do modo perdido ou da confirmação.
    this.row().setChecked(this.lostMode());
    if (value) {
      void this.router.navigate(['/app/pets', this.petId(), 'modo-perdido']);
      return;
    }
    this.confirming.set(true);
  }

  protected cancel(): void {
    this.confirming.set(false);
  }

  protected async confirm(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const res = await this.tags.setLostMode({ petId: this.petId(), on: false, showSince: true, showReward: false });
    this.saving.set(false);
    this.confirming.set(false);
    if (!res.ok) {
      this.problem.set(tagErrorMessage(res.error, res.retryAfterSeconds));
      return;
    }
    this.found.emit();
  }
}
