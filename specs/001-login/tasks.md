---
description: "Task list — feature 001-login (Login / acesso ao painel)"
---

# Tasks: Login (acesso ao painel)

**Input**: Design em `specs/001-login/` (plan.md, data-model.md, contracts/, research.md, quickstart.md)
**Prerequisites**: plan.md ✅, spec.md ✅ (US1/US2/US3), data-model.md ✅, contracts/ ✅

**Tests**: incluídos — a feature toca PII/RLS/auth, então `docs/test-strategy.md` §3/§7 exige cobertura de segurança/RLS, isolamento e regressão Rescue-First (gate de merge).

**Organização**: por user story (P1/P2/P3), em fases Setup → Foundational → US1 → US2 → US3 → Polish. **Backend** (migrations/RLS/Edge/RPC) e **frontend** (Angular) são tarefas distintas; após os contratos existirem (Foundational), rodam **em paralelo** `[P]`.

## Format: `[ID] [P?] [Story] Descrição`
- **[P]**: paralelizável (arquivos diferentes, sem dependência).
- **[Story]**: US1/US2/US3 (ou Setup/Found/Polish).
- Caminhos de arquivo exatos em cada tarefa. UI/teste usam `data-testid="login-<elemento>"`.

---

## Phase 1: Setup (infraestrutura compartilhada)

**Objetivo**: criar o esqueleto do backend Supabase (primeira feature a fazê-lo) e preparar o frontend.

- [ ] T001 [Setup] Inicializar o diretório do backend: `supabase init` → cria `supabase/config.toml`. Configurar `[auth]` com `enable_confirmations = true` (FR-024) e `[auth.rate_limit]` (camada nativa, FR-018). Documentar `[auth.external.google]` (placeholders de env) em `supabase/config.toml`.
- [ ] T002 [P] [Setup] Criar `supabase/.env.local.example` (template, SEM segredos reais) com `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_SECRET`, `HASH_SALT`; garantir que `supabase/.env.local` está no `.gitignore`.
- [ ] T003 [P] [Setup] Ajustar `src/environments/environment.development.ts` para apontar à URL/anon key locais do Supabase (somente valores públicos) — ver `quickstart.md` §4.
- [ ] T004 [P] [Setup] Confirmar boundary eslint (`no-restricted-imports`) que impede `features/public/**` de importar `core/auth` (Rescue-First / FR-023). Adicionar regra se ausente em `eslint.config.*`.

**Checkpoint**: backend inicializável (`supabase start`), frontend aponta para o local.

---

## Phase 2: Foundational (BLOQUEIA todas as user stories)

**⚠️ CRÍTICO**: nada de US1/US2/US3 começa antes desta fase. Aqui nascem o schema com RLS deny-by-default, `is_admin()`, o trigger de perfil, a auditoria/rate-limit e o core de auth do frontend que todas as histórias usam.

### Backend (migrations — ordem de `docs/backend-supabase.md` §8.1; RLS na mesma migration da tabela)

