import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

type Listener = (event: { matches: boolean }) => void;

/** `matchMedia` falso e controlável: não depende do ambiente. */
function fakeMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const state = { matches: initial };
  const mql = {
    get matches() {
      return state.matches;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: () => mql });
  return {
    set(matches: boolean) {
      state.matches = matches;
      listeners.forEach((l) => l({ matches }));
    },
    listenerCount: () => listeners.size,
  };
}

describe('ThemeService', () => {
  const original = window.matchMedia;

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: original });
    localStorage.clear();
  });

  it('o padrão é "system" e, com o sistema claro, resolved é "light"', () => {
    fakeMatchMedia(false);
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
    expect(service.resolved()).toBe('light');
  });

  it('valor inválido guardado vira "system"', () => {
    fakeMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'roxo');
    expect(TestBed.inject(ThemeService).preference()).toBe('system');
  });

  it('lê o valor guardado ao iniciar', () => {
    fakeMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('dark');
    expect(service.resolved()).toBe('dark');
  });

  it('setPreference("dark") grava faro.theme = "dark" e resolved vira "dark"', () => {
    fakeMatchMedia(false);
    const service = TestBed.inject(ThemeService);
    service.setPreference('dark');
    expect(localStorage.getItem('faro.theme')).toBe('dark');
    expect(service.resolved()).toBe('dark');
  });

  it('"light" vale mesmo com o sistema escuro', () => {
    fakeMatchMedia(true);
    const service = TestBed.inject(ThemeService);
    service.setPreference('light');
    expect(service.resolved()).toBe('light');
  });

  it('com "system", resolved segue o matchMedia, inclusive quando ele muda', () => {
    const media = fakeMatchMedia(true);
    const service = TestBed.inject(ThemeService);
    expect(service.resolved()).toBe('dark');
    media.set(false);
    expect(service.resolved()).toBe('light');
    media.set(true);
    expect(service.resolved()).toBe('dark');
  });

  it('para de ouvir o sistema quando o serviço é destruído', () => {
    const media = fakeMatchMedia(false);
    TestBed.inject(ThemeService);
    expect(media.listenerCount()).toBe(1);
    TestBed.resetTestingModule();
    expect(media.listenerCount()).toBe(0);
  });

  it('se localStorage lançar erro, nada quebra', () => {
    fakeMatchMedia(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('negado');
    });
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
    expect(() => service.setPreference('dark')).not.toThrow();
    expect(service.resolved()).toBe('dark');
  });

  it('sem matchMedia, não quebra e segue claro', () => {
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: undefined });
    const service = TestBed.inject(ThemeService);
    expect(service.resolved()).toBe('light');
  });

  it('no servidor: preference "system", resolved "light" e não lê nem grava localStorage', () => {
    fakeMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
    expect(service.resolved()).toBe('light');
    service.setPreference('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
