# Registro de execução: 003-tag-qr

## Backend: fundação (T001, T004, T006, T007 a T023; 2026-11-22)

Executado na branch `003-tag-qr` (PR em rascunho nº 5), sem Docker, sem CLI do Supabase e sem Python na máquina: toda
verificação de banco e de Edge Function foi no CI. Não foi tocado nenhum projeto Supabase hospedado.

### Migrations criadas

| Migration | Conteúdo |
|---|---|
| `0020_pets_e_perfil_resgate.sql` | `pets`, `rescue_profiles`, gatilhos (`updated_at`, criação do perfil, regra do celular confirmado), RLS e privilégios de coluna |
| `0021_tag_batches_e_codes.sql` | `tag_normalize`, `tag_check_digit`, `tag_is_valid`, `tag_format`; `tag_batches`; `tag_codes` com CHECKs e gatilhos de imutabilidade |
| `0022_tag_assignments_e_pin_attempts.sql` | `tag_assignments` (índices únicos parciais) e `tag_pin_attempts` |
| `0023_pending_activations_e_rate_limits.sql` | `pending_activations`, `rate_limits`, `rate_limit_hit` |
| `0024_scan_events.sql` | `scan_events` (privilégio por coluna) e a visão `my_scans` |
| `0025_tag_replacement_requests.sql` | pedidos de segunda via |
| `0026_audit_log.sql` | `audit_log` (só inserção) e `audit(...)` |
| `0027_funcoes_tag.sql` | `can_link_tag`, `new_activation_pin`, `end_assignments_for_account`, `export_tutor_tag_data` |

### Decisões e desvios

1. **Seed sem PIN conhecido (desvio de `data-model.md`).** O data-model diz que os PINs do seed são "conhecidos". A regra 13 das
   tarefas e a regra do repositório público (PIN nunca em arquivo versionado) vencem: o trecho do seed chama
   `new_activation_pin()` ao carregar o banco, guarda só o hash bcrypt de custo 12 e descarta o PIN. Para ativar um código
   `available` em teste de ponta a ponta, o admin reemite o PIN (`admin_reissue_pin`, ainda por fazer); os testes pgTAP geram o
   próprio PIN dentro da transação. As tarefas que falam em "PIN de desenvolvimento" (T040 em diante) precisam disso.
2. **Lote do seed é `lote-900`, não `lote-teste`.** O CHECK da tabela é `id ~ '^lote-[0-9]{3,}$'` (data-model) e não foi alargado
   para um dado de exemplo. `admin-create-batch` deve calcular o próximo id pelo maior número; em desenvolvimento o próximo
   lote criado será `lote-901`.
3. **Paçoca = `7K3M-Q9XA-C`** (corpo `7K3MQ9XA` + `checkDigit`, vetor sintético). Os outros cinco códigos vêm de `newCode` com uma
   fonte de bytes determinística (SHA-256 de um contador) e nunca repetem um vetor dos testes. `e2e/fixtures/seed-codes.json`
   traz `assigned`, `available`, `available2`, `available3`, `blocked`, `void` (forma canônica) e `display` (forma `XXXX-XXXX-X`).
4. **`tag_normalize` só faz ASCII** (a–z para maiúsculas; remove `-`, espaço, TAB, LF, VT, FF, CR). O TypeScript faz o mesmo, sem
   `toUpperCase()` Unicode: com ele, `ß` virava `SS` e uma entrada de 8 caracteres passaria a ter 9. Vale como parte do contrato
   de equivalência (vetores e testes próprios nos dois lados).
5. **`tag_is_valid(NULL)` devolve `false`** (numa CHECK, NULL passaria). `tag_format` devolve `NULL` para entrada inválida (o
   TypeScript lança erro).
6. **CHECK a mais em `tag_codes.activation_pin_hash`**: só `$2[abxy]$12$…` (bcrypt custo 12). Um PIN em texto ou um hash de outro
   custo é recusado pelo banco.
