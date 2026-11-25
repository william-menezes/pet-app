import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Passos de um fluxo (contrato §5.10): barras em tinta, não lima, e o texto "Passo N de T". */
@Component({
  selector: 'app-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <div class="flex gap-1.5" aria-hidden="true">
      @for (bar of bars(); track $index) {
        <span class="h-[5px] flex-1 rounded-full" [class]="bar ? 'bg-foreground' : 'bg-border'" data-testid="steps-bar"></span>
      }
    </div>
    <p class="text-[13px] text-muted-foreground" data-testid="steps-text">{{ text() }}</p>
  `,
})
export class Steps {
  /** Passo atual, começando em 1. */
  readonly current = input.required<number>();
  readonly total = input.required<number>();

  protected readonly bars = computed(() =>
    Array.from({ length: Math.max(0, this.total()) }, (_, index) => index < this.current()),
  );
  protected readonly text = computed(() => $localize`Passo ${this.current()}:current: de ${this.total()}:total:`);
}
