import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { ActionCard } from '@/shared/components/faro/action-card/action-card';
import { BrandMark } from '@/shared/components/faro/brand-mark/brand-mark';
import { PetHero } from '@/shared/components/faro/pet-hero/pet-hero';

/** Galeria: capa do pet (sem foto) e cartão de ação (contrato §5.11 e §5.12). */
@Component({
  selector: 'app-gallery-pet',
  imports: [PetHero, ActionCard, BrandMark, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-[640px] flex-col gap-5" data-testid="gallery-pet">
      <app-pet-hero class="h-[236px] md:h-[320px] xl:h-[400px]" name="Paçoca" subtitle="Tag ativa · 7K3M-Q9XA-C">
        <app-brand-mark heroTop [size]="44" />
      </app-pet-hero>

      <app-action-card title="Ative sua primeira tag" i18n-title>
        <ng-container i18n>Use o PIN do cartão que veio na embalagem.</ng-container>
        <button action type="button" z-button zType="ink" zSize="md" i18n>Ativar minha tag</button>
      </app-action-card>
    </div>
  `,
})
export class GalleryPet {}
