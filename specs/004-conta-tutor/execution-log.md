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
