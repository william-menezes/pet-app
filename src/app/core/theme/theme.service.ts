import { isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import type { Signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'faro.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Preferência de tema do aparelho (contrato `shells.contract.md` §6.2). Não toca no DOM: quem aplica
 * a classe `dark` é a casca do tutor. No servidor a preferência é `system` e o tema resolvido, `light`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly systemDark = signal(false);
  private readonly _preference = signal<ThemePreference>('system');

  /** O que o tutor escolheu. Padrão: `system`. */
  readonly preference: Signal<ThemePreference> = this._preference.asReadonly();
  /** O tema que vale agora: `system` é resolvido por `prefers-color-scheme`. */
  readonly resolved: Signal<ResolvedTheme> = computed(() => {
    const preference = this._preference();
    if (preference === 'system') return this.systemDark() ? 'dark' : 'light';
    return preference;
  });

  constructor() {
    if (!this.browser) return;
    this._preference.set(this.read());
    this.watchSystem(inject(DestroyRef));
  }

  /** Grava a escolha neste aparelho. */
  setPreference(preference: ThemePreference): void {
    if (!isPreference(preference)) return;
    this._preference.set(preference);
    if (!this.browser) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // navegação privada ou armazenamento negado: a escolha vale só até recarregar
    }
  }

  private read(): ThemePreference {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return isPreference(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private watchSystem(destroyRef: DestroyRef): void {
    try {
      const query = window.matchMedia(DARK_QUERY);
      this.systemDark.set(query.matches);
      const onChange = (event: { matches: boolean }) => this.systemDark.set(event.matches);
      query.addEventListener('change', onChange);
      destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
    } catch {
      // sem matchMedia: segue claro
    }
  }
}
