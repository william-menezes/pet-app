import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { mergeClasses } from '@/shared/utils/merge-classes';

import { Focinho } from '../focinho/focinho';

/**
 * Foto redonda do pet (lista de pets, resumo do PIN). Sem foto, o focinho da marca sobre um quadrado neutro.
 * A imagem é decorativa (o nome do pet aparece ao lado).
 */
@Component({
  selector: 'app-pet-avatar',
  imports: [Focinho],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (photoUrl(); as url) {
      <img [src]="url" alt="" class="size-full object-cover" loading="lazy" decoding="async" />
    } @else {
      <app-focinho class="w-1/2 text-muted-foreground" />
    }
  `,
})
export class PetAvatar {
  readonly photoUrl = input<string | null>(null);
  /** Classes de tamanho; o padrão é 48 px (`size-12`). */
  readonly sizeClass = input('size-12');

  protected readonly classes = computed(() =>
    mergeClasses('flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-inset', this.sizeClass()),
  );
}
