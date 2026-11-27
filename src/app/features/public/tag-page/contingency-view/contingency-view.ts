import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { InfoCard } from '@/shared/components/faro/info-card/info-card';
import { NoticeView } from '../notice-view';

/**
 * Contingência (T032): limite estourado, falha ou tempo esgotado ao consultar a tag. Nunca erro técnico.
 * Layout de "tag não encontrada". "Tentar de novo" é um link comum para o mesmo endereço (o servidor
 * refaz a consulta), sem JavaScript.
 */
@Component({
  selector: 'app-contingency-view',
  imports: [NoticeView, InfoCard, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-notice-view
      heading="Este pet tem dono."
      i18n-heading
      body="Não conseguimos abrir as informações desta tag agora. Tente de novo em instantes."
      i18n-body
      [testid]="'public-contingency'"
    >
      <app-info-card card icon="info" title="Encontrou um pet?" i18n-title>
        <ng-container i18n>
          Uma clínica veterinária ou ONG pode ler o microchip do animal e localizar a família.
        </ng-container>
      </app-info-card>
      <a z-button zSize="lg" [href]="retryHref()" class="w-full" actions data-testid="public-contingency-retry" i18n>
        Tentar de novo
      </a>
    </app-notice-view>
  `,
})
export class ContingencyView {
  /** Endereço atual da página: o mesmo pedido, refeito do zero. */
  readonly retryHref = input.required<string>();
}
