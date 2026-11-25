import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { PetService } from '../../../core/pets/pet.service';
import { TagService } from '../../../core/tags/tag.service';
import { PetCard } from '../pet-card/pet-card';
import { loadPetOverview, type PetOverviewItem } from '../pet-overview';

type State = 'loading' | 'ready' | 'error';

/**
 * Tela "Pets" (`/app/pets`, aba da navegação; referência `V2-pets*.dc.html`, claro e escuro): a lista de todos os
 * pets, com a situação da tag, e "Adicionar pet". Mesmos dados e mesmo cartão do "Seus pets" do painel.
 */
@Component({
  selector: 'app-pet-list',
  imports: [RouterLink, NgIcon, PetCard, ScreenHeader, ZardAlertComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full flex-col gap-3 md:gap-4" data-testid="pet-list">
      <app-screen-header title="Seus pets" i18n-title />

      <div aria-live="polite">
        @switch (state()) {
          @case ('loading') {
            <p class="py-6 text-center text-text" role="status" aria-busy="true" data-testid="pet-list-loading" i18n>Um instante…</p>
          }
          @case ('error') {
            <div class="flex flex-col items-start gap-3" data-testid="pet-list-error">
              <z-alert
                class="w-full"
                zType="danger"
                [zRole]="'status'"
                zDescription="Não conseguimos carregar os pets. Verifique sua conexão e tente de novo."
                i18n-zDescription />
              <button type="button" z-button zType="outline" (click)="load()" data-testid="pet-list-retry" i18n>Tentar de novo</button>
            </div>
          }
        }
      </div>

      @if (state() === 'ready') {
        <p class="text-sm text-muted-foreground" data-testid="pet-list-count">{{ countText() }}</p>
        <div class="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 xl:gap-5">
          @for (item of items(); track item.dash.id) {
            <app-pet-card [item]="item" />
          }
          <a
            class="flex min-h-[72px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-input text-[15px] font-semibold text-foreground"
            routerLink="/novo-pet"
            data-testid="pet-list-add">
            <ng-icon name="plus" size="20" aria-hidden="true" />
            <span i18n>Adicionar pet</span>
          </a>
        </div>
      }
    </div>
  `,
})
export class PetList implements OnInit {
  private readonly tags = inject(TagService);
  private readonly pets = inject(PetService);

  protected readonly state = signal<State>('loading');
  protected readonly items = signal<PetOverviewItem[]>([]);

  /** "2 pets · 1 tag ativa". */
  protected readonly countText = computed(() => {
    const total = this.items().length;
    const active = this.items().filter((i) => i.dash.hasTag).length;
    const pets = total === 1 ? $localize`1 pet` : $localize`${total}:total: pets`;
    const tags = active === 1 ? $localize`1 tag ativa` : $localize`${active}:active: tags ativas`;
    return total === 0 ? $localize`Nenhum pet ainda` : `${pets} · ${tags}`;
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const overview = await loadPetOverview(this.tags, this.pets);
    if (!overview.ok) {
      this.state.set('error');
      return;
    }
    this.items.set(overview.items);
    this.state.set('ready');
  }
}