- [ ] T005 [Found] Migration `supabase/migrations/0001_extensions.sql`: habilitar `pgcrypto` (hash de e-mail/IP). (Reservar comentário sobre `pg_cron` para specs futuras — não usado aqui.)
- [ ] T006 [Found] Migration `supabase/migrations/0002_enums_e_dominios.sql`: criar `papel_enum ('tutor','admin')` e `evento_auth_enum ('login_sucesso','login_falha','login_bloqueado','logout')` (data-model §Enums).
- [ ] T007 [Found] Migration `supabase/migrations/0003_tabela_perfis.sql`: tabela `perfis` (id FK→auth.users, nome, email, papel default 'tutor', timestamps) **+ `ENABLE ROW LEVEL SECURITY` na mesma migration** (data-model §1b).
- [ ] T008 [Found] Migration `supabase/migrations/0004_tabelas_auth_seguranca.sql`: tabelas `auth_audit_log` (append-only) e `auth_login_attempts` + índices `(identity_hash,at)`/`(ip_hash,at)` **+ RLS habilitada deny-by-default** (data-model §5/§6).
- [ ] T009 [Found] Migration `supabase/migrations/0005_funcoes_auth.sql`: `is_admin()`, `current_user_role()`, `record_login_attempt(...)`, `log_auth_event(...)` — todas `SECURITY DEFINER` + `SET search_path=public`, parâmetros tipados (contracts/is-admin, login-rate-limit, auth-audit; FR-016).
- [ ] T010 [Found] Migration `supabase/migrations/0006_rls_policies_auth.sql`: policies — `perfis` (self select/update sem trocar papel, admin all via `is_admin()`), `auth_audit_log` (select admin; insert só service_role; sem update/delete), `auth_login_attempts` (sem policy permissiva = só service_role). Espelhar `contracts/rls-expectations.md`.
- [ ] T011 [Found] Migration `supabase/migrations/0007_trigger_handle_new_user.sql`: função+trigger `on_auth_user_created` que cria a linha em `perfis` (papel 'tutor') no signup (data-model §1b).
- [ ] T012 [Found] `supabase/seed.sql`: 1 perfil **admin** + 1 **tutor** de teste (e-mails confirmados via seed) para validar roteamento por papel e isolamento; sem credenciais reais commitadas.

### Frontend (core de auth — todas as histórias dependem)

- [ ] T013 [P] [Found] `src/app/core/auth/auth.store.ts`: signals `session/user/role/isAuthenticated/status/errorMessage` (contracts/auth-service §AuthStore).
- [ ] T014 [Found] `src/app/core/auth/auth.service.ts`: esqueleto com `restoreSession`, `signOut`, `setRememberMe` e dependência de `SupabaseService` (`core/supabase/supabase.service.ts`). Métodos de login entram nas histórias. (depende de T013)
- [ ] T015 [P] [Found] `src/app/core/auth/session-persistence.ts`: helper que seleciona storage persistente (`localStorage`) vs. volátil (`sessionStorage`) para "manter conectado" (research §R3; FR-007/008/009).
- [ ] T016 [P] [Found] `src/app/core/auth/role-redirect.ts`: util `roleRedirect(role): '/app' | '/admin'` (FR-005/006).
- [ ] T017 [Found] Guards em `src/app/core/auth/`: `auth.guard.ts` (CanMatch /app), `admin.guard.ts` (CanMatch /admin), `anon.guard.ts` (CanMatch /auth → redireciona logado, FR-011). (depende de T013, T016)
- [ ] T018 [Found] Ligar guards e rota de callback no roteamento: editar `src/app/app.routes.ts` (canMatch nos paths `app`/`admin`/`auth`; adicionar `auth/callback`) e `src/app/app.routes.server.ts` (`auth/callback` como `RenderMode.Client`). (depende de T017)

### Testes de fundação (segurança/RLS — gate de merge)

- [ ] T019 [P] [Found] pgTAP `supabase/tests/rls_perfis.test.sql`: tutor A não lê perfil de B; anon negado; anti-escalada de `papel`; `is_admin()`/`current_user_role()` corretos (contracts/is-admin, rls-expectations).
- [ ] T020 [P] [Found] pgTAP `supabase/tests/rls_auth_audit.test.sql`: insert só service_role; select só admin; sem update/delete; snapshot de minimização (sem coluna de PII crua). (contracts/auth-audit)

### Endurecimento anti-XSS (GATES OBRIGATÓRIOS — bloqueiam a entrega de P1)

> Decisão: o token de sessão fica em `localStorage`/`sessionStorage` (sem BFF/SSR de sessão agora), MAS as mitigações anti-XSS deixam de ser best-effort e viram **gates bloqueantes de P1** (Complexity Tracking do `plan.md`; research §R1). Estas tarefas DEVEM estar verdes antes de US1 ser considerada entregue.

