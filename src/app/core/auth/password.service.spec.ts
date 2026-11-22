import { TestBed } from '@angular/core/testing';
import { AccountStore } from '../account/account.store';
import { SupabaseService } from '../supabase/supabase.service';
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

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: {
            client: { functions: { invoke }, auth: { verifyOtp, updateUser, signOut } },
          },
        },
        { provide: AuthStore, useValue: { reset: authStoreReset } },
        { provide: AccountStore, useValue: { reset: accountStoreReset } },
      ],
    });
    service = TestBed.inject(PasswordService);
  });

  describe('requestRecovery', () => {
    it('chama a função password-recovery só com o e-mail', async () => {
      await expect(service.requestRecovery('ana@email.com')).resolves.toBeUndefined();
      expect(invoke).toHaveBeenCalledWith('password-recovery', { body: { email: 'ana@email.com' } });
    });

    it('resolve igual em sucesso, em erro devolvido e em falha de rede', async () => {
      invoke.mockResolvedValueOnce({ data: null, error: { message: 'FunctionsHttpError' } });
      const comErro = await service.requestRecovery('ana@email.com');
      invoke.mockRejectedValueOnce(new Error('Failed to fetch'));
      const comRede = await service.requestRecovery('ana@email.com');
      const sucesso = await service.requestRecovery('ana@email.com');
      expect(comErro).toBeUndefined();
      expect(comRede).toBeUndefined();
      expect(sucesso).toBeUndefined();
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

  it('changePassword ainda não está implementado (T087)', async () => {
    await expect(service.changePassword('a', 'b')).rejects.toThrow(/T087/);
  });
});
