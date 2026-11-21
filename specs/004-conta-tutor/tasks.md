---
description: "Lista de tarefas — feature 004-conta-tutor (Conta do tutor)"
---

# Tasks: Conta do tutor

**Input**: `specs/004-conta-tutor/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md)
**Prerequisites**: `001-login` (feita) e `002-ui-zardui` implementada (ver "Pré-requisitos").
**Executor**: agente **Sonnet**, pelos subagentes `backend-supabase` (**BE**), `frontend-angular`
(**FE**) e `qa-engineer` (**QA**). Quem executa não tem memória da conversa que gerou este arquivo.

**Tests**: incluídos. A feature toca dados pessoais, RLS, autenticação e envio pago de SMS; a
constituição exige revisão de segurança e privacidade.

## Regras para quem executa

1. **Leia antes de começar**: `CLAUDE.md`, `.specify/memory/constitution.md` (v2.0.0),
   `DESIGN.md`, `docs/decisoes-pivo.md`, `specs/004-conta-tutor/plan.md` e **todos** os arquivos
   de `specs/004-conta-tutor/contracts/`. Antes de uma tarefa de tela, leia também
   `specs/002-ui-zardui/contracts/shells.contract.md` e `shared-components.contract.md`.
2. **`CLAUDE.md`, `DESIGN.md`, a constituição e os contratos desta spec valem mais do que as
   instruções embutidas do subagente e do que os documentos de `docs/`** (`architecture.md`,
   `frontend.md`, `design-system.md`, `backend-supabase.md`, `test-strategy.md`, `primeng.md`).
   Onde a definição do subagente, a memória dele ou um desses documentos ainda citar PrimeNG,
   Aura, planos, assinatura, `perfil_resgate_publico` ou índigo `#3A4FD6`, **ignore**: é texto
   anterior ao pivô de 2026-11-17.
3. **Uma tarefa por vez**, na ordem. Marque `[x]` ao concluir. Não pule o "Feito quando".
4. **Não improvise.** Se um contrato for ambíguo, se um pré-requisito da `002` não existir, ou se a
   tarefa pedir algo que contradiz a constituição, **pare e relate**. Não invente comportamento,
   nome de função, coluna ou mensagem.
5. **Banco**: RLS habilitada **na mesma migration** que cria a tabela; nenhuma política para
   `anon`; toda função nova é `SECURITY DEFINER` com `SET search_path = public, pg_temp`, sem SQL
   montado com entrada, e termina com `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated`
   + o `GRANT EXECUTE` exato de `data-model.md` §5. Migrations desta spec: **0008 a 0019** (0020 em
   diante é da `003`). Enquanto a branch não foi mesclada em `develop`, uma migration desta spec
   pode ser editada (0012, 0015 e 0016 recebem funções em mais de uma tarefa); depois, só
   migrations novas (0017–0019).
6. **Não altere** as migrations 0001–0007 nem os três testes pgTAP da `001`. Se um deles quebrar,
   pare e relate.
7. **Segredos nunca no cliente**: nada de `service_role`, `PHONE_OTP_PEPPER`, `HASH_SALT` ou chave
   de provedor em `src/`, `environment*.ts`, fixture, log ou mensagem de erro. Código SMS, senha,
   link, e-mail e telefone **nunca** em log nem em `auth_audit_log.detalhe`.
8. **UI**: ZardUI + Tailwind v4 conforme `DESIGN.md`; **nunca PrimeNG**. Três larguras (base,
   `md`, `xl`). Fluxos de `/auth` sempre claros; telas de `/app/conta` seguem o tema do app.
   Nenhuma cor em hexadecimal em `src/app/**`. Sem emoji. Um botão principal por tela.
   Telas de referência em `design/telas-v2/` são HTML estático com estilos em linha: use como
   medida e conteúdo, reescrevendo com os componentes e classes do projeto.
9. **Acesso a dados só por serviços de `core/`.** Nenhuma tela chama o Supabase nem lê
   `localStorage`/`sessionStorage`. Textos de UI em PT-BR, por `i18n`/`$localize`, **copiados dos
   contratos**; nunca exiba `error.message` do Supabase.
10. `data-testid="<feature>-<elemento>"` conforme `contracts/frontend-services.contract.md` §5.
11. **Não edite** `specs/002-ui-zardui/`, `specs/003-tag-qr/`, `src/app/shared/` (componentes e
    cascas da `002`), `src/app/core/theme/`, `src/app/features/public/` nem nada de tags, pets ou
    scans. No que veio da `001`, as únicas edições permitidas são as que uma tarefa nomeia: CORS em
    `supabase/functions/login-guard/index.ts` (T021), `supabase/seed.sql` (T014),
    `supabase/config.toml` (T003, T004), `auth.guard.ts`, `auth.service.ts`, a tela de login e o
    `oauth-callback` (T027, T029, T037, T071).
12. **Depois de cada fase**: `npm run lint`, `npm test -- --watch=false`, `npm run build`,
    `supabase test db`, `deno test supabase/functions/`. Tudo verde antes de seguir.
13. **Git**: trabalhe na branch `004-conta-tutor`, criada a partir de `develop`. **Nunca** commite
    em `homolog` ou `master`. Mensagens no padrão do repositório (`:sparkles: feat: …`).
14. **Telas sem referência aprovada** (confirmar e-mail, aceite, informar celular, recuperar
    senha, nova senha, Conta, páginas legais): siga o padrão da casca de fluxo ou da casca do app e
    os componentes de `DESIGN.md`. Não crie padrão visual novo. Liste-as no relatório final como
    "precisam de passada de design".

## Format: `- [ ] ID [P?] [Story] [BE|FE|QA] Descrição`

- **[P]**: pode rodar em paralelo com outras [P] da mesma fase (arquivos diferentes, sem dependência).
- **[USn]**: história da spec. Tarefas de Setup, Foundational e Polish não têm rótulo de história.
- **Feito quando**: verificação que precisa passar antes de marcar `[x]`.

## Pré-requisitos

**A `002-ui-zardui` precisa estar implementada antes de qualquer tarefa FE.** Esta spec usa, sem
recriar (tabela completa em `contracts/frontend-services.contract.md` §0):

- **Cascas**: `app-flow-shell` (`src/app/shared/shells/flow-shell/`), `app-tutor-shell` hospedada
  por `TutorApp` (`src/app/features/pets/tutor-app/tutor-app.ts`) com a rota `app` com `children`
  e `ShellFallback`, `app-screen-header` (`src/app/shared/shells/screen-header/`).
- **Tema**: `ThemeService` em `src/app/core/theme/theme.service.ts` (`preference`, `resolved`,
  `setPreference`).
- **Componentes ZardUI** em `src/app/shared/components/`: `button`, `input`, `field`, `checkbox`,
  `toggle-group`, `badge`, `alert`, `alert-dialog`, `card`, `item`, `sonner`, `spinner`,
  `input-otp` (células de código, modo numérico).
- **Componentes do Faro** em `src/app/shared/components/faro/`: `logo`, `focinho`, `brand-panel`,
  `brand-mark`, `google-glyph`, `note`.
- **Ícones**: `src/app/shared/icons/faro-icons.ts`.
- **Tela de login migrada** (`src/app/features/auth/login/`) e `oauth-callback` sem PrimeNG.
- **Tema** em `src/styles.css` e o alias `@/` → `src/app/`.

Da `001-login` (já no repositório): `perfis`, `auth_audit_log`, `log_auth_event`, `is_admin()`,
`login-guard`, `AuthService`, `AuthStore`, guards.

Da `003-tag-qr`: **nada é pré-requisito**. A `004` roda antes dela. O que a `004` chama da `003`
é resolvido em tempo de execução (`contracts/cross-spec-003.contract.md`).

Operacional, para produção (não bloqueia o desenvolvimento): `TODO(SMS_PROVIDER)`,
`TODO(EMAIL_PROVIDER)`, `TODO(LEGAL_TEXTS)`.

---

## Phase 1: Setup

**Objetivo**: conferir os pré-requisitos e preparar configuração e pastas.

- [ ] T001 [QA] Criar a branch `004-conta-tutor` a partir de `develop` e conferir os
  pré-requisitos da `002`: existem `src/app/shared/shells/flow-shell/flow-shell.ts`,
  `src/app/shared/shells/screen-header/screen-header.ts`, `src/app/features/pets/tutor-app/tutor-app.ts`,
  `src/app/core/theme/theme.service.ts`, `src/app/shared/icons/faro-icons.ts`, as pastas
  `button`, `input`, `field`, `checkbox`, `toggle-group`, `badge`, `alert`, `alert-dialog`, `card`,
  `item`, `sonner`, `spinner`, `input-otp` em `src/app/shared/components/` e as pastas `logo`,
  `focinho`, `brand-panel`, `brand-mark`, `google-glyph`, `note` em
  `src/app/shared/components/faro/`; a rota `app` em `src/app/app.routes.ts` tem `children`.
  **Feito quando**: todos os caminhos existem, `grep -ril primeng src package.json` não devolve
  nada e `npm run build` passa. Se faltar qualquer item: **pare e relate a lista do que falta**.
