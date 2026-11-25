import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { ZardItemImports } from '@/shared/components/item';
import { ZardSwitchComponent } from '@/shared/components/switch';

/** Galeria: cartão, grupo de linhas e estado vazio (contrato §3.5). */
@Component({
  selector: 'app-gallery-lists',
  imports: [
    ZardCardImports,
    ZardItemImports,
    ZardEmptyComponent,
    ZardButtonComponent,
    ZardBadgeComponent,
    ZardSwitchComponent,
    IconTile,
    NgIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid max-w-[520px] gap-5" data-testid="gallery-lists">
      <div z-card data-testid="dev-card">
        <div z-card-header>
          <div z-card-title zTitle="Paçoca"></div>
          <p z-card-description zDescription="Tag ativa desde ontem." i18n-zDescription></p>
        </div>
        <div z-card-content i18n>Cartão sem borda e sem sombra, com raio de 20px.</div>
      </div>

      <div z-item-group data-testid="dev-item-group">
        <a z-item href="/dev/ui/components">
          <z-item-media><app-icon-tile icon="paw" /></z-item-media>
          <z-item-content>
            <span z-item-title i18n>Meus pets</span>
            <p z-item-description i18n>Veja e edite os dados dos seus pets.</p>
          </z-item-content>
          <ng-icon name="chev" size="20" class="text-muted-foreground" aria-hidden="true" />
        </a>
        <z-item-separator />
        <div z-item>
          <z-item-media><app-icon-tile icon="eye" /></z-item-media>
          <z-item-content>
            <span z-item-title i18n>Mostrar telefone</span>
            <p z-item-description i18n>Quem achou o pet pode chamar no WhatsApp.</p>
          </z-item-content>
          <z-switch [zChecked]="true"><span class="sr-only" i18n>Mostrar telefone</span></z-switch>
        </div>
        <z-item-separator />
        <div z-item>
          <z-item-media><app-icon-tile icon="warn" tone="warning" /></z-item-media>
          <z-item-content>
            <span z-item-title i18n>Modo perdido</span>
            <p z-item-description i18n>Desligado.</p>
          </z-item-content>
          <z-badge zType="neutral" i18n>Desligado</z-badge>
        </div>
      </div>

      <div class="rounded-xl bg-card" data-testid="dev-empty">
        <z-empty
          zIcon="paw"
          zTitle="Nenhum pet por aqui ainda"
          i18n-zTitle
          zDescription="Cadastre seu primeiro pet para ativar uma tag."
          i18n-zDescription
          [zActions]="[addAction]"
        />
        <ng-template #addAction>
          <button type="button" z-button i18n>Cadastrar pet</button>
        </ng-template>
      </div>
    </div>
  `,
})
export class GalleryLists {}
