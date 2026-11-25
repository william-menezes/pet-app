/**
 * OAuthCallback — T036
 *
 * Rota /auth/callback (CSR). Trata o retorno do OAuth do Google.
 * Aparece brevemente enquanto a sessão é processada.
 *
 * US2 cenários:
 *   1. Sucesso → PostAuthNavigator (termos, celular, destino guardado ou casa do papel).
 *   2. Cancelamento pelo usuário → volta ao login com mensagem neutra.
 *   3. Provedor indisponível → volta ao login com banner warn.
 *
 * A11y: role="status" + aria-live="polite" + aria-label no container.
 *       Foco posicionado no container ao carregar.
 * Segurança: token nunca lido aqui — processado pelo AuthService em core/.
 */
import { Component, OnInit, signal, inject, ElementRef, viewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Logo } from '@/shared/components/faro/logo/logo';
import { ZardSpinnerComponent } from '@/shared/components/spinner';
import { AuthService } from '../../../core/auth/auth.service';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [Logo, ZardSpinnerComponent],
  template: `
    <div class="flex min-h-dvh flex-col bg-background">
      <main class="flex flex-1 flex-col items-center justify-center px-4 py-6">
        <div class="flex w-full max-w-[440px] flex-col items-center gap-8">
          <app-logo tone="on-light" [height]="48" />

          <!-- Container de status (a11y: role=status, aria-live=polite) -->
          <div
            class="flex flex-col items-center gap-4 text-center focus:outline-none"
            role="status"
            aria-live="polite"
            aria-label="Verificando seu acesso"
            i18n-aria-label
            tabindex="-1"
            #statusContainer
            data-testid="login-callback-container">
            @if (!hasError()) {
              <span aria-hidden="true"><z-spinner class="size-12!" /></span>
              <h1 class="font-display text-xl font-semibold text-foreground" i18n>Verificando...</h1>
              <p class="max-w-[28ch] text-sm text-muted-foreground" i18n>
                Estamos validando seu acesso com o Google. Um momento.
              </p>
            } @else {
              <div class="flex flex-col items-center gap-4" role="alert" aria-live="assertive">
                <p class="text-sm text-text">{{ errorMessage() }}</p>
                <a
                  href="/auth/login"
                  class="inline-flex min-h-11 items-center px-2 text-sm font-medium text-link underline underline-offset-[3px] hover:text-foreground"
                  i18n>
                  Voltar ao login
                </a>
              </div>
            }
          </div>
        </div>
      </main>
    </div>
  `,
})
export class OAuthCallback implements OnInit, AfterViewInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly postAuth = inject(PostAuthNavigator);

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
          $localize`A verificação está demorando mais do que o esperado. Tente novamente.`,
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

      // Sucesso → aceite dos termos, celular, destino guardado ou casa do papel
      await this.postAuth.go();
    } catch {
      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = null;
      }
      this.hasError.set(true);
      this.errorMessage.set($localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`);
    }
  }
}
