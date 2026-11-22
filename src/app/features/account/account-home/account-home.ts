import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';

import { ThemeService } from '@/core/theme/theme.service';
import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardItemImports } from '@/shared/components/item';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';

import { AccountService } from '../../../core/account/account.service';
import { AccountStore } from '../../../core/account/account.store';
import { formatBrPhone } from '../../../core/account/phone';
import { ACCOUNT_ICONS, AccountIconTile } from '../shared/account-icons';

/**
 * Conta (lista), `/app/conta` (spec 004 T079). Referência: `V2-conta*.dc.html` (claro e escuro).
 * Tela-raiz do app do tutor (`data: { hub: true }`): segue o tema do app. Cabeçalho com nome e e-mail,
 * cinco linhas e o botão "Sair". As telas internas são da Phase 8, com exceção de "Privacidade".
 */
@Component({
  selector: 'app-account-home',
  imports: [
    RouterLink,
    NgIcon,
    AccountIconTile,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardItemImports,
    ZardSkeletonComponent,
  ],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-home.html',
})
export class AccountHome implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly accountStore = inject(AccountStore);
  private readonly theme = inject(ThemeService);

  protected readonly account = this.accountStore.account;
  protected readonly phoneConfirmed = this.accountStore.phoneConfirmed;

  protected readonly loading = signal(true);
  protected readonly loggingOut = signal(false);

  protected readonly initial = computed(() => {
    const account = this.account();
    return (account?.nome.trim().charAt(0) || account?.email.trim().charAt(0) || '').toUpperCase();
  });

  /** Número formatado (confirmado, ou o pendente do cadastro enquanto não houver confirmado). */
  protected readonly phoneText = computed(() => {
    const account = this.account();
    const number = account?.celular ?? account?.celularPendente ?? null;
    return number === null ? null : formatBrPhone(number);
  });

  protected readonly appearanceText = computed(() => {
    switch (this.theme.preference()) {
      case 'light':
        return $localize`Clara`;
      case 'dark':
        return $localize`Escura`;
      case 'system':
        return $localize`Igual ao sistema`;
    }
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      await this.accountService.ensureLoaded();
    } finally {
      this.loading.set(false);
    }
  }

  protected async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.accountService.logout();
    } finally {
      this.loggingOut.set(false);
    }
  }
}
