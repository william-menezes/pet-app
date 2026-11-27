import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Título (`<h1>`), apoio e, à direita, o controle principal da tela do admin (`[action]`). */
@Component({
  selector: 'app-admin-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-end justify-between gap-3.5' },
  template: `
    <div class="min-w-0 flex-1 basis-[260px]">
      <h1
        class="font-display text-[28px] leading-[1.08] font-bold tracking-[-0.03em] text-foreground md:text-[32px] xl:text-[36px]"
        data-testid="admin-heading-title">
        {{ title() }}
      </h1>
      @if (subtitle()) {
        <p class="mt-1.5 text-[15px] leading-[1.45] text-text" data-testid="admin-heading-subtitle">{{ subtitle() }}</p>
      }
    </div>
    <ng-content select="[action]" />
  `,
})
export class AdminHeading {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
