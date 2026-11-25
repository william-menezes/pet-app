import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountService } from './account.service';
import { AccountStore } from './account.store';
import { TERMS_VERSION } from './terms';

const ROW = {
  id: 'u1',
  nome: 'Ana Souza',
  email: 'ana@email.com',
  papel: 'tutor',
  celular: '+5511987654421',
  celular_confirmado_em: '2026-11-21T12:03:00Z',
  celular_pendente: null,
  termos_aceitos_em: '2026-11-21T11:58:00Z',
  termos_versao: '2026-11',
  tem_senha: true,
  provedores: ['email', 'google'],
  criado_em: '2026-11-21T11:58:00Z',
};

describe('AccountService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let eq: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;
  let calls: string[];
  let service: AccountService;
  let store: AccountStore;

  beforeEach(() => {
    calls = [];
    rpc = vi.fn(async (name: string) => {
      calls.push(`rpc:${name}`);
      return name === 'my_account' ? { data: ROW, error: null } : { data: null, error: null };
    });
    eq = vi.fn().mockResolvedValue({ error: null });
    update = vi.fn(() => ({ eq }));
    from = vi.fn(() => ({ update }));
    signOut = vi.fn(async () => {
      calls.push('signOut');
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { rpc, from } } },
        { provide: AuthService, useValue: { signOut } },
      ],
    });
    TestBed.inject(AuthStore).setSession({ user: { id: 'u1' } } as never);
    service = TestBed.inject(AccountService);
    store = TestBed.inject(AccountStore);
  });

  describe('load', () => {
    it('chama my_account e converte os nomes para a interface Account', async () => {
      const account = await service.load();
      expect(rpc).toHaveBeenCalledWith('my_account');
      expect(account).toEqual({
        id: 'u1',
        nome: 'Ana Souza',
        email: 'ana@email.com',
        papel: 'tutor',
        celular: '+5511987654421',
        celularConfirmadoEm: '2026-11-21T12:03:00Z',
        celularPendente: null,
        termosAceitosEm: '2026-11-21T11:58:00Z',
        termosVersao: '2026-11',
        temSenha: true,
        provedores: ['email', 'google'],
        criadoEm: '2026-11-21T11:58:00Z',
      });
      expect(store.loaded()).toBe(true);
      expect(store.termsAccepted()).toBe(true);
      expect(store.phoneConfirmed()).toBe(true);
      expect(store.hasPassword()).toBe(true);
      expect(store.isGoogleOnly()).toBe(false);
    });

    it('falha (erro do banco) => null e loaded continua false', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
      expect(await service.load()).toBeNull();
      expect(store.loaded()).toBe(false);
    });

    it('falha (exceção de rede) => null e loaded continua false', async () => {
      rpc.mockRejectedValue(new Error('offline'));
      expect(await service.load()).toBeNull();
      expect(store.loaded()).toBe(false);
    });

    it('conta de Google sem senha, sem aceite e sem celular confirmado', async () => {
      rpc.mockResolvedValue({
        data: {
          ...ROW,
          tem_senha: false,
          provedores: ['google'],
          termos_aceitos_em: null,
          termos_versao: null,
          celular: null,
          celular_confirmado_em: null,
        },
        error: null,
      });
      await service.load();
      expect(store.isGoogleOnly()).toBe(true);
      expect(store.termsAccepted()).toBe(false);
      expect(store.phoneConfirmed()).toBe(false);
    });

    it('ensureLoaded só chama o banco uma vez', async () => {
      await service.ensureLoaded();
      await service.ensureLoaded();
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it('load(true) força nova leitura', async () => {
      await service.load();
      await service.load(true);
      expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('chamadas simultâneas compartilham a mesma leitura', async () => {
      await Promise.all([service.load(), service.load()]);
      expect(rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateName', () => {
    it('1 caractere => invalid, sem chamar o banco', async () => {
      expect(await service.updateName('A')).toEqual({ ok: false, reason: 'invalid' });
      expect(from).not.toHaveBeenCalled();
    });

    it('só espaços conta como vazio', async () => {
      expect(await service.updateName('   ')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('2 caracteres => ok', async () => {
      expect(await service.updateName('Al')).toEqual({ ok: true });
      expect(from).toHaveBeenCalledWith('perfis');
      expect(update).toHaveBeenCalledWith({ nome: 'Al' });
      expect(eq).toHaveBeenCalledWith('id', 'u1');
    });

    it('80 caracteres => ok e recarrega a conta', async () => {
      expect(await service.updateName('a'.repeat(80))).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledWith('my_account');
    });

    it('81 caracteres => invalid', async () => {
      expect(await service.updateName('a'.repeat(81))).toEqual({ ok: false, reason: 'invalid' });
      expect(from).not.toHaveBeenCalled();
    });

    it('aplica trim antes de validar e de gravar', async () => {
      await service.updateName('  Ana  ');
      expect(update).toHaveBeenCalledWith({ nome: 'Ana' });
    });

    it('erro do banco => network', async () => {
      eq.mockResolvedValue({ error: { message: 'x' } });
      expect(await service.updateName('Ana')).toEqual({ ok: false, reason: 'network' });
    });
  });

  describe('acceptTerms', () => {
    it('envia TERMS_VERSION e recarrega', async () => {
      expect(await service.acceptTerms()).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledWith('accept_terms', { p_versao: TERMS_VERSION });
      expect(calls).toEqual(['rpc:accept_terms', 'rpc:my_account']);
    });

    it('falha => network', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
      expect(await service.acceptTerms()).toEqual({ ok: false, reason: 'network' });
    });
  });

  describe('logout', () => {
    it('chama log_logout ANTES de signOut', async () => {
      await service.logout();
      expect(calls).toEqual(['rpc:log_logout', 'signOut']);
    });

    it('ignora erro de log_logout e ainda sai', async () => {
      rpc.mockRejectedValue(new Error('offline'));
      await expect(service.logout()).resolves.toBeUndefined();
      expect(signOut).toHaveBeenCalled();
    });

    it('nunca lança, nem se o signOut falhar', async () => {
      signOut.mockRejectedValue(new Error('x'));
      await expect(service.logout()).resolves.toBeUndefined();
    });
  });
});
