import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ThemePreference, ThemeService } from '@/core/theme/theme.service';

import { AccountAppearance } from './appearance';

describe('AccountAppearance', () => {
  let fixture: ComponentFixture<AccountAppearance>;
  let el: HTMLElement;
  let setPreference: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(initial: ThemePreference) {
    const preference = signal<ThemePreference>(initial);
    setPreference = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ThemeService, useValue: { preference, setPreference } },
      ],
    });
    fixture = TestBed.createComponent(AccountAppearance);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  it('tem as três opções com os rótulos e os data-testid do contrato', async () => {
    await create('system');
    expect(byId('account-appearance-light').textContent?.trim()).toBe('Clara');
    expect(byId('account-appearance-dark').textContent?.trim()).toBe('Escura');
    expect(byId('account-appearance-system').textContent?.trim()).toBe('Igual ao sistema');
    expect(el.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Tema do app');
  });

  it.each([
    ['light', 'account-appearance-light'],
    ['dark', 'account-appearance-dark'],
    ['system', 'account-appearance-system'],
  ] as const)('com a preferência "%s" só a opção certa fica marcada', async (value, marked) => {
    await create(value);
    for (const id of ['account-appearance-light', 'account-appearance-dark', 'account-appearance-system']) {
      expect(byId(id).getAttribute('aria-pressed'), id).toBe(id === marked ? 'true' : 'false');
    }
  });

  it.each([
    ['account-appearance-light', 'light'],
    ['account-appearance-dark', 'dark'],
    ['account-appearance-system', 'system'],
  ] as const)('tocar em %s chama setPreference("%s")', async (id, value) => {
    // parte de uma preferência diferente da que será tocada
    await create(value === 'light' ? 'dark' : 'light');
    byId(id).click();
    await settle();
    expect(setPreference).toHaveBeenCalledWith(value);
    expect(setPreference).toHaveBeenCalledTimes(1);
  });

});
