/**
 * auth.service.spec.ts — T030
 *
 * Testa AuthService com SupabaseService mockado.
 * Foco: anti-enumeração (FR-014/019), unconfirmed (FR-024), rate-limit.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { SupabaseService } from '../supabase/supabase.service';

// ── Mock do SupabaseService ──
function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signInWithPassword: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        resend: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: { decision: 'allow' }, error: null }),
      },
      rpc: vi.fn().mockResolvedValue({ data: 'tutor', error: null }),
      ...overrides,
    },
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let store: AuthStore;
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    supabaseMock = makeSupabaseMock();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
      { path: 'auth/login', component: class {} as never },
      { path: 'app', component: class {} as never },
      { path: 'admin', component: class {} as never },
    ]),
        AuthService,
        AuthStore,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });

    service = TestBed.inject(AuthService);
    store = TestBed.inject(AuthStore);
  });

  // ────────────────────────────────────────────────────────────────
  // signInPassword — anti-enumeração (FR-014/019, SC-004)
  // ────────────────────────────────────────────────────────────────

  it('deve retornar errorMessage idêntica para senha errada e conta inexistente (anti-enumeração)', async () => {
    // Senha errada
    supabaseMock.client.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });
    const result1 = await service.signInPassword('test@example.com', 'wrong');

    // Conta inexistente (GoTrue retorna a mesma mensagem "Invalid login credentials")
    supabaseMock.client.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });
    const result2 = await service.signInPassword('nonexistent@example.com', 'any');

    expect(result1.ok).toBe(false);
    expect(result2.ok).toBe(false);
    expect(result1.reason).toBe('invalid');
    expect(result2.reason).toBe('invalid');

    // A mesma errorMessage em store (FR-014/019)
    expect(store.errorMessage()).toBe('E-mail ou senha inválidos. Verifique e tente de novo.');
  });

  it('deve retornar reason=unconfirmed para e-mail não confirmado (FR-024)', async () => {
    supabaseMock.client.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Email not confirmed' },
    });

    const result = await service.signInPassword('unconfirmed@example.com', 'pass');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unconfirmed');
    expect(service.isUnconfirmed()).toBe(true);
  });

  it('deve retornar ok=true e role ao autenticar com sucesso', async () => {
    const mockSession = { user: { id: 'uid-1', email: 'tutor@example.com' }, access_token: 'tok' };
    supabaseMock.client.auth.signInWithPassword.mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    });
    supabaseMock.client.rpc.mockResolvedValue({ data: 'tutor', error: null });

    const result = await service.signInPassword('tutor@example.com', 'correct');

    expect(result.ok).toBe(true);
    expect(result.role).toBe('tutor');
    expect(store.isAuthenticated()).toBe(true);
  });

  it('deve retornar reason=rate_limited quando login-guard retorna block', async () => {
    supabaseMock.client.functions.invoke.mockResolvedValue({
      data: { decision: 'block' },
      error: null,
    });

    const result = await service.signInPassword('blocked@example.com', 'pass');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('rate_limited');
    // signInWithPassword NÃO deve ter sido chamado (bloqueado antes)
    expect(supabaseMock.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────
  // post_result — alimenta rate-limit (FR-018) e auditoria (FR-020)
  // ────────────────────────────────────────────────────────────────

  it('deve chamar login-guard post_result com success=false ao falhar (FR-018/FR-020)', async () => {
    supabaseMock.client.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    await service.signInPassword('test@example.com', 'wrong');

    expect(supabaseMock.client.functions.invoke).toHaveBeenCalledWith(
      'login-guard',
      expect.objectContaining({
        body: expect.objectContaining({
          phase: 'post_result',
          success: false,
          email: 'test@example.com',
        }),
      }),
    );
  });

  it('deve chamar login-guard post_result com success=true e user_id ao autenticar (FR-020)', async () => {
    const mockSession = { user: { id: 'uid-1', email: 'tutor@example.com' }, access_token: 'tok' };
    supabaseMock.client.auth.signInWithPassword.mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    });
    supabaseMock.client.rpc.mockResolvedValue({ data: 'tutor', error: null });

    await service.signInPassword('tutor@example.com', 'correct');

    expect(supabaseMock.client.functions.invoke).toHaveBeenCalledWith(
      'login-guard',
      expect.objectContaining({
        body: expect.objectContaining({
          phase: 'post_result',
          success: true,
          user_id: 'uid-1',
        }),
      }),
    );
  });

  it('NÃO deve chamar post_result quando bloqueado por rate-limit (Edge já audita login_bloqueado)', async () => {
    supabaseMock.client.functions.invoke.mockResolvedValue({
      data: { decision: 'block' },
      error: null,
    });

    await service.signInPassword('blocked@example.com', 'pass');

    expect(supabaseMock.client.functions.invoke).not.toHaveBeenCalledWith(
      'login-guard',
      expect.objectContaining({
        body: expect.objectContaining({ phase: 'post_result' }),
      }),
    );
  });

  it('deve retornar reason=network em falha de rede', async () => {
    supabaseMock.client.functions.invoke.mockRejectedValue(new Error('fetch failed'));

    const result = await service.signInPassword('any@example.com', 'pass');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('network');
  });

  // ────────────────────────────────────────────────────────────────
  // resendConfirmation — anti-enumeração
  // ────────────────────────────────────────────────────────────────

  it('deve chamar resend silenciosamente mesmo em erro (anti-enumeração)', async () => {
    supabaseMock.client.auth.resend.mockRejectedValue(new Error('fail'));
    // Não deve lançar
    await expect(service.resendConfirmation('any@example.com')).resolves.toBeUndefined();
  });

  // ────────────────────────────────────────────────────────────────
  // signOut
  // ────────────────────────────────────────────────────────────────

  it('deve limpar o store ao fazer signOut', async () => {
    // Simula sessão ativa
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');

    await service.signOut();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.role()).toBeNull();
  });
});
