import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { Note } from '@/shared/components/faro/note/note';
import { CAPTCHA_FAILED_MESSAGE } from '@/shared/components/faro/turnstile/captcha-messages';
import { ZardInputOtpComponent } from '@/shared/components/input-otp';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { formatBrPhone } from '../../../core/account/phone';
import {
  PhoneVerificationService,
  type ConfirmError,
  type StartError,
} from '../../../core/account/phone-verification.service';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';
import { Countdown } from '../shared/countdown';
import { formatWait } from '../shared/wait-time';

/**
 * - `loading`: lendo `phone_verification_status()`;
 * - `request`: há número pendente e nenhum código aberto ("Peça um código");
 * - `code`: as seis células;
 * - `ended`: código vencido, esgotado ou inexistente (`V2-confirmar-celular-vencido*`);
 * - `unavailable`: SMS indisponível (`V2-confirmar-celular-indisponivel*`);
 * - `load_error`: o status não carregou (rede).
 */
type View = 'loading' | 'request' | 'code' | 'ended' | 'unavailable' | 'load_error';

type Problem = ConfirmError | StartError;

/**
 * Confirmar celular (`/auth/confirmar-celular`, spec 004 T057 e T058).
 * Referência: `V2-confirmar-celular{,-erro,-vencido,-indisponivel}*.dc.html`.
 *
 * O código vive só no formulário: é apagado quando erra, vence ou dá certo e nunca vai para storage,
 * URL ou log. A conferência é toda do servidor.
 */
