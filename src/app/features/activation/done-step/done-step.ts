import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { normalize } from '../../../core/tag-code';

/**
 * "Tag ativa!" (T047; referência `V2-ativacao-sucesso*.dc.html`).
 *
 * "Ver a página de [pet]" é um `<a href>` simples para `/<código>`: a página da tag é renderizada no servidor e
 * só chega com os dados prontos numa navegação completa (por `routerLink` ela cairia na tela de contingência).
 */
@Component({
  selector: 'app-activation-done-step',
  imports: [RouterLink, NgIcon, FlowShell, IconTile, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './done-step.html',
})
export class DoneStep {
  readonly petName = input.required<string>();
  readonly petId = input.required<string>();
  /** Código na forma de exibição, `XXXX-XXXX-X`. */
  readonly code = input.required<string>();
  readonly whatsappEnabled = input(false);

  protected readonly headline = computed(() => [$localize`Pronto.`, this.petName(), $localize`tem como`, $localize`voltar.`]);
  protected readonly sub = $localize`A partir de agora, quem escanear a tag fala direto com você.`;
  protected readonly pageHref = computed(() => `/${normalize(this.code())}`);
  protected readonly visibilityLink = computed(() => ['/app/pets', this.petId(), 'visibilidade']);
}
