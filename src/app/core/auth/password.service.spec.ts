import { TestBed } from '@angular/core/testing';
import { AccountStore } from '../account/account.store';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let calls: string[];
  let invoke: ReturnType<typeof vi.fn>;
  let verifyOtp: ReturnType<typeof vi.fn>;
  let updateUser: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;
  let service: PasswordService;
  let authStoreReset: ReturnType<typeof vi.fn>;
  let accountStoreReset: ReturnType<typeof vi.fn>;
  let signInPassword: ReturnType<typeof vi.fn>;
  let hasPassword: boolean;

  beforeEach(() => {
    calls = [];
    invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    verifyOtp = vi.fn().mockImplementation(async () => {
      calls.push('verifyOtp');
      return { data: {}, error: null };
    });
    updateUser = vi.fn().mockImplementation(async () => {
      calls.push('updateUser');
      return { data: {}, error: null };
    });
    signOut = vi.fn().mockImplementation(async () => {
      calls.push('signOut');
      return { error: null };
    });
    authStoreReset = vi.fn();
    accountStoreReset = vi.fn();
    hasPassword = true;
    signInPassword = vi.fn().mockImplementation(async () => {
      calls.push('signInPassword');
      return { ok: true };
    });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: {
            client: { functions: { invoke }, auth: { verifyOtp, updateUser, signOut } },
          },
        },
        { provide: AuthStore, useValue: { reset: authStoreReset } },
        {
          provide: AccountStore,
          useValue: {
            reset: accountStoreReset,
            hasPassword: () => hasPassword,
            account: () => ({ email: 'ana@email.com' }),
          },
        },
        { provide: AuthService, useValue: { signInPassword } },
      ],
    });
    service = TestBed.inject(PasswordService);
  });

  describe('requestRecovery', () => {
    it('chama a função password-recovery só com o e-mail', async () => {
      await expect(service.requestRecovery('ana@email.com')).resolves.toEqual({ ok: true });
      expect(invoke).toHaveBeenCalledWith('password-recovery', { body: { email: 'ana@email.com' } });
    });

    it('resolve igual em sucesso, em erro devolvido e em falha de rede', async () => {
      invoke.mockResolvedValueOnce({ data: null, error: { message: 'FunctionsHttpError' } });
      const comErro = await service.requestRecovery('ana@email.com');
      invoke.mockRejectedValueOnce(new Error('Failed to fetch'));
      const comRede = await service.requestRecovery('ana@email.com');
      const sucesso = await service.requestRecovery('ana@email.com');
      expect(comErro).toEqual({ ok: true });
      expect(comRede).toEqual({ ok: true });
      expect(sucesso).toEqual({ ok: true });
    });

    it('captcha_failed da função vira { ok: false } e só ele', async () => {
      invoke.mockResolvedValueOnce({ data: { ok: false, error: 'captcha_failed' }, error: null });
      expect(await service.requestRecovery('ana@email.com', 'token-x')).toEqual({
        ok: false,
        reason: 'captcha_failed',
      });
      invoke.mockResolvedValueOnce({ data: { ok: false, error: 'outro' }, error: null });
      expect(await service.requestRecovery('ana@email.com')).toEqual({ ok: true });
    });

    it('repassa o desafio anti-robô quando existir', async () => {
      await service.requestRecovery('ana@email.com', 'token-x');
      expect(invoke).toHaveBeenCalledWith('password-recovery', {
        body: { email: 'ana@email.com', captcha_token: 'token-x' },
      });
    });
  });

  describe('resetPassword', () => {
    it('chama verifyOtp (recovery), updateUser e signOut global, nessa ordem', async () => {
      const result = await service.resetPassword('hash-1', 'NovaSenha123');
      expect(result).toEqual({ ok: true });
      expect(calls).toEqual(['verifyOtp', 'updateUser', 'signOut']);
      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-1', type: 'recovery' });
      expect(updateUser).toHaveBeenCalledWith({ password: 'NovaSenha123' });
      expect(signOut).toHaveBeenCalledWith({ scope: 'global' });
    });

    it('zera os stores antes de devolver ok (o login tem anonGuard)', async () => {
      await service.resetPassword('hash-1', 'NovaSenha123');
      expect(authStoreReset).toHaveBeenCalledTimes(1);
      expect(accountStoreReset).toHaveBeenCalledTimes(1);
    });

    it('invalid_link: link vencido, usado ou adulterado; não troca a senha', async () => {
      verifyOtp.mockResolvedValueOnce({ data: {}, error: { status: 403, code: 'otp_expired' } });
      const result = await service.resetPassword('hash-1', 'NovaSenha123');
      expect(result).toEqual({ ok: false, reason: 'invalid_link' });
      expect(updateUser).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    });

    it('rede no verifyOtp vira network, e o link ainda vale numa nova tentativa', async () => {
      verifyOtp.mockResolvedValueOnce({
        data: {},
        error: { name: 'AuthRetryableFetchError', status: 0 },
      });
      expect(await service.resetPassword('hash-1', 'NovaSenha123')).toEqual({
        ok: false,
        reason: 'network',
      });
      expect(await service.resetPassword('hash-1', 'NovaSenha123')).toEqual({ ok: true });
      expect(verifyOtp).toHaveBeenCalledTimes(2);
    });

    it('weak_password: a sessão de recuperação continua e nada é encerrado', async () => {
      updateUser.mockResolvedValueOnce({ data: {}, error: { status: 422, code: 'weak_password' } });
      const result = await service.resetPassword('hash-1', '1234567');
      expect(result).toEqual({ ok: false, reason: 'weak_password' });
      expect(signOut).not.toHaveBeenCalled();
      expect(authStoreReset).not.toHaveBeenCalled();
    });

    it('nova tentativa depois de weak_password NÃO repete o verifyOtp', async () => {
      updateUser.mockResolvedValueOnce({ data: {}, error: { status: 422, code: 'weak_password' } });
      await service.resetPassword('hash-1', '1234567');
      const second = await service.resetPassword('hash-1', 'NovaSenha123');
      expect(second).toEqual({ ok: true });
      expect(verifyOtp).toHaveBeenCalledTimes(1);
      expect(updateUser).toHaveBeenCalledTimes(2);
      expect(signOut).toHaveBeenCalledTimes(1);
    });

    it('depois do sucesso, o mesmo link volta a passar pelo verifyOtp (que o servidor recusa)', async () => {
      await service.resetPassword('hash-1', 'NovaSenha123');
      verifyOtp.mockResolvedValueOnce({ data: {}, error: { status: 403, code: 'otp_expired' } });
      const again = await service.resetPassword('hash-1', 'OutraSenha123');
      expect(again).toEqual({ ok: false, reason: 'invalid_link' });
      expect(verifyOtp).toHaveBeenCalledTimes(2);
    });

    it('um link diferente também passa pelo verifyOtp', async () => {
      updateUser.mockResolvedValueOnce({ data: {}, error: { status: 422, code: 'weak_password' } });
      await service.resetPassword('hash-1', '1234567');
      await service.resetPassword('hash-2', 'NovaSenha123');
      expect(verifyOtp).toHaveBeenCalledTimes(2);
    });

    it('falha de rede no updateUser vira network e permite tentar de novo sem o verifyOtp', async () => {
      updateUser.mockRejectedValueOnce(new Error('Failed to fetch'));
      expect(await service.resetPassword('hash-1', 'NovaSenha123')).toEqual({
        ok: false,
        reason: 'network',
      });
      expect(await service.resetPassword('hash-1', 'NovaSenha123')).toEqual({ ok: true });
      expect(verifyOtp).toHaveBeenCalledTimes(1);
    });

    it('um erro no signOut não desfaz a troca de senha', async () => {
      signOut.mockRejectedValueOnce(new Error('boom'));
      expect(await service.resetPassword('hash-1', 'NovaSenha123')).toEqual({ ok: true });
      expect(authStoreReset).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('conta sem senha: no_password, sem tocar no servidor', async () => {
      hasPassword = false;
      expect(await service.changePassword('atual', 'NovaSenha123')).toEqual({ ok: false, reason: 'no_password' });
      expect(signInPassword).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    });

    it('repassa o desafio ao signInPassword e devolve captcha_failed sem contar como senha errada', async () => {
      signInPassword.mockResolvedValueOnce({ ok: false, reason: 'captcha_failed' });
      expect(await service.changePassword('atual', 'NovaSenha123', 'token-x')).toEqual({
        ok: false,
        reason: 'captcha_failed',
      });
      expect(signInPassword).toHaveBeenCalledWith('ana@email.com', 'atual', 'token-x');
    });

    it('senha atual errada: invalid_current e a senha nova nunca é enviada', async () => {
      signInPassword.mockResolvedValueOnce({ ok: false, reason: 'invalid' });
      expect(await service.changePassword('errada', 'NovaSenha123')).toEqual({ ok: false, reason: 'invalid_current' });
      expect(signInPassword).toHaveBeenCalledWith('ana@email.com', 'errada', undefined);
      expect(updateUser).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    });

    it('bloqueio do login-guard: rate_limited', async () => {
      signInPassword.mockResolvedValueOnce({ ok: false, reason: 'rate_limited' });
      expect(await service.changePassword('atual', 'NovaSenha123')).toEqual({ ok: false, reason: 'rate_limited' });
      expect(updateUser).not.toHaveBeenCalled();
    });

    it('falha de conexão ao conferir a senha atual vira network, não invalid_current', async () => {
      signInPassword.mockResolvedValueOnce({ ok: false, reason: 'network' });
      expect(await service.changePassword('atual', 'NovaSenha123')).toEqual({ ok: false, reason: 'network' });
    });

    it('senha nova fraca: weak_password e as outras sessões continuam', async () => {
      updateUser.mockResolvedValueOnce({ data: {}, error: { status: 422, code: 'weak_password' } });
      expect(await service.changePassword('atual', '1234567')).toEqual({ ok: false, reason: 'weak_password' });
      expect(signOut).not.toHaveBeenCalled();
    });

    it('erro ou queda de rede no updateUser: network', async () => {
      updateUser.mockRejectedValueOnce(new Error('Failed to fetch'));
      expect(await service.changePassword('atual', 'NovaSenha123')).toEqual({ ok: false, reason: 'network' });
      updateUser.mockResolvedValueOnce({ data: {}, error: { status: 500 } });
      expect(await service.changePassword('atual', 'NovaSenha123')).toEqual({ ok: false, reason: 'network' });
    });

    it('sucesso: confere, troca e encerra só as outras sessões, nessa ordem', async () => {
      expect(await service.changePassword('atual', 'NovaSenha123')).toEqual({ ok: true });
      expect(updateUser).toHaveBeenCalledWith({ password: 'NovaSenha123' });
      expect(signOut).toHaveBeenCalledWith({ scope: 'others' });
      expect(calls).toEqual(['signInPassword', 'updateUser', 'signOut']);
      expect(authStoreReset).not.toHaveBeenCalled();
      expect(accountStoreReset).not.toHaveBeenCalled();
    });

    it('erro no signOut das outras sessões não desfaz a troca', async () => {
      signOut.mockRejectedValueOnce(new Error('boom'));
      expect(await service.changePassword('atual', 'NovaSenha123')).toEqual({ ok: true });
    });
  });
});