7. **Privilégios.** Depois da 0017, tabela nova nasce sem acesso de `anon`, mas com todos os privilégios padrão de `authenticated`:
   toda tabela começa com `REVOKE ALL … FROM PUBLIC, anon, authenticated` e recebe só os GRANTs (de coluna) do contrato; `service_role`
   recebe GRANT explícito (em `audit_log`, só `SELECT` e `INSERT`: nem `service_role` altera ou apaga).
   - `tag_codes`: nenhum privilégio e nenhuma política para `authenticated` (o admin lê por RPC, sem o hash).
   - `scan_events`: `authenticated` só tem `SELECT` nas colunas sem `ip_hash`, `location_token_hash`,
     `location_token_expires_at`, `notified_at` e `notify_attempts`. Por isso `SELECT *` em `scan_events` falha para o tutor e para o
     admin (a lista de colunas inclui uma proibida); o app usa `my_scans`.
   - `my_scans` é `security_invoker = true` (a RLS de `scan_events` vale para quem consulta) e traz também `pet_id`.
   - `pet_temperament_ok(text[])`, usada na CHECK de `pets`, é a única função com EXECUTE para `authenticated` (a CHECK roda com
     o papel de quem grava).
8. **`rate_limit_hit(scope, key, limit, window_seconds)`** devolve `true` quando ESTOUROU (a chamada conta a si mesma: com limite
   30, a 31ª devolve `true`). A janela é fixa, alinhada a múltiplos de `window_seconds` desde a época. Só `service_role`
   (as funções `security definer` a chamam como dono).
9. **`audit_log`**: `event` é texto livre (sem CHECK enumerando eventos: `account_tags_released` e `global_rate_limit`, dos
   contratos, não estão na lista do data-model). Há uma CHECK que recusa, no primeiro nível de `detail`, as chaves `pin`,
   `new_pin`, `activation_pin`, `pin_hash`, `activation_pin_hash`, `ip`, `ip_hash`, `phone`, `celular`, `token`, `password`,
   `senha`. `audit()` pega ator e papel do JWT (`auth.uid()`, `auth.role()`); `end_assignments_for_account` grava direto na
   tabela, com ator nulo, como manda o contrato.
10. **`end_assignments_for_account`** só registra `account_tags_released` quando encerrou algum vínculo (a segunda chamada devolve 0
    e não repete o evento). Além do contrato, também zera `location_token_hash` e `location_token_expires_at` dos scans do tutor:
    sem isso, um token ainda válido permitiria gravar localização depois da exclusão. Contadores de PIN são zerados também nas
    tags `blocked`; o status delas não muda.
11. **`export_tutor_tag_data`**: `temperamento` sai como texto (itens separados por vírgula), como no exemplo do contrato.
12. **Teste da 004 reescrito sem enfraquecer** (`conta_estado_inicial.test.sql`): a asserção "nenhuma tabela de tags existe"
    quebra por construção quando a 003 chega. Passou a conferir o TEXTO das migrations 0001 a 0017 no registro do CLI
    (`supabase_migrations.schema_migrations.statements`): nenhuma cria `tag_codes`, `tag_batches`, `tag_assignments`,
    `scan_events` ou `pets`. Uma asserção a mais garante que o registro guarda os comandos (a prova não passa vazia).
    14 → 15 asserções. `conta_privacidade.test.sql` não precisou de mudança.
13. **Recomendação, fora desta fase**: o tutor tem `DELETE` em `pets`. Apagar um pet com vínculo ativo deixaria o vínculo com
    `pet_id` nulo (a FK é `set null`) e a tag ainda `assigned`. O contrato manda o app chamar `release_tag` antes; a defesa no
    banco (gatilho que recusa o `DELETE` com vínculo ativo) não foi criada porque o teste da 004 recria `tag_assignments` de
    mentira e não é claro como o gatilho conviveria com ele. Deixo para a fase de `release_tag` decidir.
14. **TypeScript e testes extras**: além de T008 e T011, `tag-code.sql-sync.spec.ts` confere que o bloco de vetores embutido em
    `supabase/tests/tag_code.test.sql` é igual ao JSON, e `_shared/tag-code.test.ts` (deno) roda a cópia das Edge Functions contra
    os mesmos vetores.
