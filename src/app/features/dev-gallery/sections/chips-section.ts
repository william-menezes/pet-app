import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { ZardBadgeComponent } from '@/shared/components/badge';
import type { ZardBadgeTypeVariants } from '@/shared/components/badge';
import { ZardToggleComponent } from '@/shared/components/toggle';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';

/** Galeria: selos, chips e segmentado de seleção única (contrato §3.4). */
@Component({
  selector: 'app-gallery-chips',
  imports: [ZardBadgeComponent, ZardToggleComponent, ZardToggleGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-[520px] flex-col gap-5" data-testid="gallery-chips">
      <div class="flex flex-col gap-2">
        <h3 class="text-base font-semibold" i18n>Selos</h3>
        <div class="flex flex-wrap items-center gap-2">
          @for (type of badgeTypes; track type) {
            <z-badge [zType]="type">{{ type }}</z-badge>
          }
        </div>
        <div class="flex flex-wrap items-center gap-2">
          @for (type of badgeTypes; track type) {
            <z-badge [zType]="type" zSize="lg">{{ type }}</z-badge>
          }
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-base font-semibold" i18n>Chips</h3>
        <div class="flex flex-wrap items-center gap-2">
          <z-toggle zAriaLabel="Dócil" i18n-zAriaLabel data-testid="gallery-chip-off">Dócil</z-toggle>
          <z-toggle zAriaLabel="Brincalhão" i18n-zAriaLabel [zValue]="true" data-testid="gallery-chip-on">Brincalhão</z-toggle>
          <z-toggle zAriaLabel="Medroso" i18n-zAriaLabel zDisabled>Medroso</z-toggle>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-base font-semibold" i18n>Segmentado</h3>
        <z-toggle-group
          zType="segmented"
          zMode="single"
          zAriaLabel="Tema"
          i18n-zAriaLabel
          [zItems]="themeItems"
          [zValue]="theme()"
          (valueChange)="onTheme($event)"
          data-testid="gallery-segmented"
        />
      </div>
    </div>
  `,
})
export class GalleryChips {
  protected readonly badgeTypes: ZardBadgeTypeVariants[] = ['neutral', 'success', 'warning', 'danger', 'ink', 'outline'];
  protected readonly themeItems: ZardToggleGroupItem[] = [
    { value: 'system', label: $localize`Sistema` },
    { value: 'light', label: $localize`Claro` },
    { value: 'dark', label: $localize`Escuro` },
  ];
  protected readonly theme = signal('system');

  protected onTheme(value: string | string[]): void {
    this.theme.set(typeof value === 'string' ? value : (value[0] ?? 'system'));
  }
}
