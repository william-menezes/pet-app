import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TURNSTILE_SCRIPT_URL, TURNSTILE_SITE_KEY } from './turnstile-script';
import type { TurnstileApi, TurnstileRenderOptions } from './turnstile-script';
import { Turnstile } from './turnstile';

/** Chave de teste da Cloudflare que sempre aprova (documentação "Testing"). */
const TEST_SITE_KEY = '1x00000000000000000000AA';

@Component({ imports: [Turnstile], template: `<app-turnstile [theme]="'light'" />` })
class Host {
  readonly turnstile = viewChild.required(Turnstile);
}

@Component({ imports: [Turnstile], template: `<app-turnstile /><app-turnstile />` })
class TwoHost {}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

function scripts(): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll<HTMLScriptElement>('script')).filter((s) =>
    s.src.startsWith('https://challenges.cloudflare.com/'),
  );
}

describe('Turnstile', () => {
  let renders: TurnstileRenderOptions[];
  let reset: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    renders = [];
    reset = vi.fn();
    remove = vi.fn();
    scripts().forEach((s) => s.remove());
    delete (window as TurnstileWindow).turnstile;
  });

  afterEach(() => {
    scripts().forEach((s) => s.remove());
    delete (window as TurnstileWindow).turnstile;
  });

  function installApi(): void {
    (window as TurnstileWindow).turnstile = {
      render: (_el, options) => {
        renders.push(options);
        return `widget-${renders.length}`;
      },
      reset: reset as unknown as TurnstileApi['reset'],
      remove: remove as unknown as TurnstileApi['remove'],
    };
  }

  function setup(siteKey: string): void {
    TestBed.configureTestingModule({ providers: [{ provide: TURNSTILE_SITE_KEY, useValue: siteKey }] });
  }

  it('sem chave: nenhum script é carregado e o token é nulo', async () => {
    setup('');
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(scripts()).toHaveLength(0);
    expect(fixture.componentInstance.turnstile().token()).toBeNull();
    expect(fixture.componentInstance.turnstile().pending()).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="turnstile-widget"]')).toBeNull();
  });

  it('com chave: carrega o script uma vez, desenha o widget e guarda o token; reset() zera', async () => {
    setup(TEST_SITE_KEY);
    installApi();
    const fixture = TestBed.createComponent(TwoHost);
    await fixture.whenStable();
    fixture.detectChanges();

    // `window.turnstile` já existia: nada a carregar, e dois widgets usam a mesma API.
    expect(scripts()).toHaveLength(0);
    await vi.waitFor(() => expect(renders).toHaveLength(2));
    expect(renders[0].sitekey).toBe(TEST_SITE_KEY);
    expect(renders[0].theme).toBe('light');

    fixture.destroy();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('com chave e sem a API na página: um só <script>, com a URL certa, mesmo com dois widgets', async () => {
    setup(TEST_SITE_KEY);
    const fixture = TestBed.createComponent(TwoHost);
    await fixture.whenStable();
    fixture.detectChanges();

    const found = scripts();
    expect(found).toHaveLength(1);
    expect(found[0].src).toBe(TURNSTILE_SCRIPT_URL);

    installApi();
    found[0].onload?.(new Event('load'));
    await vi.waitFor(() => expect(renders).toHaveLength(2));
  });

  it('o token vem do callback, expira e reset() zera e pede um novo desafio', async () => {
    setup(TEST_SITE_KEY);
    installApi();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();
    await vi.waitFor(() => expect(renders).toHaveLength(1));
    const turnstile = fixture.componentInstance.turnstile();

    expect(turnstile.pending()).toBe(true);
    renders[0].callback?.('token-1');
    expect(turnstile.token()).toBe('token-1');
    expect(turnstile.pending()).toBe(false);

    turnstile.reset();
    expect(turnstile.token()).toBeNull();
    expect(turnstile.pending()).toBe(true);
    expect(reset).toHaveBeenCalledWith('widget-1');

    renders[0].callback?.('token-2');
    renders[0]['expired-callback']?.();
    expect(turnstile.token()).toBeNull();
  });

  it('falha ao carregar o script: mostra o aviso e mantém o token nulo', async () => {
    setup(TEST_SITE_KEY);
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();

    scripts()[0].onerror?.(new Event('error'));
    await vi.waitFor(() => expect(fixture.componentInstance.turnstile().loadFailed()).toBe(true));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="turnstile-error"]')).not.toBeNull();
    expect(fixture.componentInstance.turnstile().token()).toBeNull();
  });
});
