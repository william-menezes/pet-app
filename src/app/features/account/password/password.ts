import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { Note } from '@/shared/components/faro/note/note';
import { CAPTCHA_FAILED_MESSAGE } from '@/shared/components/faro/turnstile/captcha-messages';
import { Turnstile } from '@/shared/components/faro/turnstile/turnstile';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { AccountService } from '../../../core/account/account.service';
import { AccountStore } from '../../../core/account/account.store';
import { PasswordService } from '../../../core/auth/password.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { ACCOUNT_ICONS } from '../shared/account-icons';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

type PasswordProblem =
  | 'current_empty'
  | 'weak'
  | 'too_long'
  | 'invalid_current'
  | 'rate_limited'
  | 'captcha_failed'
  | 'network';

/**
 * Senha, `/app/conta/senha` (spec 004 T088). Referência: `V2-conta-senha*.dc.html`.
 * Conta com senha: "Senha atual" e "Nova senha". Conta só com o Google: apenas a nota do contrato.
 * As senhas vivem só nos campos: são limpas depois de qualquer resposta e nunca vão a store, storage,
 * URL ou log. Segue o tema do app.
 */
@Component({
  selector: 'app-account-password',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    ScreenHeader,
    Note,
    Turnstile,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './password.html',
})
export class AccountPassword implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly accountStore = inject(AccountStore);
  private readonly passwordService = inject(PasswordService);
  /** Desafio anti-robô (Turnstile), no tema do app. O token vale uma vez: `reset()` depois de cada envio. */
  private readonly captcha = viewChild(Turnstile);
  protected readonly theme = inject(ThemeService).resolved;

  protected readonly loaded = this.accountStore.loaded;
  protected readonly hasPassword = this.accountStore.hasPassword;

  protected readonly current = new FormControl('', { nonNullable: true });
  protected readonly next = new FormControl('', { nonNullable: true });
  private readonly typedCurrent = signal('');
  private readonly typedNext = signal('');

  protected readonly showCurrent = signal(false);
  protected readonly showNext = signal(false);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly success = signal(false);
  protected readonly problem = signal<PasswordProblem | null>(null);

  protected readonly showPasswordLabel = $localize`Mostrar senha`;
  protected readonly hidePasswordLabel = $localize`Ocultar senha`;

  protected readonly canSubmit = computed(
    () =>
      this.typedCurrent() !== '' &&
      this.typedNext() !== '' &&
      !this.saving() &&
      !(this.captcha()?.pending() ?? false),
  );

  protected readonly currentInvalid = computed(
    () => this.problem() === 'current_empty' || this.problem() === 'invalid_current',
  );
  protected readonly nextInvalid = computed(() => this.problem() === 'weak' || this.problem() === 'too_long');

  protected readonly alertMessage = computed<string | null>(() => {
    switch (this.problem()) {
      case 'rate_limited':
        return $localize`Muitas tentativas. Aguarde alguns minutos.`;
      case 'captcha_failed':
        return CAPTCHA_FAILED_MESSAGE;
      case 'network':
        return $localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`;
      default:
        return null;
    }
  });

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

  protected onInput(): void {
    this.typedCurrent.set(this.current.value);
    this.typedNext.set(this.next.value);
    this.success.set(false);
    if (this.problem() !== null) this.problem.set(null);
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    const current = this.current.value;
    const next = this.next.value;

    if (current === '') {
      this.problem.set('current_empty');
      return;
    }
    if (next.length < PASSWORD_MIN) {
      this.problem.set('weak');
      return;
    }
    if (next.length > PASSWORD_MAX) {
      this.problem.set('too_long');
      return;
    }

    this.problem.set(null);
    this.success.set(false);
    this.saving.set(true);
    try {
      const captchaToken = this.captcha()?.token() ?? undefined;
      const result = await this.passwordService.changePassword(current, next, captchaToken);
      if (result.ok) {
        this.success.set(true);
        this.clearFields();
        return;
      }
      // A senha digitada não fica no campo depois de uma resposta (certa ou errada).
      this.current.setValue('');
      this.typedCurrent.set('');
      switch (result.reason) {
        case 'invalid_current':
          this.problem.set('invalid_current');
          break;
        case 'weak_password':
          this.problem.set('weak');
          break;
        case 'rate_limited':
          this.problem.set('rate_limited');
          break;
        case 'captcha_failed':
          this.problem.set('captcha_failed');
          break;
        default:
          this.problem.set('network');
      }
    } finally {
      this.saving.set(false);
      this.captcha()?.reset();
    }
  }

  private clearFields(): void {
    this.current.setValue('');
    this.next.setValue('');
    this.typedCurrent.set('');
    this.typedNext.set('');
    this.showCurrent.set(false);
    this.showNext.set(false);
  }
}
