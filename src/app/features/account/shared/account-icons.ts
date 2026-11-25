import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import type { IconDefinition } from '@boxicons/js';
import { ArrowToBottom } from '@boxicons/js/icons/ArrowToBottom';
import { DoorOpen } from '@boxicons/js/icons/DoorOpen';
import { Palette } from '@boxicons/js/icons/Palette';
import { Phone } from '@boxicons/js/icons/Phone';
import { Shield } from '@boxicons/js/icons/Shield';

import { faroIcons } from '@/shared/icons/faro-icons';
import { mergeClasses } from '@/shared/utils/merge-classes';

function svg(icon: IconDefinition): string {
  const data = icon.packs[icon.defaultPack];
  if (!data) throw new Error(`Boxicons: o ícone "${icon.name}" não tem o pacote padrão.`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}" fill="currentColor" aria-hidden="true">${data.content}</svg>`;
}

/**
 * Ícones das telas de Conta que não existem em `faro-icons.ts` (compartilhado, fora do escopo desta spec):
 * celular, aparência, privacidade, sair e baixar. Entram por subcaminho do pacote (o barrel carrega os
 * 4.362 ícones). `provideIcons` de componente substitui o conjunto global, por isso repete o do Faro.
 */
export const ACCOUNT_ICONS = {
  ...faroIcons,
  phone: svg(Phone),
  palette: svg(Palette),
  shield: svg(Shield),
  exit: svg(DoorOpen),
  download: svg(ArrowToBottom),
};

export type AccountIconName = keyof typeof ACCOUNT_ICONS;

/** Quadrado de 40 px com um ícone de 20 px, como o `app-icon-tile`, mas com os ícones de Conta. */
@Component({
  selector: 'app-account-icon-tile',
  imports: [NgIcon],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `<ng-icon [name]="icon()" size="20" aria-hidden="true" />`,
})
export class AccountIconTile {
  readonly icon = input.required<AccountIconName>();

  protected readonly classes = computed(() =>
    mergeClasses('flex size-10 shrink-0 items-center justify-center rounded-md bg-inset text-foreground'),
  );
}
