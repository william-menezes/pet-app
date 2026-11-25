import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { Note } from '@/shared/components/faro/note/note';
import { CAPTCHA_FAILED_MESSAGE } from '@/shared/components/faro/turnstile/captcha-messages';
import { Turnstile } from '@/shared/components/faro/turnstile/turnstile';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { AccountService } from '../../../core/account/account.service';
import { PhoneVerificationService } from '../../../core/account/phone-verification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { RegistrationService } from '../../../core/auth/registration.service';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';
import { AuthStatusBadge } from '../shared/status-badge';

/** Segundos entre dois reenvios (contrato §4, "Confirme seu e-mail"). */
export const RESEND_SECONDS = 60;

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Confirmar e-mail (`/auth/confirmar-email`, spec 004 T035 e T036). Sem guard.
 *
 * Três estados, pela URL:
 * - espera (sem `token_hash`): e-mail do estado do roteador, reenvio com contagem, avanço automático
 *   se a sessão aparecer em outra aba;
 * - link (`token_hash` e `type=email`): NENHUMA chamada ao carregar (scanners de e-mail abrem links);
 *   o botão confirma;
 * - link inválido: depois de `invalid_link`.
 *
 * Referência: `V2-confirmar-email{,-link,-invalido}*.dc.html`.
 */
