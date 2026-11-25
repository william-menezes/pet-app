import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import type { FaroIconName } from '@/shared/icons/faro-icons';
import { mergeClasses } from '@/shared/utils/merge-classes';

export type IconTileTone = 'neutral' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<IconTileTone, string> = {
  neutral: 'bg-inset text-foreground',
  success: 'bg-success-soft text-success-foreground',
  warning: 'bg-warning-soft text-warning-foreground',
  danger: 'bg-danger-soft text-danger-foreground',
};

/** Quadrado de 40px com um ícone de 20px (contrato §5.6). O ícone é decorativo. */
@Component({
  selector: 'app-icon-tile',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `<ng-icon [name]="icon()" size="20" aria-hidden="true" />`,
})
export class IconTile {
  readonly icon = input.required<FaroIconName>();
  readonly tone = input<IconTileTone>('neutral');

  protected readonly classes = computed(() =>
    mergeClasses('flex size-10 shrink-0 items-center justify-center rounded-md', TONE_CLASSES[this.tone()]),
  );
}
