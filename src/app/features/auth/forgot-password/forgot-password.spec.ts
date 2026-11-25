import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { TURNSTILE_SITE_KEY } from '@/shared/components/faro/turnstile/turnstile-script';
import { FakeTurnstile, TEST_TURNSTILE_SITE_KEY } from '@/shared/components/faro/turnstile/turnstile-testing';

import { PasswordService } from '../../../core/auth/password.service';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { ForgotPassword, RECOVERY_RESEND_SECONDS } from './forgot-password';

describe('ForgotPassword', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let el: HTMLElement;
  let requestRecovery: ReturnType<typeof vi.fn>;
  let capture: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  async function settle() {
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
    else await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(query: Record<string, string> = {}) {
    requestRecovery = vi.fn().mockResolvedValue({ ok: true });
    capture = vi.fn();
    const params = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
        { provide: PasswordService, useValue: { requestRecovery } },
        { provide: ReturnUrlService, useValue: { capture } },
      ],
    });
    fixture = TestBed.createComponent(ForgotPassword);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
  }

  async function submit(email: string) {
    const input = byId('forgot-password-email') as HTMLInputElement;
    input.value = email;
    input.dispatchEvent(new Event('input'));
    byId('forgot-password-submit')!.click();
    await settle();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('desafio anti-robô', () => {
    let fake: FakeTurnstile;
    beforeEach(() => {
      fake = new FakeTurnstile().install();
      TestBed.overrideProvider(TURNSTILE_SITE_KEY, { useValue: TEST_TURNSTILE_SITE_KEY });
    });
    afterEach(() => fake.uninstall());

    it('espera o token, envia captcha_token e renova o desafio depois do envio', async () => {
      await create();
      await vi.waitFor(() => expect(fake.renders).toHaveLength(1));
      await settle();
      expect((byId('forgot-password-submit') as HTMLButtonElement).disabled).toBe(true);

      fake.solve('tok-1');
      await settle();
      expect((byId('forgot-password-submit') as HTMLButtonElement).disabled).toBe(false);
      await submit('ana@email.com');

      expect(requestRecovery).toHaveBeenCalledWith('ana@email.com', 'tok-1');
      expect(fake.resets).toBe(1);
      expect(byId('forgot-password-sent')).not.toBeNull();
    });

    it('captcha_failed mostra o texto do contrato e não vai para "confira seu e-mail"', async () => {
      await create();
      await vi.waitFor(() => expect(fake.renders).toHaveLength(1));
      fake.solve('tok-1');
      await settle();
      requestRecovery.mockResolvedValueOnce({ ok: false, reason: 'captcha_failed' });
      await submit('ana@email.com');

      expect(byId('forgot-password-captcha-error')?.textContent).toContain(
        'Não foi possível confirmar que você não é um robô. Tente de novo.',
      );
      expect(byId('forgot-password-sent')).toBeNull();
      expect(fake.resets).toBe(1);
    });
  });

  it('mostra o campo de e-mail e o botão, com os data-testid do contrato', async () => {
    await create();
    expect(byId('forgot-password-email')).not.toBeNull();
    expect(byId('forgot-password-submit')?.textContent).toContain('Enviar link');
    expect(byId('forgot-password-sent')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Esqueceu a senha?');
  });

  it('guarda o returnUrl da URL ao abrir', async () => {
    await create({ returnUrl: '/app/conta' });
    expect(capture).toHaveBeenCalledWith('/app/conta');
  });

  describe('validação de formato', () => {
    it('e-mail vazio não envia e pede o e-mail', async () => {
      await create();
      await submit('');
      expect(requestRecovery).not.toHaveBeenCalled();
      expect(byId('forgot-password-error')?.textContent).toContain('Informe seu e-mail.');
      expect(byId('forgot-password-email')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('e-mail sem formato não envia e pede um e-mail válido', async () => {
      await create();
      await submit('ana@email');
      expect(requestRecovery).not.toHaveBeenCalled();
      expect(byId('forgot-password-error')?.textContent).toContain('Informe um e-mail válido.');
      expect(byId('forgot-password-sent')).toBeNull();
    });

    it('o aviso some quando a pessoa volta a digitar', async () => {
      await create();
      await submit('ana@email');
      const input = byId('forgot-password-email') as HTMLInputElement;
      input.value = 'ana@email.c';
      input.dispatchEvent(new Event('input'));
      await settle();
      expect(byId('forgot-password-error')).toBeNull();
    });
  });

  describe('confirmação', () => {
    it('envia o e-mail e mostra a confirmação com o texto do contrato', async () => {
      await create();
      await submit('  ana@email.com ');
      expect(requestRecovery).toHaveBeenCalledWith('ana@email.com', undefined);
      const sent = byId('forgot-password-sent');
      expect(sent).not.toBeNull();
      expect(sent?.textContent).toContain(
        'Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora.',
      );
      expect(byId('forgot-password-back')?.getAttribute('href')).toBe('/auth/login');
    });

    it('a tela é a mesma quando o serviço devolve normalmente e quando a rede falha (o serviço engole o erro)', async () => {
      await create();
      await submit('ana@email.com');
      const withAccount = byId('forgot-password-sent')?.textContent?.trim();
      TestBed.resetTestingModule();

      await create();
      requestRecovery.mockResolvedValue({ ok: true }); // falha de rede: o serviço também resolve sem erro
      await submit('ninguem@email.com');
      expect(byId('forgot-password-sent')?.textContent?.trim()).toBe(withAccount);
    });

    it('mesmo que o serviço lance, a confirmação é a mesma', async () => {
      await create();
      requestRecovery.mockRejectedValue(new Error('boom'));
      const input = byId('forgot-password-email') as HTMLInputElement;
      input.value = 'ana@email.com';
      input.dispatchEvent(new Event('input'));
      // a rejeição não pode escapar para a pessoa; a tela segue para a confirmação
      await fixture.componentInstance['onSend']().catch(() => undefined);
      await settle();
      expect(byId('forgot-password-sent')).not.toBeNull();
    });

    it('preserva o returnUrl no link Voltar para entrar', async () => {
      await create({ returnUrl: '/app/conta' });
      await submit('ana@email.com');
      expect(byId('forgot-password-back')?.getAttribute('href')).toBe('/auth/login?returnUrl=%2Fapp%2Fconta');
    });
  });

  describe('contagem de 60 s', () => {
    it('depois do envio mostra 1:00, desce e libera "Pedir outro link" ao zerar', async () => {
      vi.useFakeTimers();
      await create();
      await submit('ana@email.com');
      expect(RECOVERY_RESEND_SECONDS).toBe(60);
      expect(byId('forgot-password-countdown')?.textContent).toContain('1:00');
      expect(byId('forgot-password-again')).toBeNull();

      await vi.advanceTimersByTimeAsync(8_000);
      await settle();
      expect(byId('forgot-password-countdown')?.textContent).toContain('0:52');

      await vi.advanceTimersByTimeAsync(52_000);
      await settle();
      expect(byId('forgot-password-countdown')).toBeNull();
      expect((byId('forgot-password-again') as HTMLButtonElement).disabled).toBe(false);
    });

    it('"Pedir outro link" reenvia para o mesmo e-mail e recomeça a contagem', async () => {
      vi.useFakeTimers();
      await create();
      await submit('ana@email.com');
      await vi.advanceTimersByTimeAsync(60_000);
      await settle();

      byId('forgot-password-again')!.click();
      await settle();
      expect(requestRecovery).toHaveBeenCalledTimes(2);
      expect(requestRecovery).toHaveBeenLastCalledWith('ana@email.com', undefined);
      expect(byId('forgot-password-countdown')?.textContent).toContain('1:00');
    });

    it('não envia de novo enquanto a contagem não zera', async () => {
      vi.useFakeTimers();
      await create();
      await submit('ana@email.com');
      await fixture.componentInstance['onSend']();
      expect(requestRecovery).toHaveBeenCalledTimes(1);
    });
  });
});