15. **T023**: `auth.ts` (chave do SSR em tempo constante, já com lista de chaves e `FARO_SSR_KEY_PREVIOUS`; chave com menos de
    32 caracteres ou ausente: 500; `requireAdmin` com `getCaller` e `is_admin()` injetados), `responses.ts` (sem CORS: chamada
    de servidor para servidor; 401 de corpo vazio) e `supabase.ts` (as ligações reais; não é importado por nenhum arquivo com
    teste, como `clients.ts`). `loadEnv` não mudou.

### Nada de segredo ou PIN em arquivo versionado

Os testes pgTAP geram PINs com `new_activation_pin()` dentro da transação; os códigos de teste são vetores sintéticos
(`contracts/tag-code.vectors.json`) e os do seed. O teste local contra os 54 códigos do lote-001 é pulado quando
`tools/tag-generator/lote-001/codes.txt` não existe (CI): mensagem "lote-001 ausente (arquivo fora do git)".

## Verificação (CI, run 45050682153, commit ad3775f)

- pgTAP: 17 arquivos, 732 asserções, `Result: PASS` (eram 12 arquivos e 426 asserções no fim da 004; novos: `account_tags`,
  `tag_code` (45), `rls_tags_base` (129), `tags_funcoes_base` (53), `seed_tags` (17); `conta_estado_inicial` foi de 14 para 15).
  `conta_privacidade.test.sql` e `security_catalog.test.sql` da 004 passaram sem mudança, com os objetos reais da 003 presentes.
- `deno test`: 237 testes, sem permissões, com `--config` e `--lock`; o lock não mudou. `edge-deps-check.sh` passou.
- `scripts/ci/supabase-checks.sh`: 182 PASS, 0 FAIL (eram 154); a seção nova confere que `anon` recebe 401/403 em cada tabela e
  visão de tag e nas duas funções de conta, e que os códigos de `e2e/fixtures/seed-codes.json` estão no banco com o status certo
  (`select count(*) from tag_codes` = 6).
- Job `app`: 79 arquivos e 641 testes passaram, 1 pulado (o teste local dos 54 códigos do lote-001, ausente no CI), lint e build verdes.
- Histórico de execuções do CI desta fase: 4 (um erro de digitação em `DO $$` no teste das funções, corrigido em dois passos).

## Não verificado

- Os 54 códigos reais do lote-001 contra `isValid` (TypeScript e SQL): o arquivo `codes.txt` não existe aqui nem no CI.
  A conferência de T011 nesse trecho só roda na máquina de quem tem o lote (o procedimento de `docs/importar-lote-001.md` a exige).
- `docs/importar-lote-001.md` nunca foi executado contra um banco real (nem local).
- "Alterar um caractere faz o teste de sincronia falhar" (T009): provado pelo comparador (`firstDifference`) sobre cópias
  alteradas dentro do teste; não foi alterado um arquivo de verdade para ver o vermelho no CI.
- Concorrência (duas ativações simultâneas) e `resolve_tag`: não existem ainda.

## Backend: Phases 3 a 6 (T026 a T028, T036, T038, T039, T050 a T053, T058, T059; 2026-11-22)

Mesmo ambiente da fundação (sem Docker, CLI ou Python locais; verificação no CI, PR nº 5). Nenhum projeto hospedado foi tocado.
`deno test` e `deno check` rodados localmente antes do push.

### Migrations e funções

