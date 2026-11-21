import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardBadgeComponent } from '@/shared/components/badge';
import { Logo } from '@/shared/components/faro/logo/logo';

import type { NavItem } from '../nav-item';
import { ADMIN_NAV } from './admin-nav';

/**
 * Casca do admin (contrato `shells.contract.md` §4): barra no topo com abas roláveis abaixo de `xl`
 * e menu lateral no desktop. Sempre no tema claro. Só apresentação: não importa `core/auth`.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, NgIcon, Logo, ZardBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'data-testid': 'admin-shell' },
  templateUrl: './admin-shell.html',
})
export class AdminShell {
  readonly items = input<NavItem[]>(ADMIN_NAV);

  protected readonly tabItem =
    "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']";
  protected readonly sideItem = 'flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-semibold';
  protected readonly active = 'bg-foreground text-background';
  protected readonly inactive = 'text-text';

  /** `href="#conteudo"` puro navegaria para a raiz do site por causa do `<base href="/">`. */
  protected skipToContent(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }
}
