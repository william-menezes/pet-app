/**
 * Login — tela de login do painel Faro (T027).
 *
 * US1: e-mail/senha + roteamento por papel.
 * US2: Google OAuth (botão ativo).
 * US3: "manter conectado" + sessão expirada + logout (banner pós-logout).
 *
 * Segurança:
 * - Mensagem de falha SEMPRE genérica (FR-014/019 anti-enumeração).
 * - Timing uniforme: não ramifica por código do GoTrue (SC-004).
 * - Token NUNCA lido aqui — só pelo AuthService em core/ (T020d).
 * - Guards são UX; autorização real = RLS no banco.
 *
 * A11y: WCAG 2.1 AA, aria-live em erros, aria-describedby nos campos,
 *        foco visível, navegação por teclado, targets ≥ 44px.
 */
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

// PrimeNG — componentes nativos (sem wrappers custom; decisão do tutor 2026-07-01)
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';

// Core (token nunca lido fora de core/)
import { AuthService } from '../../../core/auth/auth.service';
import { roleRedirect } from '../../../core/auth/role-redirect';

type FormError = 'invalid' | 'rate_limited' | 'unconfirmed' | 'provider_unavailable' | 'network' | null;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ToastModule,
    InputTextModule,
    PasswordModule,
    CheckboxModule,
    ButtonModule,
    MessageModule,
    DividerModule,
  ],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly messageService = inject(MessageService);

  // ── Formulário (Reactive Forms tipado) ──
  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  // ── Estado local (signals) ──
  readonly isLoading = signal(false);
  readonly formError = signal<FormError>(null);
  readonly isUnconfirmed = signal(false);
  readonly isGoogleDisabled = signal(false);
  readonly showSessionExpired = signal(false);
  readonly showLoggedOut = signal(false);

  // ── Computed: mensagem do banner de erro ──
  readonly errorBannerMessage = computed<string | null>(() => {
    const err = this.formError();
    if (!err) return null;
    return this.authService.getErrorMessage(err);
  });

  // ── Erros inline de campo (getters — ReactiveForm controls são non-signal, getter é correto) ──
  get emailFieldError(): string | null {
    const ctrl = this.form.get('email');
    if (!ctrl || !ctrl.touched || ctrl.valid) return null;
    if (ctrl.hasError('required')) return 'Informe seu e-mail.';
    if (ctrl.hasError('email')) return 'Informe um e-mail válido.';
    return null;
  }

  get passwordFieldError(): string | null {
    const ctrl = this.form.get('password');
    if (!ctrl || !ctrl.touched || ctrl.valid) return null;
    if (ctrl.hasError('required')) return 'Informe sua senha.';
    return null;
  }

  // ── Destino pós-login (returnUrl) ──
  private returnUrl = '/app';

  ngOnInit(): void {
    // Lê queryParams para session-expired e returnUrl (FR-012)
    this.route.queryParams.subscribe((params) => {
      this.returnUrl = params['returnUrl'] ?? '/app';

      if (params['reason'] === 'session_expired') {
        this.showSessionExpired.set(true);
      }

      if (params['loggedOut'] === '1') {
        this.showLoggedOut.set(true);
        // Remove o queryParam da URL para não reaparecer ao recarregar
        this.router.navigate([], {
          replaceUrl: true,
          queryParams: { loggedOut: null },
          queryParamsHandling: 'merge',
        });
      }

      // Erro vindo do callback Google (provider_unavailable/network)
      if (params['error'] === 'provider_unavailable') {
        this.formError.set('provider_unavailable');
        this.isGoogleDisabled.set(true);
      } else if (params['error'] === 'google_cancelled') {
        this.formError.set(null);
        this.showGoogleCancelledInfo();
      }
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Ações do formulário
  // ────────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    // Marca todos os campos como tocados para exibir erros inline
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isLoading()) return;

    const { email, password, rememberMe } = this.form.value as {
      email: string;
      password: string;
      rememberMe: boolean;
    };

    this.isLoading.set(true);
    this.formError.set(null);
    this.isUnconfirmed.set(false);
    this.showSessionExpired.set(false);

    // Define storage ANTES do signIn (FR-007/008/009)
    this.authService.setRememberMe(rememberMe);

    try {
      const result = await this.authService.signInPassword(email, password);

      if (!result.ok) {
        this.formError.set(result.reason ?? 'invalid');
        if (result.reason === 'unconfirmed') {
          this.isUnconfirmed.set(true);
        }
        return;
      }

      // Sucesso: roteia ao destino do papel ou returnUrl (FR-005/006/012)
      const destination = result.role ? roleRedirect(result.role) : this.returnUrl;
      await this.router.navigate([destination]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onGoogleLogin(): Promise<void> {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.formError.set(null);
    this.isGoogleDisabled.set(true);

    try {
      await this.authService.signInWithGoogle();
      // O redirect para o Google acontece aqui; a página não volta até o callback
    } catch {
      this.formError.set('provider_unavailable');
      this.isGoogleDisabled.set(false);
      this.isLoading.set(false);
    }
  }

  async onResendConfirmation(): Promise<void> {
    const email = this.form.get('email')?.value as string;
    if (!email) return;

    await this.authService.resendConfirmation(email);

    // Toast de confirmação (resposta uniforme — não confirma existência)
    this.messageService.add({
      severity: 'success',
      summary: 'E-mail reenviado',
      detail: 'E-mail de confirmação reenviado. Verifique sua caixa de entrada.',
      life: 6000,
    });
  }

  onProvisionalLink(event: Event): void {
    event.preventDefault();
    this.messageService.add({
      severity: 'info',
      summary: 'Em breve',
      detail: 'Esta função estará disponível em breve.',
      life: 4000,
    });
  }

  private showGoogleCancelledInfo(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Login não concluído',
      detail: 'Login com Google não foi concluído. Use e-mail e senha para entrar.',
      life: 5000,
    });
  }

  // ── Helpers para o template ──
  get emailCtrl() {
    return this.form.get('email')!;
  }

  get passwordCtrl() {
    return this.form.get('password')!;
  }

  get isErrorBanner(): boolean {
    const err = this.formError();
    return err === 'invalid' || err === 'rate_limited' || err === 'network';
  }

  get isWarnBanner(): boolean {
    return this.formError() === 'rate_limited' || this.formError() === 'provider_unavailable';
  }

  get bannerSeverity(): 'error' | 'warn' | 'info' {
    const err = this.formError();
    if (err === 'rate_limited' || err === 'provider_unavailable') return 'warn';
    if (err === 'network') return 'warn';
    return 'error';
  }

  get submitButtonDisabled(): boolean {
    return this.isLoading() || this.formError() === 'rate_limited';
  }
}