| Migration | Conteúdo |
|---|---|
| `0028_rpc_resolve_tag.sql` | `resolve_tag(character, text)` (só `service_role`), `url_encode_utf8` |
| `0029_rpc_ativacao.sql` | `check_tag_for_link`, `activate_tag`, `set/get/clear_pending_activation` (`authenticated`); internas `tag_err`, `rate_retry_after` |
| `0030_rpc_scans.sql` | `register_scan`, `set_scan_location`, `scan_notices_pending`, `scan_notice_sent`, `scan_notice_info` (só `service_role`) |
| `0031_rpc_tutor.sql` | `set_lost_mode` (T059); recebe `my_dashboard`, `release_tag` e `request_tag_replacement` nas fases deles |
| `0032_storage_pet_photos.sql` | bucket privado `pet-photos` e 4 políticas por prefixo `<uid>/` (sem limite de tamanho/tipo: entra na 0035) |
| `0033_cron.sql` | `pg_cron`, `pg_net`, jobs `faro-resend-scan-notices` (5 min) e `faro-cleanup-tags` (diário) |

Edge Functions: `resolve-tag`, `register-scan` (`handler.ts` testável + `index.ts`), `_shared/email.ts` (porta, `TODO(EMAIL_PROVIDER)`), `_shared/email-templates.ts`.

### Decisões e desvios

1. **PINs de desenvolvimento no seed (decisão do William, 2026-11-22).** A regra "nenhum PIN em arquivo versionado" protege PINs reais. As três tags `available` do `lote-900` (sintético, só banco local e CI) têm PIN fixo derivado por SHA-256, em `e2e/fixtures/seed-codes.json` (`devPins`), gerado por `make-seed.ts`; no banco só o hash. Comentários no seed e no fixture dizem isso. As outras três tags recebem PIN aleatório descartado. O script de CI confere: `devPins` só para as 3 `available`, e nenhum código do lote-900 (nem forma de exibição) nem PIN de desenvolvimento fora de `supabase/seed.sql`, `e2e/`, testes. O vetor `7K3M-Q9XA-C` fica fora da verificação (documentado em todo o repositório). Isto substitui o desvio 1 da fundação.
2. **`state: "assigned"`, não `rescue`.** O contrato manda `assigned`; o enunciado da execução dizia `rescue`. Vale o contrato.
3. **`verify_jwt = false` em `resolve-tag` e `register-scan`.** O contrato não diz. O servidor SSR não tem chave do Supabase (só `FARO_SSR_KEY` e `IP_HASH_SECRET`), então o gateway não pode exigir JWT; a autorização é `x-faro-ssr-key` em tempo constante, 401 vazio sem ela. Confirmado no CI: o gateway local aceita a chamada só com a chave.
4. **Falha da RPC, da entrada ou resposta fora do formato em `resolve-tag`** devolve 200 `{"state":"rate_limited"}` (leva à contingência), nunca `not_found` nem 5xx. Piso de 150 ms nos três estados que não são o resgate, inclusive dígito inválido e falha.
5. **Pendência para o William: `photo_path` é `<tutor_id>/<pet_id>/…`** e a URL assinada carrega esse caminho. Bate com o contrato, mas expõe ids internos na URL da foto, apesar de "nenhum identificador interno". Não alterado.
6. **`activate_tag`**: ordem do contrato. No passo 4 o bloqueio só vale para tag `available`, para `locked` nunca revelar tag vinculada, bloqueada ou anulada. PIN fora do formato ou nulo conta como `wrong_pin`; o hash é conferido sempre. Troca (`p_replace`): vínculo anterior `released`, tag anterior volta a `available` mantendo o hash; se a inserção falhar por `unique_violation` depois de uma troca, relança para desfazer. O limite de 30 chamadas em 15 min (`rpc_guard`) é da Phase 12, não feito.
7. **`get_pending_activation`** devolve `{"ok":true,"code":"…"}` ou `{"ok":true,"code":null}` (13A). **`set_lost_mode`** devolve `{"ok":true}`; só `p_on` nulo lança (erro de programação); recado acima de 280 cai na CHECK da tabela (exceção).
8. **`register_scan`**: parâmetros separados (`p_viewer`, `p_geo_lat/lng/city/region`) em vez de um objeto `geo`. Deduplica por código + `ip_hash` + mesmo vínculo (scan do vínculo antigo nunca é reaproveitado). Token novo a cada duplicado sem GPS (só o hash fica). A primeira tentativa de aviso é contada no banco; o reenvio reserva (soma tentativa) scans com mais de 2 min, até 3 tentativas, 24 h. Sem provedor de e-mail o reenvio não reserva nada.
9. **E-mail**: drivers `log` e `stub` só com `FARO_ENV` local/test; `log` escreve só o assunto. Sem provedor o scan é gravado do mesmo jeito. Modelos sem coordenadas, IP ou dado de quem escaneou.
10. **`0033`**: URL das funções e chave do reenvio vêm do Vault (`faro_functions_url`, `faro_ssr_key`), criados pelo operador; sem eles o job não faz nada. O operador precisa criá-los para o reenvio funcionar em produção.
11. **T058**: usa as RPCs reais, mas a liberação da tag pela tutora A é escrita direta (o estado que `release_tag` deixa), porque `release_tag` é T087. Trocar quando T087 chegar.
12. **Teste do storage** não faz DELETE direto em `storage.objects` (versões novas do Storage o bloqueiam por gatilho; não verificado aqui): a política de DELETE é conferida pelo catálogo.
13. **Concorrência real** não cabe em pgTAP: o script de CI dispara 4 ativações em paralelo da mesma tag (PIN de desenvolvimento): 1 sucesso, 3 `tag_unavailable`.

