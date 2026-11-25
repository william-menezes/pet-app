import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCheckboxComponent } from '@/shared/components/checkbox';
import { GoogleGlyph } from '@/shared/components/faro/google-glyph/google-glyph';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { AccountService } from '../../../core/account/account.service';
import { AccountStore } from '../../../core/account/account.store';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';

/**
 * Aceitar os termos (`/auth/termos`, spec 004 T062). Referência: `V2-aceite-termos*.dc.html`.
 * Quem chega aqui está logado e ainda não aceitou (conta nova do Google, ou conta do e-mail antiga).
 * Depois do aceite, `PostAuthNavigator.go()` decide o próximo passo (celular ou destino guardado).
 * Os links dos textos abrem em nova aba para não perder esta tela.
 */
@Component({
  selector: 'app-accept-terms',
  imports: [
    ReactiveFormsModule,
    FlowShell,
    GoogleGlyph,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardCheckboxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accept-terms.html',
})
export class AcceptTerms implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly accountStore = inject(AccountStore);
  private readonly postAuth = inject(PostAuthNavigator);
  private readonly returnUrlService = inject(ReturnUrlService);

  protected readonly headline = [$localize`Só o`, $localize`necessário.`];
  protected readonly sub = $localize`Nome, e-mail e celular. Nada de CPF ou endereço para ativar a sua tag.`;

  protected readonly accepted = new FormControl(false, { nonNullable: true });
  private readonly acceptedValue = toSignal(this.accepted.valueChanges, { initialValue: false });

  protected readonly accepting = signal(false);
  protected readonly loggingOut = signal(false);
  protected readonly failed = signal(false);

  protected readonly account = this.accountStore.account;
  protected readonly isGoogle = computed(() => this.account()?.provedores.includes('google') === true);
  protected readonly canAccept = computed(
    () => this.acceptedValue() && !this.accepting() && !this.loggingOut(),
  );

  ngOnInit(): void {
    const returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    this.returnUrlService.capture(returnUrl);
    void this.accountService.ensureLoaded();
  }

  protected async onAccept(): Promise<void> {
    if (!this.canAccept()) return;
    this.failed.set(false);
    this.accepting.set(true);
    try {
      const result = await this.accountService.acceptTerms();
      if (!result.ok) {
        this.failed.set(true);
        return;
      }
      await this.postAuth.go();
    } finally {
      this.accepting.set(false);
    }
  }

  protected async onLogout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.accountService.logout();
    } finally {
      this.loggingOut.set(false);
    }
  }
}
