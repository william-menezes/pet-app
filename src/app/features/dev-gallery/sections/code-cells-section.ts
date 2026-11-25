import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ZardInputOtpComponent } from '@/shared/components/input-otp';

/** Galeria: células de código, numérico (código por SMS) e alfanumérico (PIN de ativação) (contrato §3.7). */
@Component({
  selector: 'app-gallery-code-cells',
  imports: [ZardInputOtpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5" data-testid="gallery-code-cells">
      <div class="flex flex-col gap-2">
        <h3 class="text-base font-semibold" i18n>Numérico (código por SMS)</h3>
        <z-input-otp
          zMode="numeric"
          [zMaxLength]="6"
          zAriaLabel="Código de 6 dígitos"
          i18n-zAriaLabel
          data-testid="dev-otp-numeric"
        />
      </div>
      <div class="flex flex-col gap-2">
        <h3 class="text-base font-semibold" i18n>Alfanumérico (PIN de ativação)</h3>
        <z-input-otp
          zMode="alphanumeric"
          [zMaxLength]="6"
          zAriaLabel="PIN de 6 caracteres"
          i18n-zAriaLabel
          data-testid="dev-otp-alphanumeric"
        />
      </div>
      <div class="flex flex-col gap-2">
        <h3 class="text-base font-semibold" i18n>Inválido</h3>
        <z-input-otp
          zMode="numeric"
          [zMaxLength]="6"
          zInvalid
          zAriaLabel="Código de 6 dígitos"
          i18n-zAriaLabel
        />
      </div>
    </div>
  `,
})
export class GalleryCodeCells {}
