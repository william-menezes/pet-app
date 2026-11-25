import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import type { IconDefinition } from '@boxicons/js';
import { Envelope } from '@boxicons/js/icons/Envelope';

import { faroIcons } from '@/shared/icons/faro-icons';

function svg(icon: IconDefinition): string {
  const data = icon.packs[icon.defaultPack];
  if (!data) throw new Error(`Boxicons: o ícone "${icon.name}" não tem o pacote padrão.`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}" fill="currentColor" aria-hidden="true">${data.content}</svg>`;
}

/**
 * Círculo de 56 px com um ícone, no alto das telas de confirmação de e-mail (`V2-confirmar-email*.dc.html`).
 * O envelope não existe em `faro-icons.ts` (compartilhado, fora do escopo desta spec): entra aqui.
 * `provideIcons` de componente substitui o conjunto global (provedor múltiplo), por isso repete o do Faro.
 */
@Component({
  selector: 'app-auth-status-badge',
  imports: [NgIcon],
  providers: [provideIcons({ ...faroIcons, mail: svg(Envelope) })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `<ng-icon [name]="icon()" size="26" aria-hidden="true" />`,
})
export class AuthStatusBadge {
  readonly icon = input<'mail' | 'alert'>('mail');

  protected readonly classes = computed(
    () =>
      `flex size-14 shrink-0 items-center justify-center rounded-full ${
        this.icon() === 'alert' ? 'bg-danger-soft text-danger-foreground' : 'bg-card text-foreground'
      }`,
  );
}
