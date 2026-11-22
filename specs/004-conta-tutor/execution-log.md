# Log de execução — 004-conta-tutor (Phases 1 e 2, tarefas BE e QA)

Execução de 2026-11-22 pelo subagente `backend-supabase`, branch `004-conta-tutor`. Escopo: T001 a T021,
exceto as `[FE]` T005 e T006. Este arquivo registra desvios, decisões e pendências.

## Bloqueio: conflito entre o contrato e o teste da 001 (T010)

`supabase/tests/rls_perfis.test.sql` (da `001`, não editável) afirma duas coisas que o contrato desta spec
proíbe:

1. Linha 82: `is_empty($$ SELECT * FROM public.perfis $$)` como `anon` espera **zero linhas**. O
   `data-model.md` §1 e o teste de segurança nº 2 de `rls-expectations.md` exigem
   `REVOKE ALL ON public.perfis FROM anon` e **erro 42501**. Resultado no CI depois da 0010:
   `ERROR: permission denied for table perfis` e o arquivo aborta (`Failed 17/18 subtests`).
2. `lives_ok` do admin em `UPDATE public.perfis SET papel = 'tutor' WHERE id = <B>` ("admin pode alterar papel
   de outro usuario"). O contrato só concede `UPDATE (nome)` a `authenticated` e a matriz diz que o admin
   **não** altera `papel` (42501). Não apareceu no log porque o arquivo abortou antes; é inferido da leitura.

Regra 6 de `tasks.md` e regra 1 desta execução: não alterar o teste da 001 e parar. A 0010 foi implementada
**exatamente como o contrato** e **não foi suavizada**. Decisão pendente do William: (a) atualizar
`rls_perfis.test.sql` para o novo contrato (anon ⇒ 42501; admin sem `papel`), ou (b) rever o contrato. Enquanto
isso, `supabase test db` fica vermelho só por esse arquivo, e as tarefas cujo "Feito quando" cita
`supabase test db` ficam sem `[x]`.

## Seed da 001 não autentica no GoTrue (achado, não corrigido)

No stack local do CI, `POST /auth/v1/token` com `tutor.a@faro.test` / `TesteSenha123!` devolve
`400 invalid_credentials`, e `POST /auth/v1/signup` com esse e-mail devolve **500** (em vez dos 200 ofuscados
do contrato). Hipótese: o `seed.sql` da 001 insere em `auth.users` sem `instance_id`
(`00000000-0000-0000-0000-000000000000`) e só preenche `confirmation_token`; o GoTrue não enxerga a linha. O
diagnóstico do script de CI imprime `instance_id` e as colunas de token para confirmar. A T014 só autoriza
dois ajustes no seed (metadado de aceite e `UPDATE` do celular do tutor A), então **não** corrigi: afeta
qualquer E2E que entre com os usuários do seed (T029, T039, T060, T064). Correção sugerida: acrescentar
`instance_id` e preencher com `''` as colunas de token em texto. As conferências T003 e T017 usam um usuário
criado pela API de admin do stack local.

## Decisões e desvios

- **`config.toml` (T003)**: a linha `enable_confirmations` já não existia em `[auth]` (nada a remover). Os
  valores do contrato foram aplicados sem alteração; a CLI 3.2.0 aceitou todas as chaves (só avisa que
  `enable_signup` está obsoleto em favor de `enabled`; o contrato manda `enable_signup`, mantido).
  `[functions.<nome>] verify_jwt` das funções novas **não** foi declarado: as pastas ainda não existem
  (Phase 4 em diante).
- **T004**: o coletor local da CLI 3.2.0 é o Mailpit (`/api/v1/...` na porta 54324).
- **`loadEnv(need, read?)`** (T019): segundo parâmetro opcional com o leitor de variáveis, padrão `Deno.env.get`.
  Existe porque o CI roda `deno test` sem permissão de env. `SITE_URL` e `ALLOWED_ORIGINS` não são
  obrigatórios em `loadEnv` (a lista de obrigatórias do contrato tem só quatro itens); ausentes: `siteUrl = ''` e
  CORS sem `Allow-Origin` (falha fechada).
- **0010**: três `CHECK` de formato (`celular`, `celular_pendente`, `termos_versao`) em vez de dois; o
  `data-model.md` §1 diz que `celular_pendente` tem "o mesmo CHECK de formato". `perfis_set_updated_at` é
  `SECURITY DEFINER` com `search_path` fixo e sem EXECUTE para anon/authenticated, para cumprir a regra geral.
- **0012**: `accept_terms`, `log_logout` e `my_account` tiveram o EXECUTE revogado também de `service_role`
  (o padrão do Supabase o concede; `data-model.md` §5 diz "não"). `handle_new_user` teve o EXECUTE revogado de
  `PUBLIC`/`anon`/`authenticated` (gatilho: o Postgres não confere EXECUTE ao disparar).
- **Testes extras**: `supabase/tests/conta_estado_inicial.test.sql` (enum com 16 valores, estado do seed,
  `SECURITY DEFINER` com `search_path`, nada executável por `anon`, nenhuma tabela de tags) para verificar T007,
  T014 e a regra geral sem depender de `psql` no CI.
- **CI**: novo passo `scripts/ci/supabase-checks.sh` (curl contra o stack local: T003, T004, T017, T021) e
  `if: ${{ !cancelled() }}` nos passos seguintes ao pgTAP, para um run mostrar tudo que está vermelho. Actions
  continuam fixadas por hash; `permissions: contents: read` intacto.
- **Flake de infraestrutura**: o primeiro run falhou em `supabase start` (`bind: address already in use` na
  porta 54324 do Mailpit, depois de `Rate exceeded` no registro de imagens); `gh run rerun --failed` passou. Não
  é do código.

## T021: o preflight local não chega na função

No stack local o **Kong responde o `OPTIONS`** com `Access-Control-Allow-Origin: *` antes de a função rodar. O
"Feito quando" literal (`Allow-Origin: http://localhost:4200` no `OPTIONS`) só é observável no projeto
hospedado. Substituí a prova por (a) testes de `handleOptions`/`corsHeadersFor` em `_shared/http.test.ts` e (b)
uma resposta real de `POST` ao `login-guard`, que traz `Access-Control-Allow-Headers` e
`Access-Control-Allow-Methods` com o texto exato de `_shared/http.ts` (o Kong só envia esses dois no preflight,
com outro valor). T021 fica sem `[x]` por essa razão.

## T003: cadastro repetido responde 422, não 200

Com a CLI 3.2.0 (GoTrue v2.198) e `enable_confirmations = true`, `POST /auth/v1/signup` com o e-mail de um
usuário **já confirmado** respondeu **HTTP 422** (run 45032125748), não o 200 ofuscado que
`auth-config.contract.md` ("O que o Auth garante") promete para FR-006. Os outros critérios da T003 passaram:
`supabase start` sobe com a configuração (a CLI só avisa que `enable_signup` está obsoleto), senha de 7
caracteres recebe 422 `weak_password`. T003 fica sem `[x]` até o William decidir: o cliente já trata "usuário já
existe" como resposta uniforme (T031), mas quem chama `/auth/v1/signup` direto consegue distinguir. O script de
CI agora imprime o `error_code` e o status do cadastro repetido de e-mail ainda não confirmado, para dar base à
decisão.

## Estado das caixas ao fim da execução

Marcadas: T001, T002, T004, T007, T008, T012, T014, T015, T017, T019, T020. Sem marca, com o código entregue:
T003 (422 acima), T009, T010, T011, T013, T016, T018 (o arquivo de teste de cada uma passa no CI; o
`supabase test db` do conjunto está vermelho só por `rls_perfis.test.sql` da 001) e T021 (preflight local é do
Kong). Detalhes nas seções acima.

## Decisões do William e resolução (2026-11-22, segunda rodada)

1. **`rls_perfis.test.sql` da 001 atualizado ao contrato (opção a).** Nenhuma asserção removida (plano continua
   em 18). Alterações:
   - "anon não lê nenhuma linha de perfis (deny-by-default)": antes `is_empty(SELECT * FROM perfis)`; depois
     `throws_ok(..., '42501', NULL, 'anon não lê perfis (deny-by-default: sem privilégio, 42501)')`.
   - "admin pode alterar papel de outro usuário (perfis_admin_all)": antes `lives_ok(UPDATE ... SET papel = 'tutor')`;
     depois `throws_ok(..., '42501', NULL, 'admin não altera papel por UPDATE direto (privilégio de coluna, 42501)')`.
     A asserção de que o admin **lê** os 3 perfis ficou como estava.
   - Nenhuma outra asserção quebrou pelo privilégio de coluna (a do "0 linhas" de tutor A sobre o nome de B e a de
     "tutor não escala papel" seguem iguais).
2. **Seed corrigido** (extensão da T014): `UPDATE auth.users` com `instance_id` zerado, colunas de token em `''`,
   `aud`/`role` `authenticated` e `raw_app_meta_data` com provedor `email`, mais `INSERT` em `auth.identities`
   (uma linha `email` por usuário). Ids, e-mails e senha de teste iguais. Prova no CI: login por senha de
   tutor.a, tutor.b e admin devolve 200 e `current_user_role` devolve tutor, tutor e admin.
3. **T003, cadastro repetido**: investigado. O 422 `user_already_exists` ocorre também para usuário confirmado
   pelo fluxo normal do link (não só o criado pela API de admin), e o repetido de não confirmado dá 429. É
   comportamento da versão do Auth, sem chave de configuração. Aceito; ressalva registrada em
   `contracts/auth-config.contract.md`. T003 marcada.
4. **T021**: aceita com a prova por `POST` e testes de `handleOptions`. Ressalva: no ambiente hospedado o
   preflight precisa ser conferido no preview. Marcada.

## Estado final

Run verde 45032898592 (commit ec9a130): pgTAP 9 arquivos e 213 asserções, deno 46 testes, script de CI 19 PASS e
0 FAIL, job `app` 48 arquivos e 238 testes. Marcadas todas as tarefas BE/QA de T001 a T021 (menos as `[FE]`
T005 e T006).

---

# Backend e QA — Phase 4 (T041 a T053)

Execução de 2026-11-22 pelo subagente `backend-supabase`, branch `004-conta-tutor`. Run verde final: 45040169923.

## Entregue

- `0014_phone_verifications.sql`: tabela com as 10 colunas, índice único parcial (uma verificação aberta por conta) e
  índice `(user_id, created_at DESC)`, RLS sem política, `REVOKE ALL` de `anon`/`authenticated`.
- `0015_funcoes_celular.sql`: `phone_is_confirmed`, `phone_verification_status`, `phone_verification_begin`,
  `phone_verification_send_failed`, `phone_verification_active`, `phone_verification_confirm`, todas
  `SECURITY DEFINER` com `search_path = public, pg_temp` e o `GRANT` exato de `data-model.md` §5.
- `_shared/`: `phone.ts`, `otp.ts`, `sms/sender.ts` (drivers `log` e `stub`; `// TODO(SMS_PROVIDER)` em `REAL_DRIVERS`,
  vazio), `reauth.ts`, `clients.ts` (acrescentado `anonClient`). Funções `phone-verify-start` e `phone-verify-confirm`
  (`logic.ts`, `logic.test.ts`, `index.ts`), com `[functions.<nome>] verify_jwt = true` no `config.toml`.
- `supabase/tests/phone_verifications.test.sql` (116 asserções) e 59 testes `deno` novos (105 no total).

## Desvios e decisões

- **`reauth.ts`**: recebe também `makeAnonClient` (fábrica do cliente que confere a senha) e `now` (relógio, opcional),
  além dos argumentos do contrato. Os tipos dos clientes são estruturais (`ReauthService`, `ReauthPasswordClient`,
  `RpcClient` em `audit.ts`): importar o tipo de `esm.sh` fez o `deno test` do CI falhar com "Could not find
  @types/node" (o Deno do runner enxerga o `package.json` da raiz). `deno check` dos dois `index.ts` passa com o
  `SupabaseClient` real.
- **`phone_verification_begin`** faz `SELECT … FOR UPDATE` no perfil antes de tudo, para serializar chamadas
  simultâneas da mesma conta (o índice único parcial seria o último recurso). Não está no contrato; não muda a saída.
- **CORS em T053**: o Kong local responde o `OPTIONS` (200, `Allow-Origin: *`) e também acrescenta `Allow-Origin: *` às
  respostas de `POST`. Então `Allow-Origin: http://localhost:4200` da função não é observável localmente (mesma
  ressalva da T021). Provas usadas: `OPTIONS` 200 nas três funções, `Allow-Headers` e `Allow-Methods` exatos da função
  no `POST`, e `http.test.ts` para a regra da origem. No ambiente hospedado, conferir o preflight no preview.
- **Driver `log` escreve duas linhas** (o texto tem `\n`): o script de CI aceita o registro `[sms:log]` + a linha
  `@tagfaro.com.br #codigo` como "só o log do driver".
- **pgTAP**: `phone_is_confirmed` depende do papel da requisição; depois de `set_no_uid`, as `claims` ficam no estado
  `authenticated` sem `sub` e o teste devolvia `false` (erro do teste, não da função). Os dois testes afetados agora
  rodam sob `tests.set_service()`.
- **jsonb no PostgREST**: `detalhe` volta com `": "` (espaço) na leitura por REST; o script confere só `limite_envio`.

## Verificação (CI)

- pgTAP: 10 arquivos, 329 asserções, `Result: PASS` (eram 9 arquivos e 213; `phone_verifications.test.sql` acrescenta 116).
- `deno test`: 105 testes passam, sem permissões.
- `scripts/ci/supabase-checks.sh`: 71 PASS, 0 FAIL. Novo trecho T051 a T053 (restarta o `functions serve` seis vezes
  com ambientes diferentes): 401 com chave anônima, `terms_required`, envio, `cooldown`, `invalid_phone`,
  `invalid_format` sem gastar tentativa, 4 × `invalid_code` (4, 3, 2, 1) e `locked`, depois `no_active` com o código certo;
  novo envio e acerto (`perfis.celular` promovido e `phone_is_confirmed` verdadeiro); troca (`reauth_required` com
  `method`, `invalid_password`, ok com a senha certa, número antigo permanece, `same_number`); `rate_limited` com 5
  eventos de `sms:account:h` e auditoria `limite_envio`; código só no registro `[sms:log]` e fora das tabelas; as cinco
  linhas de "Falha fechada"; e o driver `stub` com código fixo em `FARO_ENV=test`.

## Não verificado

- Driver real de SMS (`TODO(SMS_PROVIDER)`): não existe; o envio real não foi exercitado.
- `Allow-Origin` da função (só o ambiente hospedado).
- O teto global `sms:global:d` (`sms_unavailable` por volume) só tem a cobertura unitária de `mapDeniedBucket` e do
  `rate_limit_check`; não há teste de integração com 500 eventos.
- Corrida real entre dois `begin` simultâneos (o `FOR UPDATE` e o índice único cobrem; não houve teste concorrente).

---

# Frontend — Phases 1 e 2 (T005, T006, T022 a T030)

Execução de 2026-11-22 pelo subagente `frontend-angular`, branch `004-conta-tutor`.

## Achado que bloqueia a T028: `AuthService.restoreSession()` nunca é chamado

`restoreSession()` existe desde o commit da `001` (`bdc0e53`), mas **nada o chama** (`grep` em `src/` só acha a
definição; `app.config.ts` não tem inicializador). Conclusão: ao abrir o app a frio, `AuthStore` nasce sem sessão e os
guards tratam a pessoa como deslogada **mesmo com uma sessão válida no `localStorage`**. Provado no navegador (e2e
descartável, sem escrita no projeto): com a sessão do Supabase gravada em `localStorage`, `goto('/app')` termina em
`/auth/login?returnUrl=%2Fapp`.

Consequências para a 004: o "Feito quando" da T028 ("com sessão do tutor B, abrir `/app` redireciona para
`/auth/termos`") não pode passar abrindo a URL; só passa navegando dentro do app depois de um login. Também afeta o
avanço automático da T035 ("se a sessão aparecer em outra aba") e qualquer recarga de `/app/conta`.

Não corrigi: nenhuma tarefa nomeia `app.config.ts`, e um inicializador estático importaria `@supabase/supabase-js`
(cerca de 200 kB) para o pacote inicial, que hoje tem 399,8 kB e é o pacote da página pública. Caminho sugerido para
o William decidir: `provideAppInitializer` que só faz `import('./core/auth/auth.service')` (e chama
`restoreSession()`) quando existir a chave `sb-*-auth-token` no storage do navegador, no cliente.
**T028 fica sem `[x]`**: o código está entregue e a navegação pós-login está provada (abaixo).

## Desvios e decisões

- **T005**: além de `**/core/account/**` e `**/features/legal/**`, acrescentei `'../**/legal/**'` ao grupo de import
  relativo (o mesmo reforço que a `002` fez para `account`), porque `../../legal/x` não contém `features/` e escapava.
  Prova: criados três arquivos temporários em `features/public/` (`core/account/terms`, `account/account.routes`,
  `legal/terms/terms`); o lint os recusou; apagados.
- **T023**: `markReturning`, `isReturning` e `clearReturning` (esta última acrescentada, é a que o `PrivacyService`
  usará para apagar a marca) aceitam `platformId` opcional, com `inject(PLATFORM_ID)` como padrão. Motivo: `inject()`
  não funciona depois de um `await`, e o `PostAuthNavigator` chama `markReturning` depois de `load(true)`. Sem
  argumento o contrato `markReturning(): void` continua valendo.
- **T025**: `AccountStore.loaded` é derivado (`account !== null`); acrescentei `set()` e `reset()` ao store (o contrato
  diz que as mutações são do serviço; o `reset()` também é chamado por `AuthService.signOut()`, como manda a T029).
  `load()` deduplica chamadas simultâneas.
- **T026**: o papel é `authStore.role() ?? account.papel`. `nextStep` para `admin` aceita qualquer destino em `/admin`
  ou `/admin/*` (a tabela só cita `/admin/lotes`). O `returnUrl` entra codificado (`encodeURIComponent`) na query de
  `/auth/termos` e `/auth/celular`. Limpar os metadados `return_to` usa `SupabaseService` direto (está em `core/`).
- **T027, bug achado e corrigido**: num `CanMatchFn`, `segments` são só os que **sobram** para a rota que declara o
  guard; numa filha de `auth`, o guard de `/auth/termos` via `[termos]` e guardaria `returnUrl=/termos`, que passa no
  sanitizador e cai em `/:codigo`. Criei `core/auth/guard-url.ts` (`requestedUrl`), que lê o caminho completo da
  navegação em curso (`getCurrentNavigation().extractedUrl`; sem navegação em curso, usa os `segments`). Coberto por
  `nested-routes.spec.ts`, que roda o roteador real com a forma de `app.routes.ts`. Quando o destino fica dentro de
  `/auth`, o guard **não** acrescenta `returnUrl`.
- **T027, pacote inicial**: `termsGuard` está em `app.routes.ts` (pacote inicial). Importar `AccountService` de forma
  estática puxou o supabase-js para o inicial (613 kB; o limite do orçamento é 500 kB e a base era 397 kB). O guard
  agora faz `import()` dinâmico do serviço e usa `Injector.get`; inicial voltou a 399,8 kB. **Vale para o
  `phoneConfirmedGuard` (T055) e para qualquer guard novo registrado em `app.routes.ts`.**
- **T028**: `/auth` perdeu o `anonGuard` do pai; só `login` o tem. O índice `/auth` continua redirecionando para `login`
  (preserva `returnUrl`) até as boas-vindas (T033). A rota `conta` (`loadChildren: ACCOUNT_ROUTES`) **não** foi ligada
  agora: com a lista vazia ela trocaria o `ShellFallback` por um 404; a primeira tela da conta liga a rota.
- **T029**: `login.ts` não usa mais `result.role` nem o campo `returnUrl`; o `capture(query.returnUrl)` roda a cada
  emissão dos `queryParams`. O `oauth-callback` não ganhou teste novo (é a T063). `login.spec.ts` ganhou o mock do
  `PostAuthNavigator` e dois testes (sucesso chama `go()`, falha não chama).
- **Arquivos com CRLF**: `guards.spec.ts`, `app.routes*.ts`, `login.*`, `oauth-callback.ts` etc. foram regravados em LF;
  o Git normaliza (`warning: LF will be replaced by CRLF`) e o `diff` só mostra as linhas alteradas.

## Verificação

- `npm run lint`: passa. `npm test -- --watch=false`: **55 arquivos, 340 testes** passam (antes: 48 e 238 no CI da
  fase de banco). `npm run build`: passa, **pacote inicial 399,80 kB** (107,69 kB transferidos), sem aviso de orçamento.
  `npm run check:ui`: tokens (65 variáveis, 46 pares), pilha antiga e fronteira da página pública ok.
- `e2e/account-foundation.spec.ts` (9 testes, Chromium, 9 passam): **backend 100% simulado**. O arquivo registra
  primeiro um `abort` para qualquer `*.supabase.co` e depois só as respostas de `login-guard`, `token`,
  `current_user_role` e `my_account`; nenhuma requisição chega ao projeto hospedado. Prova: login com conta sem aceite
  vai a `/auth/termos` (com `returnUrl` preservado), tutor completo a `/app`, tutor sem celular a `/auth/celular`,
  admin a `/admin`, `returnUrl` externo é ignorado, voltar a `/app` dentro da página leva a `/auth/termos?returnUrl=…`,
  e a carga a frio sem sessão cai no login com o destino. **Não** foi provado contra os usuários reais do seed.
- T029: marcada. O "Feito quando" cita os usuários do seed; o login desses três usuários e os papéis já foram provados
  no CI da fase de banco (execução anterior, "Decisões do William, 2), e a navegação pós-login foi provada aqui com
  contas simuladas de mesma forma. A repetição ponta a ponta com o seed fica para o QA com Supabase local (T039, T064).

## T030 [QA]

Cumprida com o que existe: `lint`, `test` e `build` rodaram localmente (números acima); `supabase test db` e
`deno test` rodam no job `supabase` do CI, verde no último push. `git diff --name-only 90808ba..HEAD` sobre
`src/app/shared`, `src/app/features/public`, `specs/002-ui-zardui`, `specs/003-tag-qr`, `supabase`, `src/environments`,
`design`, `docs`, `tools`, `public` e `.github` está vazio.

## Pendências para as fases seguintes

- Decidir o `restoreSession` (acima). Sem isso, T035 (avanço automático) e as recargas de `/app/conta` não se
  comportam como o contrato descreve.
- Foto das boas-vindas (`public/photos/boas-vindas.jpg`) ainda não existe: a T033 mostrará só o fundo `bg-photo`.

## Atualização: `restoreSession()` ligado (decisão da sessão principal, 2026-11-22)

A sessão principal mandou corrigir o defeito herdado da 001 descrito acima. **Desvio registrado**: a T028 não nomeava
`app.config.ts`; a edição existe porque a ausência de chamador de `restoreSession()` é um defeito da `001` que impedia
cumprir o "Feito quando" da T028 e quebra toda recarga de página.

- `src/app/core/auth/session-bootstrap.ts` (`bootstrapSession`, `hasPersistedSession`) e `provideAppInitializer` em
  `src/app/app.config.ts`. No servidor não faz nada; no navegador procura `sb-*-auth-token` em `localStorage` e em
  `sessionStorage`; sem chave resolve sem importar nada; com chave faz `import('./auth.service')` e aguarda
  `restoreSession()`; erro resolve sem lançar (visitante anônimo).
- Pacote inicial: **399,80 kB antes, 400,28 kB depois** (+0,48 kB; 107,91 kB transferidos). O `AuthService` e o
  supabase-js continuam fora do inicial (o `session-bootstrap.ts` entra em `main`, o serviço não).
  `npm run check:bundle`: ok (o aviso conhecido de guards em `main` agora também lista `guard-url`, `terms.guard` e
  `session-bootstrap`; não há `@supabase`).
- Testes: `session-bootstrap.spec.ts` (5 casos: servidor, sem chave, chave em `localStorage`, chave em
  `sessionStorage`, erro). Suíte: 56 arquivos, 345 testes. E2E (backend simulado, 14 de 14): cold load de `/app` com
  sessão válida em `localStorage` e em `sessionStorage` permanece em `/app`; conta sem aceite vai para
  `/auth/termos?returnUrl=%2Fapp`; sem sessão vai ao login; `/` sem sessão não faz nenhum pedido a `*.supabase.co`.
- T028 marcada. Continua não provado com os usuários reais do seed (só com sessão simulada).

## Frontend — Phase 3 (T031 a T037, telas da US1)

Execução de 2026-11-22 pelo subagente `frontend-angular`. Commits: T031 `e3729bd`, T032 `871745c`, T037 `2549573`,
T033 a T036 `a4981a0`. As `[QA]` T038 a T040 ficam para a execução com Supabase local e coletor de e-mail.

### Desvios, decisões e interpretações

- **429 no cadastro (T031)**: o contrato diz "429 ⇒ `rate_limited`", e `auth-config.contract.md` diz que o 429 de reenvio
  (e-mail não confirmado) é sucesso uniforme. Resolvi pelo código do erro: `over_email_send_rate_limit` ⇒ `{ ok: true }`;
  qualquer outro 429 ⇒ `rate_limited`. 422 `user_already_exists` ⇒ `{ ok: true }`. Se o GoTrue não mandar `code` no 429,
  cai em `rate_limited`: confirmar no QA com o stack local.
- **`confirmEmail` entrega a sessão ao `AuthStore` (T031/T036)**: o cliente do Supabase guarda a sessão do `verifyOtp`, mas o
  `AuthStore` só sabe dela se alguém avisar (o `onAuthStateChange` só é assinado em `restoreSession()`, que o bootstrap
  chama apenas quando já há chave gravada). Sem isso o `authGuard` de `/auth/celular` e de `/app` mandaria a pessoa recém
  confirmada de volta às boas-vindas. `RegistrationService.confirmEmail` faz `authStore.setSession(data.session)` (arquivo
  novo, em `core/auth/`); o papel não é gravado (o `PostAuthNavigator` usa `account.papel`).
- **Confirmar e-mail em espera (T035)**: sem e-mail no estado do roteador, a contagem **não** inicia (só depois de um
  reenvio); o contrato só manda iniciar em 60 s quando há e-mail. Para perceber a sessão aberta em outra aba, a tela chama
  `AuthService.restoreSession()` ao abrir no estado de espera (assina o `onAuthStateChange`; há a ressalva de assinar duas
  vezes se o bootstrap já tinha assinado, o que só acontece com chave de sessão gravada e sessão inválida). **Não verificado
  com navegador e Supabase reais**: no e2e só há prova de que `restoreSession` é chamado (unitário) e de que o efeito chama
  `PostAuthNavigator.go()` quando o store ganha a sessão.
- **Textos que o contrato não traz** (escritos por mim, a confirmar pelo William): mensagens de erro por campo do cadastro
  ("Informe seu nome.", "Use entre 2 e 80 caracteres.", "Informe seu e-mail.", "Informe um e-mail válido.", "Informe seu
  celular.", "Informe um celular com DDD e o 9 na frente, por exemplo (11) 98765-4421.", "Use uma senha com pelo menos 8
  caracteres.", "Use no máximo 72 caracteres.", "Para criar a conta, aceite os Termos e a Política de privacidade."); o aviso
  geral do cadastro (`signup-error`: `weak_password` usa o texto do contrato de recuperação de senha; `rate_limited` e
  `network` reutilizam os textos do login; `invalid`: "Confira os campos destacados e tente de novo."); no modo sem e-mail,
  "Informe o e-mail do seu cadastro e enviamos um novo link de confirmação."; erro de rede ao confirmar: o texto do login.
- **`data-testid` fora da tabela do contrato**: `confirm-email-error` (aviso de rede ao confirmar), `signup-*-error` por campo,
  `welcome-photo`, `login-back`, `legal-*`. Úteis aos testes; nenhum muda os ids do contrato.
- **Botão do Google e divisor "ou" fora do cadastro**: o Google entra na T061; sem ele o "ou" não teria o que separar, então
  também não entrou.
- **Ícone de envelope**: não existe em `shared/icons/faro-icons.ts` (compartilhado, fora do meu escopo). Criei
  `features/auth/shared/status-badge.ts` (círculo de 56 px) com `provideIcons` local (`Envelope` do Boxicons + todos os do
  Faro: o provedor de componente substitui o conjunto global). Avaliar mover o envelope para `faro-icons.ts`.
- **Foto das boas-vindas**: `public/photos/boas-vindas.jpg` não existe. O `<img>` fica invisível até carregar e some se o
  arquivo falhar, então hoje só se vê o fundo `bg-photo`. Quando o William colocar o arquivo, aparece sem mexer no código.
- **`z-button` com `[disabled]`**: no ZardUI do repo, o host sobrescreve o atributo `disabled`; só `[zDisabled]` ou `[zLoading]`
  desabilitam de verdade. Usei `[zDisabled]` nas telas novas. O login atual usa `[disabled]` (herdado; só `zLoading` o
  protege durante o envio).
- **Lint de i18n**: `back`, `backLink` e `form` viram `[back]="'back'"`, `[backLink]="'…'"` e `[attr.form]="'signup-form'"` para
  não pedir `i18n-<atributo>` (são valores técnicos).
- **Rota `/auth` (T033)**: o índice agora é a boas-vindas com `anonGuard`; o redirecionamento provisório para o login saiu.
  Por isso o `authGuard` sem a marca de "já entrou" manda para `/auth?returnUrl=…`; os três e2e de
  `account-foundation.spec.ts` que esperavam o login nessa situação foram atualizados (esperam as boas-vindas) e ganhou um
  teste da marca (`faro.returning`) ⇒ login com `reason=session_expired`.
- **Botão Voltar no login (T037)** preserva o `returnUrl` (a tarefa só diz "para `/auth`"); fica escondido em `xl`, onde a
  referência não tem o botão (o painel de marca ocupa a esquerda).
- **Legal (T032)**: componente de modelo `features/legal/legal-page/` compartilhado pelas duas páginas; build gera
  `dist/faro/browser/legal/{termos,privacidade}/index.html`.

### Verificação

- `npm run lint`: passa. `npm test -- --watch=false`: **61 arquivos, 407 testes** passam (antes da fase: 56 e 345).
- `npm run build:stats`: passa, **pacote inicial 408,81 kB** (110,23 kB transferidos; antes 400,28 kB; orçamento 500 kB).
  `npm run check:ui` e `npm run check:bundle`: ok (a página pública não carrega o app autenticado).
- E2E, backend 100% simulado (`e2e/signup-ui.spec.ts`, 12 testes, e `account-foundation.spec.ts`, 15 testes): sem rolagem
  horizontal em 320, 390, 768 e 1440 px nas boas-vindas, no cadastro, na confirmação (espera e link) e na página legal;
  boas-vindas preservam `returnUrl`; cadastro com erros não envia; cadastro envia `name`, `phone` E.164, `terms_version`,
  `return_to` e `return_to_at`, vai a `/auth/confirmar-email` sem e-mail nem senha na URL; reenvio sem estado; link não
  chama `verifyOtp` ao carregar, o clique chama uma vez e segue para `/auth/celular`; link inválido mostra o estado e os
  dois caminhos. Nenhuma requisição chegou ao projeto hospedado (`blocked` vazio).
- **Não verificado**: o fluxo com o Supabase local e o coletor de e-mail (T039), a prova contra enumeração (T040) e o avanço
  automático por sessão em outra aba.

---

## Frontend — Phases 4 e 5 (T054 a T059, T061 a T063)

Execução de 2026-11-22 pelo subagente `frontend-angular`. Commits: correção do login `e2821e5`; T054 e T055 `765515b`; T056
`6b386d3`; T057 a T059 `6b69eb2` (mais `c0df0b8`, só espaçamento); T061 a T063 `07e4ef3`; e2e `efcb6de`. As `[QA]` T060, T064 e T065
não são do frontend (precisam de Supabase local com navegador, e do Google real).

### Correção fora das tarefas: `[disabled]` no login

`login.html` passou de `[disabled]` para `[zDisabled]` nos botões Entrar e Google. A premissa "o host sobrescreve o atributo" só
se mostra em uma sequência: com `zLoading` ligado e depois desligado, o host (`[attr.disabled]`) remove o atributo e o botão
volta a ficar habilitado **mesmo com `[disabled]` ainda verdadeiro** (caso real: o envio termina com `rate_limited`). O teste novo
`o botão Entrar continua desabilitado em rate_limited depois que o envio termina` falha no código antigo e passa no novo (conferido
trocando o HTML de volta). Os outros dois testes novos (desabilitado em `rate_limited`; Google desabilitado com provedor
indisponível) passam nos dois, porque na primeira renderização o `[disabled]` ainda vale.

### Desvios, decisões e interpretações

- **T054**: `StartResult`/`ConfirmResult` exatamente como o contrato. Resposta que não tem forma reconhecível (código de erro
  desconhecido, `ok:true` sem os campos) também vira `network`. Em sucesso de `confirm`, `AccountService.load(true)`.
- **T055**: `phoneConfirmedGuard` com `import()` dinâmico do `AccountService` (mesma regra do `termsGuard`). O contrato não diz o que
  fazer se a conta não carregar; segui o `termsGuard` (`true`, a regra de verdade é `phone_is_confirmed`). Ainda não está registrado
  em nenhuma rota (é da `003`).
- **T056**: o modo troca (celular já confirmado) é a T085, não entrou. Por isso **não há captura de "trocar celular"**. `reauth_required`
  e `invalid_password` caem em textos do contrato, mas sem o campo de senha e sem o botão do Google (T085). A tela envia o número em
  E.164 (normalizado no cliente; o servidor normaliza de novo). Celular que não é celular brasileiro não chama o servidor e mostra o texto
  de `invalid_phone`. `terms_required` leva a `/auth/termos`.
- **T057/T058**: o contrato não define o que mostrar quando `phone_verification_status()` falha. Criei o estado `load_error`
  (texto de rede, "Tentar de novo" e "Número errado? Corrigir"). Sem verificação ativa mostra "Peça um código para continuar" (o
  contrato só dá o nome do estado e o botão). Os `data-testid` das células (`confirm-phone-cell-1` a `-6`) são colocados pelo
  componente nas `<input>` do `z-input-otp` (o ZardUI não os expõe). `invalid_code` usa o singular quando falta 1 tentativa
  (o contrato diz "tentativa(s)"). O "Reenviar código" do estado normal só aparece quando a contagem zera; nos estados `vencido` e
  `indisponível` é o botão principal. Back da casca aponta para `/auth/celular` sem `returnUrl` na query (o `routerLink` string não
  carrega query); o destino guardado continua no `ReturnUrlService`, e o link "Corrigir" leva o `returnUrl`.
- **T058, tela de bloqueado**: usei a mesma tela de `V2-confirmar-celular-vencido*` para `locked`, `expired` e `no_active`, com o texto de
  cada um no aviso (como a própria referência anota).
- **T059**: depois de `confirmEmail`, `AccountService.load(true)`; com `celularPendente` pede o SMS (`start()`); `ok` leva a
  `/auth/confirmar-celular`, qualquer falha a `/auth/celular`, sempre com `replaceUrl`. O `returnUrl` vem do `ReturnUrlService.peek()`
  ou da query. Se a conta não carregar, segue por `PostAuthNavigator.go()`. O e2e `signup-ui` (link) agora simula a função de SMS.
- **T061**: a falha do OAuth não lança (o `AuthService.signInWithGoogle` registra o erro no `AuthStore`). A tela confere o `status` do
  store depois da chamada e mostra um aviso novo, escrito por mim: "Não conseguimos abrir o Google agora. Tente de novo ou crie a
  conta com e-mail e senha." Os dois botões ficam desabilitados enquanto o redirecionamento acontece.
- **T062**: a referência mostra "Você entrou com o Google" e o e-mail. Para conta sem Google escrevi "Você entrou com seu e-mail" (sem o
  ícone). O aviso de rede do aceite reutiliza o texto do login. O aceite não redireciona quem já aceitou e abre `/auth/termos` à mão.
- **T063**: o `oauth-callback` já cumpria o contrato (T029); só ganhou `oauth-callback.spec.ts` (6 testes: sucesso, cancelamento,
  rede, exceção, sem sessão no store, região de status).
- **Auxiliares novos** em `features/auth/shared/`: `countdown.ts` (contagem com `DestroyRef`) e `wait-time.ts` ("1 hora", "2 horas",
  "alguns minutos" para o `{tempo}` de `rate_limited`).
- **Lint**: `zMode`/`zRole` viram `[zMode]="'numeric'"` e `[zRole]="'status'"` (o lint de i18n pede `i18n-<atributo>` nos atributos
  estáticos). Alertas dos fluxos usam `zRole="status"` dentro de uma região `aria-live="polite"` que existe sempre.
- **Projeção da casca**: elementos `footer` dentro de `@if`/`@switch` precisam estar em blocos de raiz única; por isso `confirm-phone.html`
  tem um `@if` por elemento.

### Verificação

- `npm run lint`: passa. `npm test -- --watch=false`: 502 testes em 67 arquivos (antes da fase: 407 em 61).
- `npm run build:stats`: passa, **pacote inicial 409,06 kB** (110,39 kB transferidos; antes 408,81; orçamento 500). `npm run check:ui`
  e `npm run check:bundle`: ok.
- E2E, backend 100% simulado (nada chega a `*.supabase.co`): `e2e/phone-terms-ui.spec.ts` (15 testes) mais os de `signup-ui`,
  `account-foundation` e `login-ui`: 55 passam. Cobrem informar celular (E.164, `returnUrl`, "Agora não", `rate_limited`), digitar o
  código (teclado), código incorreto (células limpas, foco na primeira), vencido, SMS indisponível, sem número pendente, aceite dos
  termos (de `/app` ao celular), o botão do Google (o pedido de `authorize` com `provider=google` e retorno em `/auth/callback` é
  capturado e barrado) e rolagem horizontal em 320, 390, 768 e 1440 px.
- **Não verificado**: SMS real, Google real, a prova contra os usuários do seed e o preflight CORS das funções (T060, T064, T065), o
  modo troca (T085) e o desafio anti-robô (Phase 10).

---

# Backend e QA — Phases 6 e 7 (T066, T067, T073 a T077)

Execução de 2026-11-22 pelo subagente `backend-supabase`, branch `004-conta-tutor`. Run verde do job `supabase`: 45041533742
(o job `app` desse run falhou no lint de `zRole`, arquivo do frontend; não é desta fase).

## Entregue

- `0016_conta_privacidade.sql`: `export_my_data()` (`authenticated`) e `delete_account_data(uuid, text, text)` (só `service_role`).
  Os dois `EXECUTE` de texto constante com `USING` (funções da 003) estão aqui e só aqui.
- `functions/password-recovery/` (`logic.ts`, `logic.test.ts`, `index.ts`) e `functions/account-delete/` (idem).
  `config.toml`: `verify_jwt = true` nas duas (a chave anônima é um JWT válido, então o visitante chama a recuperação).
- `supabase/tests/conta_privacidade.test.sql` (59 asserções) e a seção T066/T067/T076/T077 de `scripts/ci/supabase-checks.sh`.

## Desvios e decisões

- **T075 sem `finish()`**: o `ROLLBACK TO caso` de cada caso (exigido pela tarefa) desfaz também a tabela de resultados do
  pgTAP, e `finish()` lança `# No tests run!` (exit 3, com "All 59 subtests passed"). O arquivo termina em `ROLLBACK` sem
  `finish()`; o `pg_prove` confere o plano `1..59` e cada `ok`/`not ok` da saída. Uma falha continuaria vermelha.
- **T075 com e sem a 003**: cada caso faz `DROP … IF EXISTS` / `CREATE` dos objetos de mentira. No CI a 003 não existe; o
  ramo "com os objetos reais" só está provado por construção (os `DROP … CASCADE` rodam dentro do `SAVEPOINT`).
- **`delete_account_data` com `p_user_id` nulo** lança `invalid_user` (acréscimo; o contrato não diz).
- **Exclusão, fotos**: a remoção desce em subpastas (profundidade 3) e lista em páginas de 100 antes de remover em lotes de
  100. Bucket inexistente = `404` ou texto "not found" no erro de listagem.
- **Recuperação**: `captcha_token` é aceito e ignorado. Erro do limitador = nada enviado, mesma resposta. Entrada inválida
  nem consulta o limitador e é auditada com `permitido = false`.
- Os limites novos e o repasse do `captcha_token` (Phase 10) não foram feitos.

## Verificação (CI, run 45041533742, job `supabase`)

- pgTAP: 11 arquivos, 388 asserções, `Result: PASS` (eram 10 e 329).
- `deno test`: 135 testes (eram 105), sem permissões.
- `scripts/ci/supabase-checks.sh`: 125 PASS, 0 FAIL (eram 71).
- Provado no stack local: recuperação com e sem conta devolve o mesmo corpo, ambos com piso de 0,6 s e tempos na mesma faixa;
  4º pedido sem e-mail novo e auditado com `permitido = false`; link do e-mail com `/auth/nova-senha?token_hash=` e
  `type=recovery`; nenhum e-mail na auditoria nem no log. Exclusão: `confirmation_required`, `reauth_required`,
  `invalid_password` (usuário e perfil intactos), `rate_limited`, sucesso (usuário e perfil somem, `conta_excluida` com ator
  nulo), fotos sob `<uid>/` removidas (inclusive subpasta) sem tocar a de outra conta, token antigo 401, e-mail volta a
  cadastrar.

## Não verificado

- `deletion_unavailable` e `deletion_hook_missing` pela Edge (só pelo pgTAP: não há como criar `tag_assignments` no CI).
- Conta só com o Google (`reauth_required` com `method: google`): só nos testes unitários de `reauth.ts`.
- `Allow-Origin` da função (Kong local, mesma ressalva da T021); `EdgeRuntime.waitUntil` só no `functions serve` local.
- O T075 contra os objetos reais da 003.

---

# Backend — Phase 10 (T097 a T102)

Execução de 2026-11-22 pelo subagente `backend-supabase`, branch `004-conta-tutor`. Tarefas `[BE]`: T097, T098, T099, T100, T101, T102.

## Entregue

- `0017_endurecimento_base.sql`: dois comandos de privilégios padrão para funções (`FOR ROLE postgres REVOKE EXECUTE … FROM PUBLIC` e
  `… IN SCHEMA public REVOKE EXECUTE … FROM anon, authenticated`), `REVOKE ALL` de tabelas e sequências novas para `anon`, e a devolução do
  padrão antigo (`GRANT EXECUTE … TO PUBLIC`) ao schema `extensions`; `ALTER FUNCTION … SET search_path = public, pg_temp` nas quatro
  funções da 001; `REVOKE ALL` em todas as tabelas e sequências de `public` para `anon`; `REVOKE ALL` de `auth_login_attempts` para
  `authenticated`; `REVOKE INSERT, UPDATE, DELETE, TRUNCATE` de `auth_audit_log` para `authenticated` (o `SELECT` fica);
  `statement_timeout` de 3 s (`anon`) e 8 s (`authenticated`); `DROP EXTENSION IF EXISTS pg_graphql`. `config.toml`: `[api] schemas = ["public"]`;
  `max_rows` continua 1000.
- `supabase/tests/security_catalog.test.sql` (38 asserções): as cinco condições do portão são views em `tests` (uma consulta por condição,
  usada no estado limpo e nos casos negativos). Cada condição reprova o objeto ruim criado num `SAVEPOINT` (tabela sem RLS; privilégio de tabela
  e de coluna para `anon`; `EXECUTE` por `GRANT` direto e herdado de `PUBLIC`; `security definer` sem `search_path`; `USING (true)` para
  `authenticated`; `WITH CHECK (true)` para `PUBLIC`) e há controles que NÃO devem ser acusados (com `search_path`, `security invoker`,
  política por dono). Também prova: função criada sem `GRANT` não é executável por `authenticated` nem por `anon` (catálogo e chamada real,
  `42501`); tabela criada sem `GRANT` sem privilégio de `anon`; `search_path` das quatro funções; `statement_timeout` por papel lido de
  `pg_db_role_setting`; `pg_graphql` ausente; o que `authenticated` mantém em `perfis` e `auth_audit_log`.
- Edge Functions: `_shared/http.ts` (`readJsonObject(req, maxBytes = 4096, allowedKeys?)` com resultado discriminado, `bodyErrorResponse`,
  `guardMethod`), `_shared/limits.ts` (`checkLimit`), `_shared/captcha.ts` (`parseCaptchaToken`, `isCaptchaFailure`), `_shared/testing.ts`
  (falsos só de teste), `_shared/reauth.ts` (`captchaToken`, erro `captcha_failed`, `reauthFailureBody`). As quatro funções da spec e o
  `login-guard` ganharam `handler.ts` (`createHandler(deps)`), e o `index.ts` só liga as dependências reais. `deno.json`, `deno.lock`,
  `scripts/ci/edge-deps-check.sh` e dois passos no `ci.yml`.
- `config.toml`: rotação de refresh token (`true`, reuso 10 s), entrada anônima e vínculo manual desligados, `[auth.captcha]` com
  `enabled = false`, `provider = "turnstile"` e `secret = "env(SUPABASE_AUTH_CAPTCHA_SECRET)"`.

## Alterações em asserções da 001 (nenhuma removida; planos iguais)

- `rls_auth_audit.test.sql`: "anon não lê nenhuma linha de auth_audit_log" era `is_empty`; agora `throws_ok(…, '42501')`.
  "nem o admin lê nenhuma linha de auth_login_attempts" era `is_empty`; agora `throws_ok(…, '42501')`.
  "admin pode SELECT em auth_audit_log" era `lives_ok(SELECT COUNT(*))`; agora `ok(COUNT(*) WHERE ip_hash = 'hash_semente' >= 1)`, mais forte
  (prova que lê a linha-semente). A leitura do tutor comum continua `is_empty` com a linha-semente.
- `rate_limit.test.sql`: "authenticated não lê nenhuma linha de auth_login_attempts" era `is_empty`; agora `throws_ok(…, '42501')`.
- Sete arquivos de teste ganharam uma linha (`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC`)
  porque os auxiliares `tests.*`, criados dentro da transação, são chamados depois de `SET ROLE anon/authenticated` e perderam o
  `EXECUTE` herdado de `PUBLIC`.

## O que o portão de catálogo acusou

Nada de real nas migrations 0001 a 0016 depois da 0017: o primeiro run (com a 0017) já passou nas cinco condições. Antes da 0017 as
quatro funções da 001 tinham `search_path = public` (sem `pg_temp`; o portão exige só `search_path` fixo, então já passariam) e `anon` tinha
`GRANT` nas três tabelas da 001 (condição 2): a 0017 resolve a segunda.

## Desvios e decisões

- **Papel dono das migrations**: é `postgres` (o diagnóstico do teste imprime `current_user=postgres` e `schema do pgTAP=extensions`).
  Os dois comandos do contrato funcionaram sem repetição para outro papel.
- **`DROP EXTENSION pg_graphql`** funcionou como `postgres` no stack local (a 0017 aplica sem erro).
- **Esquema `extensions`**: acrescentei `ALTER DEFAULT PRIVILEGES … IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO PUBLIC`. Não está no
  contrato; evita que extensão instalada depois (pgTAP em `supabase test db`, por exemplo) nasça sem `EXECUTE` para os papéis da API.
- **`login-guard`**: `user_id`, `user_agent` e `detail` continuam **aceitos** no corpo (o `AuthService` da 001 os envia); o `user_id` é
  ignorado e o `detail` é filtrado. Chave fora de `phase, email, success, user_id, user_agent, detail` ⇒ `400 unknown_field`. O 405 mantém o
  formato `{ error }` da 001. O limite `guard:ip:m` é contado antes de ler o corpo (toda chamada). Sem sal ⇒ `500 { error: "misconfigured" }`.
- **Contagem dos limites novos**: `otp:confirm:h` e `acct:delete:h` contam depois de autenticar e ler o corpo (400/413/401 não contam) e antes de
  qualquer conferência. `recover:calls:ip` conta antes de ler o corpo (toda chamada, inclusive `400`), e o estouro responde `{ ok: true }` com o
  piso de tempo, sem auditoria nem e-mail.
- **`rate_limited` no `phone-verify-confirm` e no `account-delete`**: `{ ok: false, error: "rate_limited", retry_after_seconds }`. Erro do
  limitador também devolve `rate_limited` (falha fechada), com 60 s. O contrato `phone-verify-confirm.edge.md` não listava `rate_limited`
  (não editei contratos).
- **`password-recovery` e `captcha_failed`**: o contrato de recuperação diz "responde sempre igual", e o de endurecimento diz que o erro de
  desafio do Auth vira `captcha_failed`. Resolvi assim: o envio roda em segundo plano, mas a função espera o que vier primeiro, o Auth ou o piso
  de 600 ms; se o Auth recusar o desafio nesse intervalo, responde `{ ok: false, error: "captcha_failed" }` (HTTP 200) **depois** do piso. Como
  o Auth confere o desafio antes de procurar a conta, isso não revela nada sobre ela. Qualquer outro erro do Auth continua `{ ok: true }`.
- **`readJsonObject`**: mudou de `Record | null` para `{ ok: true, body } | { ok: false, status, error }` (413 vs 400 vs `unknown_field`). O teste
  antigo do `readJsonObject` foi reescrito em vários (mesmos casos, mais os novos).
- **`deno.json`**: o código importa `https://esm.sh/@supabase/supabase-js@2.108.1` por URL exata (a CLI não garante ler um `deno.json`
  global); o `deno.json` espelha a versão e o `edge-deps-check.sh` confere que são iguais. Passo do CI: `deno test --config … --lock=…` e
  `git diff --exit-code` no lock.
- **T101, chaves de teste do Turnstile** (copiadas da documentação da Cloudflare, "Testing", em 2026-11-22): site key que sempre aprova
  `1x00000000000000000000AA`, que sempre reprova `2x00000000000000000000AB`; invisíveis `1x00000000000000000000BB` e `2x00000000000000000000BB`;
  interativa `3x00000000000000000000FF`; secret que sempre aprova `1x0000000000000000000000000000000AA`, que sempre reprova
  `2x0000000000000000000000000000000AA`, "token já gasto" `3x0000000000000000000000000000000AA`. Estão nos comentários do `config.toml`
  (públicas). O segredo de produção só entra por `SUPABASE_AUTH_CAPTCHA_SECRET`.
- **A CLI 3.2.0 aceitou** `[auth.captcha]` (`enabled`, `provider`, `secret`) e as quatro chaves de rotação/anônimo/vínculo manual: o
  `supabase start` subiu sem aviso de chave desconhecida (só os avisos já conhecidos de `enable_signup`). O container do Auth ficou com
  `GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true`, `…_REUSE_INTERVAL=10`, `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=false`,
  `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=false`, `GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile` e `GOTRUE_SECURITY_CAPTCHA_ENABLED=false`
  (conferido por `docker inspect` no script de CI).
- **Refresh token reutilizado**: o GoTrue v2.198 respondeu 200 quando se reusou um refresh token de duas gerações atrás, mesmo com a rotação
  ligada na configuração efetiva. A conferência virou a leitura da configuração efetiva do container; o reuso ficou como informação no log.
  Se o William quiser a revogação por reuso, é comportamento do Auth hospedado a conferir no painel.
- **Flake do coletor de e-mail**: em 2 de 9 runs da fase, o primeiro e-mail do stack recém-subido saiu com o link padrão do Supabase
  (`/auth/v1/verify?token=…&type=signup`) em vez do modelo do repositório (T004: 3 FAIL), e o run seguinte com o mesmo código passou. Acrescentei
  um aquecimento antes do T004 (até 6 tentativas) que imprime quantas foram necessárias.

## Verificação (CI, run 45045717699, commit b0aee9f)

- pgTAP: 12 arquivos, 426 asserções, `Result: PASS` (eram 11 e 388; `security_catalog.test.sql` acrescenta 38).
- `deno test`: 211 testes (eram 135), sem permissões, com `--config` e `--lock`; o lock não mudou.
- `scripts/ci/supabase-checks.sh`: 154 PASS, 0 FAIL (eram 125).
- `scripts/ci/edge-deps-check.sh`: 5 PASS (nenhum import com versão flutuante em 20 imports; `grep` vazio).
- Job `app` verde no mesmo run.

## Não verificado

- `Allow-Origin` das funções (Kong local, mesma ressalva da T021) e `EdgeRuntime.waitUntil` fora do `functions serve`.
- O desafio real: `[auth.captcha]` está desligado; o repasse do token foi provado só com falsos (o Auth local não valida token com o desafio
  desligado). Quem liga é a T104; a prova ponta a ponta é a T108.
- `max_rows` em 1000 com a geração de lote de 540 códigos (nenhuma função da 003 existe ainda).
- Painel do Supabase/hospedado: valores de `contracts/auth-config.contract.md` e proteção contra senha vazada (plano Pro) ficam no checklist.
- O `statement_timeout` por papel está provado no catálogo (`pg_db_role_setting`), não por uma consulta lenta real.
