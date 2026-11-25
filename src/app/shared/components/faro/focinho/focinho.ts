import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { FOCINHO } from '../logo/brand-assets';

/**
 * Focinho do Faro (contrato §5.2). Tamanho e cor vêm de classes no elemento hospedeiro
 * (`class="w-[270px] text-primary"`). Proporção 234:207.
 */
@Component({
  selector: 'app-focinho',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `<svg
    [attr.viewBox]="viewBox"
    fill="currentColor"
    class="block h-auto w-full"
    [attr.role]="label() ? 'img' : null"
    [attr.aria-label]="label() || null"
    [attr.aria-hidden]="label() ? null : 'true'"
  >
    <path fill-rule="evenodd" clip-rule="evenodd" [attr.d]="path" />
  </svg>`,
})
export class Focinho {
  /** Com texto: `role="img"` e `aria-label`. Sem texto: decorativo (`aria-hidden`). */
  readonly label = input<string | null>(null);

  protected readonly viewBox = FOCINHO.viewBox;
  protected readonly path = FOCINHO.path;
}