- [ ] T020a [Found] **CSP estrita** — definir `Content-Security-Policy` sem `unsafe-inline` para `script-src`, com allowlist de origens (self + domínio do Supabase para `connect-src`), em `vercel.json` (header da hospedagem SSR/estática) e espelhada nos headers do handler SSR (`src/server.ts`). Sem `unsafe-eval`. Documentar a origem do Supabase em `connect-src`. (FR-017; research §R1)
- [ ] T020b [P] [Found] **Checagem de CSP** que falha se ausente/permissiva — teste/script `e2e/security/csp.spec.ts` (Playwright) e/ou checagem de CI `scripts/check-csp.mjs` que lê o header `Content-Security-Policy` da app servida e **falha o build** se `script-src` contiver `unsafe-inline`/`unsafe-eval` ou se o header estiver ausente. (gate de CI)
- [ ] T020c [P] [Found] **Pinagem + auditoria de dependências** — fixar versões no `package-lock.json` (commitado; sem ranges flutuantes nas deps de runtime que tocam render/HTML) e adicionar passo de gate `npm audit --audit-level=high` (e checagem de que nenhuma lib de UI faz `innerHTML` arbitrário) no pipeline. Documentar no `package.json`/CI. (gate de CI)
- [ ] T020d [P] [Found] **Lint anti-XSS + isolamento do token** — regra(s) em `eslint.config.*` que: (1) **proíbem** `innerHTML`/`[innerHTML]`/`bypassSecurityTrust*` com entrada do usuário no código de feature (quebra o build); (2) **proíbem** acesso a `localStorage`/`sessionStorage` de auth fora de `src/app/core/**` (`no-restricted-properties`/`no-restricted-globals` ou boundary equivalente), reforçando que só `core/` toca o storage do token. (FR-017; reforça boundary do T004)

**Checkpoint**: schema + RLS + core de auth prontos e verdes; **gates anti-XSS (T020a–T020d) verdes — pré-condição para a entrega de P1**. US1/US2/US3 podem começar em paralelo; a CSP (T020a) deve estar ativa para o E2E de US1 rodar contra a app endurecida.

---

## Phase 3: User Story 1 — Entrar com e-mail/senha e roteamento por papel (P1) 🎯 MVP

**Goal**: autenticar por e-mail/senha por uma porta única; levar Tutor→`/app` e Admin→`/admin`; erros genéricos anti-enumeração; tratar e-mail não confirmado; rate-limit.

**Independent Test**: com tutor e admin de seed, logar com credenciais certas/erradas e verificar acesso, destino por papel e mensagens genéricas (spec US1).

### Backend (rate-limit + auditoria do fluxo de senha) — `[P]` com o frontend após contratos

- [ ] T021 [P] [US1] Edge Function `supabase/functions/login-guard/index.ts`: endpoint pré-login que deriva `identity_hash`/`ip_hash` (IP do runtime, anti-spoofing), chama `record_login_attempt`, retorna `allow|backoff|block` e grava auditoria (`login_bloqueado` quando aplicável). (contracts/login-rate-limit; FR-018)
- [ ] T022 [P] [US1] Lógica pura `supabase/functions/login-guard/rate-limit.ts`: `decide(failIdentity, failIp)` (testável isolada).
- [ ] T023 [P] [US1] deno test `supabase/functions/login-guard/rate-limit.test.ts`: tabela de casos 0..6 falhas por eixo → decisão correta (SC-005).
- [ ] T024 [P] [US1] pgTAP `supabase/tests/rate_limit.test.sql`: 5 falhas/15min por identidade → `block`; por IP → `block`; reset após janela (FR-018, SC-005).

### Frontend (tela + serviço de senha) — `[P]` com o backend após contratos

