import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Meta } from '@angular/platform-browser';

import { normalize } from '../../../core/tag-code/tag-code';
import type { TagResolution } from '../../../models';
import { ContingencyView } from './contingency-view/contingency-view';
import { NotActivatedView } from './not-activated-view/not-activated-view';
import { NotFoundView } from './not-found-view/not-found-view';
import { RescueView } from './rescue-view/rescue-view';

/** Título e descrição genéricos (Open Graph incluso): nunca o nome do pet nem a foto. */
const GENERIC_TITLE = $localize`Faro · tag de identificação`;
const GENERIC_DESCRIPTION = $localize`O caminho de volta para casa. A tag com QR Code que ajuda quem achou um pet a falar com a família.`;

/**
 * Página da tag, `/<código>` (T030). Escolhe a tela pelo estado que o resolvedor da rota trouxe:
 * resgate (com ou sem modo perdido), não ativada, não encontrada ou contingência. Nenhum estado é um erro
 * técnico (Princípio I). Sem overlay; não importa nada do app autenticado nem de `core/auth`.
 *
 * O `<head>` é genérico e `noindex`: o nome do pet só aparece no corpo da página.
 */
@Component({
  selector: 'app-tag-page',
  imports: [RescueView, NotActivatedView, NotFoundView, ContingencyView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (resolution().state) {
      @case ('assigned') {
        @if (assigned(); as data) {
          <app-rescue-view [profile]="data.profile" [lostElapsed]="data.lostElapsed ?? null" />
        }
      }
      @case ('available') {
        @if (available(); as data) {
          <app-not-activated-view [code]="data.code" />
        }
      }
      @case ('not_found') {
        <app-not-found-view />
      }
      @default {
        <app-contingency-view [retryHref]="retryHref()" />
      }
    }
  `,
})
export class TagPage {
  private readonly meta = inject(Meta);

  /** Resultado do resolvedor da rota (`resolve`). */
  readonly resolution = input.required<TagResolution>();
  /** Segmento da URL como veio (`posParams` do `tagCodeMatcher`). */
  readonly codigo = input('');

  protected readonly assigned = computed(() => {
    const value = this.resolution();
    return value.state === 'assigned' ? value : null;
  });
  protected readonly available = computed(() => {
    const value = this.resolution();
    return value.state === 'available' ? value : null;
  });
  /** O mesmo endereço, em forma canônica: "Tentar de novo" refaz o pedido ao servidor. */
  protected readonly retryHref = computed(() => `/${normalize(this.codigo())}`);

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    this.meta.updateTag({ name: 'description', content: GENERIC_DESCRIPTION });
    this.meta.updateTag({ property: 'og:title', content: GENERIC_TITLE });
    this.meta.updateTag({ property: 'og:description', content: GENERIC_DESCRIPTION });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }
}
