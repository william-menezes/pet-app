import { ChangeDetectionStrategy, Component, input, model, output, viewChild } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardSwitchComponent } from '@/shared/components/switch';

/**
 * Linha de uma lista de interruptores (contrato §5.6): título, apoio e o interruptor à direita. Tinta seleciona:
 * ligado é tinta, nunca lima. Com `locked`, mostra "Sempre" no lugar do interruptor (item que não se desliga).
 *
 * O `data-testid` fica na linha; o teste acha o controle com `getByRole('switch')` dentro dela.
 */
@Component({
  selector: 'app-switch-row',
  imports: [ZardSwitchComponent, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-14 items-center gap-3 px-3.5 py-3' },
  template: `
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-[15px] font-semibold text-foreground" data-testid="switch-row-label">{{ label() }}</span>
      @if (hint(); as text) {
        <span class="text-[13px] leading-[1.35] text-muted-foreground" data-testid="switch-row-hint">{{ text }}</span>
      }
    </span>
    @if (locked()) {
      <span class="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground" data-testid="switch-row-locked">
        <ng-icon name="lock" size="16" aria-hidden="true" />
        <span i18n>Sempre</span>
      </span>
    } @else {
      <z-switch
        [zChecked]="checked()"
        [zDisabled]="disabled()"
        (zCheckedChange)="onToggle($event)">
        <span class="sr-only">{{ label() }}</span>
      </z-switch>
    }
  `,
})
export class SwitchRow {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly checked = model(false);
  readonly disabled = input(false);
  /** Item sem interruptor: aparece "Sempre". */
  readonly locked = input(false);
  private readonly control = viewChild(ZardSwitchComponent);

  /** Emitido a cada toque, com o valor novo. */
  readonly toggled = output<boolean>();

  /**
   * Põe o valor à força, também no interruptor por dentro. Serve para desfazer um toque que a tela recusou
   * (o interruptor já virou sozinho; sem isto ele ficaria diferente do valor que a tela guarda).
   */
  setChecked(value: boolean): void {
    this.checked.set(value);
    this.control()?.zChecked.set(value);
  }

  protected onToggle(value: boolean): void {
    this.checked.set(value);
    this.toggled.emit(value);
  }
}
