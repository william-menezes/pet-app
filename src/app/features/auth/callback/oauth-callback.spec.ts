import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { OAuthCallback } from './oauth-callback';

describe('OAuthCallback (T063)', () => {
  let fixture: ComponentFixture<OAuthCallback>;
  let handleOAuthCallback: ReturnType<typeof vi.fn>;
  let go: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function create(result: unknown | Error) {
    handleOAuthCallback = vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    });
    go = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: { handleOAuthCallback } },
        { provide: PostAuthNavigator, useValue: { go } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(OAuthCallback);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
  });

  it('sucesso: segue por PostAuthNavigator.go() e não navega por conta própria', async () => {
    await create({ ok: true, role: 'tutor' });
    expect(handleOAuthCallback).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancelamento (provedor sem sessão): volta ao login com a mensagem neutra e não segue o fluxo', async () => {
    await create({ ok: false, reason: 'provider_unavailable' });
    expect(go).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { error: 'google_cancelled' } });
  });

  it('cancelamento não cria sessão no AuthStore', async () => {
    await create({ ok: false, reason: 'provider_unavailable' });
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(false);
  });

  it('falha de rede do provedor volta ao login com o erro de rede', async () => {
    await create({ ok: false, reason: 'network' });
    expect(go).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { error: 'network' } });
  });

  it('exceção mostra o aviso de conexão com o caminho de volta ao login', async () => {
    await create(new Error('offline'));
    const el: HTMLElement = fixture.nativeElement;
    expect(go).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não conseguimos conectar.');
    expect(el.querySelector('a[href="/auth/login"]')).not.toBeNull();
  });

  it('o container de status é uma região aria-live="polite"', async () => {
    await create({ ok: true });
    const status = fixture.nativeElement.querySelector('[data-testid="login-callback-container"]') as HTMLElement;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});
