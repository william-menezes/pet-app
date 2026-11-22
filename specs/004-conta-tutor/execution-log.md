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
