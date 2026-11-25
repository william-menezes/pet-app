import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';

import { normalize } from '../../../core/tag-code';
import { TagService } from '../../../core/tags/tag.service';
import { loadErrorText } from '../../../core/tags/tag-errors';

/** Texto de erro de carga desta tela; o do limite de chamadas vem de `loadErrorText`. */
const LOAD_FAILED = $localize`Não conseguimos abrir os dados da tag. Verifique sua conexão e tente de novo.`;

type State = 'loading' | 'error';

/**
 * `/app/tag/<código>`: leva do código da tag ao pet dono dela, em "O que estranhos veem". Existe porque a projeção
 * pública não traz id de pet: o "Editar" da visão do dono (na página da tag) só conhece o código, e quem sabe qual
 * pet é dono dele é o app autenticado (`my_dashboard`). Código que não é de um pet do tutor: vai à lista de pets.
 */
@Component({
  selector: 'app-tag-redirect',
  imports: [RouterLink, ZardAlertComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full flex-col gap-3" data-testid="tag-redirect">
      @if (state() === 'error') {
        <div class="flex flex-col items-start gap-3" data-testid="tag-redirect-error">
          <z-alert
            class="w-full"
            zType="danger"
            [zRole]="'status'"
            [zDescription]="errorText()" />
          <button type="button" z-button zType="outline" (click)="go()" data-testid="tag-redirect-retry" i18n>Tentar de novo</button>
          <a z-button zType="ghost" routerLink="/app/pets" data-testid="tag-redirect-pets" i18n>Ver meus pets</a>
        </div>
      } @else {
        <p class="py-6 text-center text-text" role="status" aria-busy="true" data-testid="tag-redirect-loading" i18n>Um instante…</p>
      }
    </div>
  `,
})
export class TagRedirect {
  private readonly tags = inject(TagService);
  private readonly router = inject(Router);

  /** Parâmetro de rota `:code` (ligado por `withComponentInputBinding`). */
  readonly code = input('');
  protected readonly state = signal<State>('loading');
  protected readonly errorText = signal(LOAD_FAILED);

  constructor() {
    effect(() => {
      this.code();
      untracked(() => void this.go());
    });
  }

  protected async go(): Promise<void> {
    this.state.set('loading');
    const wanted = normalize(this.code());
    const res = await this.tags.myDashboard();
    if (!res.ok) {
      this.errorText.set(loadErrorText(res, LOAD_FAILED));
      this.state.set('error');
      return;
    }
    const pet = res.dashboard.pets.find((p) => p.tagCode !== null && normalize(p.tagCode) === wanted);
    void this.router.navigate(pet === undefined ? ['/app/pets'] : ['/app/pets', pet.id, 'visibilidade'], { replaceUrl: true });
  }
}
