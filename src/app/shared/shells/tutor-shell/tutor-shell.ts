import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { Focinho } from '@/shared/components/faro/focinho/focinho';
import { Logo } from '@/shared/components/faro/logo/logo';

import type { NavItem } from '../nav-item';
import { TUTOR_NAV } from './tutor-nav';

const ITEM_BASE = 'items-center text-center';
const ACTIVE = 'bg-foreground text-background';

/**
 * Casca do app do tutor (contrato `shells.contract.md` §2): barra inferior no celular (só nas
 * telas-raiz), trilho no tablet e menu lateral no desktop. Só apresentação: não importa `core/auth`.
 */
@Component({
  selector: 'app-tutor-shell',
  imports: [RouterLink, RouterLinkActive, NgIcon, Focinho, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'data-testid': 'tutor-shell' },
  templateUrl: './tutor-shell.html',
})
export class TutorShell {
  readonly items = input<NavItem[]>(TUTOR_NAV);
  /** `true` nas telas-raiz: mostra a barra inferior no celular. */
  readonly bottomNav = input(false);
  readonly userName = input('');
  readonly userEmail = input('');

  protected readonly initial = computed(() => (this.userName().trim().charAt(0) || this.userEmail().trim().charAt(0)).toUpperCase());
  protected readonly mainClass = computed(
    () =>
      `flex min-w-0 flex-1 flex-col gap-3 px-4 pt-3 outline-none md:gap-4 md:px-7 md:py-6 xl:gap-5 xl:px-12 xl:py-8 ${
        this.bottomNav() ? 'pb-[104px] md:pb-6' : 'pb-4'
      }`,
  );

  protected readonly bottomItem = `flex h-[52px] flex-col justify-center gap-0.5 rounded-full text-[11px] font-semibold ${ITEM_BASE}`;
  protected readonly railItem = `flex h-[60px] w-16 flex-col justify-center gap-[3px] rounded-[18px] text-[11px] font-semibold ${ITEM_BASE}`;
  protected readonly sideItem = 'flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-semibold';
  protected readonly active = ACTIVE;

  /** `href="#conteudo"` puro navegaria para a raiz do site por causa do `<base href="/">`. */
  protected skipToContent(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }
}
