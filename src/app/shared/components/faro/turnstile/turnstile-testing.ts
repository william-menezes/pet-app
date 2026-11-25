/**
 * Apoio de teste do desafio anti-robô: uma API `window.turnstile` falsa e as chaves de teste da
 * Cloudflare (documentação "Testing"). Só os testes importam este arquivo; as chaves são públicas e
 * nunca valem em produção.
 */
import type { TurnstileApi, TurnstileRenderOptions } from './turnstile-script';

/** Chave de teste que sempre aprova. */
export const TEST_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
/** Chave de teste que sempre reprova. */
export const FAILING_TURNSTILE_SITE_KEY = '2x00000000000000000000AB';

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

export class FakeTurnstile {
  readonly renders: TurnstileRenderOptions[] = [];
  resets = 0;
  removes = 0;

  install(): this {
    (window as TurnstileWindow).turnstile = {
      render: (_element, options) => {
        this.renders.push(options);
        return `widget-${this.renders.length}`;
      },
      reset: () => {
        this.resets += 1;
      },
      remove: () => {
        this.removes += 1;
      },
    };
    return this;
  }

  uninstall(): void {
    delete (window as TurnstileWindow).turnstile;
  }

  /** O desafio do widget mais recente foi resolvido. */
  solve(token: string): void {
    this.renders.at(-1)?.callback?.(token);
  }
}
