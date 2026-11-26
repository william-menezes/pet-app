-- pgTAP: auditoria_eventos.test.sql
-- Spec 003-tag-qr, rodada de QA (Principio VII da constituicao; CLAUDE.md, "Auditoria"). Dispara, com chamadas reais, CADA evento
-- que as RPCs da spec gravam em `audit_log` e prova tres coisas:
--   1. o conjunto de eventos gravados e exatamente o esperado (um evento que deixe de ser gravado quebra o teste);
--   2. o detalhe de TODO evento so tem chaves conhecidas, e nada de PIN (antigo e novo), telefone, e-mail ou IP em
--      `detail`, `entity`, `entity_id` nem `actor_role` (o cenario planta um telefone e um e-mail "reais" de teste no
--      recado do modo perdido, na observacao do admin e no cadastro do tutor, e procura-os depois);
--   3. o inventario do codigo-fonte (`audit('...')` nas funcoes) nao tem evento fora da lista: evento novo exige atualizar a lista.
-- Fora do alcance deste arquivo (ver execution-log, secao QA): scans (a trilha e `scan_events`, provada em rpc_register_scan e
-- rls_scans), eventos de autenticacao (`auth_audit_log`; auditoria_auth_users, funcoes_conta, e2e-real/audit-events) e
-- `global_rate_limit` (endurecimento_tags.test.sql). `labels_reprinted` nao existe porque `admin-labels` (T084) esta bloqueada.
-- Cenario (criado aqui, desfeito no ROLLBACK final; os PINs so existem na transacao, nos GUC `tests.pin*`):
--   admin ADM; tutora TA (celular +5511900000051 confirmado, e-mail aud.a@faro.test); lote-902 com 8 codigos sinteticos.
-- Regra 13A: erro de negocio e RETORNO, conferido com `->> 'ok'`/`'error'`.

BEGIN;

SELECT plan(47);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

CREATE OR REPLACE FUNCTION tests.reset_limits() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM public.rate_limits WHERE scope IN ('activate_calls', 'tutor_write_min', 'admin_reissue_hour');
$$;
CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT tests.reset_limits(),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('role', 'authenticated', true);
$$;
CREATE OR REPLACE FUNCTION tests.set_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"service_role"}'::text, true),
         set_config('request.jwt.claim.sub', '', true),
         set_config('role', 'service_role', true);
$$;
CREATE OR REPLACE FUNCTION tests.mk_user(p_id uuid, p_email text, p_name text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data,
                          encrypted_password, created_at, updated_at, confirmation_token)
  VALUES (p_id, p_email, 'authenticated', 'authenticated',
          json_build_object('name', p_name, 'terms_version', '2026-11')::jsonb,
          '{"provider":"email","providers":["email"]}'::jsonb,
          extensions.crypt('SenhaDeTeste123', extensions.gen_salt('bf')), now(), now(), '');
