import { ChangeDetectionStrategy, Component, computed, input, TemplateRef, ViewEncapsulation } from '@angular/core';

import { NgIcon } from '@ng-icons/core';
import type { ClassValue } from 'clsx';

import type { FaroIconName } from '@/shared/icons/faro-icons';
import { ZardStringTemplateOutletDirective } from '@/shared/core/directives/string-template-outlet.directive';
import { mergeClasses } from '@/shared/utils/merge-classes';

import {
  alertActionVariants,
  alertDescriptionVariants,
  alertIconVariants,
  alertTitleVariants,
  alertVariants,
  type ZardAlertTypeVariants,
} from './alert.variants';

const ALERT_ICONS: Record<ZardAlertTypeVariants, FaroIconName> = {
  neutral: 'info',
  success: 'checkCircle',
  danger: 'alert',
};

@Component({
  selector: 'z-alert, [z-alert]',
  imports: [NgIcon, ZardStringTemplateOutletDirective],
  template: `
    @if (zIcon() || iconName()) {
      <span [class]="iconClasses()" data-slot="alert-icon">
        <ng-container *zStringTemplateOutlet="zIcon()">
          <ng-icon [name]="iconName()" class="size-5!" aria-hidden="true" />
        </ng-container>
      </span>
    }

    <div class="flex-1">
      @if (zTitle()) {
        <div [class]="titleClasses()" data-slot="alert-title">
          <ng-container *zStringTemplateOutlet="zTitle()">{{ zTitle() }}</ng-container>
        </div>
      }

      @if (zDescription()) {
        <div data-slot="alert-description" [class]="descriptionClasses()">
          <ng-container *zStringTemplateOutlet="zDescription()">{{ zDescription() }}</ng-container>
        </div>
      }

      @if (zAction()) {
        <div data-slot="alert-action" [class]="actionClasses()">
          <ng-container *zStringTemplateOutlet="zAction()" />
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[attr.role]': 'role()',
    '[class]': 'classes()',
    'data-slot': 'alert',
  },
  exportAs: 'zAlert',
})
export class ZardAlertComponent {
  readonly class = input<ClassValue>('');
  readonly zAction = input<TemplateRef<void>>();
  readonly zDescription = input<string | TemplateRef<void>>('');
  readonly zIcon = input<TemplateRef<void> | string>();
  readonly zRole = input<'alert' | 'status'>();
  readonly zTitle = input<string | TemplateRef<void>>('');
  readonly zType = input<ZardAlertTypeVariants>('neutral');

  protected readonly actionClasses = computed(() => alertActionVariants());
  protected readonly classes = computed(() => mergeClasses(alertVariants({ zType: this.zType() }), this.class()));
  protected readonly descriptionClasses = computed(() => alertDescriptionVariants({ zType: this.zType() }));
  protected readonly iconClasses = computed(() => alertIconVariants());
  /** Erro anuncia como `alert`; neutro e sucesso, como `status` (contrato §3.6). */
  protected readonly role = computed(() => this.zRole() ?? (this.zType() === 'danger' ? 'alert' : 'status'));
  protected readonly titleClasses = computed(() => alertTitleVariants());

  protected readonly iconName = computed((): string | undefined => {
    const customIcon = this.zIcon();
    if (customIcon && !(customIcon instanceof TemplateRef)) {
      return customIcon;
    }

    return ALERT_ICONS[this.zType()];
  });
}
