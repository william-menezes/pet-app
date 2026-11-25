import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountService } from './account.service';
import { PhoneVerificationService } from './phone-verification.service';

describe('PhoneVerificationService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let invoke: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  let service: PhoneVerificationService;

  beforeEach(() => {
    rpc = vi.fn();
    invoke = vi.fn();
    load = vi.fn().mockResolvedValue(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { rpc, functions: { invoke } } } },
        { provide: AccountService, useValue: { load } },
      ],
    });
    service = TestBed.inject(PhoneVerificationService);
  });

  describe('status', () => {
    it('converte a resposta de phone_verification_status', async () => {
      rpc.mockResolvedValue({
        data: {
          phone_confirmed: false,
          phone: null,
          pending_phone: '+5511987654421',
          active: { expires_at: '2026-11-21T12:10:00Z', attempts_left: 5 },
          resend_available_at: '2026-11-21T12:01:00Z',
        },
        error: null,
      });
      expect(await service.status()).toEqual({
        phoneConfirmed: false,
        phone: null,
        pendingPhone: '+5511987654421',
        active: { expiresAt: '2026-11-21T12:10:00Z', attemptsLeft: 5 },
        resendAvailableAt: '2026-11-21T12:01:00Z',
      });
      expect(rpc).toHaveBeenCalledWith('phone_verification_status');
    });

    it('sem verificação ativa: active e resendAvailableAt nulos', async () => {
      rpc.mockResolvedValue({
        data: { phone_confirmed: true, phone: '+5511987654421', pending_phone: null, active: null, resend_available_at: null },
        error: null,
      });
      const status = await service.status();
      expect(status?.active).toBeNull();
      expect(status?.resendAvailableAt).toBeNull();
      expect(status?.phoneConfirmed).toBe(true);
    });

    it('erro ou exceção => null', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
      expect(await service.status()).toBeNull();
      rpc.mockRejectedValue(new Error('offline'));
      expect(await service.status()).toBeNull();
    });
  });

  describe('start', () => {
    const OK = {
      ok: true,
      phone: '+5511987654421',
      expires_at: '2026-11-21T12:10:00Z',
      resend_available_at: '2026-11-21T12:01:00Z',
      attempts_left: 5,
    };

    it('sucesso: converte os nomes e envia só o que foi informado', async () => {
      invoke.mockResolvedValue({ data: OK, error: null });
      const result = await service.start({ phone: '(11) 98765-4421' });
      expect(result).toEqual({
        ok: true,
        phone: '+5511987654421',
        expiresAt: '2026-11-21T12:10:00Z',
        resendAvailableAt: '2026-11-21T12:01:00Z',
        attemptsLeft: 5,
      });
      expect(invoke).toHaveBeenCalledWith('phone-verify-start', { body: { phone: '(11) 98765-4421' } });
    });

    it('sem argumentos envia corpo vazio; com senha, envia a senha', async () => {
      invoke.mockResolvedValue({ data: OK, error: null });
      await service.start();
      expect(invoke).toHaveBeenLastCalledWith('phone-verify-start', { body: {} });
      await service.start({ phone: '11987654421', password: 'Segredo123' });
      expect(invoke).toHaveBeenLastCalledWith('phone-verify-start', {
        body: { phone: '11987654421', password: 'Segredo123' },
      });
    });

    it.each([
      'email_not_confirmed',
      'terms_required',
      'invalid_phone',
      'same_number',
      'invalid_password',
      'sms_unavailable',
      'sms_send_failed',
      'captcha_failed',
    ])('mapeia %s', async (error) => {
      invoke.mockResolvedValue({ data: { ok: false, error }, error: null });
      expect(await service.start()).toEqual({ ok: false, error });
    });

    it('captchaToken vai no corpo como captcha_token, só quando existe', async () => {
      invoke.mockResolvedValue({ data: OK, error: null });
      await service.start({ phone: '(11) 98765-4421', password: 'x', captchaToken: 'tok' });
      expect(invoke).toHaveBeenLastCalledWith('phone-verify-start', {
        body: { phone: '(11) 98765-4421', password: 'x', captcha_token: 'tok' },
      });
      await service.start({ phone: '(11) 98765-4421' });
      expect(invoke).toHaveBeenLastCalledWith('phone-verify-start', { body: { phone: '(11) 98765-4421' } });
    });

    it('reauth_required traz o método', async () => {
      invoke.mockResolvedValue({ data: { ok: false, error: 'reauth_required', method: 'google' }, error: null });
      expect(await service.start()).toEqual({ ok: false, error: 'reauth_required', method: 'google' });
      invoke.mockResolvedValue({ data: { ok: false, error: 'reauth_required', method: 'password' }, error: null });
      expect(await service.start()).toEqual({ ok: false, error: 'reauth_required', method: 'password' });
    });

    it('cooldown e rate_limited trazem retryAfterSeconds', async () => {
      invoke.mockResolvedValue({ data: { ok: false, error: 'cooldown', retry_after_seconds: 42 }, error: null });
      expect(await service.start()).toEqual({ ok: false, error: 'cooldown', retryAfterSeconds: 42 });
      invoke.mockResolvedValue({ data: { ok: false, error: 'rate_limited', retry_after_seconds: 3600 }, error: null });
      expect(await service.start()).toEqual({ ok: false, error: 'rate_limited', retryAfterSeconds: 3600 });
    });

    it('resposta não-200 (error do SDK), exceção, corpo estranho ou código desconhecido => network', async () => {
      invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError' } });
      expect(await service.start()).toEqual({ ok: false, error: 'network' });
      invoke.mockRejectedValue(new Error('offline'));
      expect(await service.start()).toEqual({ ok: false, error: 'network' });
      invoke.mockResolvedValue({ data: 'texto', error: null });
      expect(await service.start()).toEqual({ ok: false, error: 'network' });
      invoke.mockResolvedValue({ data: { ok: false, error: 'algo_novo' }, error: null });
      expect(await service.start()).toEqual({ ok: false, error: 'network' });
      invoke.mockResolvedValue({ data: { ok: true }, error: null });
      expect(await service.start()).toEqual({ ok: false, error: 'network' });
    });
  });

  describe('confirm', () => {
    it('sucesso: devolve o número e recarrega a conta', async () => {
      invoke.mockResolvedValue({ data: { ok: true, phone: '+5511987654421' }, error: null });
      expect(await service.confirm('482913')).toEqual({ ok: true, phone: '+5511987654421' });
      expect(invoke).toHaveBeenCalledWith('phone-verify-confirm', { body: { code: '482913' } });
      expect(load).toHaveBeenCalledWith(true);
    });

    it('invalid_code traz attemptsLeft e não recarrega a conta', async () => {
      invoke.mockResolvedValue({ data: { ok: false, error: 'invalid_code', attempts_left: 3 }, error: null });
      expect(await service.confirm('000000')).toEqual({ ok: false, error: 'invalid_code', attemptsLeft: 3 });
      expect(load).not.toHaveBeenCalled();
    });

    it.each(['invalid_format', 'locked', 'expired', 'no_active'])('mapeia %s', async (error) => {
      invoke.mockResolvedValue({ data: { ok: false, error }, error: null });
      expect(await service.confirm('123456')).toEqual({ ok: false, error });
    });

    it('resposta não-200, exceção ou código desconhecido => network, sem recarregar a conta', async () => {
      invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError' } });
      expect(await service.confirm('123456')).toEqual({ ok: false, error: 'network' });
      invoke.mockRejectedValue(new Error('offline'));
      expect(await service.confirm('123456')).toEqual({ ok: false, error: 'network' });
      invoke.mockResolvedValue({ data: { ok: false, error: 'algo_novo' }, error: null });
      expect(await service.confirm('123456')).toEqual({ ok: false, error: 'network' });
      expect(load).not.toHaveBeenCalled();
    });
  });
});
