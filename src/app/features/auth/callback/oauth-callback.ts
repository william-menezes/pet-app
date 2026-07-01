/**
 * OAuthCallback — T036
 *
 * Rota /auth/callback (CSR). Trata o retorno do OAuth do Google.
 * Aparece brevemente enquanto a sessão é processada.
 *
 * US2 cenários:
 *   1. Sucesso → roteia por papel (tutor=/app, admin=/admin).
 *   2. Cancelamento pelo usuário → volta ao login com mensagem neutra.
 *   3. Provedor indisponível → volta ao login com banner warn.
 *
 * A11y: role="status" + aria-live="polite" + aria-label no container.
 *       Foco posicionado no container ao carregar.
 * Segurança: token nunca lido aqui — processado pelo AuthService em core/.
 */
import { Component, OnInit, signal, inject, ElementRef, viewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { roleRedirect } from '../../../core/auth/role-redirect';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [],
  template: `
    <div class="callback-page">
      <main class="callback-main">
        <div class="callback-card">

          <!-- Marca -->
          <div class="callback-brand" aria-hidden="true">
            <span class="callback-brand__name">Faro</span>
          </div>

          <!-- Container de loading (a11y: role=status, aria-live=polite) -->
          <div
            class="callback-container"
            role="status"
            aria-live="polite"
            aria-label="Verificando seu acesso"
            tabindex="-1"
            #statusContainer
            data-testid="login-callback-container">

            @if (!hasError()) {
              <!-- Spinner de verificação -->
              <div class="callback-spinner" aria-hidden="true"></div>
              <h1 class="callback-title">Verificando...</h1>
              <p class="callback-subtitle">
                Estamos validando seu acesso com o Google. Um momento.
              </p>
            } @else {
              <!-- Estado de erro com link de fallback -->
              <div class="callback-error" role="alert" aria-live="assertive">
                <p class="callback-error__text">{{ errorMessage() }}</p>
                <a href="/auth/login" class="callback-back-link">
                  Voltar ao login
                </a>
              </div>
            }

          </div>

        </div>
      </main>
    </div>
  `,
  styles: [`
    .callback-page {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      background: var(--app, #f7f8f8);
    }

    .callback-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    .callback-card {
      width: 100%;
      max-width: 440px;
      background: var(--surface-0, #ffffff);
      border-radius: var(--r-lg, 20px);
      box-shadow: var(--shadow-card, 0 1px 3px rgba(19,32,30,.08), 0 4px 12px rgba(19,32,30,.06));
      border: 1px solid var(--border, #e2e5e7);
      padding: 48px 32px;
    }

    .callback-brand {
      text-align: center;
      margin-bottom: 32px;
    }

    .callback-brand__name {
      font-family: "Poppins", system-ui, sans-serif;
      font-weight: 700;
      font-size: 24px;
      color: var(--primary, #3a4fd6);
    }

    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }

    .callback-container:focus {
      outline: none;
    }

    .callback-spinner {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 3px solid var(--indigo-100, #cbd3f5);
      border-top-color: var(--primary, #3a4fd6);
      animation: callback-spin 0.8s linear infinite;
    }

    @keyframes callback-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .callback-spinner {
        animation-duration: 2s;
      }
    }

    .callback-title {
      font-family: "Poppins", system-ui, sans-serif;
      font-weight: 700;
      font-size: 20px;
      color: var(--text-strong, #13201e);
      margin: 0;
    }

    .callback-subtitle {
      font-family: "Inter", system-ui, sans-serif;
      font-size: 14px;
      color: var(--muted, #5e6c69);
      margin: 0;
      max-width: 28ch;
    }

    .callback-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .callback-error__text {
      font-family: "Inter", system-ui, sans-serif;
      font-size: 14px;
      color: var(--warn, #946005);
      margin: 0;
    }

    .callback-back-link {
      font-family: "Inter", system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--primary, #3a4fd6);
      text-decoration: underline;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 0 8px;
      border-radius: 4px;
    }

    .callback-back-link:focus-visible {
      outline: 2px solid var(--primary, #3a4fd6);
      outline-offset: 2px;
    }
  `],
})
export class OAuthCallback implements OnInit, AfterViewInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly hasError = signal(false);
  readonly errorMessage = signal('');

  private readonly statusContainer = viewChild<ElementRef<HTMLElement>>('statusContainer');

  /** Fallback link "Voltar ao login" aparece após 8s se travar (ui-ux.md §4). */
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.processCallback();

    // Fallback: se travar por mais de 8s, exibe link de volta ao login
    this.fallbackTimer = setTimeout(() => {
      if (!this.hasError()) {
        this.hasError.set(true);
        this.errorMessage.set(
          'A verificação está demorando mais do que o esperado. Tente novamente.',
        );
      }
    }, 8000);
  }

  ngAfterViewInit(): void {
    // Posiciona o foco no container ao carregar (a11y: ui-ux.md §4)
    this.statusContainer()?.nativeElement.focus();
  }

  private async processCallback(): Promise<void> {
    try {
      const result = await this.authService.handleOAuthCallback();

      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = null;
      }

      if (!result.ok) {
        // Cancela ou erro do provedor → volta ao login com queryParam de erro
        const errorParam =
          result.reason === 'network' ? 'network' : 'provider_unavailable';

        // Cancelamento pelo usuário → mensagem neutra (US2 cen.2)
        // Provedor indisponível → banner warn (US2 cen.3)
        const isCancelled = result.reason === 'provider_unavailable';
        await this.router.navigate(['/auth/login'], {
          queryParams: {
            error: isCancelled ? 'google_cancelled' : errorParam,
          },
        });
        return;
      }

      // Sucesso → roteia por papel
      const destination = result.role ? roleRedirect(result.role) : '/app';
      await this.router.navigate([destination]);
    } catch {
      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = null;
      }
      this.hasError.set(true);
      this.errorMessage.set('Não conseguimos conectar. Verifique sua conexão e tente de novo.');
    }
  }
}