@Component({
  selector: 'app-confirm-email',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    FlowShell,
    Note,
    AuthStatusBadge,
    Turnstile,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-email.html',
})
export class ConfirmEmail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly phoneVerification = inject(PhoneVerificationService);
  private readonly location = inject(Location);
  private readonly registration = inject(RegistrationService);
  private readonly postAuth = inject(PostAuthNavigator);
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly returnUrlService = inject(ReturnUrlService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly headline = [$localize`Falta`, $localize`um passo.`];
  protected readonly sub = $localize`Confirmar o e-mail protege a sua conta e as suas tags.`;

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** `token_hash` só vale com `type=email`. */
  protected readonly tokenHash = computed<string | null>(() => {
    const q = this.query();
    const token = q.get('token_hash');
    return token !== null && token !== '' && q.get('type') === 'email' ? token : null;
  });

  protected readonly invalidLink = signal(false);
  protected readonly mode = computed<'wait' | 'link' | 'invalid'>(() => {
    if (this.tokenHash() === null) return 'wait';
    return this.invalidLink() ? 'invalid' : 'link';
  });

  protected readonly confirming = signal(false);
  protected readonly confirmError = signal(false);

  /** E-mail vindo do cadastro, pelo estado do roteador (nunca pela URL). */
  protected readonly email = signal<string | null>(this.readEmailFromState());
  protected readonly emailControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(EMAIL_FORMAT)],
  });
  protected readonly emailError = signal(false);

  protected readonly resent = signal(false);
  protected readonly resending = signal(false);
  /** Desafio anti-robô (Turnstile): o reenvio gasta o token; `reset()` depois de cada pedido. */
  private readonly captcha = viewChild(Turnstile);
  protected readonly captchaFailed = signal(false);
  protected readonly captchaMessage = CAPTCHA_FAILED_MESSAGE;
  protected readonly resendDisabled = computed(
    () => this.remaining() > 0 || this.resending() || (this.captcha()?.pending() ?? false),
  );

  // Contagem do reenvio: guarda o instante final e um relógio de 1 s.
  private readonly deadline = signal(0);
  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;
  protected readonly remaining = computed(() =>
    Math.max(0, Math.ceil((this.deadline() - this.now()) / 1000)),
  );
  protected readonly countdownText = computed(() => {
    const total = this.remaining();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  protected readonly queryParams = computed(() => {
    const returnUrl = sanitizeReturnUrl(this.query().get('returnUrl'));
    return returnUrl === null ? null : { returnUrl };
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTimer());

    // Um link novo na mesma tela recomeça do zero.
    effect(() => {
      this.tokenHash();
      untracked(() => {
        this.invalidLink.set(false);
        this.confirmError.set(false);
      });
    });

    // Confirmou em outra aba do mesmo navegador: a sessão aparece e a tela segue sozinha.
    effect(() => {
      if (this.authStore.isAuthenticated() && untracked(() => this.mode()) === 'wait') {
        void this.postAuth.go();
      }
    });
  }

  ngOnInit(): void {
    this.returnUrlService.capture(this.query().get('returnUrl'));
    if (this.mode() === 'wait') {
      // Com e-mail no estado, o link acabou de ser enviado: a contagem começa em 60.
      if (this.email() !== null) this.startCountdown();
      // Quem aguarda não tem sessão neste navegador (o inicializador só restaura quando há chave
      // gravada); assina as mudanças de sessão para perceber a confirmação feita em outra aba.
      if (!this.authStore.isAuthenticated()) {
        void this.authService.restoreSession().catch(() => undefined);
      }
    }
  }

  private readEmailFromState(): string | null {
    const state = this.location.getState() as { email?: unknown } | null;
    const value = state?.email;
    return typeof value === 'string' && EMAIL_FORMAT.test(value) ? value : null;
  }

  private startCountdown(): void {
    this.stopTimer();
    this.now.set(Date.now());
    this.deadline.set(this.now() + RESEND_SECONDS * 1000);
    this.timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.remaining() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  protected async onResend(): Promise<void> {
    if (this.resending() || this.remaining() > 0) return;

    let target = this.email();
    if (target === null) {
      this.emailControl.markAsTouched();
      if (this.emailControl.invalid) {
        this.emailError.set(true);
        return;
      }
      target = this.emailControl.value.trim();
    }
    this.emailError.set(false);

    this.resending.set(true);
    this.captchaFailed.set(false);
    const captchaToken = this.captcha()?.token() ?? undefined;
    let result: Awaited<ReturnType<RegistrationService['resendConfirmation']>>;
    try {
      result = await this.registration.resendConfirmation(target, captchaToken);
    } finally {
      this.resending.set(false);
      this.captcha()?.reset();
    }
    if (!result.ok) {
      // Nada foi enviado: sem aviso de "enviamos" e sem espera.
      this.captchaFailed.set(true);
      return;
    }
    // Resposta uniforme: nunca revela se há cadastro pendente.
    this.resent.set(true);
    this.startCountdown();
  }

  /**
   * E-mail confirmado (T059). Conta com celular pendente: pede o SMS agora; sucesso leva à tela do código;
   * qualquer falha leva à tela do número, onde a pessoa vê o problema e pode tentar de novo. Sem celular
   * pendente, segue o fluxo normal. O destino guardado (returnUrl) acompanha todos os caminhos.
   */
  private async afterConfirmed(): Promise<void> {
    const account = await this.accountService.load(true);
    if (account?.celularPendente == null) {
      await this.postAuth.go();
      return;
    }
    const returnUrl = this.returnUrlService.peek() ?? sanitizeReturnUrl(this.query().get('returnUrl'));
    const extras = returnUrl === null ? {} : { queryParams: { returnUrl } };
    const started = await this.phoneVerification.start();
    await this.router.navigate([started.ok ? '/auth/confirmar-celular' : '/auth/celular'], {
      replaceUrl: true,
      ...extras,
    });
  }

  protected async onConfirm(): Promise<void> {
    const token = this.tokenHash();
    if (token === null || this.confirming()) return;
    this.confirming.set(true);
    this.confirmError.set(false);
    try {
      const result = await this.registration.confirmEmail(token);
      if (result.ok) {
        await this.afterConfirmed();
      } else if (result.reason === 'invalid_link') {
        this.invalidLink.set(true);
      } else {
        this.confirmError.set(true);
      }
    } finally {
      this.confirming.set(false);
    }
  }
}
