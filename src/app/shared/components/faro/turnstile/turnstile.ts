import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { TURNSTILE_SITE_KEY, TurnstileScript } from './turnstile-script';
import type { TurnstileApi } from './turnstile-script';

/**
 * Desafio anti-robô (Cloudflare Turnstile), contrato `security-hardening.contract.md` §1.
 *
 * - Carrega o script sob demanda, quando a tela que o usa aparece. Não é overlay.
 * - Sem chave (`environment.turnstileSiteKey === ''`): não desenha nada, não carrega nada e `token()`
 *   devolve `null`; quem usa envia sem token (`pending()` fica falso).
 * - O token vale uma vez: a tela chama `reset()` depois de cada envio e espera o token novo.
 */
@Component({
  selector: 'app-turnstile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (enabled) {
      <div #container class="min-h-[65px] max-w-full overflow-hidden" data-testid="turnstile-widget"></div>
      @if (loadFailed()) {
        <p role="alert" class="mt-2 text-[13px] leading-[1.45] text-muted-foreground" data-testid="turnstile-error" i18n>
          Não foi possível carregar a verificação anti-robô. Recarregue a página e tente de novo.
        </p>
      }
    }
  `,
})
export class Turnstile {
  private readonly siteKey = inject(TURNSTILE_SITE_KEY);
  private readonly script = inject(TurnstileScript);

  /** Tema do widget: claro em `/auth`; em `/app/conta` a tela passa o tema resolvido do app. */
  readonly theme = input<'light' | 'dark'>('light');

  readonly enabled = this.siteKey !== '';

  private readonly _token = signal<string | null>(null);
  /** Token do desafio resolvido, ou `null` (sem chave, em andamento, vencido ou depois de `reset()`). */
  readonly token = this._token.asReadonly();
  /** `true` quando há chave e ainda não há token: a tela mantém o botão desabilitado. */
  readonly pending = computed(() => this.enabled && this._token() === null);
  /** O script ou o widget falhou: a tela mostra o aviso do próprio componente. */
  readonly loadFailed = signal(false);

  private readonly container = viewChild<ElementRef<HTMLElement>>('container');
  private api: TurnstileApi | null = null;
  private widgetId: string | null = null;
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      void this.mount();
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.api && this.widgetId !== null) {
        try {
          this.api.remove(this.widgetId);
        } catch {
          // o widget já saiu da página
        }
      }
    });
  }

  /** Zera o token e pede um novo desafio. Chamar depois de cada envio (com sucesso ou erro). */
  reset(): void {
    this._token.set(null);
    if (this.destroyed) return;
    if (this.api && this.widgetId !== null) {
      try {
        this.api.reset(this.widgetId);
      } catch {
        this.loadFailed.set(true);
      }
    }
  }

  private async mount(): Promise<void> {
    if (!this.enabled) return;
    let api: TurnstileApi;
    try {
      api = await this.script.load();
    } catch {
      if (!this.destroyed) this.loadFailed.set(true);
      return;
    }
    const element = this.container()?.nativeElement;
    if (this.destroyed || !element) return;
    this.api = api;
    this.widgetId = api.render(element, {
      sitekey: this.siteKey,
      theme: this.theme(),
      size: 'flexible',
      callback: (token) => {
        this.loadFailed.set(false);
        this._token.set(token);
      },
      'expired-callback': () => this._token.set(null),
      'timeout-callback': () => this._token.set(null),
      'error-callback': () => {
        this._token.set(null);
        this.loadFailed.set(true);
      },
    });
  }
}
