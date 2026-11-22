import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ThemeService } from '@/core/theme/theme.service';
import type { ThemePreference } from '@/core/theme/theme.service';
import { ZardAlertDialogService } from '@/shared/components/alert-dialog';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ActionCard } from '@/shared/components/faro/action-card/action-card';
import { BrandMark } from '@/shared/components/faro/brand-mark/brand-mark';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { PetHero } from '@/shared/components/faro/pet-hero/pet-hero';
import { StatTile } from '@/shared/components/faro/stat-tile/stat-tile';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardItemImports } from '@/shared/components/item';
import { ZardSwitchComponent } from '@/shared/components/switch';
import { ZardToggleComponent } from '@/shared/components/toggle';
import { ZardToggleGroupComponent } from '@/shared/components/toggle-group';
import type { ZardToggleGroupItem } from '@/shared/components/toggle-group';
import { TutorShell } from '@/shared/shells/tutor-shell/tutor-shell';

import { GALLERY_TUTOR_NAV } from './gallery-nav';

/** Galeria: casca do tutor com a barra inferior (contrato `shells.contract.md` §8, `/dev/ui/tutor`). */
@Component({
  selector: 'app-gallery-tutor',
  imports: [
    TutorShell,
    PetHero,
    BrandMark,
    ActionCard,
    StatTile,
    IconTile,
    ZardItemImports,
    ZardSwitchComponent,
    ZardToggleComponent,
    ZardToggleGroupComponent,
    ZardBadgeComponent,
    ZardFieldImports,
    ZardInputComponent,
    ZardButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tutor-shell [items]="items" [bottomNav]="true" userName="Ana" userEmail="ana@email.com">
      <div class="flex flex-col gap-3 md:gap-4 xl:gap-5" data-testid="dev-gallery-tutor">
        <z-toggle-group
          zType="segmented"
          zMode="single"
          zAriaLabel="Tema do app"
          i18n-zAriaLabel
          [zItems]="themeItems"
          [zValue]="theme.preference()"
          (valueChange)="onTheme($event)"
          data-testid="dev-gallery-theme-switch"
        />
        <app-pet-hero class="h-[236px] md:h-[320px] xl:h-[400px]" name="Paçoca" subtitle="Tag ativa · 7K3M-Q9XA-C">
          <app-brand-mark heroTop [size]="44" />
        </app-pet-hero>

        <app-action-card title="Ative sua primeira tag" i18n-title>
          <ng-container i18n>Use o PIN do cartão que veio na embalagem.</ng-container>
          <button action type="button" z-button zType="ink" zSize="md" i18n>Ativar minha tag</button>
        </app-action-card>

        <div class="grid grid-cols-2 gap-3">
          <app-stat-tile label="Scans este mês" i18n-label value="3" caption="O último foi hoje" i18n-caption />
          <app-stat-tile label="Tags ativas" i18n-label value="1 de 1" link="/dev/ui/components" />
        </div>

        <div z-item-group>
          <div z-item>
            <z-item-media><app-icon-tile icon="eye" /></z-item-media>
            <z-item-content>
              <span z-item-title i18n>Mostrar telefone</span>
              <p z-item-description i18n>Quem achou o pet pode chamar no WhatsApp.</p>
            </z-item-content>
            <z-switch [zChecked]="true"><span class="sr-only" i18n>Mostrar telefone</span></z-switch>
          </div>
          <z-item-separator />
          <div z-item>
            <z-item-media><app-icon-tile icon="warn" tone="warning" /></z-item-media>
            <z-item-content>
              <span z-item-title i18n>Modo perdido</span>
              <p z-item-description i18n>Desligado.</p>
            </z-item-content>
            <z-badge zType="neutral" i18n>Desligado</z-badge>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <z-toggle zAriaLabel="Dócil" i18n-zAriaLabel>Dócil</z-toggle>
          <z-toggle zAriaLabel="Brincalhão" i18n-zAriaLabel [zValue]="true">Brincalhão</z-toggle>
          <z-badge zType="success" i18n>Ativa</z-badge>
          <z-badge zType="warning" i18n>Perdido</z-badge>
        </div>

        <div z-field>
          <label z-field-label for="gallery-tutor-name" i18n>Nome do pet</label>
          <input z-input id="gallery-tutor-name" type="text" value="Paçoca" />
        </div>

        <div class="flex flex-col items-start gap-2">
          <button type="button" z-button zType="default" data-testid="dev-gallery-tutor-primary" i18n>Salvar alterações</button>
          <button type="button" z-button zType="danger" data-testid="dev-gallery-tutor-open-dialog" (click)="openDialog()" i18n>
            Desvincular tag
          </button>
          <p class="text-sm text-muted-foreground" aria-live="polite" data-testid="dev-gallery-tutor-result">{{ result() }}</p>
        </div>
      </div>
    </app-tutor-shell>
  `,
})
export class GalleryTutor {
  private readonly dialogs = inject(ZardAlertDialogService);
  protected readonly theme = inject(ThemeService);

  protected readonly items = GALLERY_TUTOR_NAV;
  protected readonly themeItems: ZardToggleGroupItem[] = [
    { value: 'light', label: $localize`Claro` },
    { value: 'dark', label: $localize`Escuro` },
    { value: 'system', label: $localize`Sistema` },
  ];
  protected readonly result = signal('');

  protected onTheme(value: string | string[]): void {
    if (value === 'light' || value === 'dark' || value === 'system') this.theme.setPreference(value as ThemePreference);
  }

  protected openDialog(): void {
    this.dialogs.confirm({
      zTitle: $localize`Desvincular esta tag?`,
      zDescription: $localize`A Paçoca deixa de aparecer para quem ler esta tag. Você pode ativá-la de novo com o PIN.`,
      zOkText: $localize`Desvincular tag`,
      zCancelText: $localize`Cancelar`,
      zOkDestructive: true,
      zOnOk: () => this.result.set($localize`Tag desvinculada.`),
      zOnCancel: () => this.result.set($localize`Nada mudou.`),
    });
  }
}
