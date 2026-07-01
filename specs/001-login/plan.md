# Implementation Plan: Login (acesso ao painel)

**Branch**: `001-login` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-login/spec.md` (Status: aprovada + clarificada — Session 2026-06-29)

## Summary

Implementar a **porta única de login** do painel autenticado do Faro: **e-mail/senha** e **Google (OAuth)**, com **roteamento por papel** (Tutor → `/app`; Admin → `/admin`), opção **"manter conectado"** (sessão persistente vs. curta), **logout** e tratamento de sessão expirada. A feature é inteiramente do **app painel (CSR)** — não toca a rota pública de resgate (Rescue-First preservado por construção).

Abordagem técnica: usar o **Supabase Auth (GoTrue)** como fonte de identidade (já decidido em `docs/backend-supabase.md` §4), com o cliente `@supabase/supabase-js` já presente em `core/supabase/supabase.service.ts`. O papel é resolvido pela tabela `perfis` (provisionada por trigger no signup) e sustentado nas policies por **`is_admin()`** (decisão travada no README). Os requisitos de segurança da spec aterrissam em decisões concretas de stack (token em `localStorage` cifrado-pelo-SDK + futura migração SSR-cookie documentada; rate-limit nativo do GoTrue **reforçado** por uma Edge Function + tabela de tentativas; auditoria em tabela própria `auth_audit_log` com RLS deny-by-default e minimização). Implementação organizada por user story (P1 e-mail/senha + roteamento, P2 Google, P3 manter-conectado + logout), com tarefas de backend (migrations/RLS/Edge/RPC) e frontend (Angular) separadas e paralelizáveis após os contratos.

## Technical Context

**Language/Version**: TypeScript estrito (`strict`), Angular **21.2** (standalone, signals, **zoneless** — `provideZonelessChangeDetection`), SSR híbrido via `@angular/ssr` 21.2. Edge Functions em **Deno** (runtime Supabase).
**Primary Dependencies**: `@supabase/supabase-js` ^2.108 (Auth/GoTrue + PostgREST), **PrimeNG 21** + `@primeuix/themes` (FaroPreset/Aura), `@angular/localize` (PT-BR), `@angular/forms` (Reactive Forms tipados).
**Storage**: Supabase **Postgres** (região São Paulo/BR). Identidade nativa no schema `auth` do Supabase (`auth.users`, `auth.identities`, `auth.sessions` — geridos pelo GoTrue). Tabelas próprias no schema `public`: `perfis` (papel), `auth_audit_log` (auditoria), `auth_login_attempts` (rate-limit/anti-bruteforce). `jsonb` para detalhe de auditoria.
**Identity/Auth**: Supabase Auth — provider **email** (com `enable_confirmations = true`) + provider **google** (OAuth, client id/secret em secrets do servidor). Sessão JWT (`access_token` + `refresh_token`) com refresh automático.
**Testing**: **Vitest** (unit Angular: store/serviço/guards), **pgTAP** via `supabase test db` (RLS de `perfis`/`auth_audit_log`/`auth_login_attempts`, RPC `is_admin()`/`record_login_attempt`), **deno test** (lógica pura da Edge Function de rate-limit), **Playwright** (E2E login P1, axe a11y).
**Target Platform**: Web responsivo mobile-first (PWA instalável); painel = **CSR** (`RenderMode.Client`) — a tela de login NÃO é SSR (dados sensíveis, sem ganho de SEO). Hospedagem SSR Vercel; Supabase gerenciado.
**Project Type**: Web app (frontend Angular + backend Supabase no mesmo monorepo).
**Performance Goals**: tela de login interativa ≤ **3 s** em 4G (SC-003); resposta de login (sucesso/erro) percebida ≤ **2 s** descontada latência externa; login completo ≤ **20 s** (SC-001).
**Constraints**: anti-enumeração — mensagens e **timing** uniformes entre "credenciais inválidas" e "conta inexistente" (FR-014/019, SC-004); rate-limit **5 falhas / 15 min** por identidade **E** por origem/IP com backoff (FR-018); token de sessão protegido contra XSS (FR-017/022); transporte TLS (FR-022); **zero regressão Rescue-First** (FR-023/SC-008); WCAG 2.1 AA; segredos só no servidor (FR-016/Princípio III).
**Scale/Scope**: MVP — 1 tela de login + callback OAuth + logout; 3 tabelas próprias (1 já existente conceitualmente: `perfis`); 1 Edge Function (rate-limit/auditoria) + RPCs; ~poucos admins, volume de login moderado.

### Decisões de segurança concretas (aterrissagem dos FRs — foco do plano)

| FR | Requisito (spec) | Decisão de stack concreta | Justificativa |
|---|---|---|---|
| **FR-016** | Anti-injeção (SQL injection e afins) | **Todo** acesso a dados via cliente `supabase-js` (PostgREST parametrizado) ou **RPC** com parâmetros tipados; **proibida** concatenação de SQL com entrada do usuário; **nenhum** SQL dinâmico no cliente. RPCs `SECURITY DEFINER` usam `SET search_path = public` e parâmetros (`p_*`), nunca `EXECUTE` com string montada de input. Validação de formato no cliente (UX) **e** constraints no banco. | Banco é a fonte de verdade (CLAUDE.md). PostgREST/`rpc()` já parametriza; elimina a superfície de injeção. |
| **FR-017 / FR-022** | Token de sessão protegido contra XSS + "manter conectado" | **MVP**: token gerido pelo SDK do Supabase em `localStorage` (default do `supabase-js` no browser), com `persistSession`/`autoRefreshToken` **somente no browser** (já implementado em `supabase.service.ts`; `isBrowser` guard). "Manter conectado" controla **se** o SDK persiste (persistente) **ou** usa armazenamento de sessão volátil (curta, limpa ao fechar a aba). **Mitigação de XSS = GATE OBRIGATÓRIO de P1** (não best-effort): (1) **CSP estrita** sem `unsafe-inline`/`unsafe-eval` em `script-src`, allowlist de origens, servida por `vercel.json` + headers do SSR (`src/server.ts`), com checagem de CI que falha se ausente/permissiva; (2) **pinagem + `npm audit`** de dependências (sem libs de UI que injetem HTML arbitrário); (3) **lint anti-XSS** que proíbe `innerHTML`/`[innerHTML]`/`bypassSecurityTrust*` com input e impede acesso a `localStorage`/`sessionStorage` de auth fora de `core/`; (4) sanitização nativa do Angular; o token nunca é lido por código de feature, só pelo SDK em `core/`. Tarefas T020a–T020d (Foundational), confirmadas por T033a. **Evolução documentada (não-MVP, porta aberta)**: mover para cookies `httpOnly`+`Secure`+`SameSite=Lax` via `@supabase/ssr` quando/se o painel adotar SSR autenticado — registrado em research.md. Transporte sempre HTTPS/TLS (FR-022) — garantido pela Vercel/Supabase. | `localStorage` é o caminho nativo e mais simples (YAGNI/MVP); o painel é CSR puro, então não há fluxo SSR de sessão a proteger hoje. Com as mitigações elevadas a gates bloqueantes, o risco residual de roubo de token por XSS fica reduzido. A porta para cookie httpOnly fica aberta sem refatorar o domínio (só `core/`). Ver Complexity Tracking. |
| **FR-018** | Rate-limit / anti-força-bruta (5/15min por identidade+IP, backoff) | **Defesa em duas camadas**: (1) **rate-limit nativo do GoTrue** (config `config.toml` / painel — limites de tentativas de senha por IP/hora) como rede ampla; (2) **reforço próprio determinístico** = tabela `auth_login_attempts` + RPC/Edge `record_login_attempt(p_identity_hash, p_ip_hash)` que conta falhas na janela de 15 min por `(identity_hash)` **e** por `(ip_hash)`, aplica **backoff progressivo** e bloqueio temporário após 5 falhas, retornando decisão `allow|backoff|block`. A contagem usa **hash** do e-mail e do IP (minimização LGPD). Segredos/`service_role` só na Edge. | GoTrue sozinho não garante a granularidade "identidade E IP" nem backoff determinístico testável (SC-005). A camada própria torna o parâmetro auditável e o teste anti-bruteforce determinístico. |
| **FR-014 / FR-019** | Mensagens genéricas + anti-enumeração (conteúdo **e** timing) | Mensagem única PT-BR `"E-mail ou senha inválidos."` para credenciais inválidas **e** conta inexistente. O frontend **nunca** ramifica a mensagem pelo código de erro do GoTrue. **Timing uniforme**: o GoTrue já responde de forma constante para usuário inexistente vs. senha errada; a camada de rate-limit aplica o mesmo caminho/latência a ambos os casos (sem early-return que vaze diferença perceptível). Confirmação de e-mail pendente (FR-024) usa mensagem genérica própria + ação "reenviar", sem revelar existência. | Atende SC-004 (indistinguível em conteúdo, formato e tempo). |
| **FR-020** | Auditoria de eventos sensíveis (login, falha, bloqueio, logout) | Tabela própria **`auth_audit_log`** (append-only) com `evento` (`login_sucesso\|login_falha\|login_bloqueado\|logout`), `ator` (uuid nullable), `ip_hash`, `user_agent` (truncado), `detalhe jsonb` mínimo, `at timestamptz`. **RLS deny-by-default**: `anon`/`authenticated` sem acesso; `INSERT` só por `service_role` (Edge); `SELECT` só admin (`is_admin()`). Sem PII além do necessário (e-mail só hasheado; sem senha; sem token). | Princípio VII + FR-021 (minimização LGPD). Retenção/anonimização fina = spec **009** (documentado). |
| **FR-005 / FR-006** | Roteamento por papel sem claim manipulável | Papel lido de **`perfis.papel`** (fonte no banco), exposto ao cliente por RPC `current_user_role()` **ou** leitura de `perfis` sob RLS própria (`id = auth.uid()`). O guard de rota Angular (`adminGuard`) é **só UX**; a **autorização real** é a RLS via **`is_admin()`** no banco — um guard burlado não dá acesso a dado de admin. **Nada** confia em claim do cliente para autorização. | Decisão travada (README: `is_admin()`, sem custom claim no MVP). O cliente pode ler o papel para *rotear*, mas a *proteção* dos dados é no banco. |
| **FR-023** | Invariante Rescue-First | Esta feature vive **somente** em `features/auth/` + `core/auth/` + `app/admin` + `app/app`. **Não** importa nem altera `features/public/**`; **não** adiciona guard/sessão a `/{codigo}`; **não** altera `perfil_resgate_publico`. O eslint boundary (`no-restricted-imports`) já impede `features/public` de puxar `core/auth`. | Gate crítico — confirmado no Constitution Check abaixo. |

## Constitution Check

*GATE: percorre CADA princípio da constituição v1.1.0. Reavaliado após o design (Fase 1) — mantém-se ✓.*

### I. Segurança do Pet Acima de Tudo (Rescue-First) — NÃO-NEGOCIÁVEL — ✓ PASS

- A feature é **exclusivamente** do painel autenticado (CSR). **Não** introduz qualquer dependência de autenticação/sessão/login na rota pública `/{codigo}` nem na resolução do QR (FR-023, SC-008).
- **Não** toca `features/public/**`, **não** altera a view/RPC `perfil_resgate_publico`, **não** adiciona JOIN com `assinaturas`.
- O boundary de lint (`no-restricted-imports`) garante que `features/public` continua sem importar `core/auth`.
- **Verificação no plano**: SC-008 vira teste de regressão (a página de resgate carrega anônima antes e depois desta feature); guardião arquitetural já existente (`docs/test-strategy.md` §3.5) permanece verde.

### II. Privacidade & LGPD por Design — NÃO-NEGOCIÁVEL — ✓ PASS

- **Minimização**: `auth_audit_log` e `auth_login_attempts` armazenam **e-mail e IP apenas como hash**; nunca senha, nunca token, nunca IP cru (FR-021).
- A tela de login coleta o mínimo (e-mail + senha + opção "manter conectado"); contas Google trazem e-mail já verificado pelo provedor.
- `detalhe jsonb` da auditoria é mínimo (sem PII de terceiros).
- Retenção/anonimização de `auth_audit_log`/`auth_login_attempts` (janela) fica para a spec **009-privacidade-lgpd** — registrado como dependência futura, não bloqueante (colunas já minimizadas hoje).

### III. Segurança em Profundidade & RLS-First — NÃO-NEGOCIÁVEL — ✓ PASS

- `perfis`, `auth_audit_log`, `auth_login_attempts` nascem com **RLS habilitada + deny-by-default na mesma migration** que as cria.
- `anon` **não** acessa nenhuma dessas tabelas. `authenticated` lê só o próprio `perfis` (`id = auth.uid()`); auditoria/tentativas são **insert só por `service_role`** (Edge) e **select só admin** (`is_admin()`).
- **Segredos** (Google OAuth client/secret, `service_role`, qualquer chave) só em Edge Functions / secrets do servidor — **nunca** no frontend (FR-016). O cliente usa só `anon key` (já garantido em `supabase.service.ts`).
- Anti-injeção (FR-016): acesso só por PostgREST parametrizado/RPC tipada; sem SQL dinâmico no cliente.
- Anti-força-bruta (FR-018) + anti-enumeração de contas (FR-019) são tratadas como casos de "endpoint público sensível" análogos à anti-enumeração de tags.

### IV. Spec-Driven Development — ✓ PASS

- Spec aprovada e clarificada (Session 2026-06-29, sem `[NEEDS CLARIFICATION]`) → este `plan.md` → `tasks.md`. A stack vive aqui, não na spec (que é agnóstica).
- Materializa decisões travadas do `docs/README.md` sem reabri-las (`is_admin()`, Vitest, jsonb, etc.).

### V. Mobile-First, Performance & Acesso Universal — ✓ PASS

- Tela de login mobile-first, **uma ação primária** (entrar), alvos ≥ 44px, WCAG 2.1 AA (axe no E2E), `lang="pt-BR"`, microcopy via `@angular/localize`.
- Painel = CSR (sem SSR para dados sensíveis) — coerente com a tabela de render mode (`app.routes.server.ts` já marca `auth/login` como `RenderMode.Client`).
- Orçamento: a tela de login está no bundle do painel (lazy), **fora** do bundle público de resgate — não pesa o caminho crítico do Finder.

### VI. Simplicidade & Entrega Incremental (MVP-First / YAGNI) — ✓ PASS

- 3 user stories independentes e testáveis (P1 e-mail/senha+roteamento entrega valor sozinha; P2 Google; P3 manter-conectado+logout).
- **MFA fora do MVP**, mas o data-model não fecha portas (Supabase Auth suporta MFA/TOTP nativamente sobre `auth.users` sem mudança de schema próprio; `perfis` e auditoria não impedem). Token em `localStorage` (mais simples) com porta para cookie httpOnly aberta — ver Complexity Tracking.
- Reuso máximo do que o bootstrap já criou (`features/auth/login`, `core/supabase/supabase.service.ts`).

### VII. Observabilidade, Auditoria & Confiabilidade — ✓ PASS

- `auth_audit_log` registra **login bem-sucedido, falha, bloqueio por rate-limit e logout** (FR-020, SC-006), auditável e recuperável.
- Erros tratados com mensagens amigáveis PT-BR e fallback (FR-015) via `error.interceptor`/store; sem stack trace ao usuário.
- Falha do provedor Google / perda de conexão → mensagem neutra + caminho e-mail/senha disponível, sem estado inconsistente (US2 cenário 3, FR-015).

**Resultado do GATE: ✓ APROVADO.** Há **um** desvio de simplicidade registrado em Complexity Tracking (token em `localStorage` em vez de cookie httpOnly no MVP) — justificado, com porta de evolução aberta e com as **mitigações anti-XSS elevadas a gates obrigatórios de P1** (CSP estrita + pinagem/auditoria de deps + lint anti-XSS/isolamento do token; T020a–T020d), o que reduz o risco residual. Não viola nenhum princípio inegociável; ao contrário, reforça o Princípio III.

## Project Structure

### Documentation (this feature)

```text
specs/001-login/
├── spec.md              # (existente) WHAT/WHY + Clarifications
├── plan.md              # Este arquivo
├── research.md          # Decisões de stack + alternativas (token storage, rate-limit, OAuth)
├── data-model.md        # Entidades: Conta/Usuário, Papel, Sessão, Identidade Externa, Evento de Auditoria
├── quickstart.md        # Rodar/validar login local (Supabase local + Google OAuth + envs)
├── contracts/           # Contratos de RPC/Edge/serviços de auth + expectativas de RLS
│   ├── auth-service.contract.md          # AuthService (signIn/OAuth/signOut/refresh) + AuthStore
│   ├── is-admin.rpc.md                   # is_admin() + current_user_role() (roteamento por papel)
│   ├── login-rate-limit.edge.md          # Edge Function + record_login_attempt() (FR-018)
│   ├── auth-audit.contract.md            # auth_audit_log + RPC log_auth_event (FR-020)
│   └── rls-expectations.md               # matriz RLS das tabelas desta feature
└── tasks.md             # (Fase 2) tarefas por user story
```

### Source Code (repository root) — caminhos reais

```text
src/app/
├── core/
│   ├── supabase/
│   │   └── supabase.service.ts            # (EXISTE) cliente anon-key, SSR-aware — base do auth
│   └── auth/                              # NOVO — infra de autenticação (singletons)
│       ├── auth.store.ts                  # signals: session, user, role, loading, error
│       ├── auth.service.ts                # signInPassword / signInWithGoogle / signOut / refresh / resendConfirmation
│       ├── auth.guard.ts                  # CanMatch p/ /app (autenticado)
│       ├── admin.guard.ts                 # CanMatch p/ /admin (role=admin; UX — real é is_admin() na RLS)
│       ├── anon.guard.ts                  # CanMatch p/ /auth (redireciona logado ao destino do papel — FR-011)
│       ├── role-redirect.ts              # util: papel → rota destino (/app | /admin) (FR-005/006)
│       └── session-persistence.ts        # "manter conectado": escolhe storage persistente vs. volátil (FR-007/008/009)
│
├── features/
│   └── auth/                              # NOVO/expandir scaffold do bootstrap
│       ├── auth.routes.ts                 # rotas /auth (login, callback)
│       ├── login/
│       │   ├── login.ts                   # (EXISTE scaffold) form e-mail/senha + Google + "manter conectado"
│       │   ├── login.html                 # data-testid="login-*"
│       │   ├── login.css
│       │   └── login.spec.ts              # (EXISTE scaffold) unit Vitest
│       └── callback/
│           └── oauth-callback.ts          # NOVO — trata retorno OAuth Google, erro/cancelamento (US2)
│
└── (rotas) app.routes.ts / app.routes.server.ts   # ajustar: guards + rota /auth/callback (CSR)

supabase/                                  # NOVO — primeira feature a criar o backend
├── config.toml                            # auth: email confirmations on, provider google, rate-limit nativo
├── seed.sql                               # admin inicial (controlado) + perfis de teste tutor/admin
├── migrations/
│   ├── 0001_extensions.sql                # pgcrypto (hash), (pg_cron reservado p/ specs futuras)
│   ├── 0002_enums_e_dominios.sql          # enum papel (tutor|admin), evento de auditoria
│   ├── 0003_tabela_perfis.sql            # perfis (id=auth.users.id, papel) + RLS deny-by-default
│   ├── 0004_tabelas_auth_seguranca.sql    # auth_audit_log + auth_login_attempts + RLS
│   ├── 0005_funcoes_auth.sql              # is_admin(), current_user_role(), record_login_attempt(), log_auth_event()
│   ├── 0006_rls_policies_auth.sql         # policies (perfis próprio, admin via is_admin(), insert service_role)
│   └── 0007_trigger_handle_new_user.sql   # on_auth_user_created → cria linha em perfis (papel default 'tutor')
└── functions/
    └── login-guard/                       # Edge Function: pré-login rate-limit + auditoria (service_role)
        ├── index.ts
        └── rate-limit.ts                  # lógica pura testável (deno test) — decisão allow|backoff|block
```

**Structure Decision**: Web app monorepo. **Frontend** segue a estrutura confirmada em `docs/frontend.md` §2 com a reconciliação real do scaffold: **UI de auth** em `src/app/features/auth/`, **infra de auth** em `src/app/core/auth/`, reusando o cliente existente `core/supabase/supabase.service.ts` (nome real do arquivo). **Backend** cria pela primeira vez `supabase/` seguindo a ordem de migrations de `docs/backend-supabase.md` §8.1 (RLS na mesma migration da tabela). A tela de login permanece `RenderMode.Client` (já declarado em `app.routes.server.ts`).

## Complexity Tracking

> Apenas um desvio de simplicidade a justificar. Nenhuma violação de princípio inegociável.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **Token de sessão em `localStorage` (não em cookie `httpOnly`) no MVP** — FR-017 pede proteção contra XSS | O painel é **CSR puro** (sem SSR autenticado), e o `supabase-js` já gere refresh/persistência com `localStorage` de forma nativa e testada. Cookie `httpOnly` exigiria adotar `@supabase/ssr` + um middleware de sessão SSR que **não existe** hoje e adicionaria superfície sem benefício enquanto o painel não for SSR. **Decisão (atualizada): aceitar `localStorage`/`sessionStorage`, MAS as mitigações anti-XSS deixaram de ser recomendação best-effort e passaram a GATES OBRIGATÓRIOS de P1** (bloqueiam a entrega): (1) **CSP estrita** sem `unsafe-inline`/`unsafe-eval` em `script-src` + allowlist, em `vercel.json` e `src/server.ts`, com checagem de CI que falha se ausente/permissiva (T020a/T020b); (2) **pinagem de dependências + `npm audit`** e proibição de libs de UI com `innerHTML` arbitrário (T020c); (3) **lint anti-XSS** que proíbe `innerHTML`/`[innerHTML]`/`bypassSecurityTrust*` com input e impede acesso ao storage de auth fora de `core/` (T020d); (4) sanitização nativa do Angular; token nunca lido por código de feature. Confirmado por T033a antes de P1 ser entregue. Isso **reduz o risco residual** de roubo de token por XSS. | Cookie `httpOnly`+`Secure`+`SameSite` agora foi **rejeitado para o MVP** porque introduz um fluxo SSR de sessão inexistente (complexidade não justificada, contra YAGNI/Princípio VI) — a arquitetura **não** muda (sem BFF/SSR de sessão agora). **A porta fica aberta**: a migração toca **só** `core/auth` + `core/supabase`, sem alterar o domínio; documentada em `research.md` como evolução quando/se o painel adotar SSR autenticado. FR-022 (transporte TLS) é atendido independentemente. |

> Nota: **MFA fora do MVP** **não** é um desvio (é simplificação alinhada ao Princípio VI). A arquitetura permanece aberta a MFA (Supabase Auth TOTP nativo sobre `auth.users`, sem mudança nas tabelas próprias) — registrado, não rastreado como complexidade.
