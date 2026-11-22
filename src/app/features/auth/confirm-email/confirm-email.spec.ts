import { Location } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { RegistrationService } from '../../../core/auth/registration.service';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { ConfirmEmail, RESEND_SECONDS } from './confirm-email';

describe('ConfirmEmail', () => {
  let fixture: ComponentFixture<ConfirmEmail>;
  let el: HTMLElement;
  let resendConfirmation: ReturnType<typeof vi.fn>;
  let confirmEmail: ReturnType<typeof vi.fn>;
  let go: ReturnType<typeof vi.fn>;
  let restoreSession: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  async function create(opts: { query?: Record<string, string>; state?: unknown } = {}) {
    resendConfirmation = vi.fn().mockResolvedValue(undefined);
    confirmEmail = vi.fn().mockResolvedValue({ ok: true });
    go = vi.fn().mockResolvedValue(true);
    restoreSession = vi.fn().mockResolvedValue(undefined);
    const params = new BehaviorSubject(convertToParamMap(opts.query ?? {}));

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
        { provide: Location, useValue: { getState: () => opts.state ?? null } },
        { provide: RegistrationService, useValue: { resendConfirmation, confirmEmail } },
        { provide: PostAuthNavigator, useValue: { go } },
        { provide: AuthService, useValue: { restoreSession } },
        { provide: ReturnUrlService, useValue: { capture: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ConfirmEmail);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    return params;
  }

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('estado de espera (sem token_hash)', () => {
    it('mostra o e-mail do estado do roteador e a contagem inicial de 60 s', async () => {
      await create({ state: { email: 'ana@email.com' } });
      expect(byId('confirm-email-address')?.textContent).toBe('ana@email.com');
      expect(byId('confirm-email-countdown')?.textContent).toContain('1:00');
      expect((byId('confirm-email-resend') as HTMLButtonElement).disabled).toBe(true);
      expect(byId('confirm-email-input')).toBeNull();
      expect(byId('confirm-email-login')?.getAttribute('href')).toBe('/auth/login');
      expect(RESEND_SECONDS).toBe(60);
    });

    it('a contagem desce e libera o reenvio ao zerar (relógio falso)', async () => {
      vi.useFakeTimers();
      await create({ state: { email: 'ana@email.com' } });
      vi.advanceTimersByTime(18_000);
      await settle();
      expect(byId('confirm-email-countdown')?.textContent).toContain('0:42');
      vi.advanceTimersByTime(42_000);
      await settle();
      expect(byId('confirm-email-countdown')).toBeNull();
      expect((byId('confirm-email-resend') as HTMLButtonElement).disabled).toBe(false);
    });

    it('reenviar chama resendConfirmation, mostra o aviso uniforme e reinicia a contagem', async () => {
      vi.useFakeTimers();
      await create({ state: { email: 'ana@email.com' } });
      vi.advanceTimersByTime(60_000);
      await settle();
      byId('confirm-email-resend')!.click();
      await vi.advanceTimersByTimeAsync(0);
      await settle();
      expect(resendConfirmation).toHaveBeenCalledWith('ana@email.com');
      expect(byId('confirm-email-resent-notice')?.textContent).toContain(
        'Se houver um cadastro pendente para este e-mail, enviamos um novo link.',
      );
      expect(byId('confirm-email-countdown')?.textContent).toContain('1:00');
    });

    it('o e-mail do estado só vale se tiver formato de e-mail', async () => {
      await create({ state: { email: 'nao-e-email' } });
      expect(byId('confirm-email-address')).toBeNull();
      expect(byId('confirm-email-input')).not.toBeNull();
    });

    describe('sem e-mail no estado', () => {
      it('mostra o campo, sem contagem, e reenvia o e-mail digitado', async () => {
        await create();
        expect(byId('confirm-email-address')).toBeNull();
        expect(byId('confirm-email-countdown')).toBeNull();
        const input = byId('confirm-email-input') as HTMLInputElement;
        input.value = ' ana@email.com ';
        input.dispatchEvent(new Event('input'));
        byId('confirm-email-resend')!.click();
        await settle();
        expect(resendConfirmation).toHaveBeenCalledWith('ana@email.com');
        expect(byId('confirm-email-resent-notice')).not.toBeNull();
      });

      it('e-mail inválido não reenvia', async () => {
        await create();
        const input = byId('confirm-email-input') as HTMLInputElement;
        input.value = 'ana@email';
        input.dispatchEvent(new Event('input'));
        byId('confirm-email-resend')!.click();
        await settle();
        expect(resendConfirmation).not.toHaveBeenCalled();
        expect(input.getAttribute('aria-invalid')).toBe('true');
      });
    });

    it('segue sozinha por PostAuthNavigator.go() quando a sessão aparece', async () => {
      await create({ state: { email: 'ana@email.com' } });
      expect(go).not.toHaveBeenCalled();
      expect(restoreSession).toHaveBeenCalledTimes(1);
      TestBed.inject(AuthStore).setSession({ user: { id: 'u1' } } as Session);
      fixture.detectChanges();
      await settle();
      expect(go).toHaveBeenCalledTimes(1);
    });
  });

  describe('estado do link (token_hash e type=email)', () => {
    const query = { token_hash: 'abc123', type: 'email' };

    it('não chama nada ao carregar e mostra o botão de confirmar', async () => {
      await create({ query });
      expect(confirmEmail).not.toHaveBeenCalled();
      expect(restoreSession).not.toHaveBeenCalled();
      expect(go).not.toHaveBeenCalled();
      expect(byId('confirm-email-confirm')?.textContent?.trim()).toBe('Confirmar meu e-mail');
      expect(el.querySelector('h1')?.textContent?.trim()).toBe('Confirmar seu e-mail');
    });

    it('sem type=email a URL é tratada como espera', async () => {
      await create({ query: { token_hash: 'abc123' } });
      expect(byId('confirm-email-confirm')).toBeNull();
      expect(byId('confirm-email-resend')).not.toBeNull();
    });

    it('o clique confirma uma vez e segue por PostAuthNavigator.go()', async () => {
      await create({ query });
      byId('confirm-email-confirm')!.click();
      await settle();
      expect(confirmEmail).toHaveBeenCalledTimes(1);
      expect(confirmEmail).toHaveBeenCalledWith('abc123');
      expect(go).toHaveBeenCalledTimes(1);
    });

    it('invalid_link mostra o estado "não vale mais" com os dois caminhos', async () => {
      await create({ query });
      confirmEmail.mockResolvedValue({ ok: false, reason: 'invalid_link' });
      byId('confirm-email-confirm')!.click();
      await settle();
      expect(go).not.toHaveBeenCalled();
      expect(byId('confirm-email-invalid')?.textContent).toContain('Este link não vale mais');
      expect(byId('confirm-email-new-link')?.getAttribute('href')).toBe('/auth/confirmar-email');
      expect(byId('confirm-email-login')?.getAttribute('href')).toBe('/auth/login');
    });

    it('falha de rede mantém o botão e mostra aviso', async () => {
      await create({ query });
      confirmEmail.mockResolvedValue({ ok: false, reason: 'network' });
      byId('confirm-email-confirm')!.click();
      await settle();
      expect(byId('confirm-email-error')).not.toBeNull();
      expect(byId('confirm-email-confirm')).not.toBeNull();
      expect(go).not.toHaveBeenCalled();
    });
  });
});