### Formas de resposta (para o frontend)

- `resolve-tag` (200 sempre que autorizado): `{"state":"assigned","profile":{code, pet:{name, photo_url?}, temperament?[], care_notes?, tutor_first_name?, whatsapp_url?, phone_display?, lost?:{since?, reward?:true, message?}}}` | `{"state":"available","code"}` | `{"state":"not_found"}` | `{"state":"rate_limited"}`. Campo desligado não aparece.
- `register-scan`: `scan` devolve `{"owner":true}` ou `{"owner":false,"scan_token"?}`; `location` devolve `{"updated":bool}`; `resend` devolve `{"sent":n,"failed":m}`.
- RPCs do tutor: `{"ok":true,…}` ou `{"ok":false,"error":<código>,"retry_after_seconds"?}`. `check_tag_for_link`: `invalid_code`, `tag_unavailable`, `locked`. `activate_tag`: `invalid_code`, `phone_not_confirmed`, `pet_not_found`, `locked`, `tag_unavailable`, `wrong_pin`, `not_entitled`, `pet_has_tag`; sucesso `{ok, code, pet_id, pet_name, whatsapp_enabled}`. `set_lost_mode`: `pet_not_found`, `no_active_tag`. `locked` por PIN traz 900 s (conta) ou 86400 s (tag).

### Verificação (CI, run 45054880601, commit c456712)

- pgTAP: 23 arquivos, 1094 asserções, PASS (eram 17 e 732). Novos: `rpc_resolve_tag` (53), `rpc_activate_tag` (101), `rpc_register_scan` (100, inclui `cron.job`), `rpc_set_lost_mode` (46), `rls_scans` (39), `storage_pet_photos` (20); `seed_tags` 17 para 20.
- `deno test`: 302 testes (eram 237); lock inalterado.
- `supabase-checks.sh`: 242 PASS, 0 FAIL (eram 182). Inclui corrida (1 sucesso e 3 `tag_unavailable`), `rate_limited` na 31ª chamada, cabeçalhos idênticos de bloqueado, anulado e inexistente, e aviso gravado com `notified_at` pelo driver `log`.
- Job `app`: 641 testes, 1 pulado, verde.
- Tempo de uma verificação de PIN (bcrypt custo 12, média de 5, T039): 229 ms no CI (run 45505863780).
- Execuções de CI nesta fase: 4 (as duas primeiras falharam por erro de teste e uma verificação do script que dependia de fração de segundo; corrigidos). Último verde: run 45505863780, commit 5deb311.

### Não verificado

- URL assinada de foto com Storage real (só teste unitário com falso).
- E-mail real: não há provedor (`TODO(EMAIL_PROVIDER)`).
- Job de reenvio chamando a função por `pg_net` com Vault configurado.
- T057 (e2e de navegador) não é desta execução.
