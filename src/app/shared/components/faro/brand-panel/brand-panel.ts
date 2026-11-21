import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Focinho } from '../focinho/focinho';
import { Logo } from '../logo/logo';

/** Posição e tamanho do focinho gigante (lima) por variante e largura. Classes escritas por inteiro para o Tailwind achar. */
const FOCINHO_CLASSES = {
  page: 'w-[300px] -top-10 -right-[70px] md:w-[480px] md:-top-20 md:-right-[110px] xl:w-[640px] xl:-top-[130px] xl:-right-[190px]',
  flow: 'w-[300px] -top-10 -right-[70px] md:w-[480px] md:-top-20 md:-right-[110px] xl:w-[560px] xl:-top-[120px] xl:-right-[180px]',
} as const;

const HEADLINE_CLASSES = {
  page: 'xl:text-[72px]',
  flow: 'xl:text-[56px]',
} as const;

/**
 * Painel navy com o focinho gigante, o wordmark de letras brancas e, no desktop, a tagline
 * (contrato §5.3). O pai define o tamanho: altura da faixa no celular e no tablet, largura no desktop.
 */
@Component({
  selector: 'app-brand-panel',
  imports: [Focinho, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative flex flex-col overflow-hidden bg-brand p-5 text-brand-foreground md:px-8 md:py-7 xl:px-14 xl:pt-12 xl:pb-14',
  },
  template: `
    <app-focinho class="pointer-events-none absolute text-primary" [class]="focinhoClasses()" data-testid="brand-panel-focinho" />
    <div class="relative z-10 flex flex-1 flex-col">
      <div class="md:hidden"><app-logo tone="on-dark" [height]="52" /></div>
      <div class="hidden md:block"><app-logo tone="on-dark" [height]="60" /></div>

      @if (headline().length) {
        <p
          class="mt-auto hidden font-display leading-none font-bold tracking-[-0.03em] text-white xl:block"
          [class]="headlineClasses()"
          data-testid="brand-panel-headline"
        >
          @for (line of headline(); track $index) {
            <span class="block">{{ line }}</span>
          }
        </p>
      }
      @if (sub()) {
        <p class="mt-[18px] hidden max-w-[420px] text-lg text-brand-muted xl:block" data-testid="brand-panel-sub">
          {{ sub() }}
        </p>
      }
    </div>
  `,
})
export class BrandPanel {
  /** `page`: metade da tela (login, páginas públicas). `flow`: 560px (fluxos). */
  readonly variant = input<'page' | 'flow'>('page');
  /** Linhas da frase; cada item vira uma linha. */
  readonly headline = input<string[]>([]);
  /** Frase de apoio. */
  readonly sub = input('');

  protected readonly focinhoClasses = computed(() => FOCINHO_CLASSES[this.variant()]);
  protected readonly headlineClasses = computed(() => HEADLINE_CLASSES[this.variant()]);
}
