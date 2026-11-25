import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { SupabaseService } from '../supabase/supabase.service';

const KEY = 'sb-abcdef-auth-token';
const SESSION = { access_token: 'a', refresh_token: 'r', user: { id: 'u1' } };

describe('AuthService.restoreSession', () => {
  let auth: Record<string, ReturnType<typeof vi.fn> | Storage>;
  let service: AuthService;
  let store: AuthStore;

  const setup = (getSession: { data: { session: unknown }; error: unknown }) => {
    auth = {
      getSession: vi.fn().mockResolvedValue(getSession),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SupabaseService,
          useValue: { client: { auth, rpc: vi.fn().mockResolvedValue({ data: 'tutor', error: null }) } },
        },
      ],
    });
    service = TestBed.inject(AuthService);
    store = TestBed.inject(AuthStore);
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('chave no sessionStorage: aponta o cliente para ele e restaura a sessão', async () => {
    sessionStorage.setItem(KEY, '{}');
    setup({ data: { session: SESSION }, error: null });
    await service.restoreSession();
    expect(auth['storage']).toBe(sessionStorage);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.role()).toBe('tutor');
    expect(auth['signOut']).not.toHaveBeenCalled();
  });

  it('chave no localStorage: restaura sem trocar o storage', async () => {
    localStorage.setItem(KEY, '{}');
    setup({ data: { session: SESSION }, error: null });
    await service.restoreSession();
    expect(auth['storage']).toBe(localStorage);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('chave gravada mas sessão inválida: limpa localmente e segue anônimo', async () => {
    sessionStorage.setItem(KEY, '{}');
    setup({ data: { session: null }, error: null });
    await service.restoreSession();
    expect(auth['signOut']).toHaveBeenCalledWith({ scope: 'local' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('falha de rede ao ler a sessão: não apaga a credencial', async () => {
    localStorage.setItem(KEY, '{}');
    setup({ data: { session: null }, error: new Error('network') });
    await service.restoreSession();
    expect(auth['signOut']).not.toHaveBeenCalled();
  });

  it('sem chave: não limpa nada', async () => {
    setup({ data: { session: null }, error: null });
    await service.restoreSession();
    expect(auth['signOut']).not.toHaveBeenCalled();
  });
});
