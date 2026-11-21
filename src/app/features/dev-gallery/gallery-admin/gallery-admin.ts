import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ZardBadgeComponent } from '@/shared/components/badge';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { ZardItemImports } from '@/shared/components/item';
import { AdminShell } from '@/shared/shells/admin-shell/admin-shell';

import { GALLERY_ADMIN_NAV } from '../gallery-tutor/gallery-nav';

/** Galeria: casca do admin com título, selos e um grupo de linhas (`/dev/ui/admin`). */
@Component({
  selector: 'app-gallery-admin',
  imports: [AdminShell, ZardBadgeComponent, ZardItemImports, IconTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-shell [items]="items">
      <div class="flex flex-col gap-3.5 md:gap-[18px] xl:gap-5" data-testid="dev-gallery-admin">
        <h1 class="font-display text-[28px] leading-[1.1] font-bold tracking-[-0.03em] text-foreground md:text-[34px]" i18n>
          Lotes
        </h1>
        <div class="flex flex-wrap items-center gap-2">
          <z-badge zType="success" i18n>lote-001</z-badge>
          <z-badge zType="neutral" i18n>100 códigos</z-badge>
          <z-badge zType="warning" i18n>2 bloqueados</z-badge>
        </div>
        <div z-item-group>
          @for (batch of batches; track batch.name) {
            <div z-item>
              <z-item-media><app-icon-tile icon="qr" /></z-item-media>
              <z-item-content>
                <span z-item-title>{{ batch.name }}</span>
                <p z-item-description>{{ batch.detail }}</p>
              </z-item-content>
              <z-badge [zType]="batch.type">{{ batch.status }}</z-badge>
            </div>
            @if (!$last) {
              <z-item-separator />
            }
          }
        </div>
      </div>
    </app-admin-shell>
  `,
})
export class GalleryAdmin {
  protected readonly items = GALLERY_ADMIN_NAV;
  protected readonly batches = [
    { name: 'lote-001', detail: $localize`100 códigos · 12 ativados`, status: $localize`Em uso`, type: 'success' as const },
    { name: 'lote-002', detail: $localize`100 códigos · nenhum ativado`, status: $localize`Impresso`, type: 'neutral' as const },
  ];
}