- [ ] T002 [P] [BE] Acrescentar a `supabase/.env.local.example` as variáveis `SUPABASE_ANON_KEY`,
  `PHONE_OTP_PEPPER`, `FARO_ENV`, `SMS_DRIVER`, `SMS_STUB_CODE`, `SMS_DAILY_CAP`,
  `ALLOWED_ORIGINS`, `SITE_URL`, com um comentário de uma linha cada e os valores de exemplo de
  `quickstart.md` §1 (nenhum segredo real). **Feito quando**: o arquivo lista as oito e
  `git check-ignore supabase/.env.local` confirma que o arquivo real é ignorado.
- [ ] T003 [BE] Ajustar `supabase/config.toml` exatamente como em
  `contracts/auth-config.contract.md` ("valores exigidos"), **sem** as seções de modelo de e-mail
  (T004): remover a linha `enable_confirmations` de `[auth]`; definir `minimum_password_length`,
  `password_requirements`, `[auth.rate_limit]`, `[auth.email]` e `[auth.sms]`. Se a CLI recusar o
  nome de alguma chave, pare e relate. **Feito quando**: `supabase start` sobe sem erro de
  configuração e os dois primeiros `curl` da seção "Conferência" do contrato dão o resultado
  esperado (senha de 7 caracteres recusada; cadastro repetido responde 200 sem sessão).
- [ ] T004 [P] [BE] Criar `supabase/templates/confirmation.html` e `supabase/templates/recovery.html`
  conforme `contracts/auth-config.contract.md` ("Modelos de e-mail"), com os links **exatos**, e
  registrar os dois em `supabase/config.toml` (`[auth.email.template.confirmation]` e
  `[auth.email.template.recovery]`). **Feito quando**: depois de `supabase stop && supabase start`,
  um cadastro por `curl` gera no coletor local (`http://localhost:54324`) um e-mail cujo link
  contém `/auth/confirmar-email?token_hash=` e `type=email`; `grep -c "ConfirmationURL\|\.Token }}" supabase/templates/*.html`
  devolve `0` para os dois arquivos.
- [ ] T005 [P] [FE] Em `eslint.config.js`, no bloco `files: ['src/app/features/public/**/*.ts']`
  criado pela `002`, acrescentar ao `group` de `no-restricted-imports` os padrões
  `'**/core/account/**'` e `'**/features/legal/**'`. Não alterar outras regras. **Feito quando**:
  `npm run lint` passa e, criando temporariamente em `src/app/features/public/` um arquivo que
  importa `../../core/account/terms`, o lint falha (apague o arquivo depois).
- [ ] T006 [P] [FE] Criar `src/app/core/account/terms.ts` com `export const TERMS_VERSION = '2026-11';`
  e `src/app/features/account/account.routes.ts` com `export const ACCOUNT_ROUTES: Routes = [];`.
  **Feito quando**: `npm run build` passa.

**Checkpoint**: pré-requisitos conferidos, Auth configurado, e-mails apontando para o app.

---

## Phase 2: Foundational (bloqueia todas as histórias)

**Objetivo**: endurecer o que veio da `001`, estender `perfis`, criar o limitador, as funções de
conta, a auditoria por gatilho, os módulos compartilhados das Edge Functions e o núcleo de
navegação do frontend.

**CRÍTICO**: nenhuma história começa antes desta fase estar verde.

### Banco

- [ ] T007 [BE] Criar `supabase/migrations/0008_enum_eventos_conta.sql` contendo **apenas** 12
  comandos `ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS '<valor>';` para:
  `conta_criada`, `email_confirmado`, `termos_aceitos`, `celular_codigo_enviado`,
  `celular_codigo_invalido`, `celular_bloqueado`, `celular_confirmado`,
  `senha_recuperacao_solicitada`, `senha_alterada`, `reautenticacao_falha`, `dados_exportados`,
  `conta_excluida`. Nenhum outro comando no arquivo. **Feito quando**: `supabase db reset` passa e
  `select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'evento_auth_enum';`
  devolve `16`.
- [ ] T008 [BE] Criar `supabase/migrations/0009_hardening_funcoes_auth.sql`:
  `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE … TO service_role`
  para `public.log_auth_event(public.evento_auth_enum, uuid, text, text, jsonb)` e
  `public.record_login_attempt(text, text, boolean)`; e, para `public.is_admin()` e
  `public.current_user_role()`, `REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated, service_role`.
  Motivo em `research.md` R13. **Feito quando**: `supabase db reset` passa e
  `select has_function_privilege('anon','public.log_auth_event(public.evento_auth_enum,uuid,text,text,jsonb)','EXECUTE');`
  devolve `false`.
- [ ] T009 [P] [QA] Criar `supabase/tests/funcoes_auth_grants.test.sql` com os quatro testes do
  bloco "`funcoes_auth_grants.test.sql`" de `contracts/account.rpc.md`. **Feito quando**:
  `supabase test db` passa, incluindo os três arquivos da `001` sem edição.
- [ ] T010 [BE] Criar `supabase/migrations/0010_perfis_conta.sql` conforme `data-model.md` §1:
  5 colunas novas, os 2 `CHECK` de formato, as 3 restrições nomeadas, o bloco de privilégios
  (copiar os 4 comandos) e o gatilho `perfis_set_updated_at`. Não alterar as políticas da `001`.
  **Feito quando**: `supabase db reset` passa;
  `select has_column_privilege('authenticated','public.perfis','celular','UPDATE');` devolve
  `false` e o mesmo para `nome` devolve `true`.
