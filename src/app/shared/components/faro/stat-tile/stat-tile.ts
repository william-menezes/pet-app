import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

const CARD_CLASSES = 'flex flex-col gap-1 rounded-xl bg-card p-4';

/** Cartão de número (contrato §5.9). Com `link`, o cartão inteiro é um `<a>`. */
@Component({
  selector: 'app-stat-tile',
  imports: [NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (link(); as href) {
      <a [routerLink]="href" [class]="cardClasses" data-testid="stat-tile-link">
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else {
      <div [class]="cardClasses" data-testid="stat-tile-card">
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    }

    <ng-template #body>
      <span class="text-[13px] text-muted-foreground" data-testid="stat-tile-label">{{ label() }}</span>
      <span
        class="font-display text-[38px] leading-[1.05] font-bold tracking-[-0.02em] text-foreground xl:text-[40px]"
        data-testid="stat-tile-value"
      >
        {{ value() }}
      </span>
      @if (caption()) {
        <span class="text-[13px] text-muted-foreground" data-testid="stat-tile-caption">{{ caption() }}</span>
      }
    </ng-template>
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly caption = input('');
  /** Com valor, o cartão inteiro é um link. */
  readonly link = input<string | null>(null);

  protected readonly cardClasses = CARD_CLASSES;
}