- [ ] T025 [US1] `src/app/core/auth/auth.service.ts`: implementar `signInPassword(email,password)` — chama `login-guard`, depois `signInWithPassword`, trata `unconfirmed` (FR-024), resolve papel, emite estado; **mensagem de falha SEMPRE genérica** (FR-014/019) e `resendConfirmation(email)`. (depende de T014; usa contratos T021)
- [ ] T026 [US1] `src/app/features/auth/auth.routes.ts`: rotas `/auth/login` (e placeholder `/auth/callback` para US2); proteger `/auth` com `anonGuard`.
- [ ] T027 [US1] `src/app/features/auth/login/login.ts`: form Reactive tipado (e-mail formato + senha não-vazia, FR-004), checkbox "manter conectado" (chama `setRememberMe`), ações entrar / entrar-com-Google (placeholder US2) / reenviar-confirmação; estados loading/erro genérico. Após sucesso → `roleRedirect`. (depende de T025, T016)
- [ ] T028 [US1] `src/app/features/auth/login/login.html`: layout mobile-first (uma ação primária), WCAG AA, com `data-testid="login-email"`, `login-password`, `login-remember`, `login-submit`, `login-error`, `login-google`, `login-resend-confirmation`, `login-signup-link`, `login-forgot-link` (FR-013 encaminha a signup/recuperação — estado provisório aceitável). (depende de T027)
- [ ] T029 [P] [US1] `src/app/features/auth/login/login.css`: tema Aura/Paleta C (índigo), alvos ≥ 44px (design-system).

### Testes US1

- [ ] T030 [P] [US1] Vitest `src/app/core/auth/auth.service.spec.ts`: `signInPassword` com SupabaseService mockado — sucesso/falha; falha de inexistente e senha errada produzem **a mesma** `errorMessage` (FR-014); `unconfirmed` aciona caminho de reenviar (FR-024).
- [ ] T031 [P] [US1] Vitest `src/app/features/auth/login/login.spec.ts`: validação de form (FR-004), botão desabilitado em invalid, exibição de erro genérico, `data-testid` presentes.
- [ ] T032 [P] [US1] Vitest `src/app/core/auth/guards.spec.ts`: `authGuard` redireciona não-logado; `adminGuard` barra tutor; `anonGuard` redireciona logado ao destino do papel (FR-011/012).
- [ ] T033 [US1] Playwright `e2e/login.spec.ts` (`@critical`): tutor loga → `/app`; admin loga → `/admin`; senha errada e e-mail inexistente → mensagem genérica idêntica (SC-004); axe sem violações sérias na tela de login. Seletores `data-testid`.
- [ ] T033a [US1] **Gate de entrega P1 — confirmar endurecimento anti-XSS ativo**: verificar que T020a–T020d estão verdes contra a app que serve a tela de login (CSP sem `unsafe-inline` presente no header; lint anti-XSS/isolamento de token sem violações; `npm audit` gate ok). P1 NÃO é considerada entregue sem este check. (depende de T020a–T020d, T033)

**Checkpoint**: US1 funcional e testável sozinha — MVP do login entregue, **com os gates anti-XSS (T020a–T020d) verdes**.

---

## Phase 4: User Story 2 — Entrar com Google (P2)

**Goal**: login social com Google levando ao destino do papel; cancelamento/indisponibilidade tratados com mensagem neutra e fallback para e-mail/senha.

**Independent Test**: acionar "Entrar com Google", concluir consentimento → acesso + roteamento; cancelar → volta ao login sem acesso (spec US2).

### Backend / config

- [ ] T034 [US2] Configurar provider Google no `supabase/config.toml` (`[auth.external.google]` com envs) e documentar redirect autorizado (`/auth/callback`) em `quickstart.md` §2. Segredos só no servidor (FR-016/Princípio III).

### Frontend

- [ ] T035 [US2] `src/app/core/auth/auth.service.ts`: `signInWithGoogle()` (`signInWithOAuth` com `redirectTo=<origin>/auth/callback`) e `handleOAuthCallback()` (sucesso→roteia por papel; cancelamento/erro→mensagem neutra, FR-015). (depende de T025)
- [ ] T036 [US2] `src/app/features/auth/callback/oauth-callback.ts` + rota `/auth/callback` (CSR): processa retorno, trata erro/cancelamento (US2 cenários 2/3), redireciona por papel. (depende de T035, T018)
- [ ] T037 [US2] `src/app/features/auth/login/login.html`/`.ts`: ativar o botão `data-testid="login-google"` e o tratamento de `provider_unavailable` (mensagem neutra + caminho e-mail/senha). (depende de T035)

