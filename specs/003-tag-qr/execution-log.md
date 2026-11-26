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

## Backend: Phases 8 a 12 (T068, T075, T076, T086, T087, T101, T102, T103, T105; 2026-11-24 e 25)

Mesmo ambiente (sem Docker, CLI ou Python locais; verificação no CI, PR nº 5). Nenhum projeto hospedado foi tocado. O trabalho
foi feito por dois agentes: o primeiro escreveu as migrations 0031 (parte nova), 0034 e 0035, as Edge Functions e os testes, e
parou com o CI vermelho; o segundo corrigiu, revisou cada tarefa contra o "Feito quando" e fechou.

### O que quebrava no CI e como ficou

`admin_list_batches` (0034) usava `count(...) FILTER` dentro de `jsonb_agg(jsonb_build_object(...))` na mesma consulta:
`aggregate function calls cannot be nested`. Só `rpc_admin.test.sql` caiu (7 de 128 asserções rodaram). Corrigido na própria
0034 (ainda não tinha passado no CI): subconsulta que agrupa por lote e o `jsonb_agg` por fora. Sem outra mudança de teste.

### Migrations e funções

| Migration | Conteúdo |
|---|---|
| `0031_rpc_tutor.sql` (parte nova) | `my_dashboard` (T068); `release_tag` e `request_tag_replacement` (T087); gatilho `pets_guard_delete` (recusa apagar pet com vínculo ativo, `pet_has_active_tag`) |
| `0034_rpc_admin.sql` | `admin_list_batches`, `admin_list_codes`, `admin_code_detail`, `admin_set_status`, `admin_reissue_pin`, `admin_end_assignment`, `admin_resolve_replacement`, `admin_scan_queue`, `admin_audit`, `admin_dashboard_counters`, `admin_export_codes` (T086), `admin_insert_batch` e `admin_mark_package_downloaded` (só `service_role`), auxiliar `tutor_short_name` |
| `0035_endurecimento_tags.sql` | `rpc_guard`, `rate_hit_audited`, `global_rate_hit`, `admin_rate_hit`; gatilhos `pets_guard_limit` (20 pets) e `replacement_requests_guard_limit` (3 pedidos abertos); limites do bucket `pet-photos` (5 MB; jpeg, png, webp); redefinição de `activate_tag`, `set_lost_mode`, `set/get/clear_pending_activation` com a guarda no começo |

Edge Functions: `admin-create-batch` (`handler.ts` testável + `index.ts`; `verify_jwt = true` e `requireAdmin` por dentro), `_shared/qr.ts`
(matriz do QR v3-H e `chooseMask`), `_shared/zip.ts` (ZIP sem compressão). `resolve-tag` e `register-scan` ganharam o teto global e
(no `register-scan`) os limites por `ip_hash`. Documento novo: `docs/producao-tags.md`.

### Decisões e desvios

1. **Id do lote.** `admin_insert_batch` usa o maior número da faixa 1 a 899, no mínimo 2 (`lote-002` mesmo sem o lote-001 no banco);
   900 a 999 são do seed e de testes e não contam; acima de 899: `batch_range_exhausted`. Provado em pgTAP (o seed tem `lote-900`) e
   pelo gateway no script de CI (`X-Batch-Id: lote-002`, depois `lote-003`).
2. **Máscara do QR.** `chooseMask` (penalidade) vale só para lotes novos. O lote-001 nunca recebe máscara calculada: ela é lida das
   etiquetas impressas (`docs/importar-lote-001.md`, passo 1). O texto do fim desse documento sugeria que `admin-create-batch` "gera
   máscaras" para qualquer lote; foi reescrito. Nada no código atribui máscara ao lote-001. A conferência da matriz contra o `segno`
   do script é a T085 (bloqueada).
3. **Pacote só com `pins.csv`** (cabeçalho `code,pin`, código em exibição) até a etiqueta existir (T084). O segundo pedido do pacote
   é recusado pelo banco (`package_already_downloaded`); o PIN em claro só existe na memória da função e no corpo da resposta.
4. **Erro de negócio é retorno, nunca exceção (13A).** Exceções que sobram, de propósito: `p_on` nulo, `p_reason` e `p_kind`
   inválidos (erro de programação) e os gatilhos de tabela (`pet_limit`, `replacement_limit`, `pet_has_active_tag`,
   `tag_code_never_deleted`): tabela não tem como devolver `{"ok":false}`.
5. **`rpc_guard`** não conta sem sessão (`auth.uid()` nulo); com sessão toda chamada conta, inclusive as que falham antes do PIN.
   Escopos: `activate_calls` 30 em 15 min (`locked`); `tutor_write_min` 30/min e `tutor_read_min` 120/min (`too_many_requests`).
   Admin: `admin_reissue_hour` e `admin_end_hour` 60/h, `admin_batch_hour` 10/h. Estouro grava **um** evento por janela
   (`admin_rate_limited`, `global_rate_limit`).
6. **`release_tag`** mantém `blocked` se a tag estava bloqueada (só o vínculo acaba), desliga o modo perdido, zera contadores e
   tentativas, gera PIN novo (hash bcrypt custo 12) e devolve `new_pin` uma vez; auditoria `tag_released` só com o motivo.
   `request_tag_replacement('lost')` anula o código na hora (`void`).
7. **Teste do T068 usa uma "Ana" sintética** (como todos os pgTAP, que não podem depender do seed), não o usuário do seed.
8. **T076, "PIN do CSV ativa o código":** o pgTAP prova pela RPC (`admin_insert_batch` + `activate_tag`); o script de CI prova de
   ponta a ponta pelo gateway (admin do seed cria lote de 3, lê `pins.csv`, ativa um código com a Ana, confere que o PIN não está
   no log da função nem na auditoria, nem em tabela).
9. **Custo do lote grande (risco não medido).** Cada código custa um bcrypt de custo 12 (cerca de 0,2 s no CI). Um lote de 500 faz
   cerca de 100 s numa única transação, que pode estourar o tempo do PostgREST ou da Edge Function. Lote de 54 (o caso real) fica em
   cerca de 11 s. Se for preciso 500, gerar em fatias ou subir o timeout; não foi alterado nem medido.

### Formas de resposta (para o frontend)

- `my_dashboard()`: `{"ok":true,"pets":[{id, name, species, photo_path, lost_mode, lost_since, has_tag, tag_code (XXXX-XXXX-X ou null), tag_status (available|assigned|blocked|void ou null), scans_month, last_scan:{occurred_at, geo_method}|null, visible_shown, visible_total (5)}],"pending_activation":"XXXX-XXXX-X"|null}`. Erro: `too_many_requests` (com `retry_after_seconds`). A URL da foto sai no cliente.
- `release_tag(p_code, p_reason in released|transferred)`: `{"ok":true,"code","new_pin"}`; erros `not_owner` (também para tag inexistente ou de outra pessoa), `invalid_code`, `too_many_requests`. Motivo fora da lista lança exceção.
- `request_tag_replacement(p_code, p_kind in damaged|lost)`: `{"ok":true,"request_id"}`; erros `not_owner`, `invalid_code`, `replacement_limit`, `too_many_requests`.
- Gatilhos (exceção P0001, mensagem = código): `pet_limit` (21º pet), `pet_has_active_tag` (apagar pet com tag), `replacement_limit`.
- `admin_list_batches()`: `{ok, batches:[{id, quantity, created_at, notes, package_downloaded_at, counts:{available,assigned,blocked,void}}]}`.
- `admin_list_codes(p_search, p_status, p_batch, p_limit 1..100, p_offset)`: `{ok, total, rows:[{code, batch_id, status, pet_name, tutor ("Ana S."), last_scan_at}]}`; erros `forbidden`, `invalid_status`.
- `admin_code_detail(p_code)`: `{ok, code, batch_id, status, created_at, updated_at, qr_version, qr_mask, notes, assignment:{id, started_at, pet_name, tutor}|null, history:[{id, started_at, ended_at, end_reason, pet_name, tutor}], scans:[{id, occurred_at, status_at_scan, geo_method, lat, lng, accuracy_m, city, region, assignment_id}] (até 100), pin:{used, used_at, fail_count_24h, locked_until}, replacement_requests:[{id, kind, status, created_at, resolved_at}]}`; erros `forbidden`, `invalid_code`, `not_found`.
- `admin_set_status(p_code, p_status in available|blocked|void, p_note)`: `{ok, code, status}` (status final: `assigned` se desbloqueou tag vinculada); erros `forbidden`, `invalid_status`, `invalid_code`, `not_found`, `invalid_transition`.
- `admin_reissue_pin(p_code)` e `admin_end_assignment(p_code, p_reason in admin|damaged|lost)`: `{ok, code, new_pin}` uma vez; erros `forbidden`, `invalid_code`, `not_found`, `tag_not_available` (reemitir em tag que não é `available`), `no_active_assignment`, `invalid_reason`, `too_many_requests`.
- `admin_resolve_replacement(p_request, p_status in done|cancelled)`: `{ok}`; erros `forbidden`, `invalid_status`, `not_found`, `invalid_transition` (pedido já fechado).
- `admin_scan_queue(p_limit, p_offset)`: `{ok, scans:[{id, code, status_at_scan, occurred_at, geo_method, city, region}], replacements:[{id, code, kind, created_at}], locked_tags:[{code, locked_until}]}`.
- `admin_audit(p_event, p_entity_id, p_limit 1..200, p_offset)`: `{ok, rows:[{id, at, actor_id, actor_role, event, entity, entity_id, detail}]}`; `p_entity_id` aceita a forma de exibição.
- `admin_dashboard_counters()`: `{ok, generated, available, active, blocked, void}`.
- `admin_export_codes(p_batch)`: `{ok, batch_id, count, csv}` com `code,qr_version,qr_mask` (sem PIN); erro `not_found`.
- `admin-create-batch` (POST, JWT de admin; corpo `{quantity 1..500, notes?}` até 1 KB): 200 `application/zip` (só `pins.csv`), `Cache-Control: no-store`, `X-Batch-Id`; 401 sem admin válido (corpo vazio), 403 usuário não admin, 400 `invalid_input`, 429 `too_many_requests`, 409 `batch_range_exhausted`, 500 sem detalhe.

### Pendência da foto (registrada, não resolvida)

A URL assinada da foto carrega `<tutor_id>/<pet_id>/<arquivo>`, o que põe identificadores internos numa URL que o visitante da página
pública vê e que ele pode guardar (a assinatura vence, o caminho não). Saídas: (A) caminho com identificador opaco por pet
(`pets.photo_key uuid` aleatório; `photo_path = <photo_key>/<arquivo>`): exige coluna nova, mudar as quatro políticas de storage
(hoje por prefixo `<uid>/`, que passaria a ser verificado por consulta a `pets`) e migrar as fotos já enviadas; custo médio, o
tutor segue enviando direto ao Storage. (B) servir a foto por rota do servidor do app (`/foto/<código>`, que chama a função com a
chave do servidor e transmite os bytes): a URL não revela nada, o bucket deixa de ter URL assinada para estranhos; custo maior, a
foto passa a trafegar pelo servidor SSR (banda e cache) e a rota é nova no app. Nada foi alterado.

### Verificação (CI)

Ver a seção "Verificação final" abaixo.

## Verificação final (Phases 8 a 12, backend)

- CI, run 45525406840 (commit do script de CI com o gateway do `admin-create-batch`): job `app` verde (79 arquivos, 641 testes, 1 pulado,
  lint e build); job `supabase` verde: pgTAP 27 arquivos, 1377 asserções, PASS (eram 23 e 1094); `deno test` 330 testes (eram 302);
  `supabase-checks.sh` 259 PASS, 0 FAIL (eram 242, mais 15 do bloco T076 e o resto das fases anteriores). `security_catalog.test.sql`
  e `conta_privacidade.test.sql` da 004 passaram sem mudança, com os objetos reais da 003.
- Execuções de CI desta rodada: 2 (a correção do agregado aninhado; o bloco novo do script).
- Cobertura do gate de banco de `contracts/rls-expectations.md` (T092, parte de banco): a matriz, o isolamento entre vínculos (release_tag,
  troca de dono, `end_assignments_for_account`, `export_tutor_tag_data`), o contrato físico (código imutável e nunca apagado, `void`
  irreversível, dígito inválido, índices únicos parciais), Rescue-First (corpo de `resolve_tag`/`register_scan` sem cobrança) e
  anti-enumeração estão em `rls_tags_base`, `rls_scans`, `rpc_*`, `account_tags`, `storage_pet_photos` e `security_catalog`. Não
  marcada: falta a parte de navegador e de build (segredos em `dist/`, chunks do bundle público, axe, orçamento de desempenho).
