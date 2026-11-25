import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';

import { ThemeService } from '@/core/theme/theme.service';
import { Note } from '@/shared/components/faro/note/note';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { ACCOUNT_ICONS } from '../shared/account-icons';

/** Ids de teste do contrato, na ordem dos itens do segmentado. */
const ITEM_TEST_IDS = ['account-appearance-light', 'account-appearance-dark', 'account-appearance-system'];

/**
 * Aparência, `/app/conta/aparencia` (spec 004 T089). Referência: `V2-conta-aparencia*.dc.html`.
 * Segmentado de seleção única que reflete `ThemeService.preference()` e chama `setPreference`. Não
 * toca no DOM do tema nem no storage: quem aplica a classe `dark` é a casca do tutor, e quem grava a
 * escolha é o serviço de tema.
 */
@Component({
  selector: 'app-account-appearance',
  imports: [ScreenHeader, Note, ZardToggleGroupComponent],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appearance.html',
})
export class AccountAppearance {
  private readonly theme = inject(ThemeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly preference = this.theme.preference;

  protected readonly items: ZardToggleGroupItem[] = [
    { value: 'light', label: $localize`Clara` },
    { value: 'dark', label: $localize`Escura` },
    { value: 'system', label: $localize`Igual ao sistema` },
  ];

  constructor() {
    // O segmentado do ZardUI não expõe `data-testid` por item: o componente os põe nos botões depois
    // de renderizar (os itens são fixos).
    afterNextRender(() => {
      const buttons = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-slot="toggle-group-item"]');
      buttons.forEach((button, index) => {
        const id = ITEM_TEST_IDS[index];
        if (id) button.setAttribute('data-testid', id);
      });
    });
  }

  protected onChange(value: string | string[]): void {
    if (value === 'light' || value === 'dark' || value === 'system') {
      this.theme.setPreference(value);
    }
  }
}
