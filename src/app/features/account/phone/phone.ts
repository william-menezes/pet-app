import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { Note } from '@/shared/components/faro/note/note';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { AccountService } from '../../../core/account/account.service';
import { AccountStore } from '../../../core/account/account.store';
import { formatBrPhone } from '../../../core/account/phone';
import { ACCOUNT_ICONS } from '../shared/account-icons';

/** A pessoa volta para esta tela depois do fluxo de `/auth/celular` e `/auth/confirmar-celular`. */
const PHONE_URL = '/app/conta/celular';

type PhoneState = 'confirmed' | 'unconfirmed' | 'pending';

/** "02 nov 2026", no fuso de São Paulo. */
function formatDay(iso: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')} ${get('month').replace('.', '')} ${get('year')}`;
}

/**
 * Celular, `/app/conta/celular` (spec 004 T084). Referências: `V2-conta-celular*.dc.html` e
 * `V2-conta-celular-pendente*.dc.html`. Três estados:
 * - confirmado: número, selo, data e "Trocar celular";
 * - não confirmado: aviso e "Confirmar celular" (o número pode ser o do cadastro);
 * - troca pendente (há confirmado e um novo aguardando o código): "Aguardando confirmação de {número}".
 * O número antigo continua valendo durante a troca. Os botões levam ao fluxo de `/auth`.
 */
@Component({
  selector: 'app-account-phone',
  imports: [
    RouterLink,
    ScreenHeader,
    Note,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
  ],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phone.html',
})
export class AccountPhone implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly accountStore = inject(AccountStore);

  protected readonly account = this.accountStore.account;
  protected readonly loading = signal(true);
  protected readonly returnQuery = { returnUrl: PHONE_URL };

  protected readonly state = computed<PhoneState>(() => {
    const account = this.account();
    if (account === null || !this.accountStore.phoneConfirmed()) return 'unconfirmed';
    const pending = account.celularPendente;
    return pending !== null && pending !== account.celular ? 'pending' : 'confirmed';
  });

  protected readonly number = computed(() => {
    const account = this.account();
    const value = account?.celular ?? account?.celularPendente ?? null;
    return value === null ? null : formatBrPhone(value);
  });

  protected readonly pendingText = computed(() => {
    const pending = this.account()?.celularPendente ?? null;
    const formatted = pending === null ? '' : formatBrPhone(pending);
    return $localize`Aguardando confirmação de ${formatted}:number:`;
  });

  protected readonly confirmedOn = computed(() => {
    const iso = this.account()?.celularConfirmadoEm ?? null;
    return iso === null ? null : formatDay(iso);
  });

  /** Sem número confirmado, o número mostrado é o informado no cadastro. */
  protected readonly fromSignup = computed(
    () => this.state() === 'unconfirmed' && this.account()?.celular == null && this.number() !== null,
  );

  async ngOnInit(): Promise<void> {
    try {
      await this.accountService.ensureLoaded();
    } finally {
      this.loading.set(false);
    }
  }

  protected reload(): void {
    this.loading.set(true);
    void this.accountService.load(true).finally(() => this.loading.set(false));
  }
}
