import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import type { FaroIconName } from '@/shared/icons/faro-icons';

/** Nota: ícone de 18px e uma frase pequena em cinza (contrato §5.8). */
@Component({
  selector: 'app-note',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-start gap-2.5 text-[13px] leading-[1.45] text-muted-foreground' },
  template: `
    <ng-icon [name]="icon()" size="18" class="mt-px shrink-0" aria-hidden="true" />
    <span class="min-w-0"><ng-content /></span>
  `,
})
export class Note {
  readonly icon = input.required<FaroIconName>();
}
