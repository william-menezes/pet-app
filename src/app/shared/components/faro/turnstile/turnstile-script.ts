import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';

/** Script do desafio. Só é pedido quando uma tela que usa `app-turnstile` aparece (nunca no pacote inicial). */
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Chave pública (site key) do Turnstile. Vazia = desafio desligado: nada é carregado e as chamadas seguem
 * sem token. Os testes trocam o valor por este token, não pelo arquivo de ambiente.
 */
export const TURNSTILE_SITE_KEY = new InjectionToken<string>('TURNSTILE_SITE_KEY', {
  providedIn: 'root',
  factory: () => environment.turnstileSiteKey,
});

export interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  'timeout-callback'?: () => void;
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

/** Carrega o script do Turnstile uma única vez por aplicação, sob demanda. */
@Injectable({ providedIn: 'root' })
export class TurnstileScript {
  private readonly document = inject(DOCUMENT);
  private promise: Promise<TurnstileApi> | null = null;

  load(): Promise<TurnstileApi> {
    if (this.promise) return this.promise;
    const win = this.document.defaultView as TurnstileWindow | null;
    const attempt = new Promise<TurnstileApi>((resolve, reject) => {
      if (!win) {
        reject(new Error('turnstile: sem janela'));
        return;
      }
      if (win.turnstile) {
        resolve(win.turnstile);
        return;
      }
      const script = this.document.createElement('script');
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (win.turnstile) resolve(win.turnstile);
        else reject(new Error('turnstile: API ausente'));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('turnstile: script não carregou'));
      };
      this.document.head.appendChild(script);
    });
    this.promise = attempt;
    // Falhou: a próxima tela (ou "tentar de novo") pode pedir de novo.
    attempt.catch(() => {
      if (this.promise === attempt) this.promise = null;
    });
    return attempt;
  }
}
