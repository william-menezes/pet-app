import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';
import { BRAND_HEADLINE, BRAND_SUB } from '@/shared/components/faro/brand-panel/brand-copy';
import { BrandPanel } from '@/shared/components/faro/brand-panel/brand-panel';
import { PublicFooter } from '@/shared/shells/public-layout/public-footer';
import { PublicLayout } from '@/shared/shells/public-layout/public-layout';

/** Landing pública (rota `/`, prerender): estrutura das páginas públicas com painel de marca. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, ZardButtonComponent, BrandPanel, PublicFooter, PublicLayout],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  protected readonly brandHeadline = BRAND_HEADLINE;
  protected readonly brandSub = BRAND_SUB;
}
