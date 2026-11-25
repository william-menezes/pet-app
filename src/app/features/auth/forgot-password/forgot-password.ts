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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { CAPTCHA_FAILED_MESSAGE } from '@/shared/components/faro/turnstile/captcha-messages';
import { Turnstile } from '@/shared/components/faro/turnstile/turnstile';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { PasswordService } from '../../../core/auth/password.service';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';
import { Countdown } from '../shared/countdown';
import { AuthStatusBadge } from '../shared/status-badge';

/** Segundos de espera depois de cada envio (contrato §4, "Esqueci a senha"). */
export const RECOVERY_RESEND_SECONDS = 60;

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Esqueci a senha (`/auth/recuperar-senha`, spec 004 T069). Referências: `V2-recuperar-senha*.dc.html`
 * e `V2-recuperar-senha-enviado*.dc.html`.
 *
 * Anti-enumeração: depois do envio a tela mostra SEMPRE a mesma confirmação, haja ou não conta, com ou
 * sem falha de rede (`PasswordService.requestRecovery` nunca lança nem devolve erro). O e-mail nunca
 * vai para a URL.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    FlowShell,
    AuthStatusBadge,
    Turnstile,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.html',
})
export class ForgotPassword implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly passwords = inject(PasswordService);
  private readonly returnUrlService = inject(ReturnUrlService);

  protected readonly headline = [$localize`De volta em`, $localize`um minuto.`];
  protected readonly sub = $localize`Você cria uma senha nova e continua de onde parou.`;

  protected readonly email = new FormControl('', { nonNullable: true });
  protected readonly sending = signal(false);
  /** `true` depois do primeiro envio, para qualquer resposta. */
  protected readonly sent = signal(false);
  protected readonly emailError = signal<'required' | 'format' | null>(null);
  protected readonly countdown = new Countdown();
  /** Desafio anti-robô (Turnstile): o widget da tela atual (formulário ou "link enviado"). */
  private readonly captcha = viewChild(Turnstile);
  protected readonly captchaFailed = signal(false);
  protected readonly captchaMessage = CAPTCHA_FAILED_MESSAGE;

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly queryParams = computed(() => {
    const returnUrl = sanitizeReturnUrl(this.query().get('returnUrl'));
    return returnUrl === null ? null : { returnUrl };
  });

  protected readonly sendDisabled = computed(
    () => this.sending() || this.countdown.remaining() > 0 || (this.captcha()?.pending() ?? false),
  );

  ngOnInit(): void {
    this.returnUrlService.capture(this.query().get('returnUrl'));
  }

  protected onEmailInput(): void {
    if (this.emailError() !== null) this.emailError.set(null);
  }

  protected async onSend(): Promise<void> {
    if (this.sendDisabled()) return;

    const value = this.email.value.trim();
    if (value === '') {
      this.emailError.set('required');
      return;
    }
    if (!EMAIL_FORMAT.test(value)) {
      this.emailError.set('format');
      return;
    }
    this.emailError.set(null);

    this.sending.set(true);
    this.captchaFailed.set(false);
    // O token vale uma vez: lido aqui, e o widget é renovado em seguida, com qualquer resposta.
    const captchaToken = this.captcha()?.token() ?? undefined;
    try {
      // O serviço nunca lança; se lançasse, a tela seguiria igual (anti-enumeração).
      const result = await this.passwords.requestRecovery(value, captchaToken).catch(() => ({ ok: true }));
      if (!result.ok) {
        // Nada foi enviado: a tela não pode dizer "confira seu e-mail" nem iniciar a espera.
        this.captchaFailed.set(true);
        return;
      }
      // Sempre a mesma tela, e a espera de 60 s vale para qualquer resposta.
      this.sent.set(true);
      this.countdown.start(RECOVERY_RESEND_SECONDS);
    } finally {
      this.sending.set(false);
      this.captcha()?.reset();
    }
  }
}
