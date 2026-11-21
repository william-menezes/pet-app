import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Focinho } from '../focinho/focinho';

const SIZE_CLASSES = {
  44: 'size-11',
  52: 'size-[52px]',
  56: 'size-14',
} as const;

/** Círculo branco com o focinho lima, no canto de cima da foto nas páginas públicas (contrato §5.5). */
@Component({
  selector: 'app-brand-mark',
  imports: [Focinho],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `<app-focinho class="w-[60%] text-primary" label="Faro" i18n-label />`,
})
export class BrandMark {
  readonly size = input<44 | 52 | 56>(44);

  protected readonly classes = computed(
    () => `flex shrink-0 items-center justify-center rounded-full bg-white ${SIZE_CLASSES[this.size()]}`,
  );
}
