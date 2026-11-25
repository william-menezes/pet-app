import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardBadgeComponent } from '@/shared/components/badge';
import { PetAvatar } from '@/shared/components/faro/pet-avatar/pet-avatar';

import { petSummary } from '../pet-format';
import type { PetOverviewItem } from '../pet-overview';

/**
 * Cartão de um pet nas listas ("Seus pets" do painel e a tela de pets): foto, nome, "Cão · SRD · 4 anos" e a
 * situação da tag. O cartão inteiro é um link para a página do pet.
 */
@Component({
  selector: 'app-pet-card',
  imports: [RouterLink, NgIcon, PetAvatar, ZardBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      class="flex min-h-[72px] items-center gap-3 rounded-2xl bg-card p-3.5 text-foreground"
      [routerLink]="['/app/pets', item().dash.id]"
      data-testid="pet-card-link">
      <app-pet-avatar [photoUrl]="item().photoUrl" [sizeClass]="'size-14'" />
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="truncate font-display text-base font-semibold" data-testid="pet-card-name">{{ item().dash.name }}</span>
        <span class="truncate text-[13px] text-muted-foreground" data-testid="pet-card-summary">{{ summary() }}</span>
        <span>
          <z-badge [zType]="badgeType()" data-testid="pet-card-badge">{{ badge() }}</z-badge>
        </span>
      </span>
      <ng-icon name="chev" size="20" class="shrink-0 text-muted-foreground" aria-hidden="true" />
    </a>
  `,
})
export class PetCard {
  readonly item = input.required<PetOverviewItem>();

  protected readonly summary = computed(() => {
    const { dash, pet } = this.item();
    return pet === null ? petSummary({ species: dash.species, breed: null, birthMonth: null }) : petSummary(pet);
  });
  protected readonly badge = computed(() => {
    const dash = this.item().dash;
    if (dash.lostMode) return $localize`Modo perdido`;
    if (!dash.hasTag) return $localize`Sem tag`;
    return dash.tagStatus === 'blocked' ? $localize`Tag bloqueada` : $localize`Tag ativa`;
  });
  protected readonly badgeType = computed(() => {
    const dash = this.item().dash;
    if (dash.lostMode) return 'warning' as const;
    // Vermelho é só para ação destrutiva e âmbar só para o modo perdido: tag bloqueada fica neutra.
    return dash.hasTag && dash.tagStatus !== 'blocked' ? ('success' as const) : ('neutral' as const);
  });
}