@Component({
  selector: 'app-confirm-phone',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    FlowShell,
    Note,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardInputOtpComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-phone.html',
})
export class ConfirmPhone implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly verification = inject(PhoneVerificationService);
  private readonly postAuth = inject(PostAuthNavigator);
  private readonly returnUrlService = inject(ReturnUrlService);

  protected readonly headline = [$localize`Um número`, $localize`que atende.`];
  protected readonly sub = $localize`É por ele que quem achou o seu pet fala com você. Por isso confirmamos antes.`;

  private readonly otp = viewChild(ZardInputOtpComponent);
  protected readonly code = new FormControl('', { nonNullable: true });
  protected readonly codeLength = signal(0);

  protected readonly view = signal<View>('loading');
  protected readonly phone = signal<string | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  private readonly attemptsLeft = signal<number | undefined>(undefined);
  private readonly retryAfter = signal<number | undefined>(undefined);
  protected readonly confirming = signal(false);
  protected readonly resending = signal(false);
  protected readonly countdown = new Countdown();

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly queryParams = computed(() => {
    const returnUrl = sanitizeReturnUrl(this.query().get('returnUrl'));
    return returnUrl === null ? null : { returnUrl };
  });

  protected readonly phoneText = computed(() => {
    const phone = this.phone();
    return phone === null ? '' : formatBrPhone(phone);
  });

  protected readonly canConfirm = computed(() => this.codeLength() === 6 && !this.confirming());
  protected readonly codeInvalid = computed(
    () => this.problem() === 'invalid_code' || this.problem() === 'invalid_format',
  );

  /** "Continuar sem confirmar" só aparece nos estados que o contrato indica. */
  protected readonly canContinueWithout = computed(
    () => this.view() === 'unavailable' || this.problem() === 'rate_limited',
  );

  protected readonly problemMessage = computed<string | null>(() => {
    const problem = this.problem();
    if (problem === null) return null;
    switch (problem) {
      case 'invalid_format':
        return $localize`Digite os 6 dígitos do código.`;
      case 'invalid_code': {
        const left = this.attemptsLeft();
        return left === 1
          ? $localize`Código incorreto. Você tem mais 1 tentativa.`
          : $localize`Código incorreto. Você tem mais ${left ?? 0}:count: tentativas.`;
      }
      case 'locked':
        return $localize`Muitas tentativas. Peça um novo código.`;
      case 'expired':
      case 'no_active':
        return $localize`Este código venceu. Peça um novo.`;
      case 'rate_limited':
        return $localize`Muitos pedidos de código. Tente de novo em ${formatWait(this.retryAfter())}:time:.`;
      case 'sms_unavailable':
      case 'sms_send_failed':
        return $localize`Não conseguimos enviar o SMS agora.`;
      case 'email_not_confirmed':
        return $localize`Confirme seu e-mail antes de continuar.`;
      case 'same_number':
        return $localize`Este já é o seu celular confirmado.`;
      case 'cooldown':
        return null;
      case 'captcha_failed':
        return CAPTCHA_FAILED_MESSAGE;
      case 'terms_required':
      case 'invalid_phone':
      case 'reauth_required':
      case 'invalid_password':
      case 'network':
        return $localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`;
    }
  });

  constructor() {
    this.code.valueChanges.subscribe((value) => this.codeLength.set(value.length));

    // Dá a cada célula o `data-testid` do contrato (`confirm-phone-cell-1` a `-6`).
    effect(() => {
      const inputs = this.otp()?.inputs() ?? [];
      inputs.forEach((ref, index) =>
        ref.nativeElement.setAttribute('data-testid', `confirm-phone-cell-${index + 1}`),
      );
    });
  }

  async ngOnInit(): Promise<void> {
    this.returnUrlService.capture(this.query().get('returnUrl'));
    await this.loadStatus();
  }

  protected async loadStatus(): Promise<void> {
    this.view.set('loading');
    const status = await this.verification.status();
    if (status === null) {
      this.view.set('load_error');
      return;
    }
    if (status.pendingPhone === null) {
      await this.router.navigate(['/auth/celular'], { replaceUrl: true, ...this.queryParamsOption() });
      return;
    }
    this.phone.set(status.pendingPhone);
    if (status.resendAvailableAt !== null) {
      const deadline = Date.parse(status.resendAvailableAt);
      if (Number.isFinite(deadline)) this.countdown.startAt(deadline);
    }
    this.view.set(status.active === null ? 'request' : 'code');
  }

  protected async onConfirm(): Promise<void> {
    if (!this.canConfirm()) return;
    const value = this.code.value;
    this.problem.set(null);
    this.confirming.set(true);
    try {
      const result = await this.verification.confirm(value);
      if (result.ok) {
        this.code.setValue('');
        await this.postAuth.go();
        return;
      }
      this.attemptsLeft.set(result.attemptsLeft);
      this.problem.set(result.error);
      switch (result.error) {
        case 'invalid_code':
          this.resetCode();
          break;
        case 'locked':
        case 'expired':
        case 'no_active':
          this.code.setValue('');
          this.view.set('ended');
          break;
        case 'invalid_format':
        case 'network':
          break;
      }
    } finally {
      this.confirming.set(false);
    }
  }

  /** "Reenviar código", "Enviar código por SMS" e "Tentar de novo": todos pedem um código novo. */
  protected async onResend(): Promise<void> {
    if (this.resending() || this.countdown.remaining() > 0) return;
    this.problem.set(null);
    this.resending.set(true);
    try {
      const result = await this.verification.start();
      if (result.ok) {
        this.phone.set(result.phone);
        const deadline = Date.parse(result.resendAvailableAt);
        if (Number.isFinite(deadline)) this.countdown.startAt(deadline);
        this.code.setValue('');
        this.view.set('code');
        return;
      }
      this.retryAfter.set(result.retryAfterSeconds);
      switch (result.error) {
        case 'cooldown':
          if (result.retryAfterSeconds !== undefined) this.countdown.start(result.retryAfterSeconds);
          this.problem.set('cooldown');
          break;
        case 'terms_required':
          await this.router.navigate(['/auth/termos'], this.queryParamsOption());
          break;
        case 'invalid_phone':
          await this.router.navigate(['/auth/celular'], this.queryParamsOption());
          break;
        case 'sms_unavailable':
        case 'sms_send_failed':
          this.problem.set(result.error);
          this.code.setValue('');
          this.view.set('unavailable');
          break;
        default:
          this.problem.set(result.error);
      }
    } finally {
      this.resending.set(false);
    }
  }

  protected continueWithout(): Promise<boolean> {
    return this.postAuth.go({ skipPhone: true });
  }

  /** Apaga as células e põe o foco na primeira. */
  private resetCode(): void {
    const otp = this.otp();
    if (otp) otp.clearValue();
    else this.code.setValue('');
  }

  private queryParamsOption(): { queryParams?: { returnUrl: string } } {
    const returnUrl = sanitizeReturnUrl(this.query().get('returnUrl'));
    return returnUrl === null ? {} : { queryParams: { returnUrl } };
  }
}
