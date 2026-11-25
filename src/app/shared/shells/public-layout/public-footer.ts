import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Focinho } from '@/shared/components/faro/focinho/focinho';

/**
 * Rodapé navy das páginas públicas (contrato `shells.contract.md` §5.2): focinho decorativo, a
 * tagline, uma linha de confiança e, se houver, o código da tag já formatado.
 */
@Component({
  selector: 'app-public-footer',
  imports: [Focinho],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative flex shrink-0 flex-col gap-1.5 overflow-hidden bg-brand px-5 pt-4 pb-[18px] text-brand-foreground md:px-[104px] md:pt-5 md:pb-[22px] xl:px-24 xl:pt-[22px] xl:pb-6',
    'data-testid': 'public-footer',
  },
  template: `
    <app-focinho
      class="pointer-events-none absolute -top-[34px] -right-[78px] w-[250px] text-brand-deep md:-right-[60px] md:w-[300px]"
    />
    <p class="relative font-display text-lg font-bold tracking-[-0.02em]" i18n>O caminho de volta para casa.</p>
    <p class="relative max-w-[300px] text-[13px] leading-[1.4] text-brand-muted" data-testid="public-footer-trust">
      {{ trust() }}
    </p>
    @if (code(); as value) {
      <p class="relative font-display text-[13px] font-semibold text-primary" data-testid="public-footer-code">
        <ng-container i18n>Tag</ng-container> {{ value }}
      </p>
    }
  `,
})
export class PublicFooter {
  /** Linha de confiança. */
  readonly trust = input.required<string>();
  /** Código da tag já formatado (`7K3M-Q9XA-C`). */
  readonly code = input<string | null>(null);
}
