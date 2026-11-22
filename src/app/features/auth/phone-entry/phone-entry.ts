import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { Note } from '@/shared/components/faro/note/note';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { AccountService } from '../../../core/account/account.service';
import { formatBrPhone, maskBrPhoneInput, normalizeBrPhone } from '../../../core/account/phone';
import {
  PhoneVerificationService,
  type StartError,
} from '../../../core/account/phone-verification.service';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';
import { Countdown } from '../shared/countdown';
import { formatWait } from '../shared/wait-time';

type EntryProblem = StartError | 'local_invalid_phone';

/**
 * Informar celular (`/auth/celular`, spec 004 T056), modo primeira confirmação. O modo troca (celular
 * já confirmado, com senha ou Google) é a T085. Referência: `V2-informar-celular*.dc.html`.
 *
 * O número e o código nunca vão para a URL, para o storage ou para o log. O que o servidor responde
 * é repassado como veio (`PhoneVerificationService`); aqui só se escolhe o texto.
 */
@Component({
  selector: 'app-phone-entry',
  imports: [
    ReactiveFormsModule,
    FlowShell,
    Note,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phone-entry.html',
})
export class PhoneEntry implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly verification = inject(PhoneVerificationService);
  private readonly postAuth = inject(PostAuthNavigator);
  private readonly returnUrlService = inject(ReturnUrlService);

  protected readonly headline = [$localize`Um número`, $localize`que atende.`];
  protected readonly sub = $localize`É por ele que quem achou o seu pet fala com você. Por isso confirmamos antes.`;

  protected readonly phone = new FormControl('', { nonNullable: true });
  protected readonly sending = signal(false);
  protected readonly problem = signal<EntryProblem | null>(null);
  private readonly retryAfter = signal<number | undefined>(undefined);
  protected readonly cooldown = new Countdown();

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly returnUrl = computed(() => sanitizeReturnUrl(this.query().get('returnUrl')));

  protected readonly phoneInvalid = computed(
    () => this.problem() === 'invalid_phone' || this.problem() === 'local_invalid_phone',
  );

  protected readonly problemMessage = computed<string | null>(() => {
    const problem = this.problem();
    if (problem === null) return null;
    switch (problem) {
      case 'local_invalid_phone':
      case 'invalid_phone':
        return $localize`Confira o número. Use DDD + celular, como (11) 98765-4321.`;
      case 'email_not_confirmed':
        return $localize`Confirme seu e-mail antes de continuar.`;
      case 'same_number':
        return $localize`Este já é o seu celular confirmado.`;
      case 'reauth_required':
        return $localize`Para trocar o celular, confirme que é você.`;
      case 'invalid_password':
        return $localize`Senha incorreta.`;
      case 'cooldown':
        if (this.cooldown.remaining() === 0) return null;
        return $localize`Você poderá enviar em ${this.cooldown.text()}:time:.`;
      case 'rate_limited':
        return $localize`Muitos pedidos de código. Tente de novo em ${formatWait(this.retryAfter())}:time:.`;
      case 'sms_unavailable':
        return $localize`Não conseguimos enviar o SMS agora. Tente de novo mais tarde.`;
      case 'sms_send_failed':
        return $localize`Não conseguimos enviar o SMS agora. Tente de novo.`;
      case 'terms_required':
      case 'network':
        return $localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`;
    }
  });

  protected readonly sendDisabled = computed(() => this.sending() || this.cooldown.remaining() > 0);

  async ngOnInit(): Promise<void> {
    this.returnUrlService.capture(this.query().get('returnUrl'));
    // O número pendente do cadastro vem pré-preenchido, formatado.
    const account = await this.accountService.ensureLoaded();
    if (account?.celularPendente && this.phone.value === '') {
      this.phone.setValue(formatBrPhone(account.celularPendente));
    }
  }

  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const masked = maskBrPhoneInput(input.value);
    if (masked !== input.value) input.value = masked;
    this.phone.setValue(masked);
    if (this.phoneInvalid()) this.problem.set(null);
  }

  protected async onSend(): Promise<void> {
    if (this.sendDisabled()) return;
    this.problem.set(null);

    const e164 = normalizeBrPhone(this.phone.value);
    if (e164 === null) {
      this.problem.set('local_invalid_phone');
      return;
    }

    this.sending.set(true);
    try {
      const result = await this.verification.start({ phone: e164 });
      if (result.ok) {
        await this.router.navigate(['/auth/confirmar-celular'], this.queryParamsOptions());
        return;
      }
      if (result.error === 'terms_required') {
        await this.router.navigate(['/auth/termos'], this.queryParamsOptions());
        return;
      }
      this.retryAfter.set(result.retryAfterSeconds);
      if (result.error === 'cooldown' && result.retryAfterSeconds !== undefined) {
        this.cooldown.start(result.retryAfterSeconds);
      }
      this.problem.set(result.error);
    } finally {
      this.sending.set(false);
    }
  }

  protected skip(): Promise<boolean> {
    return this.postAuth.go({ skipPhone: true });
  }

  private queryParamsOptions(): { queryParams?: { returnUrl: string } } {
    const returnUrl = this.returnUrl();
    return returnUrl === null ? {} : { queryParams: { returnUrl } };
  }
}
