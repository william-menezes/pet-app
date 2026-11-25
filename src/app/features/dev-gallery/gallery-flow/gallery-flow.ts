import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardInputOtpComponent } from '@/shared/components/input-otp';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

/** Galeria: casca de fluxo com passos, campo, células de código e ações (`/dev/ui/flow`). */
@Component({
  selector: 'app-gallery-flow',
  imports: [FlowShell, ZardFieldImports, ZardInputComponent, ZardInputOtpComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-flow-shell barTitle="Ativar tag" i18n-barTitle back="back" backLink="/dev/ui" [step]="step">
      <div class="flex flex-col gap-4 md:gap-[18px]" data-testid="dev-gallery-flow">
        <h1 class="font-display text-[28px] leading-[1.1] font-bold tracking-[-0.03em] text-foreground md:text-[34px]" i18n>
          Digite o PIN do cartão
        </h1>
        <p class="text-base text-text" i18n>São 6 letras e números, impressos no cartão que veio na embalagem.</p>
        <z-input-otp zMode="alphanumeric" [zMaxLength]="6" zAriaLabel="PIN de 6 caracteres" i18n-zAriaLabel />
        <div z-field>
          <label z-field-label for="gallery-flow-code" i18n>Código da tag</label>
          <input z-input id="gallery-flow-code" type="text" value="7K3M-Q9XA-C" />
        </div>
      </div>
      <button footer type="button" z-button zSize="lg" class="w-full" i18n>Continuar</button>
      <button footer type="button" z-button zType="ghost" zSize="md" i18n>Agora não</button>
    </app-flow-shell>
  `,
})
export class GalleryFlow {
  protected readonly step = { current: 2, total: 3 };
}
