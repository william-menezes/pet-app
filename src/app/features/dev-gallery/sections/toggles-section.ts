import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ZardCheckboxComponent } from '@/shared/components/checkbox';
import { ZardSwitchComponent } from '@/shared/components/switch';

/** Galeria: caixa e interruptor, desligados, ligados, inválida e desativados (contrato §3.3). */
@Component({
  selector: 'app-gallery-toggles',
  imports: [ZardCheckboxComponent, ZardSwitchComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid max-w-[440px] gap-3" data-testid="gallery-toggles">
      <z-checkbox zId="gallery-checkbox-off" data-testid="dev-checkbox-off" i18n>Manter conectado</z-checkbox>
      <z-checkbox zId="gallery-checkbox-on" [formControl]="checked" data-testid="dev-checkbox-on" i18n>Receber aviso por e-mail</z-checkbox>
      <z-checkbox zInvalid i18n>Li e aceito os termos</z-checkbox>
      <z-checkbox zDisabled i18n>Desativada</z-checkbox>

      <div class="flex items-center justify-between gap-3">
        <span id="gallery-switch-off-label" class="text-[15px] font-semibold text-foreground" i18n>Mostrar telefone</span>
        <z-switch zId="gallery-switch-off" data-testid="dev-switch-off">
          <span class="sr-only" i18n>Mostrar telefone</span>
        </z-switch>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-[15px] font-semibold text-foreground" i18n>Mostrar foto</span>
        <z-switch zId="gallery-switch-on" [zChecked]="true" data-testid="dev-switch-on">
          <span class="sr-only" i18n>Mostrar foto</span>
        </z-switch>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-[15px] font-semibold text-foreground" i18n>Desativado</span>
        <z-switch zDisabled>
          <span class="sr-only" i18n>Desativado</span>
        </z-switch>
      </div>
    </div>
  `,
})
export class GalleryToggles {
  protected readonly checked = new FormControl(true, { nonNullable: true });
}
