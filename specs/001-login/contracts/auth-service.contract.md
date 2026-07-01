# Contract — AuthService & AuthStore (frontend)

**Camada:** `src/app/core/auth/`. Encapsula todo acesso ao Supabase Auth. Nenhuma view chama o SDK direto (CLAUDE.md). O token nunca é lido por código de feature.

## AuthStore (signals) — `core/auth/auth.store.ts`

Estado reativo somente-leitura para a UI.

```ts
type Role = 'tutor' | 'admin';
type AuthStatus = 'idle' | 'loading' | 'error';

interface AuthStoreApi {
  readonly session:        Signal<Session | null>;   // do supabase-js
  readonly user:           Signal<User | null>;       // session.user
  readonly role:           Signal<Role | null>;       // de perfis.papel (ver is-admin.rpc.md)
  readonly isAuthenticated: Signal<boolean>;
  readonly status:         Signal<AuthStatus>;
  readonly errorMessage:   Signal<string | null>;     // mensagem PT-BR já genérica
}
```

- `role` é resolvido após login lendo `perfis` (RLS própria) ou `current_user_role()`. Usado **só para rotear** (FR-005). Autorização real = RLS `is_admin()`.
- `errorMessage` é sempre a mensagem genérica final (nunca o erro técnico do GoTrue).

## AuthService — `core/auth/auth.service.ts`

| Método | Assinatura | Comportamento / FR |
|---|---|---|
| `setRememberMe` | `(remember: boolean): void` | Define o storage da sessão (persistente vs. volátil) ANTES do signIn (FR-007/008/009). Ver `session-persistence.ts`. |
| `signInPassword` | `(email: string, password: string): Promise<AuthResult>` | (1) chama Edge `login-guard` (rate-limit, FR-018); se `block/backoff` → erro genérico "tente mais tarde". (2) `supabase.auth.signInWithPassword`. (3) trata e-mail não confirmado (FR-024) → erro genérico + permite `resendConfirmation`. (4) sucesso → resolve papel → emite estado. **Mensagem de falha SEMPRE genérica** (FR-014/019). |
| `signInWithGoogle` | `(): Promise<void>` | `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: <origin>/auth/callback } })`. Segredos no servidor (R6). |
| `handleOAuthCallback` | `(): Promise<AuthResult>` | Em `/auth/callback`: detecta sessão da URL; sucesso → roteia por papel; cancelamento/erro → mensagem neutra + volta ao login (US2 cenários 2/3, FR-015). |
| `resendConfirmation` | `(email: string): Promise<void>` | `supabase.auth.resend({ type:'signup', email })` (FR-024). Resposta uniforme (não confirma existência). |
| `signOut` | `(): Promise<void>` | `supabase.auth.signOut()` + limpa storage + auditoria `logout` (FR-010). |
| `restoreSession` | `(): Promise<void>` | No bootstrap CSR: `getSession()` + assina `onAuthStateChange` para manter o store; suporta FR-011 (logado acessando /auth → redireciona). |

```ts
interface AuthResult {
  ok: boolean;
  role?: 'tutor' | 'admin';   // presente quando ok
  // erro NUNCA detalha causa ao usuário; só o código interno p/ log estruturado
  reason?: 'invalid' | 'unconfirmed' | 'rate_limited' | 'provider_unavailable' | 'network';
}
```

## Contrato de erro / mensagens (FR-014/015/019)

| `reason` interno | Mensagem PT-BR ao usuário (genérica) |
|---|---|
| `invalid` | `E-mail ou senha inválidos.` (idêntica p/ inexistente e senha errada — anti-enumeração) |
| `unconfirmed` | `Não foi possível entrar. Se você acabou de se cadastrar, confirme seu e-mail.` + ação **Reenviar confirmação** |
| `rate_limited` | `Muitas tentativas. Tente novamente mais tarde.` |
| `provider_unavailable` | `O login com Google está indisponível no momento. Você pode entrar com e-mail e senha.` |
| `network` | `Falha de conexão. Verifique sua internet e tente de novo.` |

- **Timing uniforme:** `invalid` por inexistente vs. senha errada percorre o mesmo caminho (sem early-return), atendendo SC-004.

## Guards — `core/auth/{auth,admin,anon}.guard.ts`

| Guard | Tipo | Regra |
|---|---|---|
| `authGuard` | `CanMatchFn` p/ `/app` | `isAuthenticated()` ? true : `/auth/login?returnUrl=...` (FR-012) |
| `adminGuard` | `CanMatchFn` p/ `/admin` | `role() === 'admin'` ? true : `/app` (UX; real é RLS `is_admin()`) |
| `anonGuard` | `CanMatchFn` p/ `/auth` | logado → `roleRedirect(role())` (FR-011); senão true |

> Guards são `CanMatch` (impedem download do chunk). A defesa real é a RLS (um guard burlado não dá acesso a dado).
