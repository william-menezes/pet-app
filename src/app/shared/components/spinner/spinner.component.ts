import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  type TemplateRef,
  ViewEncapsulation,
} from '@angular/core';

import { NgIcon } from '@ng-icons/core';
import type { ClassValue } from 'clsx';

import { ZardStringTemplateOutletDirective } from '@/shared/core/directives/string-template-outlet.directive';
import { mergeClasses } from '@/shared/utils/merge-classes';

@Component({
  selector: 'z-spinner',
  imports: [NgIcon, ZardStringTemplateOutletDirective],
  template: `
    @let icon = zIcon();
    @if (icon) {
      <ng-container *zStringTemplateOutlet="icon; context: iconContext()" />
    } @else {
      <ng-icon data-slot="spinner" name="loader" aria-hidden="true" [class]="classes()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'inline-flex',
    role: 'status',
    '[attr.aria-label]': 'zAriaLabel()',
  },
  exportAs: 'zSpinner',
})
export class ZardSpinnerComponent {
  readonly class = input<ClassValue>('');
  readonly zIcon = input<TemplateRef<{ $implicit: string }> | undefined>(undefined);
  /** Announced by screen readers. An input because the library ships no translations. */
  readonly zAriaLabel = input($localize`Carregando`);

  // `size-4!` com importante: o estilo do host do ng-icon não está em camada e venceria `size-4`.
  // Para outro tamanho, passe `size-12!`.
  protected readonly classes = computed(() => mergeClasses('size-4! animate-spin text-foreground', this.class()));
  protected readonly iconContext = computed(() => ({ $implicit: this.classes() }));
}