### Testes US2

- [ ] T038 [P] [US2] Vitest `src/app/core/auth/auth.service.oauth.spec.ts`: `signInWithGoogle` invoca OAuth com `redirectTo` correto; `handleOAuthCallback` roteia por papel no sucesso e retorna mensagem neutra no cancelamento/erro (FR-015).
- [ ] T039 [P] [US2] Playwright `e2e/login-google.spec.ts`: botão Google presente/acionável; cenário de cancelamento volta ao login sem acesso (OAuth mockado/stub). `data-testid="login-google"`.

**Checkpoint**: US1 e US2 funcionam de forma independente.

---

## Phase 5: User Story 3 — Manter conectado e sair com segurança (P3)

**Goal**: sessão persistente vs. curta; logout invalida acesso; sessão expirada redireciona ao login e retorna ao destino pretendido.

**Independent Test**: logar com/sem "manter conectado", reabrir navegador e verificar permanência/expiração; logout bloqueia acesso (spec US3).

### Frontend

- [ ] T040 [US3] `src/app/core/auth/auth.service.ts`: finalizar `signOut()` (limpa storage + auditoria `logout` via Edge/RPC) e garantir que `setRememberMe` é aplicado antes do signIn em todos os fluxos (senha e Google). (depende de T015, T025, T035)
- [ ] T041 [US3] `src/app/core/auth/auth.guard.ts`: ao detectar sessão expirada/ausente em `/app`, redirecionar a `/auth/login?returnUrl=...` e, após autenticar, levar ao destino pretendido (FR-012). (depende de T017, T025)
- [ ] T042 [P] [US3] UI de logout: botão `data-testid="login-logout"` no shell autenticado (ex.: `src/app/features/pets/pets/pets.html` ou um header compartilhado) chamando `auth.service.signOut()` (FR-010).

### Backend

- [ ] T043 [P] [US3] Garantir que `logout` é auditado: a Edge/RPC `log_auth_event('logout', ...)` é chamada no signOut (server-side trigger ou chamada da Edge). (contracts/auth-audit; FR-020)

### Testes US3

- [ ] T044 [P] [US3] Vitest `src/app/core/auth/session-persistence.spec.ts`: marcado → storage persistente; desmarcado → volátil (FR-007/008/009).
- [ ] T045 [P] [US3] Playwright `e2e/session.spec.ts`: "manter conectado" persiste após recarregar contexto; sem ele expira; logout (`login-logout`) bloqueia `/app`; sessão expirada → login → retorna ao destino (SC-007, FR-010/012).

**Checkpoint**: as três histórias funcionam independentemente.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T046 [P] [Polish] Verificar auditoria fim-a-fim (FR-020/SC-006): teste de integração confirma linhas `login_sucesso/login_falha/login_bloqueado/logout` em `auth_audit_log`, **sem** PII crua (FR-021).
- [ ] T047 [P] [Polish] **Scan de segredos no bundle** (`docs/test-strategy.md` §3.6): garantir que `dist/` não contém `service_role`/`GOOGLE_OAUTH_SECRET`/qualquer chave; bundle de auth não importa `features/public`.
- [ ] T048 [P] [Polish] **Regressão Rescue-First** (SC-008/FR-023): teste/guardião confirma que `/{codigo}` carrega anônima e que nada desta feature tocou `perfil_resgate_publico` nem `features/public/**`.
- [ ] T049 [P] [Polish] i18n: extrair textos PT-BR da tela de login para `@angular/localize` (sem strings hardcoded); confirmar `lang="pt-BR"`.
- [ ] T050 [Polish] Rodar `quickstart.md` ponta a ponta (validação manual das 9 linhas da tabela §6) e `npm run lint`/`npm test`/`supabase test db`/`npm run e2e` verdes.

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2)** bloqueia tudo → **US1/US2/US3** (após Foundational) → **Polish**.
- Dentro de cada história: **backend (migrations/RLS/Edge/RPC) antes do frontend que o consome**; mas, como os **contratos** (`contracts/`) já existem, backend e frontend de uma mesma história rodam **em paralelo** sincronizados pelo contrato.
- Migrations 0001→0007 são sequenciais entre si (ordem do arquivo); por isso T005–T011 não são `[P]` entre si. Já os testes pgTAP (T019/T020) e o core de frontend (T013/T015/T016) são `[P]`.
- **Gates anti-XSS (T020a–T020d) são bloqueantes de P1**: estão na Foundational e DEVEM estar verdes antes de US1 ser entregue (confirmado por T033a). T020a (CSP) precede o E2E de US1 (T033) para que ele rode contra a app endurecida.

