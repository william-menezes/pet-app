import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { Note } from '@/shared/components/faro/note/note';
import { CAPTCHA_FAILED_MESSAGE } from '@/shared/components/faro/turnstile/captcha-messages';
import { Turnstile } from '@/shared/components/faro/turnstile/turnstile';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { NgIcon, provideIcons } from '@ng-icons/core';

import { AccountService } from '../../../core/account/account.service';
import { AccountStore } from '../../../core/account/account.store';
import { formatBrPhone, maskBrPhoneInput, normalizeBrPhone } from '../../../core/account/phone';
import {
  PhoneVerificationService,
  type StartError,
} from '../../../core/account/phone-verification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';
import { ACCOUNT_ICONS } from '../../account/shared/account-icons';
import { Countdown } from '../shared/countdown';
import { formatWait } from '../shared/wait-time';

/** Para onde a troca de celular volta quando não há destino guardado. */
const CHANGE_FALLBACK_URL = '/app/conta/celular';

type EntryProblem = StartError | 'local_invalid_phone';

/**
 * Informar celular (`/auth/celular`, spec 004 T056 e T085). Referências: `V2-informar-celular*.dc.html` e,
 * no modo troca (`AccountStore.phoneConfirmed()` verdadeiro), `V2-trocar-celular*.dc.html`.
 *
 * Modo troca: o celular atual continua valendo até o novo ser confirmado; o servidor pede a prova de
 * que é a mesma pessoa (senha atual, ou entrar de novo com o Google). A senha vive só no campo e é
 * limpa depois de qualquer resposta.
 *
 * O número e o código nunca vão para a URL, para o storage ou para o log. O que o servidor responde
 * é repassado como veio (`PhoneVerificationService`); aqui só se escolhe o texto.
 */
@Component({
  selector: 'app-phone-entry',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    FlowShell,
    Note,
    Turnstile,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phone-entry.html',
})
export class PhoneEntry implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly verification = inject(PhoneVerificationService);
  private readonly accountStore = inject(AccountStore);
  private readonly authService = inject(AuthService);
  private readonly postAuth = inject(PostAuthNavigator);
  private readonly returnUrlService = inject(ReturnUrlService);

  protected readonly headline = [$localize`Um número`, $localize`que atende.`];
  protected readonly sub = $localize`É por ele que quem achou o seu pet fala com você. Por isso confirmamos antes.`;

  protected readonly phone = new FormControl('', { nonNullable: true });
  protected readonly password = new FormControl('', { nonNullable: true });
  protected readonly showPassword = signal(false);
  private readonly typedPassword = signal('');
  /** Método que o servidor pediu na última resposta `reauth_required`. */
  protected readonly reauthMethod = signal<'password' | 'google' | null>(null);
  protected readonly showPasswordLabel = $localize`Mostrar senha`;
  protected readonly hidePasswordLabel = $localize`Ocultar senha`;
  protected readonly sending = signal(false);
  /** Desafio anti-robô (Turnstile): só na troca de número com senha; o token vale uma vez. */
  private readonly captcha = viewChild(Turnstile);
  protected readonly problem = signal<EntryProblem | null>(null);
  private readonly retryAfter = signal<number | undefined>(undefined);
  protected readonly cooldown = new Countdown();

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly returnUrl = computed(() => sanitizeReturnUrl(this.query().get('returnUrl')));

  /** Modo troca: já existe um celular confirmado. */
  protected readonly changeMode = this.accountStore.phoneConfirmed;
  protected readonly currentPhone = computed(() => {
    const phone = this.accountStore.account()?.celular ?? null;
    return phone === null ? null : formatBrPhone(phone);
  });
  protected readonly needsPassword = computed(
    () => this.changeMode() && (this.accountStore.hasPassword() || this.reauthMethod() === 'password'),
  );
  protected readonly needsGoogle = computed(() => this.changeMode() && this.reauthMethod() === 'google');
  protected readonly passwordInvalid = computed(() => this.problem() === 'invalid_password');

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
      case 'captcha_failed':
        return CAPTCHA_FAILED_MESSAGE;
      case 'terms_required':
      case 'network':
        return $localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`;
    }
  });

  protected readonly sendDisabled = computed(
    () =>
      this.sending() ||
      this.cooldown.remaining() > 0 ||
      (this.needsPassword() && this.typedPassword() === '') ||
      (this.captcha()?.pending() ?? false),
  );

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

  protected onPasswordInput(): void {
    this.typedPassword.set(this.password.value);
    if (this.problem() === 'invalid_password' || this.problem() === 'reauth_required') this.problem.set(null);
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
      const password = this.needsPassword() ? this.password.value : undefined;
      const captchaToken = this.captcha()?.token() ?? undefined;
      const result = await this.verification.start({
        phone: e164,
        ...(password === undefined ? {} : { password }),
        ...(captchaToken ? { captchaToken } : {}),
      });
      this.clearPassword();
      this.captcha()?.reset();
      if (result.ok) {
        await this.router.navigate(['/auth/confirmar-celular'], this.queryParamsOptions());
        return;
      }
      if (result.error === 'terms_required') {
        await this.router.navigate(['/auth/termos'], this.queryParamsOptions());
        return;
      }
      if (result.error === 'reauth_required') {
        this.reauthMethod.set(result.method ?? (this.accountStore.hasPassword() ? 'password' : 'google'));
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

  /**
   * Modo troca: "Cancelar" (ou o X) volta para onde a pessoa estava, ou para a tela do celular, e apaga o
   * destino guardado no `init` para ele não sobrar num login futuro da mesma aba.
   */
  protected cancel(): Promise<boolean> {
    const target = this.returnUrl() ?? CHANGE_FALLBACK_URL;
    this.returnUrlService.clear();
    return this.router.navigateByUrl(target);
  }

  /** Conta só com o Google: guarda a volta para a tela do celular e abre o Google de novo. */
  protected async onGoogleReauth(): Promise<void> {
    if (this.sending()) return;
    this.returnUrlService.capture(CHANGE_FALLBACK_URL);
    await this.authService.signInWithGoogle();
  }

  private clearPassword(): void {
    this.password.setValue('');
    this.typedPassword.set('');
    this.showPassword.set(false);
  }

  private queryParamsOptions(): { queryParams?: { returnUrl: string } } {
    const returnUrl = this.returnUrl();
    return returnUrl === null ? {} : { queryParams: { returnUrl } };
  }
}
