import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { PetHero } from '@/shared/components/faro/pet-hero/pet-hero';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { PetService } from '../../../core/pets/pet.service';
import { RescueProfileService } from '../../../core/pets/rescue-profile.service';
import { TagService } from '../../../core/tags/tag.service';
import { loadErrorText, tagErrorMessage } from '../../../core/tags/tag-errors';
import type { DashboardPet, Pet, RescueProfile } from '../../../models';
import { formatScanTime } from '../../scans/scan-format';
import { petChips, petCoverLine } from '../pet-format';
import { PetLostRow } from './lost-row/lost-row';

/** Texto de erro de carga desta tela; o do limite de chamadas vem de `loadErrorText`. */
const LOAD_FAILED = $localize`Não conseguimos carregar o pet. Verifique sua conexão e tente de novo.`;

type State = 'loading' | 'ready' | 'error' | 'missing';

/**
 * Página do pet (`/app/pets/:petId`, T070; referência `V2-pet*.dc.html`, claro e escuro): capa, chips, a linha do
 * modo perdido (T062), os cartões da tag e do último scan e o menu.
 *
 * Três estados da tag: sem tag (botão "Vincular tag" no lugar do cartão), ativa (cartão da tag, modo perdido e
 * "Gerenciar tag") e bloqueada ("Tag bloqueada. Fale com o suporte.": sem modo perdido nem gerenciar, a tag não
 * funciona e o tutor não tem o que fazer com ela).
 */
@Component({
  selector: 'app-pet-page',
  imports: [
    RouterLink,
    NgIcon,
    IconTile,
    PetHero,
    PetLostRow,
    ScreenHeader,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pet-page.html',
})
export class PetPage {
  private readonly tags = inject(TagService);
  private readonly pets = inject(PetService);
  private readonly profiles = inject(RescueProfileService);

  /** Parâmetro de rota `:petId` (ligado por `withComponentInputBinding`). */
  readonly petId = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly errorText = signal(LOAD_FAILED);
  protected readonly dash = signal<DashboardPet | null>(null);
  protected readonly pet = signal<Pet | null>(null);
  protected readonly profile = signal<RescueProfile | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  private loadId = 0;

  protected readonly name = computed(() => this.pet()?.name ?? '');
  protected readonly coverLine = computed(() => {
    const pet = this.pet();
    return pet === null ? '' : petCoverLine(pet);
  });
  protected readonly chips = computed(() => {
    const pet = this.pet();
    return pet === null ? [] : petChips(pet);
  });
  protected readonly photoAlt = computed(() => $localize`Foto de ${this.name()}:name:`);

  protected readonly tagState = computed<'none' | 'active' | 'blocked'>(() => {
    const dash = this.dash();
    if (dash === null || !dash.hasTag) return 'none';
    return dash.tagStatus === 'blocked' ? 'blocked' : 'active';
  });
  protected readonly blockedMessage = $localize`Tag bloqueada. Fale com o suporte.`;
  protected readonly noTagMessage = tagErrorMessage('no_active_tag');

  protected readonly lastScanTime = computed(() => {
    const last = this.dash()?.lastScan;
    return last === null || last === undefined ? null : formatScanTime(last.occurredAt);
  });
  protected readonly lastScanCaption = computed(() => {
    const last = this.dash()?.lastScan;
    if (last === null || last === undefined) return $localize`Quando alguém escanear, aparece aqui`;
    switch (last.geoMethod) {
      case 'gps':
        return $localize`Localização precisa`;
      case 'ip':
        return $localize`Localização aproximada`;
      case 'none':
        return $localize`Sem localização`;
    }
  });
  protected readonly scansMonthText = computed(() => {
    const count = this.dash()?.scansMonth ?? 0;
    if (count === 0) return $localize`Nenhum scan este mês`;
    return count === 1 ? $localize`1 scan este mês` : $localize`${count}:count: scans este mês`;
  });
  protected readonly visibilityHint = computed(() => {
    const profile = this.profile();
    if (profile === null) return $localize`Escolha o que estranhos veem`;
    const whatsapp = profile.showWhatsapp ? $localize`WhatsApp liberado` : $localize`WhatsApp oculto`;
    const phone = profile.showPhone ? $localize`telefone liberado` : $localize`telefone oculto`;
    return `${whatsapp} · ${phone}`;
  });

  constructor() {
    effect(() => {
      this.petId();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    const petId = this.petId();
    const [dashboard, pet, profile] = await Promise.all([this.tags.myDashboard(), this.pets.get(petId), this.profiles.get(petId)]);
    if (id !== this.loadId) return;
    if (!dashboard.ok || (!pet.ok && pet.error !== 'not_found')) {
      this.errorText.set(loadErrorText(dashboard, LOAD_FAILED));
      this.state.set('error');
      return;
    }
    const dash = dashboard.dashboard.pets.find((p) => p.id === petId) ?? null;
    if (!pet.ok || dash === null) {
      this.state.set('missing');
      return;
    }
    const urls = await this.pets.photoUrls([pet.pet.photoPath]);
    if (id !== this.loadId) return;
    this.dash.set(dash);
    this.pet.set(pet.pet);
    // O perfil só alimenta uma linha do menu: se falhar, a linha perde o apoio e a tela segue.
    this.profile.set(profile.ok ? profile.profile : null);
    this.photoUrl.set(pet.pet.photoPath === null ? null : (urls[pet.pet.photoPath] ?? null));
    this.state.set('ready');
  }

  /** "Pet encontrado" confirmado: o modo perdido saiu no servidor; a tela relê o que mudou. */
  protected onFound(): void {
    this.dash.update((d) => (d === null ? d : { ...d, lostMode: false, lostSince: null }));
    void this.load();
  }
}