- [ ] T011 [P] [QA] Criar `supabase/tests/rls_perfis_conta.test.sql` cobrindo **todas** as linhas
  de `perfis` da matriz de `contracts/rls-expectations.md` (cada "nega" de coluna espera o erro
  `42501`), incluindo o teste de segurança nº 3 ("não se autoconfirma") e o nº 4 ("não escala
  papel"). **Feito quando**: `supabase test db` passa.
- [ ] T012 [BE] Criar `supabase/migrations/0011_rate_limit_events.sql`: tabela
  `public.rate_limit_events` (`data-model.md` §3) com `ENABLE ROW LEVEL SECURITY`, sem política,
  `REVOKE ALL … FROM anon, authenticated`, índice `(bucket, key, at DESC)`, e a função
  `public.rate_limit_check(jsonb, boolean)` exatamente como em `contracts/rate-limit.rpc.md`
  (passos 1 a 6). **Feito quando**: `supabase db reset` passa e, como `service_role`,
  `select public.rate_limit_check('[{"bucket":"t","key":"k","max":1,"window":60}]'::jsonb, true);`
  devolve `allowed = true` na primeira chamada e `allowed = false` na segunda.
- [ ] T013 [P] [QA] Criar `supabase/tests/rate_limit_events.test.sql` com os sete testes de
  `contracts/rate-limit.rpc.md`. **Feito quando**: `supabase test db` passa.
- [ ] T014 [BE] Criar `supabase/migrations/0012_funcoes_conta.sql` com `CREATE OR REPLACE FUNCTION
  public.handle_new_user()` conforme `contracts/account.rpc.md` (tabela de metadados, regra do
  provedor, `papel = 'tutor'` fixo, auditoria dentro de bloco `EXCEPTION`). O gatilho
  `on_auth_user_created` da `001` continua o mesmo. Em seguida, ajustar `supabase/seed.sql` para
  que o **tutor A** (`…0001`) nasça pronto e o **tutor B** (`…0002`) continue incompleto: nos
  metadados do tutor A acrescentar `"terms_version": "2026-11"`; depois do bloco existente,
  `UPDATE public.perfis SET celular = '+5511900000001', celular_confirmado_em = now() WHERE id = '00000000-0000-0000-0000-000000000001';`.
  Não mexer no tutor B nem no admin. **Feito quando**: `supabase db reset` passa;
  `select count(*) from auth_audit_log where evento = 'conta_criada';` devolve `3`; o tutor A tem
  `termos_versao = '2026-11'` e `celular` preenchido; o tutor B tem os dois nulos.
- [ ] T015 [BE] No mesmo arquivo `0012_funcoes_conta.sql`, acrescentar `accept_terms(text)`,
  `log_logout()`, `my_account()` e `account_auth_facts(uuid)` conforme `contracts/account.rpc.md`,
  com os `REVOKE`/`GRANT` de `data-model.md` §5. **Feito quando**: `supabase db reset` passa e
  `select has_function_privilege('authenticated','public.account_auth_facts(uuid)','EXECUTE');`
  devolve `false`.
- [ ] T016 [P] [QA] Criar `supabase/tests/funcoes_conta.test.sql` com os nove testes do bloco
  "`funcoes_conta.test.sql`" de `contracts/account.rpc.md`. **Feito quando**: `supabase test db` passa.
- [ ] T017 [BE] Criar `supabase/migrations/0013_auditoria_auth_users.sql`: função
  `public.audit_auth_user_changes()` e gatilho `on_auth_user_updated`
  (`AFTER UPDATE OF email_confirmed_at, encrypted_password, recovery_sent_at ON auth.users`)
  conforme `contracts/account.rpc.md`, com o corpo dentro de `EXCEPTION WHEN OTHERS` e
  `RETURN NEW` sempre. **Feito quando**: `supabase db reset` passa e um login pelo app (ou pelo
  `curl` de `quickstart.md` §6) continua funcionando.
- [ ] T018 [P] [QA] Criar `supabase/tests/auditoria_auth_users.test.sql` com os cinco testes do
  bloco correspondente de `contracts/account.rpc.md`. **Feito quando**: `supabase test db` passa.

### Edge Functions: módulos compartilhados

- [ ] T019 [P] [BE] Criar `supabase/functions/_shared/http.ts` e `supabase/functions/_shared/env.ts`
  conforme `contracts/shared-edge.contract.md`, e `supabase/functions/_shared/env.test.ts`
  cobrindo cada regra de `loadEnv` (incluindo `HASH_SALT` curto, pepper curto e `FARO_ENV` ausente
  ⇒ `production`). **Feito quando**: `deno test supabase/functions/_shared/env.test.ts` passa.
- [ ] T020 [P] [BE] Criar `supabase/functions/_shared/hash.ts`, `ip.ts`, `clients.ts` e `audit.ts`
  conforme `contracts/shared-edge.contract.md`, e `supabase/functions/_shared/hash.test.ts`
  (vetor HMAC-SHA256 da RFC 4231, caso 2: chave `Jefe`, dado `what do ya want for nothing?`,
  resultado `5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843`; e as duas funções
  de entrada de hash). **Feito quando**: `deno test supabase/functions/_shared/hash.test.ts` passa.
- [ ] T021 [BE] Em `supabase/functions/login-guard/index.ts`, tratar `OPTIONS` e acrescentar os
  cabeçalhos CORS em **todas** as respostas usando `handleOptions` e `corsHeaders` de
  `_shared/http.ts`. Não mudar a lógica de decisão nem os corpos das respostas. **Feito quando**:
  o `curl -X OPTIONS` de `contracts/shared-edge.contract.md` devolve 204 (ou 200) com
  `Access-Control-Allow-Origin: http://localhost:4200`, e `deno test supabase/functions/login-guard/`
  continua passando.

### Frontend: núcleo

- [ ] T022 [P] [FE] Criar `src/app/core/auth/return-url.ts` (`sanitizeReturnUrl` e
  `ReturnUrlService`) e `return-url.spec.ts` com a tabela de casos de
  `contracts/frontend-services.contract.md` §3. **Feito quando**: `npm test -- --watch=false`
  passa com os 13 casos da tabela.
- [ ] T023 [P] [FE] Criar `src/app/core/auth/returning-visitor.ts` (`markReturning`, `isReturning`,
  com `isPlatformBrowser` e `try/catch`) e `returning-visitor.spec.ts`. **Feito quando**: o teste
  cobre "sem marca ⇒ false", "depois de marcar ⇒ true" e "storage lançando erro ⇒ false".
- [ ] T024 [P] [FE] Criar `src/app/core/account/phone.ts` (`normalizeBrPhone`, `formatBrPhone`,
  `maskBrPhoneInput`) e `phone.spec.ts` com a tabela de casos de
  `contracts/shared-edge.contract.md` (seção `phone.ts`). **Feito quando**: os 9 casos da tabela
  passam e `formatBrPhone('+5511987654421') === '(11) 98765-4421'`.
- [ ] T025 [FE] Criar `src/app/core/account/account.store.ts` e `account.service.ts` (`load`,
  `ensureLoaded`, `updateName`, `acceptTerms`, `logout`) conforme
  `contracts/frontend-services.contract.md` §3, e `account.service.spec.ts`. `load` chama
  `rpc('my_account')` e converte os nomes para a interface `Account`. **Feito quando**: o teste
  cobre `load` (sucesso e falha), `updateName` com 1, 2, 80 e 81 caracteres, `acceptTerms` enviando
  `TERMS_VERSION` e `logout` chamando `log_logout` **antes** de `AuthService.signOut()`.
- [ ] T026 [FE] Criar `src/app/core/auth/post-auth-navigation.ts` (`nextStep` e
  `PostAuthNavigator`) e `post-auth-navigation.spec.ts` conforme
  `contracts/frontend-services.contract.md` §3. **Feito quando**: as 7 linhas da tabela de
  `nextStep` passam; `go()` com serviços falsos limpa o destino só no passo final, ignora
  `return_to` com mais de 7 dias, ignora `return_to` que `sanitizeReturnUrl` reprova e chama
  `markReturning()`.
- [ ] T027 [FE] Criar `src/app/core/auth/terms.guard.ts` + `terms.guard.spec.ts`; alterar
  `src/app/core/auth/auth.guard.ts` para a regra "boas-vindas x login" (§2 do contrato) e
  acrescentar os dois casos a `src/app/core/auth/guards.spec.ts`. **Feito quando**: os testes
  cobrem: tutor sem aceite ⇒ `/auth/termos?returnUrl=…`; admin ⇒ `true`; falha ao carregar ⇒
  `true`; sem sessão e sem marca ⇒ `/auth?returnUrl=…`; sem sessão e com marca ⇒
  `/auth/login?returnUrl=…&reason=session_expired`.
- [ ] T028 [FE] Reestruturar as rotas em `src/app/app.routes.ts` conforme
  `contracts/frontend-services.contract.md` §1: tirar `anonGuard` do pai `auth` e aplicá-lo só em
  `login`; `callback` sem guard; acrescentar `termsGuard` ao `canMatch` de `app`; registrar
  `auth/termos` (`authGuard`), `auth/celular` e `auth/confirmar-celular` (`authGuard`,
  `termsGuard`) apontando **provisoriamente** para o `ShellFallback` da `002` com
  `data: { home: '/app' }` (as histórias trocam pelo componente real). Em
  `src/app/app.routes.server.ts`, garantir `{ path: 'auth/**', renderMode: RenderMode.Client }`.
  Não reordenar nem editar rotas de outras specs; as rotas da tag continuam por último.
  **Feito quando**: `npm run build` passa; com sessão do tutor B (sem aceite no seed), abrir `/app`
  redireciona para `/auth/termos`; sem sessão, `/auth/login` abre normalmente.
- [ ] T029 [FE] Em `src/app/features/auth/login/login.ts` e
  `src/app/features/auth/callback/oauth-callback.ts`, trocar a navegação pós-sucesso
  (`roleRedirect` + `router.navigate`) por `PostAuthNavigator.go()`; na `init` da tela de login,
  chamar `ReturnUrlService.capture(query.returnUrl)`. Em `src/app/core/auth/auth.service.ts`,
  fazer `signOut()` também zerar o `AccountStore`. Não mudar a API pública da classe `Login` nem
  os `data-testid` (`specs/002-ui-zardui/contracts/shared-components.contract.md` §6.1).
  **Feito quando**: `login.spec.ts` e `auth.service.spec.ts` continuam verdes (ajuste só os mocks
  de navegação); entrando com o admin do seed chega-se a `/admin`; com `tutor.a@faro.test` (aceite
  e celular no seed), a `/app`; com `tutor.b@faro.test` (sem aceite), a `/auth/termos`. O E2E de
  login da `001` (`e2e/login.spec.ts`, se existir) continua verde usando o tutor A.
- [ ] T030 [QA] Rodar a verificação de fim de fase (regra 12). **Feito quando**: os cinco comandos
  passam e `git status` não mostra arquivo alterado em `specs/002-ui-zardui/`,
  `specs/003-tag-qr/`, `src/app/shared/` nem `src/app/features/public/`.

**Checkpoint**: base pronta. As histórias podem começar.

---

## Phase 3: User Story 1 - Criar conta com e-mail e senha e confirmar o e-mail (Priority: P1) — MVP

**Goal**: boas-vindas, cadastro por e-mail e senha, tela "Confirme seu e-mail", confirmação pelo
link, com resposta idêntica para e-mail já cadastrado.

**Independent Test**: criar conta com e-mail novo, abrir o link no coletor local, confirmar, e
verificar sessão de tutor com aceite registrado; antes de confirmar, o login é recusado.

- [ ] T031 [P] [US1] [FE] Criar `src/app/core/auth/registration.service.ts` (`signUp`,
  `resendConfirmation`, `confirmEmail`) e `registration.service.spec.ts` conforme
  `contracts/frontend-services.contract.md` §3. **Feito quando**: o teste cobre: entrada inválida
  não chama o Supabase; os metadados enviados são `name`, `phone` em E.164, `terms_version`,
  `return_to` e `return_to_at`; resposta de "usuário já existe" ⇒ `{ ok: true }`; o tempo mínimo de
  1.200 ms (relógio falso); `confirmEmail` usa `type: 'email'`; a senha não é gravada em nenhum
  store.
- [ ] T032 [P] [US1] [FE] Criar as páginas `src/app/features/legal/terms/terms.ts` e
  `src/app/features/legal/privacy-policy/privacy-policy.ts` (título, aviso "Rascunho. Texto final
  em preparação." e um `// TODO(LEGAL_TEXTS)`), registrar `/legal/termos` e `/legal/privacidade` em
  `src/app/app.routes.ts` (antes das rotas da tag) e em `src/app/app.routes.server.ts` como
  `RenderMode.Prerender`. Sempre claras, coluna de leitura de 680 px. **Feito quando**:
  `npm run build` passa e gera os dois HTML pré-renderizados; as duas rotas abrem sem sessão.
- [ ] T033 [US1] [FE] Criar a tela de boas-vindas em `src/app/features/auth/welcome/`
  (`welcome.ts`, `welcome.html`, `welcome.spec.ts`) e trocar a rota `/auth` (índice) para ela, com
  `anonGuard`. Referência: `design/telas-v2/V2-boas-vindas.dc.html`, `-tablet`, `-desktop`; textos,
  medidas e regra da foto em `contracts/frontend-services.contract.md` §4 ("Boas-vindas").
  **Feito quando**: o teste confere `welcome-create-account` e `welcome-login`, a preservação do
  `returnUrl` nos dois links e o aviso `welcome-deleted-notice` com `?conta=excluida`; a tela não
  tem rolagem horizontal em 320, 390, 768 e 1440 px.
- [ ] T034 [US1] [FE] Criar a tela de cadastro em `src/app/features/auth/signup/` (`signup.ts`,
  `signup.html`, `signup.spec.ts`) e registrar `/auth/criar-conta` com `anonGuard`. Referência:
  `design/telas-v2/V2-criar-conta.dc.html`, `-tablet`, `-desktop`; casca `app-flow-shell`; campos,
  atributos e textos em `contracts/frontend-services.contract.md` §4 ("Criar conta"). Reactive
  Form tipado; erro por campo; botão desabilitado enquanto envia. **Nesta tarefa o botão do Google
  ainda não entra** (T061). Sucesso ⇒ navegar para `/auth/confirmar-email` com o e-mail no
  **estado do roteador**. **Feito quando**: o teste cobre cada validação (nome 1 e 81 caracteres,
  e-mail inválido, celular fixo, senha de 7, aceite desmarcado), os `data-testid` `signup-*` (menos
  `signup-google`) e que o e-mail não aparece na URL depois do envio.
- [ ] T035 [US1] [FE] Criar a tela `src/app/features/auth/confirm-email/` (`confirm-email.ts`,
  `confirm-email.html`, `confirm-email.spec.ts`), registrar `/auth/confirmar-email` **sem guard**,
  e implementar o estado **de espera** (URL sem `token_hash`): e-mail do estado do roteador,
  reenvio com contagem de 60 s, campo de e-mail quando não há estado, mensagem uniforme depois do
  reenvio, links "E-mail errado? Voltar" e "Já confirmei. Entrar", e avanço automático por
  `PostAuthNavigator.go()` se a sessão aparecer. Sem tela aprovada: padrão da casca de fluxo
  (regra 14). **Feito quando**: o teste cobre a contagem (relógio falso), o reenvio chamando
  `resendConfirmation`, a mensagem `confirm-email-resent-notice` e o modo sem estado.
- [ ] T036 [US1] [FE] No mesmo componente, implementar o estado **do link** (URL com
  `token_hash` e `type=email`): **nenhuma** chamada ao carregar; botão `confirm-email-confirm` ⇒
  `confirmEmail(tokenHash)`; sucesso ⇒ `PostAuthNavigator.go()`; `invalid_link` ⇒ estado
  `confirm-email-invalid` com "Pedir novo link" e "Entrar". (A ligação com o envio do SMS entra na
  T059.) **Feito quando**: o teste prova que `verifyOtp` **não** é chamado na criação do
  componente, que é chamado uma vez no clique, e cobre os dois resultados.
- [ ] T037 [US1] [FE] Em `src/app/features/auth/login/` (`login.ts` e `login.html`): o link "Criar
  conta" passa a navegar para `/auth/criar-conta` preservando `returnUrl` e perde o `aria-label`
  com "(em breve)"; entra o botão "Voltar" (`z-button zSize="icon"`, ícone `back`,
  `aria-label="Voltar"`) para `/auth`, no espaço de 56 px reservado pela `002`
  (`design/telas-v2/V2-entrar.dc.html`). Os `data-testid` existentes não mudam. **Feito quando**:
  `login.spec.ts` continua verde, com um teste novo no fim conferindo o destino do link
  `login-signup-link`.
- [ ] T038 [P] [US1] [QA] Criar `e2e/support/mailbox.ts` com `waitForLink(email, contains)`
  conforme `quickstart.md` §7 (Mailpit e, se não houver, Inbucket; espera de até 15 s).
  **Feito quando**: um teste de fumaça em `e2e/support/mailbox.spec.ts` cria um usuário por
  `POST /auth/v1/signup` e obtém um link contendo `token_hash=`.
- [ ] T039 [US1] [QA] Criar `e2e/signup-confirm-phone.spec.ts` com o primeiro teste: boas-vindas →
  criar conta → tela de espera → link do coletor → "Confirmar meu e-mail" → sessão ativa (a URL
  final é `/auth/celular` ou `/auth/confirmar-celular`); e um segundo teste: antes de confirmar,
  entrar com as credenciais mostra `login-unconfirmed-notice`. **Feito quando**: os dois passam
  em Chromium com `supabase start` e `supabase functions serve` rodando.
- [ ] T040 [US1] [QA] Criar `e2e/security/account-enumeration.spec.ts` (parte de cadastro):
  chamando `POST /auth/v1/signup` com um e-mail novo e com `tutor.a@faro.test`, as duas respostas
  têm o mesmo status HTTP e nenhuma tem erro ou sessão; pela tela, os dois casos terminam na mesma
  tela de espera com o mesmo texto; o nome do perfil de `tutor.a` não muda. **Feito quando**: o
  teste passa.

**Checkpoint**: uma pessoa cria a conta, confirma o e-mail e fica autenticada.

---

## Phase 4: User Story 2 - Confirmar o celular por SMS (Priority: P1)

**Goal**: código de 6 dígitos por SMS, com validade, reenvio, limites, correção do número e o fato
único "celular confirmado?".

**Independent Test**: com conta de e-mail confirmado e número pendente, pedir o código, confirmar
e ver `phone_is_confirmed` verdadeiro; repetir com código errado, vencido, reenvio e correção.

### Banco

- [ ] T041 [US2] [BE] Criar `supabase/migrations/0014_phone_verifications.sql`: tabela
  `public.phone_verifications` com **exatamente** as 10 colunas de `data-model.md` §2, os dois
  índices (o único parcial e o de `(user_id, created_at DESC)`), `ENABLE ROW LEVEL SECURITY`, sem
  política, `REVOKE ALL … FROM anon, authenticated`. **Feito quando**: `supabase db reset` passa e
  `select count(*) from information_schema.columns where table_name = 'phone_verifications';`
  devolve `10`.
- [ ] T042 [US2] [BE] Criar `supabase/migrations/0015_funcoes_celular.sql` com
  `phone_is_confirmed(uuid)` (corpo de `data-model.md` §5), `phone_verification_status()`,
  `phone_verification_begin(…)`, `phone_verification_send_failed(uuid)` e
  `phone_verification_active(uuid)` conforme `contracts/phone-verification.rpc.md`, com os
  `REVOKE`/`GRANT` de `data-model.md` §5. **Feito quando**: `supabase db reset` passa e
  `select has_function_privilege('authenticated','public.phone_verification_begin(uuid,text,text,text,integer,integer)','EXECUTE');`
  devolve `false`.
- [ ] T043 [US2] [BE] No mesmo arquivo `0015_funcoes_celular.sql`, acrescentar
  `phone_verification_confirm(uuid, uuid, text, text, text)` seguindo a tabela de 6 linhas de
  `contracts/phone-verification.rpc.md`, com `SELECT … FOR UPDATE` e a auditoria na mesma
  transação. **Feito quando**: `supabase db reset` passa.
- [ ] T044 [P] [US2] [QA] Criar `supabase/tests/phone_verifications.test.sql` com os testes de
  **privilégios**, de `begin`, de `phone_is_confirmed` (5 casos) e de `phone_verification_status`
  de `contracts/phone-verification.rpc.md`, mais o guardião de esquema do item 5 de
  `contracts/rls-expectations.md` (conjunto exato de colunas). **Feito quando**:
  `supabase test db` passa.
- [ ] T045 [US2] [QA] No mesmo arquivo, acrescentar os testes de `confirm`: acerto; 4 erros + 5º
  bloqueia + 6º certo ⇒ `no_active`; vencido; verificação de outra conta; **troca** (o número
  antigo permanece até o acerto); nenhum `detalhe` com dígitos do telefone. **Feito quando**:
  `supabase test db` passa.

### Edge Functions

- [ ] T046 [P] [US2] [BE] Criar `supabase/functions/_shared/phone.ts` e `phone.test.ts` com a
  tabela de casos de `contracts/shared-edge.contract.md`. **Feito quando**:
  `deno test supabase/functions/_shared/phone.test.ts` passa com os 9 casos.
- [ ] T047 [P] [US2] [BE] Criar `supabase/functions/_shared/otp.ts` (`generateCode`,
  `resolveCode`) e `otp.test.ts`. **Feito quando**: o teste gera 10.000 códigos, todos `^[0-9]{6}$`,
  e prova que `resolveCode` só devolve o código fixo com `smsDriver = 'stub'` **e** `faroEnv` em
  `local`/`test`.
- [ ] T048 [P] [US2] [BE] Criar `supabase/functions/_shared/sms/sender.ts` (`SmsSender`,
  `resolveSender`, `buildOtpMessage`, drivers `log` e `stub`, e um comentário
  `// TODO(SMS_PROVIDER)` onde entra o driver real) e `sender.test.ts`. **Feito quando**: o teste
  cobre as quatro linhas da tabela de `resolveSender` e o texto **exato** de `buildOtpMessage`.
- [ ] T049 [US2] [BE] Criar `supabase/functions/_shared/reauth.ts` (`requireRecentAuth`) conforme
  `contracts/shared-edge.contract.md`, recebendo os clientes por parâmetro para poder ser testado,
  e `reauth.test.ts` com clientes falsos. **Feito quando**: o teste cobre: limite atingido ⇒
  `rate_limited`; erro do limitador ⇒ `rate_limited`; conta com senha sem `password` ⇒
  `reauth_required`; senha errada ⇒ registra a falha, audita `reautenticacao_falha` e devolve
  `invalid_password`; senha certa ⇒ `ok` e revoga a sessão criada; conta sem senha com login há 5
  min ⇒ `ok`, há 11 min ⇒ `reauth_required`.
- [ ] T050 [US2] [BE] Criar `supabase/functions/phone-verify-start/logic.ts` (funções puras:
  escolher o número alvo, decidir se é troca, mapear `denied_bucket` para
  `cooldown`/`rate_limited`/`sms_unavailable`, montar os 6 limites) e `logic.test.ts`.
  **Feito quando**: `deno test supabase/functions/phone-verify-start/` passa, cobrindo os 5 casos
  de número alvo e os 3 mapeamentos.
- [ ] T051 [US2] [BE] Criar `supabase/functions/phone-verify-start/index.ts` seguindo os **16
  passos, na ordem**, de `contracts/phone-verify-start.edge.md`. **Feito quando**: com
  `supabase functions serve --env-file ./supabase/.env.local` e `SMS_DRIVER=log`, os quatro
  primeiros comandos `fn phone-verify-start …` de `quickstart.md` §6 devolvem as respostas
  indicadas e o código aparece **só** na linha `[sms:log]` do terminal.
- [ ] T052 [US2] [BE] Criar `supabase/functions/phone-verify-confirm/logic.ts` (validação de
  formato; mapeamento de `status`), `logic.test.ts` e `index.ts` seguindo os 8 passos de
  `contracts/phone-verify-confirm.edge.md`. **Feito quando**: `deno test supabase/functions/phone-verify-confirm/`
  passa e a sequência de `quickstart.md` §6 dá `invalid_format`, 4 × `invalid_code`, `locked`,
  `no_active`.
- [ ] T053 [US2] [QA] Executar e registrar a tabela "Falha fechada" e o bloco de CORS de
  `quickstart.md` §6 para as duas funções. **Feito quando**: as cinco linhas da tabela dão o
  resultado esperado e os `OPTIONS` devolvem 204/200; qualquer divergência é relatada, não
  contornada.

### Frontend

- [ ] T054 [P] [US2] [FE] Criar `src/app/core/account/phone-verification.service.ts` (`status`,
  `start`, `confirm`) e o `.spec.ts` conforme `contracts/frontend-services.contract.md` §3.
  **Feito quando**: o teste mapeia cada código de erro dos dois contratos de Edge, trata resposta
  não-200 como `network` e recarrega a conta depois de `confirm` com sucesso.
- [ ] T055 [P] [US2] [FE] Criar `src/app/core/account/phone-confirmed.guard.ts` e o `.spec.ts`
  (§2 do contrato). **Feito quando**: o teste cobre confirmado ⇒ `true`, admin ⇒ `true`, não
  confirmado ⇒ `/auth/celular?returnUrl=<rota>`.
- [ ] T056 [US2] [FE] Criar a tela `src/app/features/auth/phone-entry/` (`phone-entry.ts`,
  `phone-entry.html`, `phone-entry.spec.ts`) e trocar o `ShellFallback` da rota `/auth/celular`
  por ela. Só o modo **primeira confirmação** (o modo troca é a T086): campo pré-preenchido com o
  número pendente, "Enviar código por SMS", "Agora não" ⇒ `PostAuthNavigator.go({ skipPhone: true })`,
  erros de `start` com os textos de `contracts/phone-verify-start.edge.md`. Sem tela aprovada
  (regra 14). **Feito quando**: o teste cobre o pré-preenchimento, o envio com sucesso (navega
  para `/auth/confirmar-celular` preservando `returnUrl`), `invalid_phone`, `rate_limited` e o
  "Agora não".
- [ ] T057 [US2] [FE] Criar a tela `src/app/features/auth/confirm-phone/` (`confirm-phone.ts`,
  `confirm-phone.html`, `confirm-phone.spec.ts`) e trocar o `ShellFallback` da rota
  `/auth/confirmar-celular`. Referência: `design/telas-v2/V2-confirmar-celular.dc.html`, `-tablet`,
  `-desktop`. Nesta tarefa: `status()` no `init` (sem número pendente ⇒ `/auth/celular`), título e
  texto com o número formatado, as seis células (`input-otp` numérico, colar distribui os dígitos,
  `autocomplete="one-time-code"`), botão "Confirmar" desabilitado até 6 dígitos, `confirm(code)`,
  sucesso ⇒ `PostAuthNavigator.go()`, "Número errado? Corrigir" ⇒ `/auth/celular`.
  **Feito quando**: o teste cobre o redirecionamento sem pendente, colar `482913` preenchendo as
  seis células, o botão habilitando, o sucesso e os `data-testid` `confirm-phone-*`.
- [ ] T058 [US2] [FE] No mesmo componente, implementar a contagem e os estados da tabela de
  `contracts/frontend-services.contract.md` §4 ("Confirmar celular"): "Reenviar em m:ss" a partir
  de `resendAvailableAt`, botão "Reenviar código", `invalid_code` (limpa e foca a primeira
  célula), `locked`, `expired`/`no_active`, `cooldown`, `rate_limited`, `sms_unavailable`/
  `sms_send_failed`, o estado "Peça um código" quando não há verificação ativa, e "Continuar sem
  confirmar" **só** nos estados indicados. Erros em região `aria-live="polite"`.
  **Feito quando**: o teste cobre cada linha da tabela de estados (relógio falso para a contagem)
  e prova que `confirm-phone-continue-without` não existe no estado normal.
- [ ] T059 [US2] [FE] Em `src/app/features/auth/confirm-email/confirm-email.ts`, depois de
  `confirmEmail` com sucesso: se a conta tem `celularPendente`, chamar
  `PhoneVerificationService.start()`; `ok` ⇒ `/auth/confirmar-celular`; qualquer falha ⇒
  `/auth/celular`; sem pendente ⇒ `PostAuthNavigator.go()`. Sempre preservando `returnUrl`.
  **Feito quando**: `confirm-email.spec.ts` cobre os três ramos.
- [ ] T060 [US2] [QA] Em `e2e/signup-confirm-phone.spec.ts`, acrescentar: (a) caminho completo com
  `SMS_DRIVER=stub`, `FARO_ENV=test`, `SMS_STUB_CODE=424242`: cadastro → link → confirmar e-mail →
  digitar `424242` → `/app`, e em seguida a RPC `phone_is_confirmed` devolve `true`; (b) código
  errado mostra "restam 4"; (c) cadastro iniciado em `/auth/criar-conta?returnUrl=/app/conta`
  termina em `/app/conta`; (d) com `?returnUrl=https://evil.com` termina em `/app`.
  **Feito quando**: os quatro passam.

**Checkpoint**: cadastro completo de ponta a ponta. A `003` já pode consumir `phone_is_confirmed`.

---

## Phase 5: User Story 3 - Criar conta com o Google (Priority: P2)

**Goal**: "Continuar com o Google" cria a conta; o app pede o aceite dos termos e depois o celular.

**Independent Test**: uma conta sem aceite (criada pelo Google ou o tutor do seed) só chega ao app
depois de aceitar, e é convidada a confirmar o celular, podendo adiar.

- [ ] T061 [US3] [FE] Em `src/app/features/auth/signup/` (`signup.ts`, `signup.html`,
  `signup.spec.ts`): acrescentar a linha "ou" e o botão de contorno "Continuar com o Google" com
  `app-google-glyph` (ícone oficial), `data-testid="signup-google"`, que chama
  `AuthService.signInWithGoogle()`. O `returnUrl` já está guardado pelo `ReturnUrlService`.
  **Feito quando**: o teste confere o botão, o componente `app-google-glyph` dentro dele e a
  chamada ao serviço.
- [ ] T062 [US3] [FE] Criar a tela `src/app/features/auth/accept-terms/` (`accept-terms.ts`,
  `accept-terms.html`, `accept-terms.spec.ts`) e trocar o `ShellFallback` da rota `/auth/termos`.
  Caixa de aceite com os links para `/legal/termos` e `/legal/privacidade`; "Aceitar e continuar"
  desabilitado sem a caixa ⇒ `AccountService.acceptTerms()` ⇒ `PostAuthNavigator.go()`; botão de
  texto "Sair" ⇒ `AccountService.logout()`. Sem tela aprovada (regra 14). **Feito quando**: o
  teste cobre o botão desabilitado, o aceite com navegação, a falha de rede (mensagem e botão
  reabilitado) e o "Sair".
- [ ] T063 [US3] [FE] Conferir `src/app/features/auth/callback/oauth-callback.ts`: sucesso usa
  `PostAuthNavigator.go()` (T029) e o cancelamento volta para `/auth/login` com a mensagem neutra
  já existente, sem criar sessão. Acrescentar a `oauth-callback` um teste
  (`oauth-callback.spec.ts`) para os dois casos se ainda não existir. **Feito quando**: o teste
  passa.
- [ ] T064 [US3] [QA] Criar `e2e/account-onboarding.spec.ts`: criar pela API de admin um usuário
  confirmado **sem** metadados de aceite (equivale a uma conta vinda do Google; a chave
  `SUPABASE_SERVICE_ROLE_KEY` vem do ambiente do teste, nunca do repositório); entrar com ele ⇒
  `/auth/termos`; tentar abrir `/app` direto ⇒ volta para `/auth/termos`; aceitar ⇒
  `/auth/celular`; "Agora não" ⇒ `/app`; `my_account()` mostra `termos_versao = '2026-11'`.
  **Feito quando**: o teste passa duas vezes seguidas sem `supabase db reset` entre elas.
- [ ] T065 [US3] [QA] Com o provedor Google configurado como em `specs/001-login/quickstart.md` §2,
  validar à mão os cenários 1, 5 e 6 da US3 da spec. Se não houver credenciais Google no
  ambiente, **não simule**: registre no relatório "validação manual do Google pendente".
  **Feito quando**: os três cenários estão validados **ou** a pendência está registrada.

**Checkpoint**: os dois caminhos de cadastro terminam com aceite registrado.

---

## Phase 6: User Story 4 - Recuperar a senha (Priority: P2)

**Goal**: pedir a recuperação com resposta idêntica para qualquer e-mail, receber o link, criar a
senha nova e encerrar todas as sessões.

**Independent Test**: pedir para um e-mail com conta e para um sem; comparar respostas; trocar a
senha pelo link; a antiga deixa de valer.

- [ ] T066 [P] [US4] [BE] Criar `supabase/functions/password-recovery/logic.ts` (validação de
  e-mail; cálculo da espera até o piso de 600 ms) e `logic.test.ts`. **Feito quando**:
  `deno test supabase/functions/password-recovery/` passa com 8 casos de e-mail e a espera nunca
  negativa.
- [ ] T067 [US4] [BE] Criar `supabase/functions/password-recovery/index.ts` seguindo os 8 passos
  de `contracts/password-recovery.edge.md` (resposta sempre `{ "ok": true }`, envio em
  `EdgeRuntime.waitUntil`). **Feito quando**: os comandos de recuperação de `quickstart.md` §6
  dão: corpo idêntico e tempo ≥ 0,6 s para e-mail existente e inexistente; no 4º pedido para o
  mesmo e-mail, **nenhum** e-mail novo no coletor local e um evento
  `senha_recuperacao_solicitada` com `permitido = false`.
- [ ] T068 [P] [US4] [FE] Criar `src/app/core/auth/password.service.ts` com `requestRecovery` e
  `resetPassword` (e a assinatura de `changePassword` lançando "não implementado": entra na T087)
  e `password.service.spec.ts`, conforme `contracts/password-recovery.edge.md`. **Feito quando**:
  o teste cobre: `requestRecovery` resolve igual em sucesso e em falha de rede; `resetPassword`
  chama `verifyOtp` (`type: 'recovery'`) → `updateUser` → `signOut({ scope: 'global' })` nessa
  ordem; `invalid_link`; `weak_password`; nova tentativa depois de `weak_password` **não** repete
  o `verifyOtp`.
- [ ] T069 [US4] [FE] Criar a tela `src/app/features/auth/forgot-password/` (3 arquivos) e
  registrar `/auth/recuperar-senha` com `anonGuard`. Campo de e-mail, "Enviar link", estado
  `forgot-password-sent` com o texto fixo do contrato, "Voltar para entrar", botão desabilitado
  por 60 s depois de cada envio. Sem tela aprovada (regra 14). **Feito quando**: o teste cobre a
  validação de formato, a mesma tela de confirmação para qualquer resposta e a contagem.
- [ ] T070 [US4] [FE] Criar a tela `src/app/features/auth/reset-password/` (3 arquivos) e
  registrar `/auth/nova-senha` **sem guard**. Sem `token_hash` ⇒ estado `reset-password-invalid`;
  campo "Nova senha" com mostrar; "Salvar nova senha" ⇒ `resetPassword`; sucesso ⇒
  `/auth/login?senha=alterada`; `invalid_link` ⇒ "Pedir novo link". Nenhuma chamada ao carregar.
  Sem tela aprovada (regra 14). **Feito quando**: o teste prova que nada é chamado na criação e
  cobre senha de 7 caracteres, sucesso e link inválido.
- [ ] T071 [US4] [FE] Em `src/app/features/auth/login/`: o link "Esqueci a senha" passa a navegar
  para `/auth/recuperar-senha` (sem o `aria-label` "(em breve)"), e `?senha=alterada` mostra um
  `z-alert` de sucesso "Senha alterada. Entre com a nova senha." com
  `data-testid="login-password-changed"`. **Feito quando**: `login.spec.ts` continua verde, com
  dois testes novos no fim.
- [ ] T072 [US4] [QA] Criar `e2e/password-recovery.spec.ts`: criar um usuário confirmado pela API
  de admin (com `user_metadata: { terms_version: '2026-11' }`); pedir a recuperação pela tela;
  obter o link com `mailbox.ts`; definir a senha nova; entrar com a nova (a URL deixa
  `/auth/login`) e com a antiga (mensagem genérica); abrir o mesmo link de novo ⇒
  "Este link não vale mais". Acrescentar a `e2e/security/account-enumeration.spec.ts` a parte de
  recuperação: a tela mostra o mesmo texto para e-mail existente e inexistente. **Feito quando**:
  os testes passam.

**Checkpoint**: quem esquece a senha volta a entrar sem ajuda.

---

## Phase 7: User Story 5 - Sair, exportar meus dados e excluir minha conta (Priority: P2)

**Goal**: seção Conta com sair, exportação dos dados e exclusão definitiva, sem apagar códigos de tag.

**Independent Test**: exportar e conferir o arquivo; excluir e verificar que não entra mais, que
os dados pessoais sumiram e que a trilha de auditoria ficou sem identificação.

- [ ] T073 [US5] [BE] Criar `supabase/migrations/0016_conta_privacidade.sql` com
  `public.export_my_data()` conforme `contracts/account-export.rpc.md` (5 passos; formato de
  saída; `EXECUTE` de texto constante para a função da `003`, com `USING`). **Feito quando**:
  `supabase db reset` passa e, autenticado como tutor A, a RPC devolve `conta.id` de A e
  `tags_e_pets = null` com uma observação.
- [ ] T074 [US5] [BE] No mesmo arquivo, acrescentar `public.delete_account_data(uuid, text, text)`
  seguindo o pseudocódigo de `contracts/account-delete.edge.md` (falha fechada com
  `deletion_hook_missing`; evento único). **Feito quando**: `supabase db reset` passa e
  `select has_function_privilege('authenticated','public.delete_account_data(uuid,text,text)','EXECUTE');`
  devolve `false`.
- [ ] T075 [P] [US5] [QA] Criar `supabase/tests/conta_privacidade.test.sql` com os testes de
  `contracts/account-export.rpc.md` (6) e de `contracts/account-delete.edge.md` (7), criando
  **dentro do teste** a tabela `public.tag_assignments` e as funções
  `end_assignments_for_account`/`export_tutor_tag_data` de mentira quando o caso pede.
  **O arquivo tem de passar com ou sem os objetos de verdade da `003`** (ela é implementada
  depois e cria essa tabela e essas funções): cada caso roda entre `SAVEPOINT caso;` e
  `ROLLBACK TO caso;` e prepara o próprio cenário com `DROP FUNCTION IF EXISTS …`,
  `DROP TABLE IF EXISTS public.tag_assignments CASCADE` ou `CREATE TABLE IF NOT EXISTS …`, e só
  então cria a versão de mentira. Nada disso sobrevive ao `ROLLBACK` final do teste.
  **Feito quando**: `supabase test db` passa; e passa de novo depois de criar à mão, numa sessão
  de teste, uma `public.tag_assignments` vazia e uma `end_assignments_for_account(uuid)` qualquer
  (apague as duas em seguida).
- [ ] T076 [P] [US5] [BE] Criar `supabase/functions/account-delete/logic.ts` (validação de
  `confirm`; remoção paginada de arquivos sob um prefixo, recebendo o cliente de storage por
  parâmetro) e `logic.test.ts`. **Feito quando**: `deno test supabase/functions/account-delete/`
  passa com 0, 1, 100 e 250 arquivos e com bucket inexistente.
- [ ] T077 [US5] [BE] Criar `supabase/functions/account-delete/index.ts` seguindo os **9 passos,
  na ordem**, de `contracts/account-delete.edge.md`. **Feito quando**: por `curl`, com um usuário
  de teste: `confirm` errado ⇒ `confirmation_required`; senha errada ⇒ `invalid_password` e o
  usuário continua existindo; senha certa ⇒ `{ "ok": true }`, o usuário some de `auth.users` e de
  `perfis`, e existe um evento `conta_excluida` com `ator IS NULL`.
- [ ] T078 [P] [US5] [FE] Criar `src/app/core/account/privacy.service.ts` (`exportData`,
  `deleteAccount`) e o `.spec.ts` conforme `contracts/frontend-services.contract.md` §3 e
  `contracts/account-export.rpc.md` ("Frontend"). **Feito quando**: o teste cobre o nome do
  arquivo `faro-meus-dados-AAAA-MM-DD.json`, `rate_limited` com `retryAfterSeconds`, o envio de
  `{ confirm: 'EXCLUIR', password }`, cada código de erro e a limpeza local depois do sucesso.
- [ ] T079 [US5] [FE] Preencher `src/app/features/account/account.routes.ts` com a rota índice
  (`data: { hub: true }`) e criar `src/app/features/account/account-home/` (3 arquivos): cabeçalho
  com nome e e-mail, as cinco linhas e o botão "Sair" (§4 do contrato, "Conta (lista)"). Ligar em
  `src/app/app.routes.ts` como filho de `app`: `{ path: 'conta', loadChildren: … }` **antes** do
  `**` do `ShellFallback`. Sem tela aprovada (regra 14); tema do app (claro e escuro).
  **Feito quando**: o teste confere os `data-testid` `account-*`, o selo do celular nos dois
  estados e que "Sair" chama `AccountService.logout()`; no navegador, `/app/conta` abre com o item
  "Conta" ativo na navegação.
- [ ] T080 [US5] [FE] Criar `src/app/features/account/privacy/privacy.ts`, `privacy.html` e
  `privacy.spec.ts`, registrar `/app/conta/privacidade`, e implementar o bloco **Exportar meus
  dados** (texto, botão `account-privacy-export`, erro `rate_limited` com o tempo). Cabeçalho
  `app-screen-header` com voltar para `/app/conta`. **Feito quando**: o teste cobre o download
  disparado e a mensagem de limite.
- [ ] T081 [US5] [FE] Criar `src/app/features/account/privacy/delete-account-dialog.ts` (+ spec) e
  ligar ao botão de texto vermelho `account-privacy-delete`: diálogo `z-alert-dialog` com o texto
  das consequências, campo "Digite EXCLUIR", campo "Senha atual" (`hasPassword()`) ou aviso e
  botão "Entrar de novo com o Google" (`isGoogleOnly()`; antes, `ReturnUrlService.capture('/app/conta/privacidade')`),
  botão destrutivo desabilitado até o texto conferir, mensagens de cada erro de
  `contracts/account-delete.edge.md`. Sucesso ⇒ `/auth?conta=excluida`. **Feito quando**: o teste
  cobre o botão desabilitado, `invalid_password`, `reauth_required` nos dois métodos,
  `deletion_unavailable`, `deletion_incomplete` e o sucesso; o diálogo sai escuro quando o app
  está no tema escuro.
- [ ] T082 [US5] [QA] Criar `e2e/account.spec.ts`: (a) Conta → Sair ⇒ tela de entrada e um evento
  `logout` novo; (b) exportar ⇒ o arquivo baixado é JSON com `conta.email` do usuário e sem
  nenhuma chave contendo `hash`; (c) excluir com senha errada ⇒ erro e a conta continua; (d)
  excluir com a senha certa ⇒ `/auth?conta=excluida`, o login falha com a mensagem genérica e o
  mesmo e-mail consegue iniciar um cadastro novo. **Feito quando**: os quatro passam.

**Checkpoint**: direitos do titular (exportar e excluir) funcionando.

---

## Phase 8: User Story 6 - Cuidar da minha conta: nome, celular, senha e aparência (Priority: P3)

**Goal**: alterar nome, trocar celular (com o antigo valendo até o novo ser confirmado), trocar
senha e escolher a aparência.

**Independent Test**: cada ajuste funciona sozinho; durante a troca de celular,
`phone_is_confirmed` continua verdadeiro e `perfis.celular` é o número antigo.

- [ ] T083 [P] [US6] [FE] Criar `src/app/features/account/personal-data/` (3 arquivos) e registrar
  `/app/conta/dados`: campo Nome (2–80), e-mail somente leitura com a ajuda do contrato, "Salvar
  alterações" desabilitado sem mudança, aviso "Dados salvos." pelo `sonner`. **Feito quando**: o
  teste cobre os limites 1, 2, 80, 81, o botão desabilitado e o sucesso.
- [ ] T084 [P] [US6] [FE] Criar `src/app/features/account/phone/` (3 arquivos) e registrar
  `/app/conta/celular` com os três estados de §4 do contrato ("Celular"): confirmado, não
  confirmado, troca pendente. **Feito quando**: o teste cobre os três estados e os destinos dos
  botões (`/auth/celular?returnUrl=/app/conta/celular` e
  `/auth/confirmar-celular?returnUrl=/app/conta/celular`).
- [ ] T085 [US6] [FE] Em `src/app/features/auth/phone-entry/`, implementar o **modo troca**
  (`AccountStore.phoneConfirmed()` verdadeiro): título "Novo celular", linha com o celular atual,
  "Cancelar" no lugar de "Agora não", tratamento de `reauth_required` (`method = 'password'`:
  mostrar `phone-password` e reenviar; `method = 'google'`: botão `phone-google-reauth`),
  `invalid_password` e `same_number`. **Feito quando**: `phone-entry.spec.ts` cobre os cinco casos.
- [ ] T086 [US6] [QA] Acrescentar a `e2e/account.spec.ts`: com conta de celular confirmado, iniciar
  a troca (senha atual) ⇒ a tela de código aparece e `my_account()` ainda mostra o número antigo
  em `celular` e o novo em `celular_pendente`; digitar `424242` ⇒ `celular` passa a ser o novo e
  `/app/conta/celular` mostra "Confirmado". **Feito quando**: o teste passa.
- [ ] T087 [P] [US6] [FE] Implementar `changePassword(current, next)` em
  `src/app/core/auth/password.service.ts` (5 passos de `contracts/password-recovery.edge.md`) e
  os testes em `password.service.spec.ts`. **Feito quando**: o teste cobre `no_password`,
  `invalid_current`, `rate_limited`, `weak_password` e o sucesso com
  `signOut({ scope: 'others' })`.
- [ ] T088 [US6] [FE] Criar `src/app/features/account/password/` (3 arquivos) e registrar
  `/app/conta/senha`: formulário para `hasPassword()`, só a nota `account-password-google-note`
  para `isGoogleOnly()`. **Feito quando**: o teste cobre os dois modos, a validação da nova senha
  e cada mensagem.
- [ ] T089 [P] [US6] [FE] Criar `src/app/features/account/appearance/` (3 arquivos) e registrar
  `/app/conta/aparencia`: `z-toggle-group` de seleção única com "Clara", "Escura", "Igual ao
  sistema", refletindo `ThemeService.preference()` e chamando `setPreference`. **Não** tocar no
  DOM nem em `localStorage` aqui. **Feito quando**: o teste cobre a opção marcada para cada
  preferência e a chamada a `setPreference` com `'light'`, `'dark'` e `'system'`.
- [ ] T090 [US6] [QA] Acrescentar a `e2e/account.spec.ts`: alterar o nome e ver o novo nome em
  `/app/conta`; trocar a senha e entrar com a nova; escolher "Escura" e conferir que o contêiner
  da casca do tutor tem a classe `dark` e que, abrindo `/auth/login` depois de sair, **nenhum**
  elemento tem a classe `dark`. **Feito quando**: os três passam.

**Checkpoint**: todas as histórias funcionam de forma independente.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T091 [P] [QA] Criar `e2e/account-a11y.spec.ts`: axe (sem violações `serious` ou `critical`)
  e "sem rolagem horizontal" em 320, 390, 768 e 1440 px para `/auth`, `/auth/criar-conta`,
  `/auth/confirmar-email`, `/auth/celular`, `/auth/confirmar-celular`, `/auth/termos`,
  `/auth/recuperar-senha`, `/auth/nova-senha`, `/app/conta` e suas cinco telas (estas nos temas
  claro e escuro), `/legal/termos`, `/legal/privacidade`. **Feito quando**: o teste passa.
- [ ] T092 [P] [FE] Conferir que todo texto visível e todo `aria-label` das telas desta spec está
  marcado com `i18n`/`$localize`, e que os textos batem com os contratos. **Feito quando**:
  `npx ng extract-i18n --output-path /tmp/faro-i18n` conclui sem erro e uma busca por texto em
  português solto nos `.html` de `features/auth`, `features/account` e `features/legal`
  (atributos sem `i18n`) não encontra nada.
- [ ] T093 [P] [QA] Regressão do resgate: `npm run lint` com a fronteira da T005; se existir o
  script `check:ui` da `002`, rodar `npm run check:ui`; conferir que a rota de uma tag abre sem
  sessão e sem redirecionamento para `/auth`; `git diff develop --stat -- src/app/features/public`
  vazio. **Feito quando**: os quatro itens passam.
- [ ] T094 [QA] Executar o **portão de segurança** da seção "Verificação final" e registrar o
  resultado de cada item. **Feito quando**: os 12 itens estão "passou"; qualquer "falhou" bloqueia
  e é relatado, sem alterar o teste para passar.
- [ ] T095 [QA] Validar `quickstart.md` §4, §5 e §6 de ponta a ponta num banco recém-criado
  (`supabase db reset`). **Feito quando**: todas as linhas da tabela de §5 dão o resultado
  esperado (a linha do Google pode ficar "pendente", conforme T065).
- [ ] T096 [QA] Escrever o relatório final da implementação (na resposta ao usuário, **não** em
  arquivo): o que foi feito por fase; divergências encontradas entre contratos e código; a lista
  de telas que precisam de passada de design (regra 14) e se a foto da boas-vindas está pendente;
  os `TODO` abertos (`SMS_PROVIDER`, `EMAIL_PROVIDER`, `LEGAL_TEXTS`, `CAPTCHA`, `RETENCAO`); o
  estado da validação do Google; e o lembrete de que o dono precisa rodar `/security-review` e
  `/code-review` antes de promover para `homolog`. **Feito quando**: o relatório cobre os seis pontos.

---

## Dependencies & Execution Order

### Entre fases

- **Phase 1 (Setup)**: T001 primeiro (pode parar tudo). T002–T006 depois, em paralelo; T004
  depende de T003 (mesmo arquivo `config.toml`).
- **Phase 2 (Foundational)**: depende da Phase 1. **Bloqueia todas as histórias.**
- **US1 (Phase 3)**: depende da Phase 2.
- **US2 (Phase 4)**: depende da Phase 2. As tarefas de banco e de Edge não dependem da US1; as
  telas e o E2E (T059, T060) dependem das telas da US1.
- **US3 (Phase 5)**: depende da US1 (tela de cadastro) e da T056 (tela de informar celular).
- **US4 (Phase 6)**: depende só da Phase 2.
- **US5 (Phase 7)**: depende da Phase 2 e da T049 (`reauth.ts`, criada na US2).
- **US6 (Phase 8)**: depende da US2 (verificação de celular), da US4 (`password.service.ts`) e da
  US5 (rotas e lista da Conta).
- **Phase 9 (Polish)**: depois de todas as histórias desejadas.

### Dentro do banco (ordem obrigatória das migrations)

`0008` → `0009` → `0010` → `0011` → `0012` → `0013` → `0014` → `0015` → `0016`.
T007 → T008 → T010 → T012 → T014 → T015 → T017 → T041 → T042 → T043 → T073 → T074.
Cada teste pgTAP vem depois da migration que ele cobre.

### Dentro das Edge Functions

T019, T020 (base) → T021. T046, T047, T048 → T049 → T050 → T051 → T052 → T053.
T019/T020 → T066 → T067. T049 → T076 → T077.

### Dentro do frontend

T022, T023, T024 → T025 → T026 → T027 → T028 → T029.
T031 → T034 → T035 → T036. T054 → T056 → T057 → T058 → T059.
T068 → T069, T070. T078 → T079 → T080 → T081. T079 → T083, T084, T088, T089.

### Contrato antes de quem consome

Em cada história: migration e função SQL → teste pgTAP → Edge Function → serviço de `core/` →
tela → E2E.

### Parallel Opportunities

- Phase 1: T002, T004 (depois da T003), T005, T006.
- Phase 2: os testes pgTAP (T009, T011, T013, T016, T018) correm ao lado da migration seguinte;
  T019 e T020 ao lado do banco; T022, T023 e T024 entre si e ao lado do backend.
- US1: T031, T032 e T038 em paralelo; **BE não tem tarefa na US1**, então a US2-banco
  (T041–T045) pode começar junto com a US1-frontend.
- US2: T046, T047, T048 entre si; T054 e T055 entre si e ao lado das Edge Functions.
- US4 inteira (T066–T072) pode correr em paralelo com a US2, depois da Phase 2.
- US5: T075 e T076 ao lado do frontend (T078).
- US6: T083, T084, T087 e T089 em paralelo.

### Exemplo de paralelismo (depois da Phase 2)

```text
backend-supabase : T041 → T042 → T043 → T046/T047/T048 → T049 → T050 → T051 → T052
frontend-angular : T031/T032 → T033 → T034 → T035 → T036 → T037
qa-engineer      : T038 → T039 → T040 → T044 → T045
```

---

## Implementation Strategy

### MVP primeiro (US1 + US2)

1. Phase 1 e Phase 2.
2. US1: pare e valide (uma pessoa cria a conta, confirma o e-mail e entra).
3. US2: pare e valide (celular confirmado; `phone_is_confirmed` verdadeiro). **A partir daqui a
   `003-tag-qr` está desbloqueada.**

### Entrega incremental

4. US4 (recuperar senha) e US3 (Google), em qualquer ordem.
5. US5 (privacidade): obrigatória antes de abrir ao público (LGPD).
6. US6 (ajustes da conta).
7. Polish e portão de segurança.

Cada história termina com `lint`, testes, `build`, `supabase test db` e `deno test` verdes.

---

## Verificação final

### Comandos (todos precisam passar)

```bash
supabase start
supabase db reset
supabase test db
deno test supabase/functions/
npm run lint
npm test -- --watch=false
npm run build
# em outro terminal, com SMS_DRIVER=stub, FARO_ENV=test, SMS_STUB_CODE=424242 no supabase/.env.local:
supabase functions serve --env-file ./supabase/.env.local
npm run e2e
```

### Portão de segurança (T094)

| # | Item | Como provar |
|---|---|---|
| 1 | Tutor A não lê nem altera o perfil do tutor B | `supabase/tests/rls_perfis_conta.test.sql` |
| 2 | Anônimo não lê nada e não executa nenhuma função desta spec | `rls_perfis_conta`, `phone_verifications`, `rate_limit_events`, `funcoes_conta`, `conta_privacidade` + a conferência por catálogo de `contracts/rls-expectations.md` |
| 3 | Ninguém marca o próprio celular como confirmado | teste nº 3 de `contracts/rls-expectations.md` (`42501`) |
| 4 | Ninguém muda o próprio papel; metadados não definem papel | `rls_perfis_conta` + `funcoes_conta` |
| 5 | Código SMS guardado só como HMAC com chave; nenhuma coluna de código ou telefone em claro | guardião de esquema em `phone_verifications.test.sql`; `grep -rn "PHONE_OTP_PEPPER" supabase/migrations src` não devolve nada |
| 6 | Limites valem no servidor | `rate_limit_events.test.sql`; `phone_verifications.test.sql` (5 tentativas); `quickstart.md` §6 (`cooldown`, `locked`, 4º pedido de recuperação sem e-mail) |
| 7 | Falha fechada | tabela "Falha fechada" de `quickstart.md` §6; `conta_privacidade.test.sql` (`deletion_hook_missing`) |
| 8 | Anti-enumeração no cadastro e na recuperação | `e2e/security/account-enumeration.spec.ts`; tempos de `quickstart.md` §6 |
| 9 | Auditoria não forjável e sem dado pessoal | `funcoes_auth_grants.test.sql`; teste nº 8 de `contracts/rls-expectations.md`; `select detalhe from auth_audit_log` sem `@` nem telefone |
| 10 | Nenhum segredo no cliente | `grep -rnE "service_role\|PHONE_OTP_PEPPER\|HASH_SALT\|SMS_STUB_CODE" src dist/faro/browser` não devolve nada |
| 11 | SMS simulado impossível em produção | `sender.test.ts`, `otp.test.ts` e a linha `FARO_ENV=production` + `stub` de `quickstart.md` §6 |
| 12 | Resgate intacto e destino de retorno seguro | T093; `return-url.spec.ts`; caso (d) da T060 |

Riscos residuais **declarados e aceitos** (não reprovam o portão; ver `plan.md`): chamadas diretas
ao Supabase Auth para cadastro, reenvio e recuperação ficam sob os limites do próprio Auth
(`TODO(CAPTCHA)`); `logout` é relato do cliente; o `login-guard` da `001` aceita o resultado
informado pelo cliente.

Depois do portão: o dono roda `/security-review` e `/code-review`. Nada é promovido para
`homolog` ou `master` por quem executa estas tarefas.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência entre si.
- Uma tarefa que edita um arquivo já criado por outra diz isso explicitamente ("no mesmo arquivo").
- Commit ao fim de cada tarefa ou grupo lógico, na branch `004-conta-tutor`.
- Em dúvida entre um contrato desta spec e um documento antigo de `docs/`: vale o contrato.
  Em dúvida entre um contrato e a constituição: vale a constituição, e a divergência é relatada.