- T097 (quickstart): divergências a corrigir por quem tem o navegador, sem eu poder editar `specs/`: o quickstart diz "PIN de desenvolvimento no
  `seed.sql`" (ele está em `e2e/fixtures/seed-codes.json`, `devPins`); "senha de desenvolvimento no seed" (é a do script de CI, `TesteSenha123!`);
  o passo 10 fala em "baixar o pacote" com etiquetas (hoje o pacote só tem `pins.csv`); cita `admin-labels` em `functions serve` (não existe).
  Os passos de banco e função foram conferidos pelo CI; o roteiro de navegador não foi executado.
- T105: o `Feito quando` (pgTAP e deno com `forbidden` para tutor e `too_many_requests` no estouro) passa para `admin-create-batch`,
  `admin_reissue_pin` e `admin_end_assignment`. `admin-labels` ainda não existe (T084 bloqueada): quando existir, tem de chamar
  `requireAdmin` (já existe em `_shared/auth.ts`, com testes) antes de qualquer outra coisa.

### Não verificado (Phases 8 a 12)

- Lote grande (500 códigos) contra o tempo limite da função e do banco (ver desvio 9).
- Deploy de `admin-create-batch` num projeto hospedado: não feito, de propósito (T011 e T085 pendentes).
- Reimpressão idêntica (PDF), leitura física, matriz e máscara contra o lote-001 (T084 e T085, bloqueadas).
- Rotação de chave do servidor com o app real (só os testes unitários e o script com a chave nova).

## Frontend: Phases 1 a 3 (T002, T003, T005, T024, T029 a T034B; 2026-11-24 e 25)

Sem Supabase local; nada foi escrito no projeto hospedado. A página foi vista com o servidor SSR construído contra Edge Functions de mentira
(só no scratchpad). Não feitas: T024A (ver abaixo) e, por dependência, T025 (implementada, sem marcar).

### Pendências e desvios

1. **T024A não executada.** O preview da Vercel do PR nº 5 existe, mas está atrás do login da Vercel (302 para `vercel.com/sso-api`): não há
   como chamar `/api/ping` sem um token de bypass. Não é reprovação, é impossível de verificar daqui. **T025 fica sem marcar**: o código e os
   testes existem (`core/tags/server/scan-api.ts`, funções puras fora do `server.ts`, portáveis para `api/*.ts` se o gate falhar).
2. **`security.allowedHosts` em `angular.json` estava `[]`.** Fora do localhost, o Angular 21 recusa o cabeçalho `Host` e **cai em renderização no
   cliente**: em produção a página da tag nunca sairia do servidor (sem HTML de resgate, sem TransferState, só contingência). Acrescentei
   `tagfaro.com.br`, `www.tagfaro.com.br` e `*.vercel.app` (previews). Decisão do William: confirmar a lista. T037A tem de conferir.
3. **Texto neutro quanto ao gênero.** A projeção pública não traz sexo do pet nem do tutor. Onde a tela de referência diz "o Paçoca", "sozinho",
   "Perdido há", "a Ana, minha tutora", usei: "Oi, eu sou Paçoca.", "Se você me encontrou, avise Ana. Minha família me leva de volta para casa.",
   "Sou Paçoca. Me perdi de casa.", "Longe de casa há N dias/horas", "Recado de Ana", "Faro é a tag de identificação de Paçoca.". Se o William
   quiser o artigo, o backend precisa devolver o sexo.
