import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';
import type { ZardButtonSizeVariants, ZardButtonTypeVariants } from '@/shared/components/button';

/** Galeria: botão, todos os tipos e tamanhos, desativado e carregando (contrato §3.1). */
@Component({
  selector: 'app-gallery-button',
  imports: [ZardButtonComponent, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6" data-testid="gallery-button">
      <div class="flex flex-col gap-3">
        <h3 class="text-base font-semibold" i18n>Tipos (tamanho padrão)</h3>
        <div class="flex flex-wrap items-center gap-3">
          @for (type of types; track type) {
            <button type="button" z-button [zType]="type" [attr.data-testid]="'dev-button-' + type">{{ type }}</button>
          }
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="text-base font-semibold" i18n>Tamanhos (tipo default)</h3>
        <div class="flex flex-wrap items-center gap-3">
          @for (size of sizes; track size) {
            @if (size === 'icon') {
              <button type="button" z-button zType="outline" zSize="icon" aria-label="Adicionar" i18n-aria-label>
                <ng-icon name="plus" size="20" aria-hidden="true" />
              </button>
            } @else if (size !== 'rescue') {
              <button type="button" z-button [zSize]="size">{{ size }}</button>
            }
          }
        </div>
        <div class="max-w-[460px]">
          <button type="button" z-button zSize="rescue">
            <ng-icon name="whats" size="24" aria-hidden="true" />
            <span i18n>Falar no WhatsApp</span>
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="text-base font-semibold" i18n>Estados</h3>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" z-button zDisabled data-testid="dev-button-disabled" i18n>Desativado</button>
          <button type="button" z-button zType="outline" zDisabled i18n>Desativado</button>
          <button type="button" z-button zLoading data-testid="dev-button-loading" i18n>Salvando</button>
          <button type="button" z-button zType="ink" zSize="md" i18n>Tinta</button>
          <button type="button" z-button zType="destructive" i18n>Confirmar</button>
          <a z-button zType="link" href="/dev/ui" i18n>Link de texto</a>
        </div>
      </div>
    </div>
  `,
})
export class GalleryButton {
  protected readonly types: ZardButtonTypeVariants[] = [
    'default',
    'outline',
    'ink',
    'ghost',
    'danger',
    'destructive',
    'link',
    'secondary',
  ];
  protected readonly sizes: ZardButtonSizeVariants[] = ['sm', 'md', 'default', 'lg', 'rescue', 'icon'];
}
