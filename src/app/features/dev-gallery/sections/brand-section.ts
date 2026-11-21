import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { BRAND_HEADLINE, BRAND_SUB } from '@/shared/components/faro/brand-panel/brand-copy';
import { BrandMark } from '@/shared/components/faro/brand-mark/brand-mark';
import { BrandPanel } from '@/shared/components/faro/brand-panel/brand-panel';
import { Focinho } from '@/shared/components/faro/focinho/focinho';
import { GoogleGlyph } from '@/shared/components/faro/google-glyph/google-glyph';
import { Logo } from '@/shared/components/faro/logo/logo';

/** Galeria: logo, focinho, painel de marca (page e flow), marca circular e os botões do WhatsApp e do Google. */
@Component({
  selector: 'app-gallery-brand',
  imports: [BrandPanel, BrandMark, Focinho, GoogleGlyph, Logo, ZardButtonComponent, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6" data-testid="gallery-brand">
      <div class="flex flex-wrap items-center gap-6">
        <app-logo tone="on-light" [height]="48" />
        <span class="inline-flex rounded-xl bg-brand p-4"><app-logo tone="on-dark" [height]="48" /></span>
        <app-focinho class="w-24 text-primary" label="Faro" />
        <span class="relative inline-flex h-24 w-32 items-center justify-center rounded-xl bg-brand">
          <app-brand-mark [size]="56" />
        </span>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-base font-semibold" i18n>Painel de marca, variante page</h3>
        <app-brand-panel
          class="h-[230px] rounded-2xl md:h-[330px] xl:h-[640px]"
          variant="page"
          [headline]="headline"
          [sub]="sub"
          data-testid="dev-brand-panel-page"
        />
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-base font-semibold" i18n>Painel de marca, variante flow</h3>
        <app-brand-panel
          class="h-[230px] rounded-2xl md:h-[330px] xl:h-[640px] xl:max-w-[560px]"
          variant="flow"
          [headline]="headline"
          [sub]="sub"
          data-testid="dev-brand-panel-flow"
        />
      </div>

      <div class="flex max-w-[460px] flex-col gap-3">
        <h3 class="text-base font-semibold" i18n>Botões de marca de terceiros</h3>
        <button type="button" z-button zType="default" zSize="lg" class="w-full" data-testid="dev-whatsapp">
          <ng-icon name="whats" size="22" aria-hidden="true" />
          <span i18n>Falar no WhatsApp</span>
        </button>
        <button type="button" z-button zType="outline" zSize="lg" class="w-full" data-testid="dev-google">
          <app-google-glyph />
          <span i18n>Entrar com o Google</span>
        </button>
      </div>
    </div>
  `,
})
export class GalleryBrand {
  protected readonly headline = BRAND_HEADLINE;
  protected readonly sub = BRAND_SUB;
}
