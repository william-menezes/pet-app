# Quickstart — Login (001-login)

Como rodar e validar o login localmente (Supabase local + Angular). Pré-requisitos: Node 20+, npm 10+, **Supabase CLI** (binário `supabase`), Docker (para o stack local).

> A feature 001-login é a **primeira a criar o diretório `supabase/`**. Se ele ainda não existir, `supabase init` o cria.

## 1. Subir o backend Supabase local

```bash
# na raiz do repo (d:/willi/dev/pet-app/pet-app)
supabase init           # só na primeira vez (cria supabase/config.toml)
supabase start          # sobe Postgres + Auth (GoTrue) + Studio + Inbucket (e-mails de dev)
supabase db reset       # aplica migrations 0001..0007 + seed.sql (admin/tutor de teste)
```

- O `db reset` roda as migrations desta feature (perfis, auth_audit_log, auth_login_attempts, is_admin(), trigger handle_new_user) e o `seed.sql` (1 perfil admin + 1 tutor de teste).
- **Inbucket** (e-mails locais) fica em `http://localhost:54324` — use para confirmar e-mail de contas de teste (FR-024).

## 2. Configurar o provedor Google (OAuth) — para US2

Em `supabase/config.toml` (local) ou no painel (staging/prod):

```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_OAUTH_CLIENT_ID)"
secret    = "env(GOOGLE_OAUTH_SECRET)"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

```bash
# segredos só no servidor — NUNCA no frontend (Princípio III)
export GOOGLE_OAUTH_CLIENT_ID=...        # do Google Cloud Console
export GOOGLE_OAUTH_SECRET=...
# redirect autorizado no app frontend: http://localhost:4200/auth/callback
```

> Sem as credenciais Google, **US1 (e-mail/senha) funciona normalmente**; só o botão "Entrar com Google" (US2) fica indisponível — degradação prevista (FR-015).

## 3. Servir a Edge Function de rate-limit

```bash
supabase functions serve login-guard --env-file ./supabase/.env.local
# ./supabase/.env.local (NÃO commitar): SERVICE_ROLE_KEY, HASH_SALT, etc.
```

## 4. Apontar o frontend para o Supabase local

`src/environments/environment.development.ts` deve usar a URL/anon key locais impressas pelo `supabase start`:

```ts
export const environment = {
  production: false,
  supabaseUrl: 'http://localhost:54321',
  supabaseAnonKey: '<anon key impressa pelo supabase start>',
};
```

> Apenas valores **públicos** (URL + anon key). `service_role` e segredos **nunca** entram no frontend.

## 5. Rodar o frontend

```bash
npm install
npm start                 # ng serve → http://localhost:4200
# login em http://localhost:4200/auth/login
```

## 6. Validar as user stories

| História | Como validar | Espera-se |
|---|---|---|
| **US1** e-mail/senha + roteamento | Entrar com o **tutor** de teste → vai a `/app`. Entrar com o **admin** de teste → vai a `/admin`. Senha errada / e-mail inexistente → mesma mensagem genérica. | FR-001/003/005/006/014. |
| **US1** e-mail não confirmado | Criar conta e-mail/senha (via seed/Studio) sem confirmar → tentar logar → recusa genérica + ação "reenviar" (e-mail aparece no Inbucket). | FR-024. |
| **US1** rate-limit | 5 tentativas falhas em <15 min (mesmo e-mail) → 6ª recebe "tente mais tarde". | FR-018, SC-005. |
| **US1** já autenticado em /auth | Logado, acessar `/auth/login` → redireciona ao destino do papel. | FR-011. |
| **US2** Google | "Entrar com Google" → consentir → vai ao destino do papel. Cancelar → volta ao login com mensagem neutra. | FR-002, US2. |
| **US3** manter conectado | Logar com checkbox marcado → fechar/reabrir navegador → continua logado. Sem marcar → após fechar, exige re-login. | FR-007/008/009, SC-007. |
| **US3** logout | "Sair" → acesso a `/app` exige re-login. | FR-010. |
| **US3** sessão expirada | Expirar sessão → acessar `/app` → vai ao login → após entrar, volta ao destino pretendido. | FR-012. |
| **Rescue-First** | Abrir `/{codigo}` (anônimo) antes e depois de logar/deslogar → página de resgate carrega sempre, sem pedir login. | FR-023, SC-008. |

## 7. Rodar os testes

```bash
# Unit Angular (store, service, guards) — Vitest
npm test

# RLS / RPC (perfis, auth_audit_log, auth_login_attempts, is_admin) — pgTAP
supabase test db

# Lógica pura da Edge (decisão de rate-limit) — deno test
deno test supabase/functions/login-guard/

# E2E (login P1 + axe a11y) — Playwright
npm run e2e
```

## 8. Auditoria (verificar FR-020)

No Studio (`http://localhost:54323`) ou via SQL como `service_role`:

```sql
SELECT evento, ator, at FROM auth_audit_log ORDER BY at DESC LIMIT 20;
```

Deve conter linhas de `login_sucesso`, `login_falha`, `login_bloqueado`, `logout` — **sem** e-mail cru/senha/token (FR-021).
