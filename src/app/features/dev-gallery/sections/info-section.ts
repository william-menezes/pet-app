import { ChangeDetectionStrategy, Component } from '@angular/core';

import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { InfoCard } from '@/shared/components/faro/info-card/info-card';
import { Note } from '@/shared/components/faro/note/note';

/** Galeria: quadrado de ícone, cartão de informação e nota (contrato §5.6 a §5.8). */
@Component({
  selector: 'app-gallery-info',
  imports: [IconTile, InfoCard, Note],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-[520px] flex-col gap-4" data-testid="gallery-info">
      <div class="flex items-center gap-3">
        <app-icon-tile icon="paw" />
        <app-icon-tile icon="checkCircle" tone="success" />
        <app-icon-tile icon="warn" tone="warning" />
        <app-icon-tile icon="alert" tone="danger" />
      </div>
      <app-info-card icon="lock" title="Seus dados ficam com você" i18n-title>
        <ng-container i18n>Quem achou o pet só vê o que você liberou.</ng-container>
      </app-info-card>
      <app-note icon="info">
        <ng-container i18n>Você pode mudar isso quando quiser.</ng-container>
      </app-note>
    </div>
  `,
})
export class GalleryInfo {}