### Divisão Backend × Frontend (para os implementadores)

| Fase | Backend (backend-supabase) | Frontend (frontend-angular) | Plataforma/CI | Paralelizável? |
|---|---|---|---|---|
| Foundational | T005–T012, T019, T020 | T013–T018 | T020a (CSP em `vercel.json`/`src/server.ts`), T020b–T020d (checagens CI: CSP, deps, lint anti-XSS) | Backend ∥ frontend ∥ gates anti-XSS; migrations sequenciais entre si |
| US1 (P1) | T021–T024 | T025–T033, T033a | T033a depende dos gates T020a–T020d | **Sim** após contratos — backend (Edge/rate-limit) ∥ frontend (tela/serviço); P1 só entrega com gates verdes |
| US2 (P2) | T034 | T035–T039 | — | **Sim** — config Google ∥ UI/callback |
| US3 (P3) | T043 | T040–T042, T044, T045 | — | **Sim** — auditoria de logout ∥ persistência/logout UI |
| Polish | T046–T048 (parte) | T047–T049 | T047 (scan de segredos) | Mistos, maioria `[P]` |

### Parallel Opportunities
- Foundational: T013 [P], T015 [P], T016 [P], T019 [P], T020 [P] juntos; migrations T005–T011 em série. Gates anti-XSS: **T020a primeiro** (define a CSP em `vercel.json`/`src/server.ts`); depois T020b, T020c, T020d em paralelo `[P]` (arquivos/checagens distintos).
- US1: T021/T022/T023/T024 (backend) ∥ T029/T030/T031/T032 (frontend isolados). T025→T027→T028 em série (mesmo fluxo/arquivos). T033a fecha o gate de entrega após T020a–T020d + T033.
- Times distintos podem tocar US1, US2 e US3 em paralelo após o Foundational, pois cada história tem arquivos próprios.

---

## Implementation Strategy

1. Setup + Foundational (schema com RLS, `is_admin()`, trigger, core de auth, **gates anti-XSS T020a–T020d**) — **gate de segurança verde** antes de qualquer história.
2. **US1** (e-mail/senha + roteamento) → validar → é o **MVP do login**.
3. **US2** (Google) → validar.
4. **US3** (manter conectado + logout) → validar.
5. Polish (auditoria fim-a-fim, scan de segredos, regressão Rescue-First, i18n, quickstart).

## Notes
- `[P]` = arquivos diferentes, sem dependência. Tarefas no mesmo arquivo nunca são `[P]`.
- Tarefas de UI/teste usam `data-testid="login-<elemento>"`.
- **Gate de merge** (`docs/test-strategy.md` §6.3): suíte de segurança/RLS verde, scan de segredos sem achados, axe AA na tela de login, regressão Rescue-First verde, e revisão humana de segurança/privacidade (toca PII/RLS/auth).
- **Gates anti-XSS bloqueantes de P1** (T020a–T020d, confirmados por T033a): CSP estrita sem `unsafe-inline` (`vercel.json` + `src/server.ts`), pinagem+`npm audit` de deps, lint anti-XSS (`innerHTML`/`bypassSecurityTrust*`) + isolamento do token de auth fora de `core/`. Decorrem de aceitar `localStorage` com defesas endurecidas (Complexity Tracking do `plan.md`).
