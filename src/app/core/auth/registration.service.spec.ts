import { TestBed } from '@angular/core/testing';
import { AccountStore } from '../account/account.store';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { RegistrationService, SIGNUP_MIN_RESPONSE_MS, type SignUpInput } from './registration.service';
import { ReturnUrlService } from './return-url';

const VALID: SignUpInput = {
  nome: '  Ana Souza ',
  email: 'ana@email.com',
  celular: '(11) 98765-4421',
  senha: 'SenhaSegura1',
  aceite: true,
};

describe('RegistrationService', () => {
  let signUp: ReturnType<typeof vi.fn>;
  let verifyOtp: ReturnType<typeof vi.fn>;
  let resendConfirmation: ReturnType<typeof vi.fn>;
  let peek: ReturnType<typeof vi.fn>;
  let service: RegistrationService;

  beforeEach(() => {
    vi.useFakeTimers();
    signUp = vi.fn().mockResolvedValue({ data: {}, error: null });
    verifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    resendConfirmation = vi.fn().mockResolvedValue(undefined);
    peek = vi.fn().mockReturnValue(null);

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { auth: { signUp, verifyOtp } } } },
        { provide: AuthService, useValue: { resendConfirmation } },
        { provide: ReturnUrlService, useValue: { peek } },
      ],
    });
    service = TestBed.inject(RegistrationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Roda o cadastro até o fim, avançando o relógio falso. */
  async function run(input: SignUpInput = VALID) {
    const pending = service.signUp(input);
    await vi.advanceTimersByTimeAsync(SIGNUP_MIN_RESPONSE_MS + 50);
    return pending;
  }

  describe('entrada inválida não chama o Supabase', () => {
    const casos: [string, Partial<SignUpInput>][] = [
      ['nome de 1 caractere', { nome: 'A' }],
      ['nome de 81 caracteres', { nome: 'A'.repeat(81) }],
      ['e-mail inválido', { email: 'ana@email' }],
      ['celular fixo', { celular: '(11) 3456-7890' }],
      ['senha de 7 caracteres', { senha: '1234567' }],
      ['senha de 73 caracteres', { senha: 'a'.repeat(73) }],
      ['aceite desmarcado', { aceite: false }],
    ];
    for (const [nome, parcial] of casos) {
      it(nome, async () => {
        const result = await service.signUp({ ...VALID, ...parcial });
        expect(result).toEqual({ ok: false, reason: 'invalid' });
        expect(signUp).not.toHaveBeenCalled();
      });
    }
  });

  it('envia os metadados: name, phone em E.164 e terms_version, sem return_to quando não há destino', async () => {
    const result = await run();
    expect(result).toEqual({ ok: true });
    expect(signUp).toHaveBeenCalledTimes(1);
    const arg = signUp.mock.calls[0][0];
    expect(arg.email).toBe('ana@email.com');
    expect(arg.password).toBe('SenhaSegura1');
    expect(arg.options.data).toEqual({
      name: 'Ana Souza',
      phone: '+5511987654421',
      terms_version: '2026-11',
    });
  });

  it('envia return_to e return_to_at (ISO) quando há destino guardado', async () => {
    peek.mockReturnValue('/ativar/7K3M-Q9XA-C');
    await run();
    const data = signUp.mock.calls[0][0].options.data;
    expect(data.return_to).toBe('/ativar/7K3M-Q9XA-C');
    expect(new Date(data.return_to_at).toISOString()).toBe(data.return_to_at);
  });

  it('repassa o captchaToken só quando existe', async () => {
    await run({ ...VALID, captchaToken: 'tok' });
    expect(signUp.mock.calls[0][0].options.captchaToken).toBe('tok');
    signUp.mockClear();
    await run();
    expect('captchaToken' in signUp.mock.calls[0][0].options).toBe(false);
  });

  describe('resultados', () => {
    it('"usuário já existe" (422) vira ok', async () => {
      signUp.mockResolvedValue({ data: {}, error: { status: 422, code: 'user_already_exists' } });
      expect(await run()).toEqual({ ok: true });
    });

    it('429 de reenvio (e-mail ainda não confirmado) vira ok', async () => {
      signUp.mockResolvedValue({ data: {}, error: { status: 429, code: 'over_email_send_rate_limit' } });
      expect(await run()).toEqual({ ok: true });
    });

    it('429 de limite de pedidos vira rate_limited', async () => {
      signUp.mockResolvedValue({ data: {}, error: { status: 429, code: 'over_request_rate_limit' } });
      expect(await run()).toEqual({ ok: false, reason: 'rate_limited' });
    });

    it('senha fraca vira weak_password', async () => {
      signUp.mockResolvedValue({ data: {}, error: { status: 422, code: 'weak_password' } });
      expect(await run()).toEqual({ ok: false, reason: 'weak_password' });
    });

    it('falha de rede vira network (erro retentável e exceção)', async () => {
      signUp.mockResolvedValue({ data: {}, error: { name: 'AuthRetryableFetchError', status: 0 } });
      expect(await run()).toEqual({ ok: false, reason: 'network' });
      signUp.mockRejectedValue(new Error('boom'));
      expect(await run()).toEqual({ ok: false, reason: 'network' });
    });

    it('qualquer outro erro vira ok', async () => {
      signUp.mockResolvedValue({ data: {}, error: { status: 500, code: 'unexpected_failure' } });
      expect(await run()).toEqual({ ok: true });
    });
  });

  describe('tempo mínimo de resposta', () => {
    it('só resolve depois de 1.200 ms mesmo com resposta imediata', async () => {
      let done = false;
      void service.signUp(VALID).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(SIGNUP_MIN_RESPONSE_MS - 100);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(150);
      expect(done).toBe(true);
    });

    it('vale também para o erro', async () => {
      signUp.mockResolvedValue({ data: {}, error: { status: 422, code: 'user_already_exists' } });
      let done = false;
      void service.signUp(VALID).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(SIGNUP_MIN_RESPONSE_MS - 100);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(150);
      expect(done).toBe(true);
    });
  });

  it('a senha não é gravada em nenhum store', async () => {
    await run();
    const guardado = JSON.stringify({
      auth: Object.values(TestBed.inject(AuthStore)).map((v) => (typeof v === 'function' ? v() : v)),
      account: Object.values(TestBed.inject(AccountStore)).map((v) => (typeof v === 'function' ? v() : v)),
    });
    expect(guardado).not.toContain('SenhaSegura1');
    expect(JSON.stringify(Object.keys(service))).not.toContain('senha');
  });

  describe('confirmEmail', () => {
    it('usa verifyOtp com type email', async () => {
      expect(await service.confirmEmail('abc123')).toEqual({ ok: true });
      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'email' });
    });

    it('link vencido, usado ou adulterado vira invalid_link', async () => {
      verifyOtp.mockResolvedValue({ data: {}, error: { status: 403, code: 'otp_expired' } });
      expect(await service.confirmEmail('x')).toEqual({ ok: false, reason: 'invalid_link' });
    });

    it('falha de rede vira network', async () => {
      verifyOtp.mockResolvedValue({ data: {}, error: { name: 'AuthRetryableFetchError', status: 0 } });
      expect(await service.confirmEmail('x')).toEqual({ ok: false, reason: 'network' });
      verifyOtp.mockRejectedValue(new Error('boom'));
      expect(await service.confirmEmail('x')).toEqual({ ok: false, reason: 'network' });
    });
  });

  it('resendConfirmation delega no AuthService', async () => {
    await service.resendConfirmation('ana@email.com');
    expect(resendConfirmation).toHaveBeenCalledWith('ana@email.com');
  });
});
