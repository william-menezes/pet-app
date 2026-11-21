import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { BRAND_HEADLINE, BRAND_SUB } from '@/shared/components/faro/brand-panel/brand-copy';
import { BrandPanel } from '@/shared/components/faro/brand-panel/brand-panel';
import { InfoCard } from '@/shared/components/faro/info-card/info-card';
import { PublicFooter } from '@/shared/shells/public-layout/public-footer';
import { PublicLayout } from '@/shared/shells/public-layout/public-layout';

/** Galeria: página pública com faixa de marca, cartão de informação, botão `rescue` e rodapé (`/dev/ui/public`). */
@Component({
  selector: 'app-gallery-public',
  imports: [PublicLayout, PublicFooter, BrandPanel, InfoCard, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-public-layout media="band">
      <app-brand-panel media variant="page" [headline]="headline" [sub]="sub" />

      <div class="flex flex-1 flex-col gap-4" data-testid="dev-gallery-public">
        <h1 class="font-display text-[32px] leading-[1.05] font-bold tracking-[-0.03em] text-foreground md:text-[40px]" i18n>
          Esta tag ainda não foi ativada
        </h1>
        <app-info-card icon="info" title="Achou um pet com esta tag?" i18n-title>
          <ng-container i18n>O tutor ainda não terminou de configurar a tag.</ng-container>
        </app-info-card>
        <div class="flex-1 xl:hidden"></div>
        <a z-button zSize="rescue" href="/dev/ui" i18n>Entrar em contato</a>
      </div>

      <app-public-footer footer trust="Faro é a tag de identificação do seu pet." i18n-trust code="7K3M-Q9XA-C" />
    </app-public-layout>
  `,
})
export class GalleryPublic {
  protected readonly headline = BRAND_HEADLINE;
  protected readonly sub = BRAND_SUB;
}
