import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StatTile } from '@/shared/components/faro/stat-tile/stat-tile';
import { Steps } from '@/shared/components/faro/steps/steps';

/** Galeria: cartão de número (com e sem link) e passos (contrato §5.9 e §5.10). */
@Component({
  selector: 'app-gallery-stats',
  imports: [StatTile, Steps],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-[520px] flex-col gap-5" data-testid="gallery-stats">
      <div class="grid grid-cols-2 gap-3">
        <app-stat-tile label="Scans este mês" i18n-label value="3" caption="O último foi hoje" i18n-caption />
        <app-stat-tile label="Tags ativas" i18n-label value="5 de 7" link="/dev/ui/components" />
      </div>
      <div class="flex flex-col gap-4">
        <app-steps [current]="1" [total]="3" />
        <app-steps [current]="2" [total]="3" data-testid="dev-steps" />
        <app-steps [current]="3" [total]="3" />
      </div>
    </div>
  `,
})
export class GalleryStats {}
