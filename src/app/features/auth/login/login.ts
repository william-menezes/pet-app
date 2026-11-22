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
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

// Componentes do Faro (ZardUI + próprios)
import { NgIcon } from '@ng-icons/core';
import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCheckboxComponent } from '@/shared/components/checkbox';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSonnerComponent, ZardSonnerService } from '@/shared/components/sonner';
import { BRAND_HEADLINE, BRAND_SUB } from '@/shared/components/faro/brand-panel/brand-copy';
import { BrandPanel } from '@/shared/components/faro/brand-panel/brand-panel';
import { Focinho } from '@/shared/components/faro/focinho/focinho';
import { GoogleGlyph } from '@/shared/components/faro/google-glyph/google-glyph';
import { Logo } from '@/shared/components/faro/logo/logo';

// Core (token nunca lido fora de core/)
import { AuthService } from '../../../core/auth/auth.service';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';

type FormError = 'invalid' | 'rate_limited' | 'unconfirmed' | 'provider_unavailable' | 'network' | null;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIcon,
    RouterLink,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardCheckboxComponent,
    ZardFieldImports,
    ZardInputComponent,
    ZardSonnerComponent,
    BrandPanel,
    Focinho,
    GoogleGlyph,
    Logo,
  ],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sonner = inject(ZardSonnerService);
  private readonly postAuth = inject(PostAuthNavigator);
  private readonly returnUrlService = inject(ReturnUrlService);

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
  /** `?senha=alterada`: vindo da tela de nova senha (T071). */
  readonly showPasswordChanged = signal(false);
  readonly showPassword = signal(false);
  /** `returnUrl` sanitizado da URL, repassado aos links para criar conta e voltar (T037). */
  readonly linkQueryParams = signal<{ returnUrl: string } | null>(null);

  // Frase e apoio do painel de marca (desktop) e rótulos do botão de olho
  protected readonly brandHeadline = BRAND_HEADLINE;
  protected readonly brandSub = BRAND_SUB;
  protected readonly showPasswordLabel = $localize`Mostrar senha`;
  protected readonly hidePasswordLabel = $localize`Ocultar senha`;

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
    if (ctrl.hasError('required')) return $localize`Informe seu e-mail.`;
    if (ctrl.hasError('email')) return $localize`Informe um e-mail válido.`;
    return null;
  }

  get passwordFieldError(): string | null {
    const ctrl = this.form.get('password');
    if (!ctrl || !ctrl.touched || ctrl.valid) return null;
    if (ctrl.hasError('required')) return $localize`Informe sua senha.`;
    return null;
  }

  ngOnInit(): void {
    // Lê queryParams para session-expired e returnUrl (FR-012)
    this.route.queryParams.subscribe((params) => {
      // Guarda o destino já sanitizado; quem decide para onde ir é o PostAuthNavigator.
      this.returnUrlService.capture(params['returnUrl']);
      const safeReturnUrl = sanitizeReturnUrl(params['returnUrl']);
      this.linkQueryParams.set(safeReturnUrl === null ? null : { returnUrl: safeReturnUrl });

      if (params['reason'] === 'session_expired') {
        this.showSessionExpired.set(true);
      }

      this.showPasswordChanged.set(params['senha'] === 'alterada');

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

      // Sucesso: aceite dos termos, celular, destino guardado ou casa do papel (FR-005/006/012)
      await this.postAuth.go();
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
    this.sonner.success($localize`E-mail reenviado`, {
      description: $localize`E-mail de confirmação reenviado. Verifique sua caixa de entrada.`,
      duration: 6000,
    });
  }

  private showGoogleCancelledInfo(): void {
    this.sonner.info($localize`Login não concluído`, {
      description: $localize`Login com Google não foi concluído. Use e-mail e senha para entrar.`,
      duration: 5000,
    });
  }

  // ── Helpers para o template ──
  get emailCtrl() {
    return this.form.get('email')!;
  }

  get passwordCtrl() {
    return this.form.get('password')!;
  }

  /** Tom do aviso de erro (contrato §6.2): só credenciais inválidas é 'danger'. */
  get bannerType(): 'danger' | 'neutral' {
    return this.formError() === 'invalid' ? 'danger' : 'neutral';
  }

  get submitButtonDisabled(): boolean {
    return this.isLoading() || this.formError() === 'rate_limited';
  }
}
