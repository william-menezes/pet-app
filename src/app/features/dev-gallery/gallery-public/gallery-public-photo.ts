import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { BrandMark } from '@/shared/components/faro/brand-mark/brand-mark';
import { PublicFooter } from '@/shared/shells/public-layout/public-footer';
import { PublicLayout } from '@/shared/shells/public-layout/public-layout';

/** Galeria: página pública com a faixa de foto (sem foto real: `bg-photo`) e a marca no canto (`/dev/ui/public/photo`). */
@Component({
  selector: 'app-gallery-public-photo',
  imports: [PublicLayout, PublicFooter, BrandMark, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-public-layout media="photo">
      <div media class="relative">
        <app-brand-mark class="absolute top-3.5 left-3.5" [size]="44" />
      </div>

      <div class="flex flex-1 flex-col gap-3" data-testid="dev-gallery-public-photo">
        <h1 class="font-display text-[36px] leading-none font-bold tracking-[-0.03em] text-foreground md:text-[48px]">Paçoca</h1>
        <p class="text-base text-text" i18n>Cão · Sem raça definida · Porte médio</p>
        <div class="flex-1 xl:hidden"></div>
        <a z-button zSize="rescue" href="/dev/ui" i18n>Falar com a Ana</a>
      </div>

      <app-public-footer footer trust="Faro é a tag de identificação do seu pet." i18n-trust code="7K3M-Q9XA-C" />
    </app-public-layout>
  `,
})
export class GalleryPublicPhoto {}
