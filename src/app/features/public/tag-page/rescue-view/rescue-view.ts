import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { BrandMark } from '@/shared/components/faro/brand-mark/brand-mark';
import { Focinho } from '@/shared/components/faro/focinho/focinho';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { InfoCard } from '@/shared/components/faro/info-card/info-card';
import { PublicFooter } from '@/shared/shells/public-layout/public-footer';
import { PublicLayout } from '@/shared/shells/public-layout/public-layout';
import type { LostElapsed, PublicRescueProfile } from '../../../../models';
import { telHref } from './tel-href';

/** Estado do botão "Enviar onde estou": escondido, parado, enviando, enviado ou permissão negada. */
export type LocationStatus = 'unavailable' | 'idle' | 'sending' | 'sent' | 'denied';

/**
 * Tela de resgate (T031) e, com `profile.lost`, a de modo perdido (T061): a página que estranhos veem
 * ao ler a tag. Mostra SÓ o que veio na projeção (campo ausente = não aparece). Sem overlay, sem
 * terceiros. O botão do WhatsApp é um `<a href>` que existe no HTML do servidor.
 *
 * Textos neutros quanto ao gênero do pet e do tutor: a projeção pública não traz sexo nem artigo.
 * `ownerView` (T048): faixa "você está vendo como um estranho" e botões de contato desativados.
 */
@Component({
  selector: 'app-rescue-view',
  imports: [PublicLayout, PublicFooter, BrandMark, Focinho, IconTile, InfoCard, NgIcon, NgTemplateOutlet, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rescue-view.html',
})
export class RescueView {
  readonly profile = input.required<PublicRescueProfile>();
  /** "Há quanto tempo" calculado no servidor; ausente se o tutor não liberou ou se a data é inválida. */
  readonly lostElapsed = input<LostElapsed | null>(null);
  /** Visão do dono: o tutor logado abrindo a própria tag. */
  readonly ownerView = input(false);
  readonly locationStatus = input<LocationStatus>('unavailable');
  /** O visitante tocou em "Enviar onde estou". */
  readonly shareLocation = output<void>();

  protected readonly name = computed(() => this.profile().pet.name);
  protected readonly photo = computed(() => this.profile().pet.photo_url ?? null);
  protected readonly tutor = computed(() => this.profile().tutor_first_name ?? null);
  protected readonly lost = computed(() => this.profile().lost ?? null);
  protected readonly isLost = computed(() => this.lost() !== null);
  protected readonly whatsapp = computed(() => this.profile().whatsapp_url ?? null);
  protected readonly phone = computed(() => this.profile().phone_display ?? null);
  protected readonly phoneHref = computed(() => {
    const phone = this.phone();
    return phone === null ? null : telHref(phone);
  });
  protected readonly hasContact = computed(() => this.whatsapp() !== null || this.phone() !== null);
  protected readonly temperament = computed(() => this.profile().temperament ?? []);
  protected readonly care = computed(() => this.profile().care_notes ?? null);
  protected readonly elapsed = computed(() => (this.lost()?.since !== undefined ? this.lostElapsed() : null));
  protected readonly lostMessage = computed(() => this.lost()?.message ?? null);
  protected readonly reward = computed(() => this.lost()?.reward === true);

  /** Linha de confiança do rodapé (`PublicFooter.trust` é texto simples). */
  protected readonly trust = computed(() => {
    const name = this.name();
    const tutor = this.tutor();
    return tutor === null
      ? $localize`Faro é a tag de identificação de ${name}:name:.`
      : $localize`Faro é a tag de identificação de ${name}:name:. A conversa é direto entre você e ${tutor}:tutor:.`;
  });

  protected readonly photoAlt = computed(() => $localize`Foto de ${this.name()}:name:`);
}
