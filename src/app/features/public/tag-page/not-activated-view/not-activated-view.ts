import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { InfoCard } from '@/shared/components/faro/info-card/info-card';
import { normalize } from '../../../../core/tag-code/tag-code';
import { NoticeView } from '../notice-view';

/**
 * "Tag não ativada" (T033). "Ativar minha tag" leva a `/ativar/<código>` (código normalizado, 9
 * caracteres) e "Entrar" ao login com o mesmo destino de volta. Links comuns (`<a href>`): navegação
 * completa para o documento do app, que carrega com a política de cabeçalhos dele (contrato de
 * endurecimento §1). Nada de `routerLink` para fora da página da tag.
 */
@Component({
  selector: 'app-not-activated-view',
  imports: [NoticeView, InfoCard, NgIcon, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-notice-view
      heading="Esta tag ainda não foi ativada."
      i18n-heading
      body="Se a tag é sua, ative em poucos minutos com o PIN que veio no cartão da embalagem."
      i18n-body
      [testid]="'public-not-activated'"
    >
      <div chip class="mt-4 flex">
        <span
          class="inline-flex h-10 items-center gap-2 rounded-full bg-card px-4 font-display text-base font-semibold tracking-[0.02em] text-foreground"
          data-testid="public-not-activated-code"
        >
          <ng-icon name="tag" size="18" aria-hidden="true" />
          {{ code() }}
        </span>
      </div>
      <app-info-card card icon="info" title="Encontrou um pet com esta tag?" i18n-title>
        <ng-container i18n>
          Ela ainda não tem família cadastrada. Uma clínica veterinária ou ONG pode ler o microchip do animal.
        </ng-container>
      </app-info-card>
      <a z-button zSize="lg" class="w-full" actions [href]="activateHref()" data-testid="public-not-activated-activate" i18n>
        Ativar minha tag
      </a>
      <p class="text-sm text-text" actions>
        <ng-container i18n>Já tem conta?</ng-container>
        <a [href]="loginHref()" class="ml-1 font-semibold text-link underline underline-offset-[3px]" data-testid="public-not-activated-login" i18n>Entrar</a>
      </p>
    </app-notice-view>
  `,
})
export class NotActivatedView {
  /** Código na forma de exibição, `XXXX-XXXX-X`. */
  readonly code = input.required<string>();

  protected readonly activateHref = computed(() => `/ativar/${normalize(this.code())}`);
  protected readonly loginHref = computed(
    () => `/auth/login?returnUrl=${encodeURIComponent(this.activateHref())}`,
  );
}
