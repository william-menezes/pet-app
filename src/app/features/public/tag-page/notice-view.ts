import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BRAND_HEADLINE, BRAND_SUB } from '@/shared/components/faro/brand-panel/brand-copy';
import { BrandPanel } from '@/shared/components/faro/brand-panel/brand-panel';
import { PublicLayout } from '@/shared/shells/public-layout/public-layout';

/**
 * Esqueleto das telas curtas da página da tag (não ativada, não encontrada, contingência): faixa de
 * marca no topo, título, texto e, por projeção, `[chip]`, `[card]` e `[actions]`. Sem rodapé (as telas
 * de referência não têm). Sempre claro, sem overlay.
 */
@Component({
  selector: 'app-notice-view',
  imports: [PublicLayout, BrandPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-public-layout media="band">
      <app-brand-panel media variant="page" [headline]="brandHeadline" [sub]="brandSub" />

      <div class="flex flex-1 flex-col pt-1 md:pt-0" [attr.data-testid]="testid()">
        <h1
          class="font-display text-[38px] leading-[1.04] font-bold tracking-[-0.03em] text-foreground md:text-[48px] xl:text-[60px]"
          data-testid="public-notice-title"
        >
          {{ heading() }}
        </h1>
        <p class="mt-3.5 text-base leading-[1.45] text-text md:text-[17px] xl:text-lg" data-testid="public-notice-body">
          {{ body() }}
        </p>
        <ng-content select="[chip]" />
        <div class="h-[18px] shrink-0"></div>
        <ng-content select="[card]" />
        <div class="min-h-[18px] flex-1 xl:hidden"></div>
        <div class="mt-4 flex flex-col items-center gap-3 xl:mt-6">
          <ng-content select="[actions]" />
        </div>
      </div>
    </app-public-layout>
  `,
})
export class NoticeView {
  readonly heading = input.required<string>();
  readonly body = input.required<string>();
  readonly testid = input<string | null>(null);

  protected readonly brandHeadline = BRAND_HEADLINE;
  protected readonly brandSub = BRAND_SUB;
}
