import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { LOGO } from './brand-assets';

/** Wordmark do Faro (contrato §5.1). A largura sai da proporção do arquivo. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block leading-none' },
  template: `<img
    [src]="src()"
    alt="Faro"
    i18n-alt
    [attr.width]="width()"
    [attr.height]="height()"
    decoding="async"
    class="block max-w-none"
  />`,
})
export class Logo {
  /** `on-light`: letras navy. `on-dark`: letras brancas (sobre navy ou sobre o tema escuro). */
  readonly tone = input<'on-light' | 'on-dark'>('on-light');
  /** Altura em px; a largura é `round(height * LOGO.width / LOGO.height)`. */
  readonly height = input(48);

  protected readonly src = computed(() => (this.tone() === 'on-dark' ? LOGO.onDark : LOGO.onLight));
  protected readonly width = computed(() => Math.round((this.height() * LOGO.width) / LOGO.height));
}
