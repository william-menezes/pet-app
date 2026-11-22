import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';

/**
 * Cabeçalho das telas internas do app do tutor (contrato §2.3): botão de voltar ou fechar, título
 * (o `<h1>` da tela) e um controle opcional à direita (`[action]`).
 */
@Component({
  selector: 'app-screen-header',
  imports: [NgIcon, RouterLink, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-12 items-center gap-3 md:gap-3.5' },
  template: `
    @if (back(); as kind) {
      @if (backLink(); as link) {
        <a
          z-button
          zType="ghost"
          zSize="icon"
          class="bg-card"
          [routerLink]="link"
          [attr.aria-label]="label(kind)"
          data-testid="screen-header-back"
        >
          <ng-icon [name]="kind === 'close' ? 'close' : 'back'" size="22" aria-hidden="true" />
        </a>
      } @else {
        <button
          type="button"
          z-button
          zType="ghost"
          zSize="icon"
          class="bg-card"
          [attr.aria-label]="label(kind)"
          data-testid="screen-header-back"
          (click)="backClick.emit()"
        >
          <ng-icon [name]="kind === 'close' ? 'close' : 'back'" size="22" aria-hidden="true" />
        </button>
      }
    }
    <h1
      class="min-w-0 flex-1 text-[19px] font-semibold text-foreground md:text-[28px] md:leading-[1.1] md:font-bold md:tracking-[-0.03em] xl:text-[34px]"
      data-testid="screen-header-title"
    >
      {{ title() }}
    </h1>
    <ng-content select="[action]" />
  `,
})
export class ScreenHeader {
  readonly title = input.required<string>();
  readonly back = input<'back' | 'close' | null>(null);
  readonly backLink = input<string | null>(null);
  /** Emitido quando o botão não é um link (`backLink` vazio). */
  readonly backClick = output<void>();

  protected label(kind: 'back' | 'close'): string {
    return kind === 'close' ? $localize`Fechar` : $localize`Voltar`;
  }
}
