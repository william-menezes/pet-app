import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import type { FaroIconName } from '@/shared/icons/faro-icons';

/** Cartão de informação: ícone, título e o texto projetado (contrato §5.7). */
@Component({
  selector: 'app-info-card',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-start gap-3 rounded-xl bg-card px-4 py-3.5' },
  template: `
    <ng-icon [name]="icon()" size="22" class="mt-px shrink-0 text-foreground" aria-hidden="true" />
    <div class="flex min-w-0 flex-col gap-0.5">
      <p class="text-[15px] font-semibold text-foreground" data-testid="info-card-title">{{ title() }}</p>
      <div class="text-sm leading-[1.45] text-text"><ng-content /></div>
    </div>
  `,
})
export class InfoCard {
  readonly icon = input.required<FaroIconName>();
  readonly title = input.required<string>();
}