4. **Textos que o contrato não trazia:** sem nome do tutor ("a família", "Recado de quem cuida de mim"); sem nenhum contato liberado (cartão
   "Encontrou um pet?", o mesmo da tela "não encontrada"); telefone ("Ligar: (11) …", `tel:+55…`; o contrato só dá o texto de exibição, sem DDI);
   localização negada; contingência ("Este pet tem dono." e "Não conseguimos abrir as informações desta tag agora…"); `**` do app ("Não
   encontramos esta página.").
5. **"Editar" da visão do dono leva a `/app`**, não a "O que estranhos veem": a projeção pública (e a resposta `owner`) não traz id de pet.
6. **`/<código>/perdido` removida**; a política `tag` de cabeçalhos passou a cobrir também segmento com `%20` (`/7k3m%20q9xa%20c`) e manda
   `Cache-Control: no-store` e `X-Robots-Tag: noindex`. `vercel.json` regenerado (`check:headers` verde, amostras novas).
7. `session-bootstrap` saiu de `core/auth/` para `core/session/` (a checagem do pacote não aceita `core/auth` no fecho estático e não se isenta).
8. Adiantei, sem marcar, o que a página precisa para funcionar inteira: visão do dono e sonda (T048), scan e localização no navegador (T054), modo
   perdido (T061). T048, T054 e T061 continuam `[ ]`: faltam e2e e a revisão do QA.
9. Link de "Ver a página do Paçoca" (T047) e qualquer link do app para `/<código>` tem de ser `<a href>`: navegação interna (routerLink) chega à
   página sem TransferState e cai na contingência (o "Tentar de novo" resolve, mas é pior).

### T034A (hidratação pura)

`provideClientHydration()` sem opções. HTML servido de `/<código>` (conferido com o servidor construído): só `<script id="ng-state" type="application/json">` e dois
`<script src>`; nenhum executável embutido. Os `.html` de `dist/faro/browser` também. Ressalva: `dist/faro/server/index.server.html` (modelo do servidor, nunca
enviado como está) contém o `ng-event-dispatch-contract`; o servidor não o injeta na resposta. CSP não foi tocada.

### T034B (guards sob demanda)

`lazyCanMatch` em todos os guards de `app.routes.ts`; `check:bundle` reprova `core/auth`, `core/account`, `core/supabase` e `@supabase/*` no fecho estático. Passa.
Inicial: 323 kB (gzip 106,5 kB; era 347 kB e 113,7 kB). **Rota da tag: 131,9 kB em gzip, acima dos 100 kB.** Do total, cerca de 95 kB são o Angular
(`core` 54,6, `router` 21, `common` 7, `rxjs` 6,4, `platform-browser` 5,2); `tailwind-merge` 8,7 e os 33 ícones registrados globalmente 5,2.
Sem router e sem `tailwind-merge`/ícones ainda sobrariam cerca de 75 + o resto: a meta não é atingível sem mexer no roteamento ou nos componentes
compartilhados (fora do escopo). Número registrado; o script só informa, não reprova.

### Verificação

`npm run lint`, `npm test -- --watch=false` (96 arquivos, 892 testes, 1 pulado), `npm run build`, `check:ui`, `check:headers`, `check:bundle` (+ `--self-test`),
e2e (`npm run e2e`, 166 passaram antes da fiação do scan; mais 5 novos em `e2e/tag-page-head.spec.ts`). Nenhum segredo em `dist/faro/browser`.
O run 45530612559 (commit b09ad20) falhou porque aquele commit intermediário referenciava arquivos que só entraram no seguinte: não é defeito do código final.

## Frontend: Phases 4 e 5 (T040 a T048, T054 a T056; 2026-11-25)

Sem Supabase local; nada foi escrito no projeto hospedado. As telas foram vistas com o `ng serve` e o backend simulado em `e2e/support/mock-tutor.ts`
(o `abort` barra tudo que vai para `*.supabase.co`); as capturas estão no scratchpad (`shots-003-fase4`). A prova contra o banco de verdade
(PIN errado de verdade, bloqueio, concorrência, e-mail do scan) é do QA (T049, T057).

### O job `e2e` vermelho do run 45532380623

Causa: `e2e-real/account-a11y.spec.ts` dava `page.goto('/auth/celular')` logo depois do clique do login, sem esperar o app terminar de entrar; a navegação
cortava o login e `/auth/celular` caía no `authGuard` (`phone-input` nunca aparecia, 4 testes de 109). A 004 já tinha a correção (`toHaveURL` depois do
login e `networkidle` no `loginViaUi`); a 003 tinha mesclado a 004 antes dela. Não é defeito do frontend nem do backend: apliquei as mesmas duas edições de
teste (`e2e-real/account-a11y.spec.ts` +1 linha, `e2e-real/support/flows.ts` +2 linhas), idênticas às da 004, de modo que o merge não conflita. Run
45534441744 (commit `2732c10`): `app`, `supabase` e `e2e` verdes. Observação para o merge: o `e2e-real/support/flows.ts` da 004 tem mais uma alteração ainda
sem commit (DEF-001).

### O que foi feito

- **T040** `core/tags/tag.service.ts` (+ `tag-errors.ts`): `check_tag_for_link`, `activate_tag` (cinco parâmetros, `p_enable_whatsapp` sempre explícito),
  ativação pendente (`set`, `get`, `clear`) e `my_dashboard`. Normaliza e confere o dígito ANTES de chamar; PIN que não tem seis caracteres do alfabeto
  nem sai do aparelho; devolve `{ ok:false, error }` e nunca lança; os 12 códigos do contrato têm teste e texto. Não é exportado por `core/tags/index.ts`.
- **T041** `core/pets/pet.service.ts` (+ `image-resize.ts`): criar, editar, remover, listar, foto (1600 px, WebP, `pet-photos/<uid>/<pet>/<uuid>.webp`, limite de
  5 MiB do bucket) e URLs assinadas. Só as colunas concedidas por privilégio de coluna. O redimensionamento é injetável (`PHOTO_PROCESSOR`); no e2e roda de verdade no Chromium.
- **T042** `core/tags/activation.guard.ts` (carregado por `lazyCanMatch`) + `activation-links.ts`. Vai na frente de `authGuard`/`termsGuard`/`phoneConfirmedGuard`.
  Sem sessão: `/auth/criar-conta?returnUrl=/ativar/<código normalizado>`; com sessão: `set_pending_activation` e segue. Teste com roteador real, endereço exato.
- **T043, T046, T047** `features/activation/` (container + três passos, cada um com a própria casca de fluxo): escolher o pet (confirmação da troca ANTES do PIN, porque
  a RPC só devolve `pet_has_tag` depois de conferir o PIN), PIN (seis células alfanuméricas, normalização, WhatsApp MARCADO com o aviso abaixo, visível sem rolar a 390x844;
  erros `wrong_pin`, `locked`, `phone_not_confirmed` leva a `/auth/celular?returnUrl=/ativar/<código>?pet=<id>`), "Tag ativa!" (link `<a href="/<código>">`).
  O painel de marca de cada passo usa a frase da tela de referência no desktop.
- **T044, T045** `features/pets/new-pet/`: dois passos, o pet só é gravado no fim ("Salvar pet" ou "Pular por enquanto"); `?returnUrl=` interno devolve para a ativação com `?pet=<id>`;
  sem destino, o painel. Foto que falha depois do pet salvo: "Tentar enviar a foto de novo" ou "Continuar sem a foto", sem duplicar o pet.
- **T048 e T054** (adiantados na Phase 3): os testes do "Feito quando" existem em `tag-page.spec.ts` (`owner` verdadeiro e falso; geolocalização permitida e negada) e passam.
  Marcados agora.
- **T055** `core/scans/scan.service.ts`: `my_scans` com filtros (todos, este mês no horário de Brasília, localização precisa, pet), limite de 200.
- **T056** `features/scans/` (claro e escuro): filtros, cartão do mapa com Leaflet 1.9.4 sob demanda (círculo para a aproximada, pino com o raio do erro para a precisa),
  lista por mês, nota de privacidade, estado vazio, de erro e de carga. `?pet=<id>` filtra. O Leaflet vem num chunk da rota (o CSS dele também); `check:bundle` passou a reprovar
  `leaflet`, `core/pets`, `core/scans` e `core/tags/tag.service` no fecho público.
- Correção de componente compartilhado: chip marcado de `z-toggle-group` ficava cinza no hover (`toggle.variants.ts`).

### Desvios, decisões e textos que não estavam no contrato nem na tela

1. **Texto sem gênero**, como na Phase 3: "Quero que quem achar Paçoca possa me chamar no WhatsApp" (a tela diz "o Paçoca"), "Ver a página de Paçoca", "Cão"/"Gato" (a lista não traz o sexo, então não há "Gata"),
   "Pronto. Paçoca tem como voltar." e "sobre o jeito do seu pet".
2. **Textos inventados**: "Código válido" (leitor de tela), "Ao ativar esta, a anterior volta a ficar livre e o PIN do cartão dela continua valendo." (troca de tag; vem da regra do PIN mantido),
   "Você ainda não tem nenhum pet cadastrado...", "Trocar a tag", "Escolher outro pet", "Perdeu o cartão? Fale com o suporte do Faro." (sem link: o repositório não tem contato de suporte; a tela de referência tem `href="#"`),
   mensagens de `too_many_requests` e `replacement_limit`, erros do novo pet, "Não foi possível saber onde foi" e "Sem local" (scan sem localização), "Ninguém escaneou a tag ainda" e o estado de filtro vazio,
   "Mostrando só os scans de um pet." e a linha "São Paulo, SP" quando o scan tem cidade.
3. **"Ligar agora"** (T047) leva a `/app/pets/<id>/visibilidade`, rota que ainda é `ShellFallback` (Phase 7). O "Editar" da visão do dono continua indo a `/app` (Phase 3).
4. **Espécie começa sem escolha** no novo pet (a tela de referência mostra "Cão" marcado, mas é dado de exemplo): evita cadastrar um gato como cão por descuido e dá sentido à validação de espécie.
   Sexo e porte são opcionais e, uma vez escolhidos, não se desmarcam (a seleção única do Faro não permite).
5. **Pet que já tem tag** usa o PIN vigente da tag nova (a RPC mantém o PIN da antiga); a tela não gera nem mostra PIN.
6. **Mapa**: só o scan mais recente que tem localização, sem interação (não rouba a rolagem), `aria-hidden`; a atribuição do OpenStreetMap fica no cartão. A CSP já tem `img-src https:`, então não mudou
   (a pesquisa pede "só nessa rota"; a política atual é mais larga, decisão do William). Sem paginação: até 200 scans.
7. Dependências novas: `leaflet` 1.9.4 e `@types/leaflet` 1.9.21 (versões fixas).

### Verificação

`npm run lint` limpo; `npm test -- --watch=false` 104 arquivos, 1006 testes (1 pulado); `npm run build`; `check:ui`, `check:bundle` (+ `--self-test`), `check:headers`; `npm run e2e` 192 passaram
(eram 166 + 5; acrescentei `activation-ui` 8, `new-pet-ui` 4, `scans-ui` 9, todos com axe e sem rolagem horizontal). Rota da tag segue em 132,4 kB gzip (meta de 100 kB não atingida, ver Phase 3).

### Ajustes depois da revisão (mesma rodada)

- PIN com caractere fora do alfabeto (por exemplo, "U") agora segue para o `TagService`, que devolve `wrong_pin` sem chamar a RPC, e a mensagem aparece (antes o botão não fazia nada).
- Foto: WebP, com JPEG de reserva quando o navegador não codifica WebP pelo canvas (caminho `.jpg`, `contentType: image/jpeg`; o bucket aceita os dois). **Não verificado no Safari do iOS**; o e2e roda só no Chromium.
- Foco: trocar de passo (ativação e novo pet) leva o foco ao título do passo novo (`h1` com `tabindex="-1"`); depois de `wrong_pin` o foco vai à primeira célula. Com teste de componente.
- `docs/zardui-faro.md` registra a edição de `toggle.variants.ts`.
- Colar um PIN com hífen ou espaço perde um caractere: o `handlePaste` do `z-input-otp` corta em seis antes de filtrar. Não corrigido (componente copiado do ZardUI; o cartão traz o PIN sem separador).
- O PR nº 5 está `CONFLICTING` com `develop`, e por isso o GitHub não dispara a CI de `pull_request` nos pushes novos; o CI foi disparado à mão (`workflow_dispatch`) na branch.
- Os tiles do OpenStreetMap expõem a um terceiro a área do scan e o IP do tutor; a CSP (`img-src https:`) é mais larga do que o "só nessa rota" da pesquisa. Decisão do William.

## Frontend: Phases 6 a 8 (T060 a T066, T069 a T073; 2026-11-25)

Antes das tarefas: merge de `origin/develop` em `003-tag-qr` (a `develop` recebeu a 004 completa; o PR nº 5 estava `CONFLICTING` e o CI de `pull_request` não disparava).

### O merge de `develop`

- Um único arquivo em conflito: `scripts/ci/supabase-checks.sh`. Os dois lados só acrescentaram blocos (o da 003 e o das chaves `sb_publishable_`/`verify_jwt` da 004); ficaram os dois, na ordem 003 e depois 004. `supabase/config.toml` (blocos `[functions.*]` da 003 mais o `verify_jwt = false` de `login-guard` e `password-recovery`), `_shared/*` e `e2e-real/*` mesclaram sozinhos; `e2e/session-restore.spec.ts` e `e2e-real/*` ficaram como a `develop`.
- **Erro meu, corrigido no commit seguinte:** a primeira resolução regravou o `supabase-checks.sh` pelo PowerShell 5.1, que leu o UTF-8 como ANSI e gravou "PaÃ§oca". Três checagens da 003 (`resolve-tag` com o nome do pet e os dois avisos de e-mail do scan) falharam no CI (run 45543143714). Refeito com `git merge-file` (bytes preservados); run 45544034538, commit `c56fbb1`: `app`, `supabase` e `e2e` verdes.
- **DEF-001 e o pacote público.** `session-persistence.ts` (e o spec) saíram de `core/auth/` para `core/session/`, ao lado do `session-bootstrap.ts` que a 003 já tinha movido: o `session-bootstrap` da `develop` passou a importar `findPersistedStorage`, e `check:bundle` não aceita `core/auth` no fecho estático. Não há duas cópias. `auth.service.ts` e `supabase.service.ts` importam do novo caminho.
- **Sonda da "visão do dono"** (`core/tags/owner-probe.service.ts`): o cliente do Supabase agora nasce com o storage onde a sessão está, então `getSession()` acha também a sessão volátil; a leitura do token gravado nos dois storages ficou como rede de segurança. Os testes (`scan-client.service.spec.ts`) cobrem token só em `localStorage` e só em `sessionStorage`. Sem import de `core/auth`.

### O que foi feito

- **T060** `features/pets/lost-mode/`: recado com contador de 280, dois interruptores, prévia do alerta (tablet e desktop), "Ativar modo perdido" e "Agora não". O recado vem do rascunho guardado em `rescue_profiles.lost_message` (ligar com o campo vazio apagaria o texto da última vez). `TagService.setLostMode`.
- **T061** (a tela já existia desde a Phase 3): `rescue-view.spec.ts` cobre agora as oito combinações de tempo, recompensa e recado; conferida contra `V2-resgate-perdido*`.
- **T062** `features/pets/pet-page/lost-row/`: interruptor da página do pet. Desligado leva à tela do modo perdido; ligado abre a confirmação "Pet encontrado" (diálogo de decisão, só no app). Entra na página do pet na T070.
- **T064** `core/pets/rescue-profile.service.ts`: lê e grava só as colunas `show_*` e `lost_show_*` (as demais são privilégio de coluna). O gatilho `phone_not_confirmed` do banco chega como EXCEÇÃO (`message: "phone_not_confirmed"`, conferido contra o Postgres local), não como `{ ok:false }`; o serviço devolve o mesmo código como erro de negócio.
- **T065** `features/pets/visibility/`: três grupos, "Nome e foto" travado em "Sempre", "Pré-visualizar" e "Salvar" (só grava o que mudou). WhatsApp e telefone sem celular confirmado NÃO ligam: o interruptor volta, aparece "Confirme seu celular para continuar." e o botão leva a `/auth/celular?returnUrl=/app/pets/<id>/visibilidade`. A conferência usa o `AccountService` (mesma fonte do `phoneConfirmedGuard`); o erro do banco também é tratado ao salvar.
- **T066** prévia: a PRÓPRIA `RescueView` na visão do dono, com as escolhas ainda não salvas (`preview-profile.ts` monta o que `resolve-tag` devolveria). Painel de tela cheia com `.faro-light` (bloco novo em `src/styles.css` que devolve ao claro as variáveis que `.dark` redefine; `check:tokens` compara os dois blocos) para sair clara com o app no escuro. Esc fecha e o foco volta ao botão. Não monta `wa.me` de verdade.
- **T069** painel (`features/pets/dashboard/`) e a tela "Pets" (`pet-list`); o placeholder `features/pets/pets/` saiu. `data-testid="pets-home"` está na raiz também enquanto carrega e em erro (`e2e/session-restore.spec.ts` da `develop` espera por ele).
- **T070** página do pet (`pet-page/`), com os três estados da tag (sem tag: "Vincular tag"; ativa; bloqueada: "Tag bloqueada. Fale com o suporte.").
- **T071** editar pet: os MESMOS formulários do novo pet (`NewPet` com `petId`), com os dados preenchidos, "Salvar alterações" e sem "Pular por enquanto"; "Remover pet" (`remove-pet/`): confirma, libera a tag com `release_tag` ANTES de apagar o pet (a FK do vínculo é `ON DELETE SET NULL`) e mostra o PIN novo uma vez, só em estado da tela (apagado ao concluir e ao destruir). Se a tag foi liberada e o delete falhou, fica no passo do PIN e "Tentar remover de novo" não libera a tag outra vez. `PetService.get`, `TagService.releaseTag`.
- **T072** `features/pets/link-tag/` passo 1: abas "Escanear QR" e "Digitar código"; `qr-scanner.ts` (`BarcodeDetector`, com `jsQR` 1.4.0 por `import()` dinâmico como reserva; câmera de trás; desliga ao sair); `core/tag-code/qr-payload.ts` só aceita `HTTPS://TAGFARO.COM.BR/<CODIGO>` (nada de subdomínio, `usuario@`, porta, outro caminho). Falha de câmera cai em "Digitar código" com o motivo. `check_tag_for_link` mostra "Código válido · tag disponível".
- **T073** passo 2 reutilizando o `PinStep` da ativação (`variant="link"`) e o `DoneStep`.

### Desvios, decisões e textos que não estavam no contrato nem na tela

1. **WhatsApp marcado no PIN do vincular** (decisão a confirmar com o William). A constituição diz que a exceção do pré-marcado vale "só nessa tela" (a de ativação); as telas `V2-vincular-pin*`, `docs/decisoes-pivo.md` ("as duas telas do PIN foram redesenhadas com a opção marcada") e o contrato de `activate_tag` tratam o vínculo pelo app como a mesma ativação. Segui a tela e o contrato: marcado, com o aviso, enviado sempre de forma explícita. Fora do vínculo, tudo começa desligado (a prévia, "O que estranhos veem" e o modo perdido).
2. **"Editar" da visão do dono**: a projeção pública não traz id de pet. Rota nova `/app/tag/:code` (`tag-redirect/`, fora da tabela do contrato): acha o pet pelo código em `my_dashboard` e vai a `/app/pets/<id>/visibilidade` (código que não é de um pet do tutor: `/app/pets`). `RescueView` ganhou `showOwnerEdit` (a prévia esconde o botão).
3. **Editar pet fora das filhas de `app`**: `/app/pets/:petId/editar` é uma rota de nível superior, declarada antes de `app`, na casca de fluxo (sempre clara), como `/novo-pet`. Na tabela do contrato ela é filha de `app`; aninhar o `NewPet` dentro da casca do tutor poria uma casca de fluxo dentro da outra.
4. **Painel sem o que o backend não traz**: sem sino de notificações, sem "Ninguém entrou em contato ainda", sem o terceiro cartão do desktop ("Tag vinculada há N dias": o `my_dashboard` não devolve o início do vínculo). "Estranhos veem" mostra `X de 5` (a tela desenha "5 de 7"). A tela "Pets" (`/app/pets`) não tinha tarefa própria; fiz com os mesmos dados e o mesmo cartão do "Seus pets".
5. **`PetHero`** ganhou `heading` (`h1`, `h2` ou `none`): a página do pet usa o nome do cabeçalho como título e deixa o da capa como texto escondido do leitor; o painel usa `h2`. Padrão `h1`, sem mudança para quem já usava.
6. **`SwitchRow`** novo (`shared/components/faro/switch-row/`): o interruptor interno vira sozinho ao toque; `setChecked` desfaz um toque que a tela recusou e NÃO emite `toggled` (sem isso, desfazer o toque na linha do modo perdido virava um segundo toque e levava à tela de ligar: pego pelo e2e).
7. **Cor**: tag bloqueada e "sem tag" usam o selo neutro (vermelho é só ação destrutiva, âmbar só modo perdido). Os selos do bloco âmbar da prévia do modo perdido usam `text-lost` (o `warning-foreground` clareia no tema escuro e perderia contraste sobre o branco).
8. **Texto neutro quanto ao gênero**, como nas Phases 3 a 5: "Paçoca sumiu?", "Sou Paçoca. Me perdi de casa.", "Longe de casa há poucos minutos", "Dados de Paçoca".
9. **Textos que o contrato e as telas não traziam**: "O alerta de <nome> está ligado", "Salvar alterações" (modo perdido já ligado e editar pet), "Alerta atualizado.", "Modo perdido ativado. A página da tag já mostra o alerta.", "<nome> foi encontrado?" e "O alerta sai da página da tag. Você continua recebendo um aviso a cada scan.", "Ligado há N horas", "Modo perdido ligado", "Alerta ligado na página da tag", "Nada cadastrado ainda", "Nenhum celular cadastrado", "<celular mascarado> · ainda não confirmado", "Alterações salvas.", "Voltar para editar" e a frase da barra da prévia, "Abrindo a tag", "Vincular tag a <nome>" e "Sem a tag, quem achar não tem como avisar você", "Falta ativar uma tag" e "Você começou a ativar a tag <código>. Falta escolher o pet e digitar o PIN do cartão." e "Continuar a ativação", "Cadastre o seu primeiro pet" e o apoio, "Este pet ainda não tem tag.", "Quando alguém escanear, aparece aqui", "Nenhum scan este mês", "Remover <nome>?" e as duas descrições, "A tag foi liberada", "<nome> foi removido", "Copiar PIN", "PIN copiado.", "Tentar remover de novo" e "A tag foi liberada, mas não conseguimos remover <nome>. Anote o PIN e tente de novo.", "Este pet já tem uma tag" e "A tag <código> já está vinculada a este pet. Para trocar de tag, use "Gerenciar tag".", "Esse QR não é de uma tag do Faro. Aponte para o QR que fica na tag.", "A câmera não foi liberada. Digite o código que fica embaixo do QR.", "Não conseguimos usar a câmera. Digite o código que fica embaixo do QR.", "Conferindo o código…", "Câmera para ler o QR da tag", "Abrindo a câmera…", "Nenhum pet ainda", "Escolher o pet" (seletor da capa) e "Sobre este pet" (nome do menu). As mensagens de erro de carga ("Não conseguimos carregar…") repetem o padrão das Phases 4 e 5.
10. Dependência nova: `jsqr` 1.4.0 (versão fixa, Apache-2.0, `npm audit` sem achados), num pedaço à parte (~26 kB gzip) que só baixa quando o navegador não tem `BarcodeDetector`. `check:bundle` reprova `jsqr` e `core/tag-code/qr-payload` no fecho público.
11. **Permissions-Policy**: `camera=(self)` já valia para todo caminho que não é a página da tag (`vercel.json` e `security-headers.ts`), então `/vincular/*` não precisou de mudança. A câmera real (Chromium com dispositivo falso) abriu no e2e; **não** foi testada em Safari do iOS nem com um QR de verdade (o vídeo de teste não tem QR).
12. A rota da tag subiu de 132,7 kB para 134,1 kB gzip (meta de 100 kB segue não atingida): a divisão de pedaços do build mudou com as rotas novas; nenhum arquivo do app autenticado entrou no fecho público (`check:bundle` ok).

### Verificação

- `npm run lint` limpo; `npm test -- --watch=false`: 120 arquivos, 1187 testes (1 pulado); `npm run build:stats`; `check:ui` (inclui `check:tokens` com o `.faro-light`), `check:bundle` (+ `--self-test`), `check:headers`, `check:secrets`, `check:templates`, `check:audit` (0 vulnerabilidades).
- e2e (`npx playwright test`, backend simulado): 255 passaram (eram 196): `lost-mode-ui` 8, `visibility-ui` 10, `pets-ui` 33, `link-tag-ui` 8, todos com axe, sem rolagem horizontal, nas três larguras e (onde é app do tutor) no escuro. Capturas no scratchpad (`shots-003-fase6a8`).
- **Chamadas reais**, contra o Supabase LOCAL (pilha parada ao fim; `scratchpad/real-rpc-check.mjs`, só `fetch`): 29 de 29 conferências, incluindo `my_dashboard` (forma e ausência de `ip_hash`/hash de PIN), `rescue_profiles` (leitura, PATCH nas colunas permitidas, `lost_mode` recusado, RLS), `set_lost_mode` (ligar, religar preserva `lost_since`, desligar com `p_message` nulo mantém o recado, `no_active_tag`, `pet_not_found`), `check_tag_for_link` (inválida, disponível, bloqueada/anulada/inexistente iguais), `activate_tag` com o PIN do seed `lote-900` (errado e certo) e `release_tag` (PIN novo uma vez; o antigo deixa de valer).

### Não verificado

- **T073 em navegador contra o banco de verdade.** O `environment.e2e.ts` (que o `ng serve --configuration e2e` exige) não foi gerado: a instrução era não mexer em `src/environments/*`. O vínculo com o seed foi conferido pelas mesmas chamadas, direto na API local; a tela, por testes de componente e e2e com backend simulado. O e2e do navegador com o seed (T074) é do QA.
- Safari do iOS (foto em JPEG de reserva, `BarcodeDetector` ausente: cai no `jsQR`) e leitura de um QR físico pela câmera.
- Remover pet e o vínculo pelo app contra o banco, pela tela.

## Frontend: Phases 9 a 12 (T077 a T082, T088 a T090, T094, T095, T104, T106; 2026-11-25)

Mesmo ambiente das Phases 6 a 8 (worktree da branch `003-tag-qr`; Docker e a pilha do Supabase LOCAL só para conferir respostas reais por script; nada hospedado foi tocado). Não feitas, de propósito: T099 (ver "Tarefas [FE] ainda abertas"), T084 e T085 (bloqueadas), e as `[BE]` e `[QA]`.

### O que foi feito

- **T077** `core/admin/admin-tag.service.ts` (e `models/admin.ts`): todas as RPCs `admin_*` do contrato mais `createBatch` (Edge Function `admin-create-batch` por `fetch`, não por `functions.invoke`: o `invoke` leria o zip como texto e corromperia os bytes). Erro de negócio volta como `{ ok:false, error }`; `network` para o resto; nenhuma mensagem do Supabase vaza. `FileSaver` (`core/admin/save-file.ts`) baixa e revoga o endereço temporário na hora.
- **T078** `features/admin/batches/` ("Lotes", rota `/admin`): contadores, cartões até o tablet e tabela no desktop, aviso do pacote, "Exportar códigos" (CSV sem PIN, `admin_export_codes`) e "Criar lote" num painel NA PÁGINA com três passos (formulário, confirmação, gerando, fim). O pacote é salvo na hora e solto: nenhum signal guarda o `Blob` (teste confere). O placeholder `features/admin/admin/` saiu.
- **T079** `features/admin/codes/`: busca (código, pet ou tutor, enviada no Enter ou em "Buscar"), filtro por situação e por lote, lista com seleção, paginação de 25. "Reimprimir seleção" fica desativado e diz por quê (`LABELS_AVAILABLE = false`, T084 bloqueada).
- **T080** `features/admin/code-detail/` (`/admin/codigos/:code`): vínculo, estado do PIN (nunca o valor), scans (dez, com "Mostrar todos"), histórico, pedidos de 2ª via (com "Marcar como resolvido") e as ações: bloquear/desbloquear, reemitir PIN, encerrar vínculo (com motivo), reimprimir QR (desativado), trocar código, anular. Toda ação confirma com o código por extenso. PIN novo: `admin/pin-reveal`, uma vez, apagado ao concluir, ao trocar de código e ao destruir a tela.
- **T081** `features/admin/queue/` (`/admin/fila`): três seções e chips com contagem; um cartão por linha até o tablet, colunas no desktop.
- **T082** `features/admin/audit/` (`/admin/auditoria`): filtro por código ou lote (no banco) e por tipo de evento (nas linhas carregadas), "Carregar mais", sem PIN, telefone, IP nem identificador de conta.
- **T088 a T090** `features/pets/manage-tag/` (`/app/pets/:petId/tag`, claro e escuro): cartão do código, "Passar a tag adiante", "Desvincular", "2ª via: danificada" e "2ª via: perdi a tag". `TagService.requestReplacement` e `assignmentStart` (lê `started_at` do vínculo ativo, `tag_assignments` é legível pelo próprio tutor). O PIN novo aparece numa seção da PÁGINA (não num diálogo) e some ao concluir, ao trocar de pet e ao sair.
- **T094** títulos de rota passaram por `$localize` (inclusive `/admin`, que agora é "Lotes — Faro"); `ng extract-i18n` extrai 1408 mensagens sem erro; o lint de template já barra texto fora do i18n.
- **T095** checklist por tela (abaixo).
- **T104** o que já existia (T025: `POST /api/scan` e `/api/scan/location`, 413/415/400, IP só dos cabeçalhos da Vercel; política `tag` de cabeçalhos, `check:headers`) mais o que faltava: o piso de 150 ms no servidor do app (`PublicTagService`), para tudo que não é a página de resgate, inclusive o código com dígito errado, que nem chama a função. A função `resolve-tag` já tinha o piso por dentro.
- **T106** texto de `too_many_requests` alinhado ao contrato ("Muitas ações em pouco tempo. Aguarde um minuto.", com o tempo que o servidor informar no lugar de "um minuto") e tratamento nas telas que carregam por `my_dashboard` (painel, lista, pet, modo perdido, visibilidade, vincular, gerenciar tag, redirecionamento da tag); `pet_limit` no novo pet (HTTP 400 `P0001` do gatilho vira "Você chegou ao limite de pets desta conta. Fale com o suporte."). Teste de que a página da tag não usa `routerLink`: o que já existia (varre os arquivos) mais o novo (nenhuma diretiva `RouterLink` nos quatro estados renderizados).
- **Pendência herdada**: o `z-input-otp` cortava o PIN colado em seis ANTES de tirar hífen e espaço, então "K47-Q9M" perdia o último caractere. Agora filtra e depois corta; testes (colar com hífen, com espaço, com tudo junto e pelo primeiro campo). Edição registrada em `docs/zardui-faro.md`.

### Conferência contra o banco de verdade (Supabase LOCAL, pilha parada ao fim)

`scratchpad/real-admin-check.mjs` (só `fetch`, recusa alvo que não seja `127.0.0.1`): 26 conferências, 23 passaram de cara e as 3 que falharam eram a conferência errada ou um bug meu real, todos corrigidos depois:

- **`audit_log.id` é número (bigint).** Meu parser exigia texto e a tela de Auditoria cairia SEMPRE em "Não conseguimos conectar". Corrigido (`idOf`), com teste.
- **`actor_role` real é `authenticated` ou `anon`**, nunca `admin`/`tutor`: a coluna "Quem" mostrava "sistema" para tudo. Agora "conta logada", "visitante" ou "sistema"; não dá para dizer admin de tutor por esta coluna e a tela não inventa.
- **`detail` real** traz `from`/`to`/`note`/`reason`/`kind`/`fail_count`: virou "disponível → bloqueado · teste", "tag perdida" etc. Evento de pet não mostra o uuid.
- `admin_list_codes` devolve o código já com hífen (o serviço aceita as duas formas).
- 4º pedido aberto de 2ª via: `{ok:false,error:"replacement_limit"}` (HTTP 200), 21º pet: HTTP 400 `P0001` `pet_limit`; `tag_assignments` legível pelo tutor.

### Desvios, decisões e textos que não estavam no contrato nem na tela

1. **BLOQUEIO [BE]: `admin-create-batch` não tem CORS.** `supabase/functions/_shared/responses.ts` diz "aqui não há CORS" e o handler responde 405 a tudo que não é POST, inclusive o `OPTIONS` do preflight. O navegador do admin (outra origem que `*.supabase.co`) nunca consegue criar um lote: o preflight falha, o POST não sai e nenhum lote é criado (não há risco de lote sem arquivo por isso). A função precisa tratar `OPTIONS` e devolver `Access-Control-Allow-Origin` (a lista de origens do app), `Allow-Headers: authorization, apikey, content-type`, `Allow-Methods: POST, OPTIONS` e `Access-Control-Expose-Headers: X-Batch-Id, Content-Disposition` (como `_shared/http.ts` já faz para as outras funções). Não mexi em `supabase/`. No front, o 200 nunca descarta o pacote: se `X-Batch-Id` não for legível, o arquivo sai como `lote-novo.zip` e a tela diz o que fazer. O e2e simula o pior caso (CORS liberado, cabeçalho não exposto).
2. **Selos de situação neutros.** As telas pintam "Bloqueado" de âmbar e "Anulado" de vermelho; o DESIGN.md reserva âmbar ao modo perdido e vermelho à ação destrutiva. Só "Ativo" leva cor (verde); "Bloqueado" é selo com contorno, os outros neutros. Vale o DESIGN.md.
3. **Chip "Conta" da auditoria removido** (a tela tem Ativação, PIN, Lotes, Vínculos, Situação e Conta). O `audit_log` desta spec não tem eventos de conta. O banco filtra por UM evento: os chips agrupam e filtram as linhas já carregadas; quando nenhuma das carregadas serve e há mais, a tela oferece "Carregar mais". Sem o total ("Mostrando 6 de 128"): o backend não devolve total.
4. **Subtítulo e aviso sem "o PDF das etiquetas"**: o pacote hoje só tem `pins.csv` (T084 bloqueada). O aviso diz que o PDF ainda não é gerado aqui.
5. **Quinto cartão de número, "Bloqueados"** (a tela tem quatro): o admin precisa ver quantos estão bloqueados.
6. **Fila: pedidos de 2ª via sem "Pet e tutor"** e **detalhe: tutor só como "Ana S."** (sem e-mail): as RPCs não devolvem. O detalhe não mostra e-mail nem telefone do tutor.
7. **"Reimprimir seleção" e "Reimprimir QR" desativados** com o motivo; `LABELS_AVAILABLE` em `features/admin/admin-format.ts` liga quando `admin-labels` existir (e ligar exige a chamada, que hoje não há).
8. **"Criar lote" em painel na página, não em overlay**, e o PIN novo (admin e tutor) numa seção da página: `z-alert-dialog` fecha com Esc e o PIN só aparece uma vez. O `remove-pet` (T071, Phase 8) tinha o mesmo risco; corrigido depois (ver "Correções de acompanhamento").
9. **`too_many_requests`**: o texto do `tagErrorMessage` era "Muitos pedidos em pouco tempo. Tente de novo em X" e divergia do contrato; agora "Muitas ações em pouco tempo. Aguarde X." (X = "um minuto" sem a informação do servidor).
10. Títulos de rota: `/admin` passou de "Administração — Faro" para "Lotes — Faro" (e `app.routes.spec.ts` acompanha).
11. **axe e o sonner**: o toast do `ngx-sonner` é uma `<ol>` cujos filhos não são `<li>` (violação `list`, grave). Nos e2e o axe roda com o toast fora da tela. Problema da biblioteca copiada; não corrigido.
12. **Piso de 150 ms**: a função `resolve-tag` já aplica; o código com dígito errado nunca chegava nela e respondia na hora. O servidor do app agora aplica o piso a `not_found`, `available` e contingência (o `rate_limited` visto daqui).
13. `eslint.config.js`: `scope` (de `<th scope>`) entrou em `ignoreAttributes`.

Textos novos (não estavam no contrato nem nas telas): "Lotes de tags", "Cada lote gera os códigos e os PINs dos cartões.", "Quantidade de tags", "Observação (opcional)", "De 1 a 500. Um lote de 54 leva cerca de 10 segundos; lotes grandes levam bem mais.", "Informe um número inteiro de 1 a 500.", "Gerar N códigos?", "O arquivo com os PINs dos cartões baixa agora e aparece uma vez só. Não dá para baixar de novo: guarde-o até imprimir os cartões.", "Gerar lote e baixar", "Gerando os códigos…", "Não feche esta página. O arquivo baixa sozinho quando terminar.", "Lote criado", "O arquivo X foi baixado e tem os PINs dos cartões. Confira a pasta de downloads agora: ele não aparece de novo. Se não encontrar, reemita o PIN de cada código na tela do código.", "Não recebemos a resposta. O lote pode ter sido criado sem o arquivo: confira a lista de lotes e, se houver um lote sem arquivo, reemita o PIN de cada código na tela do código.", "Nenhum lote criado ainda" e o apoio, "Não baixado", "Exportar códigos", "Códigos de X exportados, sem PINs.", o aviso do pacote ("O arquivo traz os PINs dos cartões e só existe no download original. Guarde-o até imprimir os cartões. O PDF das etiquetas ainda não é gerado aqui: use o script local de etiquetas. “Exportar códigos” baixa só os códigos, sem PINs."), "a página mostra “tag não encontrada”", "Buscar", "Código, pet ou tutor", "Todos os lotes", "A reimpressão chega com a geração das etiquetas. Por enquanto, reimprima pelo script local.", "Nenhum código encontrado", "Confira a busca e os filtros, ou volte para a lista completa.", "Limpar busca e filtros", "Anterior", "Próxima", "N selecionados.", "Limpar seleção", "Sem vínculo", "Nunca escaneada", "Último scan: …", "Voltar para Códigos", "Não encontramos este código", "Confira o código ou procure na lista.", "Ver códigos", "Usado em …", "Ainda não usado", "tentativas erradas (24 h)", "Travada até …", "Sem vínculo no momento.", "Ninguém escaneou este código ainda.", "Mostrar todos os N scans", "Mostrar menos", "Só para tag disponível: encerre o vínculo antes", "Este código não tem vínculo ativo", "Indisponível até a geração das etiquetas", "Desbloquear código", "A página da tag volta a funcionar", "Código anulado: não há mais ações. O histórico fica guardado.", os títulos e textos das confirmações (bloquear, desbloquear, reemitir, encerrar, trocar, anular), "Motivo do encerramento" (Suporte, Tag danificada, Tag perdida), os avisos ("Código bloqueado.", "Código desbloqueado.", "Código anulado.", "Código anulado. Envie uma tag nova ao tutor.", "PIN reemitido.", "Vínculo encerrado.", "Pedido marcado como resolvido."), "PIN novo da tag X", "Este PIN não aparece de novo. Anote ou copie agora, antes de sair desta tela.", "Copiar PIN", "PIN copiado.", "Concluir", "Nada pedindo atenção agora" e o apoio, "Nenhum scan sem vínculo.", "Nenhum pedido aberto.", "Nenhuma tag travada.", "Erros de PIN", "Mostrando os 100 mais recentes.", "Código ou lote", "Filtrar", "Nenhum evento encontrado", "Nenhum dos eventos já carregados é deste tipo. Carregue mais eventos ou volte para todos.", "Ver todos os eventos", "Mostrando N eventos", "conta logada", "visitante", "sistema", os nomes dos eventos ("Tag liberada pelo tutor", "Conta travada por PIN errado", "Tag travada por PIN errado", "Pacote do lote baixado", "Códigos exportados", "Vínculo encerrado pelo admin", "2ª via pedida", "Pedido de 2ª via fechado", "Situação do código alterada", "Modo perdido ligado" e "desligado"), as palavras do detalhe ("troca de tag", "liberada pelo tutor", "passada adiante", "encerrado pelo admin", "conta excluída", "resolvido", "cancelado", "N erros em 24 h"), as mensagens de erro do admin (`adminErrorMessage`), "Tag de X", "Vinculada a X desde …", "Bloqueada", "X ainda não tem tag", "Vincule uma tag para gerenciá-la aqui.", "A tag fica livre e ganha um PIN novo", as confirmações da tag (passar adiante, desvincular, 2ª via danificada, 2ª via perdida: "Anular e pedir tag nova"), "A tag foi desvinculada", "A tag foi liberada", "Pedido registrado" e os dois textos de pedido registrado, "Tag liberada para o próximo dono.", "Tag desvinculada.", "Pedido de 2ª via registrado.", "Não conseguimos carregar a tag. Verifique sua conexão e tente de novo." e, em T106, "Você chegou ao limite de pets desta conta. Fale com o suporte." (do contrato) e "Muitas ações em pouco tempo. Aguarde um minuto." (do contrato).

### Checklist de estados vazio, de carregamento e de erro (T095)

Cada estado termina num próximo passo: carregamento é transitório ("Um instante…"); erro tem "Tentar de novo" (ou, sem acesso, a mensagem de que a conta não tem acesso); vazio tem um botão ou link.

| Tela | Vazio | Erro |
|---|---|---|
| Painel | "Cadastre o seu primeiro pet" + "Cadastrar pet" | "Tentar de novo" (ou texto do limite) |
| Seus pets | "Nenhum pet ainda" + "Adicionar pet" | "Tentar de novo" |
| Página do pet | pet sem tag: "Vincular tag"; pet de outro tutor: "Ver meus pets" | "Tentar de novo" |
| Histórico de scans | "Ninguém escaneou a tag ainda" + "Voltar ao painel"; filtro: "Ver todos os scans" | "Tentar de novo" |
| Modo perdido, Visibilidade, Vincular, Gerenciar tag | sem tag: "Vincular tag"; pet inexistente: "Ver meus pets" | "Tentar de novo" |
| Admin: Lotes | "Nenhum lote criado ainda" + "Criar lote" | "Tentar de novo" |
| Admin: Códigos | "Nenhum código encontrado" + "Limpar busca e filtros" | "Tentar de novo" |
| Admin: Detalhe | "Não encontramos este código" + "Ver códigos" | "Tentar de novo" |
| Admin: Fila | "Nada pedindo atenção agora" + "Ver códigos"; cada seção vazia diz que está vazia | "Tentar de novo" |
| Admin: Auditoria | "Nenhum evento encontrado" + "Ver todos os eventos" (ou "Carregar mais") | "Tentar de novo"; erro ao carregar mais fica abaixo da lista |

Em todas, `forbidden` (conta sem acesso) mostra a mensagem sem "Tentar de novo" (repetir não adianta).

### Verificação

- `npm run lint` limpo; `npm test -- --watch=false`: 126 arquivos, 1310 testes (1 pulado); `npm run build:stats`; `check:ui`, `check:bundle` (o fecho público não importa admin nem app autenticado; rota da tag 133,5 kB gzip, meta de 100 kB segue não atingida), `check:headers`, `check:secrets`, `check:templates` verdes. `ng extract-i18n`: 1408 mensagens, sem erro.
- e2e simulado (`npx playwright test`): 288 passaram (eram 255; 21 do admin e 12 de gerenciar tag e 2ª via), todos com axe, sem rolagem horizontal, nas três larguras e, no app do tutor, no escuro.
- Capturas das telas novas, nas três larguras (e no escuro onde há app do tutor), em `scratchpad/shots-003-fase9a12`, sem PIN visível (a caixa do PIN é conferida pelo DOM): olhei lotes, criar e confirmar lote, códigos, detalhe, confirmação, fila, auditoria e gerenciar tag.

### Não verificado

- **Criar lote ponta a ponta** (browser, função e banco): bloqueado pela falta de CORS na função (item 1). A função em si foi testada pelo `deno test` do backend; o front, por teste unitário e e2e simulado.
- As telas do admin no navegador contra o banco de verdade (o `environment.e2e.ts` não existe e não mexi em `src/environments/*`); as respostas foram conferidas por script contra o banco local.
- Lote grande (500) e o tempo da função; leitura de QR físico; Safari do iOS.
- `admin-labels`, reimpressão e T085: bloqueadas.

### Ajustes depois da revisão (mesma rodada)

- **PIN novo à vista.** A caixa do PIN do admin e o painel do PIN de "Gerenciar tag" levam a tela e o foco para o título quando aparecem (o botão que abriu o diálogo sai do DOM e o admin pode estar rolado até as ações). O e2e confere `toBeInViewport()` e o foco, nas três larguras.
- **Ordem do detalhe do código.** No celular e no tablet "Ações" vem logo depois de "Vínculo atual", como em `V2-admin-codigo*.dc.html`; no desktop as ações ficam na coluna da direita.
- **Códigos nos testes.** `T6EV-BXPY-W` e `TJ27-9DDB-B` (em `codes.spec.ts` e `queue.spec.ts`) são dos vetores SINTÉTICOS (`specs/003-tag-qr/contracts/tag-code.vectors.json`, que declara "nenhum destes é um código real"); o resto vem do seed (`e2e/fixtures/seed-codes.json`). Nenhum código nem PIN do lote-001 foi aberto.
- **Banco local.** A pilha local foi parada e o volume `supabase_db_wt-003` apagado: os testes por script tinham mexido nele (PIN reemitido de uma das tags disponíveis do seed, pedidos de 2ª via, pets de teste). `supabase start` recria tudo do zero com o seed.

### Tarefas [FE] ainda abertas na spec inteira

- **T024A** (verificação da hospedagem no preview da Vercel): precisa de um deploy de preview e o preview fica atrás de SSO; sem token de bypass não dá para conferir por `curl`. É do William ou de quem tem acesso ao projeto na Vercel.
- **T025** (`POST /api/scan` e `/api/scan/location` em `src/server.ts`): o código existe, tem testes (413, 415, 400, IP só dos cabeçalhos da Vercel) e funciona no `ng serve`; a tarefa depende de T024A para virar `[x]` e, se a hospedagem reprovar a rota própria do Express, a lógica está pronta para ir para `api/*.ts`.
- **T099** (página de contingência de pré-lançamento): a rota `/:code` de verdade já existe e a tela "Este pet tem dono" (contingência) já é parte dela; a tarefa manda substituir um conteúdo provisório em `features/public/rescue-page/`, que não existe mais, e a mensagem pedida ("Em breve mais informações.") é de antes da página real. Não executei: precisa de uma decisão do William sobre se ainda se quer uma página estática só enquanto o app não estiver no ar.
- T084 e T085 (bloqueadas, `[BE]` e `[QA]`), T100 (`docs/dominio-tagfaro.md`, para o William) e as `[QA]` ficam fora desta lista.

### Pendências que ficam para quem pegar depois

- **`remove-pet` (T071, Phase 8) ainda mostra o PIN novo num diálogo que fecha com Esc**: o tutor pode perder a única visão do PIN. A correção é a mesma de "Gerenciar tag" (PIN numa seção da página). Não corrigido nesta rodada.
- **T106**: as cargas de `activation` (passo do pet) e de `new-pet` em edição seguem com o texto genérico de erro de carga quando o servidor limita as chamadas.
- **T095** pede o checklist "no PR": ele está acima, neste log; falta copiar a tabela para a descrição do PR nº 5.
- **CORS da `admin-create-batch`** (item 1 dos desvios): sem a correção do `[BE]`, "Criar lote" não funciona num navegador e a T083 (e2e do admin) fica bloqueada. Conferido por leitura do código (`_shared/responses.ts` e o handler), não por preflight real: a pilha local subiu sem o `edge-runtime`.

- **Nota sobre o e2e final.** A asserção nova de "PIN à vista" pegou um defeito real (no tablet o overlay do diálogo devolve a rolagem de antes ao sair e desfazia o `scrollIntoView`): o painel do PIN agora é levado à tela de novo quando o diálogo termina de fechar (`zAfterClose`). Depois disso, `admin-ui` e `manage-tag-ui` passaram 33 de 33; a rodada completa anterior tinha dado 287 de 288, com só essa falha. O texto de fim de lote perdeu uma repetição ("O arquivo foi baixado e tem os PINs dos cartões").

## Backend: CORS da `admin-create-batch` (2026-11-25)

Resolve o item 1 dos desvios da rodada de frontend: "Criar lote" não funcionava num navegador (preflight caía em 405 e a resposta não tinha `Access-Control-Allow-Origin`).

- **Inventário.** Chamada direto pelo navegador (precisa de CORS): só `admin-create-batch` (`fetch` em `core/admin/admin-tag.service.ts`). Só pelo servidor SSR, sem CORS de propósito: `resolve-tag` e `register-scan` (cabeçalho `x-faro-ssr-key`). `admin-labels` ainda não existe (T084 bloqueada); quando existir, o admin a chamará do navegador e deve usar o mesmo `withCors`. As funções da 004 já usam `_shared/http.ts`.
- **Mudança.** `_shared/http.ts` ganhou `withCors` e o parâmetro `expose` em `corsHeadersFor`; `createBatchHandler` responde `OPTIONS` (204) e põe CORS em toda resposta. A lista vem de `ALLOWED_ORIGINS` (`BatchDeps.allowedOrigins` permite injetar nos testes). Autorização intacta (JWT + `is_admin()`); contrato `admin.contract.md` atualizado.
- **Testes.** `deno test` novos em `admin-create-batch/handler.test.ts` (preflight permitido e não permitido, POST com e sem origem, cabeçalhos expostos, erros 401/403/400/405/429/500 com CORS, CORS não autoriza) e `_shared/http.test.ts`. Rodam no CI (sem `deno` na máquina). Checagem nova em `scripts/ci/supabase-checks.sh`.
- **Preflight real, na pilha local** (`functions serve`, `ALLOWED_ORIGINS=http://localhost:4200`): POST de tutor comum (403) com origem permitida traz `Expose-Headers: X-Batch-Id, Content-Disposition`; com origem fora da lista não traz. No stack local o Kong responde o `OPTIONS` e põe `Allow-Origin: *` por cima, então o valor exato do `Allow-Origin` só é provado nos testes unitários; no projeto hospedado o `OPTIONS` chega na função. Pilha parada ao fim.

## Frontend: correções de acompanhamento (2026-11-25)

- **`remove-pet` perdia o PIN novo (defeito).** O PIN da tag liberada aparecia num `z-alert-dialog`, que fecha com Esc, e é a única vez em que ele é mostrado. Agora o diálogo só confirma; o PIN fica numa seção da página (`remove-pet-pin-panel`), a tela rola até ela e o foco vai para o título depois que o diálogo termina de fechar (`zAfterClose`, o mesmo cuidado de "Gerenciar tag"). Há "Copiar PIN", o aviso "Anote agora. Ele não aparece de novo." e o PIN só some em "Concluir", ao trocar de pet (`petId` muda: tudo é zerado) ou ao sair da rota (`DestroyRef`). Se a remoção do pet falha depois de a tag ser liberada, a seção continua com o PIN, mostra o erro e oferece "Tentar remover de novo" (não libera a tag outra vez). Não reusei `admin/pin-reveal`: ele tem os testids e o texto do admin e a seção daqui precisa do aviso de erro e do botão de tentar de novo; a fronteira (nada de admin no app do tutor) fica intacta. Testes: unitários (PIN fora do overlay, Esc, foco, copiar, trocar de pet, erro depois da liberação) e e2e simulado nas três larguras, com e sem preferência de tema escuro guardada (a edição é um fluxo, sempre claro: o e2e confere que não há `.dark`), com axe, sem rolagem horizontal e com o PIN na tela e com foco.
- **T106, o que faltava.** Passo do pet da ativação e edição do pet usam o texto do contrato para `too_many_requests` ("Muitas ações em pouco tempo. Aguarde um minuto.", com o tempo do servidor quando houver). Na edição, se `my_dashboard` falha (qualquer motivo), a tela não abre mais pela metade: antes o pet carregava sem a tag e "Remover pet" apagaria o pet sem liberar a tag. Testes novos nas duas telas.
- **T095.** A tabela do checklist foi copiada para a descrição do PR nº 5.


## QA: e2e real, gate de segurança e defeitos (2026-11-25)

Ambiente: Supabase LOCAL (Docker), Edge Functions locais (`functions serve`), `ng serve --configuration e2e` com o servidor SSR falando com as funções (chave do servidor sorteada por rodada) e o servidor de produção construído (`dist/faro/server/server.mjs`). Nada foi enviado ao projeto hospedado. O `environment.e2e.ts` foi gerado localmente a partir de `supabase status`, como o CI faz (ignorado pelo git).

### O que o harness ganhou

- `playwright.e2e-real.config.ts`: o `webServer` passa `SUPABASE_URL`, `SUPABASE_FUNCTIONS_URL`, `FARO_SSR_KEY` e `IP_HASH_SECRET` (da rodada) ao `ng serve`; `reuseExistingServer` só fora do CI.
- `scripts/ci/e2e-prepare.sh`: sorteia `FARO_SSR_KEY` e `IP_HASH_SECRET` por rodada (`openssl rand`, mascarados, nunca versionados; o `check:secrets` barra valor literal) e grava `FARO_SSR_KEY` e `EMAIL_DRIVER=log` no ambiente das funções.
- `e2e-real/global-setup.ts`: cria o pool de tags pelo mesmo caminho do admin (`admin-create-batch`, dois lotes de 24) e guarda código/PIN num arquivo temporário do sistema, fora do repositório. Cada teste que muda uma tag pega um par novo (`takeTag`): `retries` nunca encontra tag já vinculada; o seed só é lido.
- Job `e2e` do CI: constrói a produção e sobe duas instâncias (porta 4300 com as funções locais; 4301 com a URL das funções morta) com `NG_ALLOWED_HOSTS=localhost` (o build só aceita os hosts do produto: sem isso `localhost` recebe 400). Passo novo `scripts/ci/check-pins-in-log.mjs`: procura cada PIN do pool nos logs das funções e do servidor.
- Limites compartilhados: cada teste de página injeta `x-real-ip` próprio nas chamadas a `localhost:4200`, para os limites por origem (30 resolve/min, 20 scan/min) não se misturarem.

### Testes novos (`e2e-real/`)

| Arquivo | Cobre |
|---|---|
| `tag-page.spec.ts` | T035, T057 e parte de T063/T067: cinco estados; sem JavaScript; bloqueada = anulada = inexistente (HTML idêntico fora o código); piso de 150 ms; 3 larguras com axe; 1 scan + aviso (`notified_at`); repetição não duplica; robô e dono não geram scan; localização precisa (`gps`); campo desligado fora do HTML bruto; WhatsApp só com opt-in e celular confirmado; modo perdido |
| `activation.spec.ts` | T049: cadastro pela tela (SMS simulado) → novo pet → PIN → página muda; PIN errado; 5 erros travam a conta e o PIN certo no bloqueio é recusado; 20 erros em várias contas travam a tag; troca (`p_replace`) mantém o PIN da tag antiga; uso único; PIN novo ao liberar e o antigo recusado; mensagem única; tablet e desktop |
| `owner.spec.ts` | T074 (vincular pelo app, item (b)), T057/T091 (histórico do dono; passar adiante; outra conta com o PIN novo; isolamento de scans, vínculos e pets), T067, T063, T071 (PIN à vista; Esc não o esconde), T088 a T090 (2ª via danificada e perdida), painel |
| `admin.spec.ts` | T083: criar lote pela tela e ler o `pins.csv` baixado; ativar com o PIN do arquivo; PIN fora de log, tabela e auditoria; bloquear e desbloquear; scan de tag bloqueada na fila; encerrar vínculo e reemitir PIN; tutor comum fora do `/admin` e `forbidden` em toda RPC `admin_*` |
| `gate-security.spec.ts` | T092/T107: `anon` sem nenhuma das 12 tabelas/visões e sem nenhuma das 30 funções; funções só de servidor negadas a tutor e admin; isolamento A/B (pets, perfil, vínculos, pedidos, scans, colunas privadas, escrita alheia); Storage real; contrato físico (`code`, DELETE, `void`, dígito); anti-enumeração; chave do servidor; limites de taxa; `/api/scan` 413/400/415; nenhum host de terceiro; sem segredo no HTML |
| `prod-server.spec.ts` | T037 e T092 (build): TTFB, LCP e JS no servidor de produção; axe nas telas públicas; contingência com as funções fora do ar (nunca 5xx nem erro técnico) |
| `a11y-screens.spec.ts` | T093: axe e rolagem horizontal em todas as telas do tutor (claro e escuro), fluxos e admin, 3 larguras, dados reais |

### Defeitos de produto (nada foi corrigido; cada um tem `test.fail` com identificador)

| Id | Gravidade | Resumo |
|---|---|---|
| DEF-003-01 | Alta (bloqueia a produção do lote real; não é de segurança) | `admin-create-batch` com 54 códigos (o tamanho do lote real) devolve 500. `admin_insert_batch` gasta ~0,2 s de bcrypt por código e o PostgREST cancela a chamada em 8 s (`authenticator.statement_timeout=8s`): 30 códigos levam ~6 s e passam, 60 voltam 500 após 8,1 s, 54 levam ~8,1 s no CI e falham. A tela "Criar lote" cai no mesmo erro. Esperado: o lote de 54 sai. Onde: `0034_rpc_admin.sql` (bcrypt em transação única) e `admin-create-batch`; sair em fatias de ~20 códigos ou subir o timeout do papel de serviço. Teste: `admin.spec.ts` "DEF-003-01" |
| DEF-003-02 | Média (T037) | JS da rota da tag: 134,2 kB gzip em 29 arquivos, medido no servidor de produção; o orçamento é 100 kB (o log do FE já registrava 133 a 134 kB). TTFB (45 ms) e LCP (112 ms) ficam muito abaixo, na máquina local e com o backend ao lado. Teste: `prod-server.spec.ts` "DEF-003-02" |
| DEF-003-03 | Média | O aviso (toast) do `ngx-sonner` é uma `<ol>` cujos filhos não são `<li>`: axe `list` (serious) enquanto há aviso na tela (reproduzido ao reemitir um PIN no admin). Os e2e simulados esperam o aviso sair. Componente copiado do ZardUI. Teste: `a11y-screens.spec.ts` "DEF-003-03" |
| OBS-1 | Baixa | O HTML de um código com dígito inválido não traz o `TransferState` `faro-tag:<código>` que o de um código válido sem tag (bloqueado, anulado, inexistente) traz; a tela é a mesma. Só distingue "dígito inválido" de "dígito válido", o que o algoritmo público já permite; não revela existência, bloqueio nem anulação |
| OBS-2 | Baixa | `POST /rest/v1/my_scans` como `anon` responde 500 ("view não atualizável") em vez de 401/403. Nenhum dado, nenhuma escrita |
| OBS-3 | Baixa | `tag_pin_attempts`, `tag_batches`, `audit_log` e `rate_limits` têm privilégio de SELECT para `authenticated` e a RLS devolve zero linhas (não 403). O resultado é o mesmo (nega); o teste prova com controle positivo (o `service_role` vê linhas) |
| OBS-4 | Baixa | O servidor de produção construído recusa `localhost` com 400 (`allowedHosts`): o roteiro do quickstart (`npm run build && npm run serve:ssr:faro`, abrir `localhost:4000`) não funciona como está; precisa de `NG_ALLOWED_HOSTS=localhost` |

### Respostas aos itens (a) e (b)

- (a) `login-guard` com `phase: post_result, success: true` sem sessão NÃO zera o contador. Não há `DELETE` nem reset: a linha de sucesso é uma inclusão e `record_login_attempt` conta só as falhas da janela de 15 min (por identidade e por IP). Provado por leitura da função e por chamada real (depois do bloqueio, `success:true` continua devolvendo `block`). O limite por conta não é contornável por esse caminho. Efeito conhecido: o eixo por IP bloqueia todas as contas que usam o mesmo IP por 15 min.
- (b) O WhatsApp vem MARCADO também na tela de PIN do "vincular tag pelo app" (`/vincular/<pet>`), com o mesmo aviso da ativação. O CLAUDE.md fala em marcado só na ativação. Registrado, não alterado (`owner.spec.ts`, T074, `toBeChecked()` com comentário). Desmarcar na tela funciona: a página pública sai sem `wa.me`.

### Rotação da chave do servidor (T107, parte executada)

Executada uma vez na pilha local, nos dois passos do contrato: (1) só a chave antiga: antiga 200, nova 401; (2) `FARO_SSR_KEY` = nova e `FARO_SSR_KEY_PREVIOUS` = antiga: as duas 200; (3) apaga a `_PREVIOUS`: antiga 401, nova 200. Estado inicial restaurado. O passo a passo ainda não está em `quickstart.md` (não posso editar `specs/` além das caixas): T107 fica aberta.

### Tarefas

- Fechadas com prova: T035, T049, T057, T063, T067, T074, T083, T091, T092.
- Abertas: T037 (DEF-003-02), T093 (DEF-003-03), T097 (divergências abaixo; não edito `specs/`), T107 (falta o roteiro de rotação no quickstart), T098 (gate humano: `/security-review` e `/code-review`).
- Bloqueadas por decisão: T084 e T085 (etiquetas), T024A e T037A (preview da Vercel atrás de SSO), T025, T099, T100.
- 004: T093 a T096 NÃO fechadas. Os itens que dependem da rota da tag passam (a rota abre sem sessão e sem redirecionar para `/auth`, `check:ui` verde, nada de `primeng`), mas `git diff develop -- src/app/features/public` não é vazio por construção (a 003 implementou a página pública), e T094 (os 12 itens do portão da 004) e T096 pertencem à rodada de QA da 004.

### Divergências do quickstart (T097)

1. "senha de desenvolvimento no `seed.sql`" e "Tutora `ana@email.com`": o seed tem `tutor.a@faro.test`, `tutor.b@faro.test` e `admin@faro.test`; a senha é a do script de CI.
2. "PIN de desenvolvimento no `seed.sql`": os PINs estão em `e2e/fixtures/seed-codes.json` (`devPins`, só das três tags `available`).
3. `functions serve` cita `admin-labels` (não existe) e o roteiro 10 fala em "baixar o pacote" com etiquetas (só há `pins.csv`).
4. As variáveis do servidor SSR "em `.env` local": o servidor Node lê `process.env`, não carrega `.env`.
5. `npm run build && npm run serve:ssr:faro` e abrir `localhost:4000`: 400 por `allowedHosts` (OBS-4). O roteiro 10 manda criar "um lote de 6", que funciona; um lote de 54 não (DEF-003-01).
6. Os passos 1 a 10 foram exercitados pelos testes acima (resgate, mesma mensagem, normalização, scan, ativação, PIN errado, modo perdido, visibilidade, passar adiante, admin), e não por uma execução manual em máquina limpa.

### Gate de segurança: expectativa → prova

Veredito de segurança: nenhuma expectativa falhou. Veredito geral: AMARELO (DEF-003-01 a 03 abertos; T037, T093, T097 e T107 abertas).

| Expectativa | Prova (arquivo: teste) |
|---|---|
| Tutor A não lê nem altera pets, perfil, vínculos, pedidos, scans de B | `gate-security.spec.ts`: "isolamento entre tutores"; pgTAP `rls_tags_base`, `rls_scans`, `rpc_my_dashboard`, `rls_perfis*` |
| `anon` sem tabela e sem função | `gate-security.spec.ts`: "anon não lê <tabela>" (12) e "anon não executa nenhuma função da spec" (30); pgTAP `security_catalog`, `rls_tags_base`; `supabase-checks.sh` |
| Funções só de servidor negadas a tutor e admin | `gate-security.spec.ts`: "funções só de servidor"; pgTAP `rls_tags_base` |
| `authenticated` sem `activation_pin_hash`, `ip_hash`, token de localização | `gate-security.spec.ts`: "colunas privadas"; pgTAP `rls_tags_base`, `rls_scans` |
| Página pública só mostra o consentido (cada interruptor; WhatsApp só com opt-in e celular confirmado) | `tag-page.spec.ts`: "campo desligado ... HTML bruto", "WhatsApp e telefone não ligam sem celular confirmado"; `owner.spec.ts` T067; pgTAP `rpc_resolve_tag` |
| Scans de um vínculo antigo não aparecem para o novo dono, nem os novos para o antigo | `owner.spec.ts` T057/T091; pgTAP `rls_scans`, `account_tags` |
| PIN: sem PIN certo não há vínculo; 5 erros bloqueiam a conta; PIN certo no bloqueio é recusado | `activation.spec.ts`: "PIN errado: ... 5 erros bloqueiam"; pgTAP `rpc_activate_tag` |
| PIN: 20 erros em 24 h travam a tag (até para o PIN certo) | `activation.spec.ts`: "bloqueio por tag" |
| PIN: uso único; PIN novo ao liberar; PIN antigo recusado | `activation.spec.ts`: "uso único"; `owner.spec.ts` T071; `admin.spec.ts` reemitir |
| PIN mantido na troca de tag e na exclusão de conta | `activation.spec.ts`: "pet que já tem tag"; pgTAP `rpc_activate_tag` (troca), `account_tags` ("PIN vigente é mantido") |
| Contadores de PIN não são desfeitos por caminho lateral | pgTAP `rpc_activate_tag`, `account_tags`; NÃO reexaminado em navegador |
| PIN nunca em log, resposta de erro, tabela, URL, storage, auditoria | `scripts/ci/check-pins-in-log.mjs` (CI); `activation.spec.ts` (URL e storage); `admin.spec.ts` e `gate-security.spec.ts` (tabela, auditoria); pgTAP `rpc_activate_tag` |
| Mensagem única (inexistente = bloqueado = anulado), também na ativação | `tag-page.spec.ts` (HTML idêntico); `gate-security.spec.ts` (corpo, status e cabeçalhos); `activation.spec.ts` ("tag inválida, bloqueada..."); pgTAP `rpc_resolve_tag` |
| Dígito inválido não chega ao banco; limite por origem | `gate-security.spec.ts` ("anti-enumeração", "limite por origem"); `activation.spec.ts` (`invalid_code`); pgTAP `rpc_resolve_tag` |
| Piso de 150 ms nos estados que não são o resgate | `tag-page.spec.ts`; `gate-security.spec.ts` (servidor real) |
| Chave do servidor errada ou ausente: 401 de corpo vazio | `gate-security.spec.ts`; `deno test` (`_shared/auth`) |
| Limites de taxa no servidor (resolve 30/min, scan 20/min, ativação 30/15 min, lote 10/h) | `gate-security.spec.ts`; pgTAP `endurecimento_tags` (31ª de `activate_tag` = `locked`); 429 do `admin-create-batch` visto ao esgotar as 10/h |
| Contrato físico: `code` imutável, nunca apagado, `void` irreversível, dígito inválido recusado | `gate-security.spec.ts`: "contrato físico" (até com `service_role`); pgTAP `rls_tags_base` |
| Código: normalização e vetores idênticos no TS e no SQL | `tag-code.sql-sync.spec.ts` (app), `tag_code.test.sql` (pgTAP), `_shared/tag-code.test.ts` (deno); `activation.spec.ts` e `gate-security.spec.ts` (`invalid_code` na entrada) |
| Nenhuma URL de tag usa outro domínio | `gate-security.spec.ts` ("nenhuma URL de tag..."; `qr-payload` só aceita o domínio); `qr-payload.spec.ts` |
| Rescue-First: contingência com a função fora do ar | `prod-server.spec.ts` (servidor de produção com URL morta, nunca 5xx nem texto técnico) |
| `resolve_tag` e `register_scan` sem cobrança; scans de tag bloqueada na fila do admin | pgTAP `rpc_resolve_tag`, `rpc_register_scan`, `rpc_admin`; `admin.spec.ts` (fila) |
| Robô e dono não geram scan nem e-mail; repetição em 10 min não duplica | `tag-page.spec.ts`; pgTAP `rpc_register_scan` |
| Admin só com `is_admin()` (RPC e Edge Function) | `admin.spec.ts`: "tutor comum não entra no admin"; pgTAP `rpc_admin`, `endurecimento_tags`; `deno test` |
| Auditoria sem dado pessoal nem PIN | `admin.spec.ts`; pgTAP `rpc_activate_tag`, `account_tags`, constraint de `audit_log` |
| Storage `pet-photos`: A lê e grava no prefixo; B, anon e prefixo alheio negados; tipo e 5 MB | `gate-security.spec.ts`: "Storage pet-photos (real)"; pgTAP `storage_pet_photos` |
| Nenhum segredo em `dist/`; bundle público sem chunks do app autenticado; nenhum `primeng` | `npm run check:secrets` (varre `dist/`), `check:bundle`, `check:ui` (job `app`); `prod-server.spec.ts` (HTML e scripts da rota sem segredo nem código do app autenticado) |

## Correcao do DEF-003-01 (lote de 54 codigos devolvia 500) e OBS-2

- **Causa**: `admin_insert_batch` fazia o bcrypt custo 12 de todos os PINs num so statement (~0,15 a 0,2 s por codigo); o PostgREST cancela em 8 s.
- **Correcao** (migration `0036_batch_hash_separado.sql`, sem mexer em 0020-0035): `admin_hash_pins(text[])` (so `service_role`, ate 10 PINs, nao grava nem audita) calcula os hashes; `admin_insert_batch` passa a receber `{code, pin_hash, qr_mask}` (bcrypt custo 12 conferido por regex; `pin` em claro recusado) e grava lote + codigos + um evento de auditoria numa transacao. A Edge Function pede os hashes em fatias de 10 (3 em voo), depois chama `admin_insert_batch` uma vez; na colisao so os itens trocados ganham PIN e hash novos. Custo do bcrypt (12) e `statement_timeout` intactos.
- **Tempos medidos** (stack local, Windows, Docker Desktop, 1 execucao cada): 54 codigos em ~8,2 s; 500 codigos em ~49 s pela Edge Function.
- **OBS-2**: `my_scans` ganhou gatilhos INSTEAD OF que negam escrita (42501) e perdeu os privilegios de escrita de `service_role`; `POST /rest/v1/my_scans` como `anon` agora responde 401 `42501` (antes 500). Era a ordem do Postgres (o rewrite recusa a escrita em visao com join antes de checar privilegio). `my_scans` e a unica visao do schema `public`.
- **Testes**: pgTAP `rpc_admin` (privilegios, validacao e limite de `admin_hash_pins`; hash malformado, custo 10, `pin` em claro e formato antigo recusados) e `rls_scans`; `deno test` do handler (fatias, 3 em voo, colisao com reaproveitamento de hash, falha de fatia, falha do insert, limite de taxa tocado uma vez); `admin.spec.ts` (54 e 500 reais, sem `test.fail`) e `gate-security.spec.ts` (`admin_hash_pins` nas listas de funcoes so de servidor).

## Correcoes de frontend apontadas pelo QA (DEF-003-03, WhatsApp ao vincular, DEF-003-02)

- **DEF-003-03 (aviso/toast)**: o `ngx-sonner` rende `<ol><ngx-sonner-toast><li role="status" aria-live>`. O `role="status"` tira o `<li>` do papel de item e o axe reprova a `<ol>` (`list`, grave). Correcao no `ZardSonnerComponent` (componente copiado): um `MutationObserver` (so no navegador) poe `role="presentation"` na `<ol data-sonner-toaster>`, que e so contêiner de posicao; cada aviso segue como regiao viva (`aria-live="polite"`). Regra do axe mantida. Prova: e2e simulado novo em `e2e/dev-gallery.spec.ts` (axe COM o aviso visivel, antes da correcao reprovava `list`) e teste unitario do componente; `test.fail` removido de `e2e-real/a11y-screens.spec.ts`.
- **WhatsApp ao vincular pelo app**: o passo do PIN (`PinStep`) passa a iniciar o WhatsApp **desmarcado** quando `variant = 'link'`, com o apoio "Se voce marcar, seu WhatsApp vai aparecer ... Voce pode mudar depois em O que estranhos veem". A ativacao pela tag (`activate`) continua marcada e com o aviso. Commit isolado, facil de reverter. Testes unitarios, e2e simulado e `owner.spec.ts` (T074) ajustados.
- **DEF-003-02 (JS da rota publica, 134 kB gzip contra meta de 100 kB)**: medido, sem corte seguro que chegue a meta; `test.fail` mantido. Tabela por pedaco abaixo (gzip nivel 6 do fecho da rota `/:code`, 30 arquivos, 134,8 kB; `check:bundle` aponta 133,5 kB).

| Pedaco | gzip kB |
| --- | --- |
| `@angular/core` | 53,7 |
| `@angular/router` | 20,9 |
| `features/public` (pagina, resgate, contingencia) | 10,1 |
| `tailwind-merge` (usado por button, icon-tile, pet-avatar) | 8,7 |
| `@angular/common` (inclui http da hidratacao) | 7,6 |
| `rxjs` | 6,3 |
| `@angular/platform-browser` | 5,2 |
| Boxicons (30 icones registrados na raiz) | 5,2 |
| shells, logo, brand-panel, button, info-card etc. (codigo do Faro) | ~12 |
| `@ng-icons/core`, `tslib`, `cva`, `clsx`, `localize` | ~3,5 |

  Piso: Angular (core + router + common + platform-browser + rxjs + tslib + localize) ≈ 94,8 kB. Cortes avaliados e nao feitos: (a) registrar so os icones da pagina publica na raiz e o resto nas rotas autenticadas, ~3 kB, exige reorganizar `app.routes.ts` e arrisca icone ausente em overlays; (b) trocar `tailwind-merge` por `clsx` nos 3 componentes alcancados, ~8,7 kB, muda a resolucao de classes em sobrescritas (`w-full text-lg` sobre o tamanho do botao). Com os dois, ~122 kB; 100 kB nao e alcancavel sem tirar o roteador.

## QA: auditoria, contadores de PIN e conferência da 0036 (2026-11-25)

**Veredito do gate: VERDE, com um achado de gate que já foi corrigido (DEF-003-04) e três riscos registrados (R-AUD-1, R-AUD-2, R-HASH-1).**
Pilha local própria da rodada (db reset, `supabase test db` completo na base limpa: 30 arquivos, PASS). Nada do Supabase hospedado foi tocado.

### DEF-003-04: o gate "nenhum PIN nos logs" nunca podia falhar (gravidade ALTA para o gate, nenhuma para o produto)

`scripts/ci/check-pins-in-log.mjs` montava o padrão com `` new RegExp(`\b${pin}\b`) ``. Em template literal `\b` é o caractere de retrocesso (U+0008), não o limite de palavra: o padrão **nunca casava**, mesmo com o PIN plantado no log. O passo "PINs nos logs" do CI (inclusive no run 45580957555) passava vazio. Medido: com o padrão antigo, um texto com o PIN dá `false`; com `\\b`, `true`.
Correção (é script de teste, não produto): `\\b`, uma **prova de que o detector detecta** (planta o primeiro PIN num texto e exige o casamento; senão sai com 2) e `PIN_POOL_FILE` para conferir outros lotes. Controle feito: log com PIN plantado dá `exit 1`.
Agora o passo confere também os **logs dos containers do Supabase** (PostgREST, banco, gateway, Auth: o PIN em claro passa por eles a caminho da função) e os **500 PINs do lote grande** (`admin.spec.ts` grava o arquivo temporário).
Medida local depois da correção, com o detector provado: 48 PINs do pool e 500 PINs do lote de 500, em 11 logs (os 10 containers e o `functions serve`): **nenhum**. Os logs não estavam vazios (banco 680 KB, gateway 187 KB, chamadas a `admin_hash_pins` visíveis no gateway).

### 1. Auditoria: evento → onde é gravado → teste

Lista: constituição, Princípio VII, e CLAUDE.md "Auditoria".

| Evento da lista | Gravado em | Prova |
| --- | --- | --- |
| Scans | `scan_events` (linha ligada ao vínculo vigente; `ip_hash`), por `register_scan` (0030); não vai para `audit_log` (por desenho) | `rpc_register_scan`, `rls_scans`, `gate-security.spec` (isolamento entre vínculos) |
| Criação de lote | `audit_log`: `batch_created` (só a quantidade), `batch_package_downloaded`, `codes_exported`, `admin_rate_limited` (0034, 0035, 0036) | `rpc_admin`; **novo** `auditoria_eventos`, `batch_atomicidade` |
| Emissão e reemissão de PIN | `batch_created` (emissão do lote), `pin_reissued` (reemissão do admin), `tag_released` (o PIN novo do tutor sai na liberação; não há evento próprio) | `rpc_admin`, `rpc_release_tag`; **novo** `auditoria_eventos`, `pin-counters.spec` |
| Tentativas de ativação falhas e bloqueios | `activation_failed`, `activation_locked_account`, `activation_locked_tag` (0035) | `rpc_activate_tag`; **novo** `auditoria_eventos`, `pin_contadores_laterais`, `pin-counters.spec` |
| Criar vínculo | `tag_activated` (0035) | `rpc_activate_tag`; **novo** `auditoria_eventos` |
| Encerrar vínculo | `tag_released` (liberar, trocar), `assignment_ended_by_admin`, `account_tags_released` (exclusão de conta), `tag_status_changed` (2ª via perdida) | `rpc_release_tag`, `rpc_admin`, `account_tags`; **novo** `auditoria_eventos` |
| Transferir vínculo | `tag_released` com `reason = transferred` | `rpc_release_tag`; **novo** `auditoria_eventos` |
| Mudança de status do código | `tag_status_changed` (de, para, observação do admin) | `rpc_admin`, `rpc_release_tag`; **novo** `auditoria_eventos` |
| Reimpressão | **não gravado**: `labels_reprinted` só existe nos contratos; `admin-labels` (T084 🔒) não existe, e os botões de reimpressão estão desativados | nenhuma (não aplicável até a T084); quando a T084 entrar sem o evento, vira defeito |
| Eventos de autenticação | `auth_audit_log`: `conta_criada`, `termos_aceitos`, `logout`, `email_confirmado`, `senha_alterada`, `senha_recuperacao_solicitada`, `login_sucesso`, `login_falha`, `login_bloqueado` | `auditoria_auth_users`, `funcoes_conta`, `conta_estado_inicial`; `login-guard/handler.test.ts` (falsos); **novo** `audit-events.spec` (`login_sucesso` e `login_falha` pela função real) |
| Acessos e exclusões de dados | `dados_exportados` e `conta_excluida` (`auth_audit_log`), `account_tags_released` | `conta_privacidade`, `account.spec`, `account_tags`. **Leituras do admin** (`admin_code_detail`, `admin_list_codes`, `admin_scan_queue`, `admin_audit`) **não geram evento**: R-AUD-2 |

Testes novos desta parte: `supabase/tests/auditoria_eventos.test.sql` (44 asserções) dispara 17 eventos com chamadas reais e prova (a) o conjunto exato, (b) chaves do detalhe numa lista fechada, (c) nenhum PIN antigo ou novo, telefone, e-mail ou IP em `detail`, `entity`, `entity_id` nem `actor_role` (o cenário planta telefone e e-mail no recado do modo perdido e no cadastro), (d) ator vindo do JWT, (e) inventário: toda chamada `audit('...')` do banco está na lista, (f) a tabela é só de inserção, até para `service_role`. `e2e-real/zz-audit-sweep.spec.ts` roda por último e varre **todas** as linhas de `audit_log` e `auth_audit_log` da rodada contra os PINs do pool e do lote de 500; controle feito (linha plantada com PIN reprova).

**R-AUD-1 (baixo)**: a observação livre do admin em `admin_set_status` (até 200 caracteres) vai inteira para `detail.note`. A barreira da tabela só olha nomes de chave; um telefone ou e-mail digitado na observação fica para sempre no `audit_log`. Teste `todo` documentado em `auditoria_eventos` (falha esperada). Sugestão: avisar na tela "não escreva dados pessoais" ou recusar dígitos e `@` na observação.
**R-AUD-2 (baixo a médio)**: o Princípio VII lista "acessos a dados". As leituras do admin devolvem nome curto, nome do pet e cidade/região dos scans, sem registro. Decisão do William: aceitar para o MVP ou gravar `admin_viewed_code`.

### 2. Contadores de PIN não se desfazem por caminho lateral

`supabase/tests/pin_contadores_laterais.test.sql` (84 asserções, chamadas reais) e `e2e-real/pin-counters.spec.ts` (pilha inteira). Para a conta e para a tag, com o bloqueio de pé e sem ele:

| Caminho | Resultado |
| --- | --- |
| PIN certo de OUTRA tag | contadores e instante do bloqueio intactos |
| Liberar outra tag; trocar a tag de um pet (`p_replace`); trocar de pet entre as tentativas | intactos |
| Criar e remover pet | intacto |
| Começar e abandonar ativação pendente | intacto |
| Sair e entrar de novo | intacto; no e2e, `logout` e novo login reais no Auth, o 5º erro (3 da sessão antiga + 2) bloqueia, o PIN certo continua recusado e o instante do bloqueio não muda |
| PIN certo durante o bloqueio da conta e da tag | `locked`; não reduz nem aumenta contador |
| Outra conta na mesma tag | soma na tag, não mexe na conta de A; 4 contas x 5 erros = 20 travam a tag por 24 h para todos, e conta que nunca errou com o PIN certo recebe `locked` |
| Jobs do cron (`cron_cleanup_tags`, `cron_resend_scan_notices`) | não tocam em contadores nem em bloqueios; só apagam `rate_limits` com mais de 48 h e ativações pendentes vencidas (controle: apagam o que é velho e mantêm o de 47 h); `cron.job` tem só os dois jobs, e os comandos são só essas funções |
| Reemissão de PIN pelo admin | **zera de propósito**: tentativas de todas as contas, contador da tag e bloqueio; PIN antigo passa a ser `wrong_pin`; PIN novo ativa. Bate com `admin.contract.md` ("gera PIN novo, zera contadores"). É o único caminho que levanta um bloqueio antes da hora, e é auditado (`pin_reissued`, detalhe vazio) |
| Excluir a conta | zera a linha da conta (cascata), **não** o contador da tag nem o bloqueio dela |

Risco registrado, não defeito: o contador por conta é reiniciável por excluir e recriar a conta (celular novo confirmado por SMS); a salvaguarda é o limite por tag (20 em 24 h), provado.

### 3. Conferência da 0036

- `admin_hash_pins` por HTTP real (`e2e-real/batch-hash.spec.ts`): `anon`, tutor novo, tutor do seed e admin logado recebem 401/403, **nunca 404**, e a resposta não ecoa o PIN. Atenção: o `gate-security.spec` chama as RPCs com corpo `{}` e aceita 404; para uma função com argumento obrigatório essa prova pode ser vazia (risco de harness, não alterado). Aqui a chamada tem o formato certo, e o controle com a chave de serviço devolve hashes bcrypt custo 12.
- Entrada inválida (service_role): minúsculas, fora do alfabeto, tamanho errado, nulo, vazio, 11 PINs: 22023 sem o valor. **R-HASH-1 (informativo)**: com o tipo errado (texto no lugar de array) quem rejeita é o cast do PostgREST (`22P02 malformed array literal: "<valor>"`), que ecoa o valor; só `service_role` chega lá, e a Edge Function só manda `text[]` montado por ela. Demais papéis recebem 403 sem eco.
- Nenhum PIN nos logs depois do lote de 500: provado (ver DEF-003-04). Além disso, o par código/PIN do pacote confere com o hash de cada fatia: o teste ativa o 1º, o 250º e o 500º código do lote com o PIN do pacote.
- Falha no meio do lote: **prova real no banco** (`batch_atomicidade.test.sql`, 13 asserções): gatilho de teste que levanta no 3º código (os 2 primeiros já inseridos) e outro na auditoria (lote e códigos já inseridos); depois de cada falha, zero lotes, zero códigos, zero `batch_created`; o controle sem gatilho grava tudo e exatamente um evento. A falha de uma fatia de `admin_hash_pins` (antes de qualquer gravação) continua só com falsos (`handler.test.ts`): não há como derrubar uma chamada HTTP no meio.

### Não verificado

`deno test` (sem deno na máquina; o CI roda). O e2e real completo (precisa do `ng serve`); só os specs de API foram executados aqui, mais o de 500 e o de 54.

## Rodada de frontend do /code-review (F1 a F4)

- **F1 (confirmado)**: `PetService.remove` só apagava a linha. Agora lista `pet-photos/<uid>/<pet>/`, apaga a linha e depois remove os objetos listados (se a listagem falhou antes, tenta de novo depois da linha). Linha que não sai: nenhuma foto é apagada. Foto que não sai: o pet continua removido, sucesso parcial com `console.warn` sem dado pessoal; a tela não afirma nada depois da remoção, então o texto ficou. Trocar a foto já apagava a anterior (`uploadPhoto` com `previousPath`, melhor esforço); a pasta inteira é limpa na remoção. A política `pet_photos_tutor_delete` (0032) permite DELETE no próprio prefixo. Formato gravado: `<tutor_id>/<petId>/<crypto.randomUUID()>.(webp|jpg)`; o `jpg` só quando o processador devolve `image/jpeg` (nunca `jpeg`/`png`); o id do pet existe antes (criar, subir, gravar o caminho).
- **F2 (confirmado)**: com `createdPetId`, `persist` chama `PetService.update` com os campos atuais antes de repetir a foto; erro do update mostra o erro e não repete a foto. Testes em `new-pet.spec.ts`.
- **F3 (confirmado)**: teto de `accuracy_m` no servidor do app: 100.000 (`scan-api.ts`), igual ao banco; teste de 100.000 (aceita) e 100.001 (400).
- **F4 (confirmado)**: app usava `< 48`, página pública `<= 48`. O app passa a `<= 48` (contrato: "horas até 48 h"). Sem função compartilhada (a pública não pode importar o app); os dois testes travam 48 h = horas e 49 h = 2 dias.
