import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * O cartão lima que pede uma ação (contrato §5.12). No máximo um por tela.
 * Projeção: conteúdo padrão (o texto) e `[action]` (um `z-button zType="ink" zSize="md"`).
 */
@Component({
  selector: 'app-action-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col rounded-2xl bg-primary p-[18px] text-primary-foreground md:p-[22px] xl:p-[26px]',
  },
  template: `
    <h2
      class="font-display text-[22px] leading-[1.12] font-bold tracking-[-0.02em] text-primary-foreground md:text-[26px] xl:text-[30px]"
      data-testid="action-card-title"
    >
      {{ title() }}
    </h2>
    <div class="mt-2 text-sm md:text-[15px] xl:text-base"><ng-content /></div>
    <div class="mt-3.5 self-start empty:hidden"><ng-content select="[action]" /></div>
  `,
})
export class ActionCard {
  readonly title = input.required<string>();
}