$$;
CREATE OR REPLACE FUNCTION tests.pin() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('tests.pin'); $$;
CREATE OR REPLACE FUNCTION tests.wrong_pin() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN left(current_setting('tests.pin'), 1) = '0' THEN '1' ELSE '0' END || substr(current_setting('tests.pin'), 2);
$$;
CREATE OR REPLACE FUNCTION tests.denied(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END;
$$;
-- Eventos gravados nesta transacao (o relogio da transacao e fixo: `at = now()` isola o que este arquivo produziu).
CREATE OR REPLACE FUNCTION tests.mine() RETURNS SETOF public.audit_log LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT * FROM public.audit_log WHERE at = now();
$$;
CREATE OR REPLACE FUNCTION tests.n(p_event text) RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::integer FROM public.audit_log WHERE at = now() AND event = p_event;
$$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT set_config('tests.pin', public.new_activation_pin(), true);
SELECT tests.mk_user('a6a6a6a6-0000-0000-0000-0000000000ad', 'aud.adm@faro.test', 'Admin Aud');
SELECT tests.mk_user('a6a6a6a6-0000-0000-0000-0000000000a1', 'aud.a@faro.test', 'Ana Aud');
UPDATE public.perfis SET papel = 'admin' WHERE id = 'a6a6a6a6-0000-0000-0000-0000000000ad';
UPDATE public.perfis SET celular = '+5511900000051', celular_confirmado_em = now() WHERE id = 'a6a6a6a6-0000-0000-0000-0000000000a1';
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('a6a6a6a6-1111-0000-0000-0000000000a1', 'a6a6a6a6-0000-0000-0000-0000000000a1', 'Rex Aud', 'dog'),
  ('a6a6a6a6-1111-0000-0000-0000000000a2', 'a6a6a6a6-0000-0000-0000-0000000000a1', 'Mel Aud', 'cat'),
  ('a6a6a6a6-1111-0000-0000-0000000000a3', 'a6a6a6a6-0000-0000-0000-0000000000a1', 'Tobi Aud', 'dog'),
  ('a6a6a6a6-1111-0000-0000-0000000000a4', 'a6a6a6a6-0000-0000-0000-0000000000a1', 'Lua Aud', 'cat');
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-902', 8);
CREATE TEMP TABLE t_hash AS SELECT extensions.crypt(current_setting('tests.pin'), extensions.gen_salt('bf', 12)) AS hash;
-- T1 ABCDEFGHV, T2 ZZZZZZZZ8 (5 erros), T3 JKMNPQRSR, T4 TVWXYZ01S, T5 1NDAN8EKS (status), T6 W030F52J1 (reemissao),
-- T7 0123456Z3 (trava da tag), T8 BZCH5NVX1 (2a via perdida).
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-902', 'available', h.hash, 0
  FROM t_hash h, (VALUES ('ABCDEFGHV'), ('ZZZZZZZZ8'), ('JKMNPQRSR'), ('TVWXYZ01S'), ('1NDAN8EKS'), ('W030F52J1'), ('0123456Z3'), ('BZCH5NVX1')) AS c (code);
CREATE TEMP TABLE t_mem (k text PRIMARY KEY, v text NOT NULL);
GRANT ALL ON t_mem TO authenticated, service_role;

-- ═══════════════ A tutora: erros, bloqueios, ativacao, modo perdido, troca, liberacao, 2a via ═══════════════
SELECT tests.set_auth_uid('a6a6a6a6-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'a6a6a6a6-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'erro 1 na T2');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'a6a6a6a6-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'erro 2 na T2');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'a6a6a6a6-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'erro 3 na T2');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'a6a6a6a6-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'erro 4 na T2');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'a6a6a6a6-1111-0000-0000-0000000000a1') ->> 'error', 'locked', 'erro 5 na T2: bloqueio da conta');
RESET ROLE;
UPDATE public.tag_codes SET pin_fail_count_24h = 19, pin_fail_window_start = now() WHERE code = '0123456Z3';
SELECT tests.set_auth_uid('a6a6a6a6-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('0123456Z3', tests.wrong_pin(), 'a6a6a6a6-1111-0000-0000-0000000000a1') ->> 'error', 'locked', 'o 20o erro da T7: bloqueio da tag');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'a6a6a6a6-1111-0000-0000-0000000000a1') ->> 'ok', 'true', 'ativa a T1 (tag_activated)');
SELECT is(public.set_lost_mode('a6a6a6a6-1111-0000-0000-0000000000a1', true, 'Ligue 11900000051 ou aud.a@faro.test', true, true) ->> 'ok', 'true', 'liga o modo perdido com telefone e e-mail no recado');
SELECT is(public.set_lost_mode('a6a6a6a6-1111-0000-0000-0000000000a1', false, NULL, true, true) ->> 'ok', 'true', 'desliga o modo perdido');
SELECT is(public.activate_tag('JKMNPQRSR', tests.pin(), 'a6a6a6a6-1111-0000-0000-0000000000a2') ->> 'ok', 'true', 'ativa a T3 na Mel');
SELECT is(public.activate_tag('TVWXYZ01S', tests.pin(), 'a6a6a6a6-1111-0000-0000-0000000000a2', true) ->> 'ok', 'true', 'troca a T3 pela T4 (tag_released: replaced)');
SELECT is(public.release_tag('TVWXYZ01S', 'transferred') ->> 'ok', 'true', 'libera a T4 (tag_released: transferred)');
SELECT is(public.request_tag_replacement('ABCDEFGHV', 'damaged') ->> 'ok', 'true', '2a via (danificada) da T1');
SELECT is(public.activate_tag('BZCH5NVX1', tests.pin(), 'a6a6a6a6-1111-0000-0000-0000000000a3') ->> 'ok', 'true', 'ativa a T8 no Tobi');
SELECT is(public.request_tag_replacement('BZCH5NVX1', 'lost') ->> 'ok', 'true', '2a via (perdida) da T8: anula o codigo (tag_status_changed)');
SELECT lives_ok($$ DELETE FROM public.pets WHERE id = 'a6a6a6a6-1111-0000-0000-0000000000a2' $$, 'a tutora remove a Mel, sem tag ativa (pet_deleted)');

-- ═══════════════ O admin: status, reemissao, encerrar vinculo, resolver pedido, exportar ═══════════════
SELECT tests.set_auth_uid('a6a6a6a6-0000-0000-0000-0000000000ad');
SELECT is(public.admin_set_status('1NDAN8EKS', 'blocked', 'suspeita de fraude') ->> 'status', 'blocked', 'admin bloqueia a T5 (com observacao limpa)');
SELECT is(public.admin_set_status('1NDAN8EKS', 'available', NULL) ->> 'status', 'available', 'admin desbloqueia a T5');
SELECT set_config('tests.newpin', (public.admin_reissue_pin('W030F52J1') ->> 'new_pin'), true);
SELECT is(length(current_setting('tests.newpin')), 6, 'admin reemite o PIN da T6 (pin_reissued)');
SELECT is(public.admin_end_assignment('ABCDEFGHV', 'admin') ->> 'ok', 'true', 'admin encerra o vinculo da T1 (assignment_ended_by_admin)');
SELECT is(public.admin_resolve_replacement((SELECT id FROM public.tag_replacement_requests WHERE tag_code = 'ABCDEFGHV' AND kind = 'damaged'), 'done') ->> 'ok', 'true', 'admin resolve o pedido da T1 (replacement_resolved)');
SELECT is(public.admin_export_codes('lote-902') ->> 'ok', 'true', 'admin exporta os codigos do lote (codes_exported)');

-- ═══════════════ Servidor: lote novo, pacote, exclusao de conta, limite do admin ═══════════════
SELECT tests.set_auth_uid('a6a6a6a6-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('W030F52J1', current_setting('tests.newpin'), 'a6a6a6a6-1111-0000-0000-0000000000a4') ->> 'ok', 'true', 'a tutora ativa a T6 com o PIN NOVO (vinculo ativo para a exclusao)');
RESET ROLE;
SELECT tests.set_service();
INSERT INTO t_mem VALUES ('batch', public.admin_insert_batch('a6a6a6a6-0000-0000-0000-0000000000ad', 1, NULL,
  jsonb_build_array(jsonb_build_object('code', 'H8ZWE5XGH',
    'pin_hash', (public.admin_hash_pins(ARRAY[current_setting('tests.pin')]))[1], 'qr_mask', 3)))::text);
SELECT is((SELECT v::jsonb ->> 'ok' FROM t_mem WHERE k = 'batch'), 'true', 'servidor cria um lote (batch_created)');
SELECT is(public.admin_mark_package_downloaded((SELECT v::jsonb ->> 'batch_id' FROM t_mem WHERE k = 'batch'), 'a6a6a6a6-0000-0000-0000-0000000000ad') ->> 'ok', 'true', 'pacote baixado (batch_package_downloaded)');
SELECT is(public.end_assignments_for_account('a6a6a6a6-0000-0000-0000-0000000000a1'), 1, 'exclusao da conta encerra 1 vinculo (account_tags_released)');
SELECT public.admin_rate_hit('a6a6a6a6-0000-0000-0000-0000000000ad', 'qa_scope', 1, 3600);
SELECT public.admin_rate_hit('a6a6a6a6-0000-0000-0000-0000000000ad', 'qa_scope', 1, 3600);
SELECT public.admin_rate_hit('a6a6a6a6-0000-0000-0000-0000000000ad', 'qa_scope', 1, 3600);
SELECT public.admin_rate_hit('a6a6a6a6-0000-0000-0000-0000000000ad', 'qa_scope', 1, 3600);
RESET ROLE;

-- ═══════════════ 1. O conjunto de eventos e exatamente o esperado ═══════════════
SELECT is((SELECT array_agg(DISTINCT event ORDER BY event)::text FROM tests.mine()),
          '{account_tags_released,activation_failed,activation_locked_account,activation_locked_tag,admin_rate_limited,assignment_ended_by_admin,batch_created,batch_package_downloaded,codes_exported,lost_mode_off,lost_mode_on,pet_deleted,pin_reissued,replacement_requested,replacement_resolved,tag_activated,tag_released,tag_status_changed}',
          'os 18 eventos esperados foram gravados, e nenhum outro');
SELECT is(tests.n('activation_failed'), 6, 'activation_failed: 5 (T2) + 1 (T7)');
SELECT is(tests.n('tag_activated'), 5, 'tag_activated: T1, T3, T4, T8 e T6');
SELECT is(tests.n('tag_released'), 2, 'tag_released: replaced e transferred');
SELECT is(tests.n('tag_status_changed'), 3, 'tag_status_changed: anulacao pela 2a via perdida + bloquear + desbloquear');
SELECT is(tests.n('replacement_requested'), 2, 'replacement_requested: damaged e lost');
SELECT is(tests.n('batch_created'), 1, 'batch_created: um so por lote');
SELECT is(tests.n('pet_deleted'), 1, 'C5: remover um pet grava pet_deleted');
SELECT is((SELECT count(*)::integer FROM tests.mine() WHERE event = 'pet_deleted' AND entity = 'pet' AND entity_id = 'a6a6a6a6-1111-0000-0000-0000000000a2' AND detail = '{}'::jsonb AND actor_id = 'a6a6a6a6-0000-0000-0000-0000000000a1'), 1, 'C5: pet_deleted com a id do pet, ator do JWT e detalhe vazio (sem nome)');

-- ═══════════════ 2. Detalhe: so chaves conhecidas; nada de PIN, telefone, e-mail ou IP ═══════════════
SELECT is((SELECT count(*)::integer FROM tests.mine() a, LATERAL jsonb_object_keys(a.detail) k
            WHERE k NOT IN ('fail_count', 'fail_count_24h', 'pet_id', 'reason', 'kind', 'from', 'to', 'note', 'request_id', 'status',
                            'count', 'quantity', 'assignments_ended', 'scope', 'limit', 'window_seconds')), 0,
          'o detalhe de todo evento so tem chaves conhecidas (lista fechada)');
SELECT is((SELECT count(*)::integer FROM tests.mine() a
            WHERE (a.detail::text || ' ' || coalesce(a.entity, '') || ' ' || coalesce(a.entity_id, '') || ' ' || coalesce(a.actor_role, ''))
                  LIKE '%' || current_setting('tests.pin') || '%'
               OR (a.detail::text || ' ' || coalesce(a.entity, '') || ' ' || coalesce(a.entity_id, '') || ' ' || coalesce(a.actor_role, ''))
                  LIKE '%' || current_setting('tests.newpin') || '%'), 0, 'nenhum evento guarda o PIN antigo nem o novo');
SELECT is((SELECT count(*)::integer FROM tests.mine() a
            WHERE (a.detail::text || ' ' || coalesce(a.entity, '') || ' ' || coalesce(a.entity_id, '') || ' ' || coalesce(a.actor_role, ''))
                  ~* '(11900000051|90000-?0051|aud\.a|aud\.adm|faro\.test|@)'), 0, 'nenhum evento guarda telefone nem e-mail (nem o do recado, nem o do cadastro)');
SELECT is((SELECT count(*)::integer FROM tests.mine() a
            WHERE (a.detail::text || ' ' || coalesce(a.entity_id, '')) ~ '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}'
               OR (a.detail::text) ~* '"(ip|ip_hash)"'), 0, 'nenhum evento guarda IP (cru, nem como ip_hash)');
SELECT is((SELECT count(*)::integer FROM tests.mine() WHERE event = 'tag_released' AND detail = '{"reason": "replaced"}'::jsonb), 1, 'tag_released (troca): so o motivo');
SELECT is((SELECT count(*)::integer FROM tests.mine() WHERE event IN ('lost_mode_on', 'lost_mode_off') AND detail = '{}'::jsonb), 2, 'lost_mode_on/off: detalhe vazio (o recado nao vai para a auditoria)');
SELECT is((SELECT count(*)::integer FROM tests.mine() WHERE event = 'tag_activated' AND actor_id = 'a6a6a6a6-0000-0000-0000-0000000000a1' AND actor_role = 'authenticated'), 5, 'o ator do evento vem do JWT (id e papel)');
SELECT is((SELECT coalesce(actor_id::text, '') || '/' || actor_role FROM tests.mine() WHERE event = 'account_tags_released'), '/system', 'exclusao de conta: ator nulo e papel system');

-- ═══════════════ 3. Inventario do codigo: evento novo exige atualizar a lista ═══════════════
SELECT is((SELECT count(*)::integer FROM (
             SELECT DISTINCT m[1] AS ev FROM pg_proc p, LATERAL regexp_matches(p.prosrc, 'audit\(''([a-z_]+)''', 'g') m
              WHERE p.pronamespace = 'public'::regnamespace) s
            WHERE s.ev NOT IN ('activation_failed', 'activation_locked_account', 'activation_locked_tag', 'tag_activated', 'tag_released',
                               'lost_mode_on', 'lost_mode_off', 'tag_status_changed', 'replacement_requested', 'pin_reissued',
                               'assignment_ended_by_admin', 'replacement_resolved', 'codes_exported', 'pet_deleted')), 0,
          'inventario: toda chamada audit(''...'') do banco esta na lista deste teste');

-- ═══════════════ 4. A tabela e so de insercao, ate para o servidor ═══════════════
SELECT tests.set_service();
SELECT is(tests.denied($$ UPDATE public.audit_log SET event = 'x' $$), true, 'service_role nao altera audit_log');
SELECT is(tests.denied($$ DELETE FROM public.audit_log $$), true, 'service_role nao apaga audit_log');
RESET ROLE;

-- ═══════════════ 5. RISCO (informativo, nao bloqueia): observacao livre do admin vai inteira para o detalhe ═══════════════
-- tag_status_changed guarda `note` (ate 200 caracteres) sem filtro. A barreira da tabela so olha nomes de chave. Se o admin
-- digitar um telefone ou e-mail na observacao, ele fica no audit_log (que nunca se apaga). Registrado como RISCO R-AUD-1.
SELECT tests.set_auth_uid('a6a6a6a6-0000-0000-0000-0000000000ad');
SELECT public.admin_set_status('1NDAN8EKS', 'blocked', 'cliente ligou do 11 90000-0051 e escreveu x@y.com');
RESET ROLE;
SELECT todo_start('R-AUD-1: a observacao livre do admin pode levar telefone/e-mail para o audit_log');
SELECT is((SELECT count(*)::integer FROM tests.mine() WHERE event = 'tag_status_changed' AND detail ->> 'note' ~* '(90000|@)'), 0,
          'a observacao com telefone/e-mail nao vai para o detalhe');
SELECT todo_end();

SELECT * FROM finish();
ROLLBACK;
