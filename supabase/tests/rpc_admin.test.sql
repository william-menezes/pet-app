-- pgTAP: rpc_admin.test.sql
-- Spec 003-tag-qr, T075 e T086 (feito quando: pgTAP cobre `forbidden` para tutor e as transicoes de situacao) e o que o contrato
-- de admin manda testar no banco. Migration 0034 (admin_*), com 0035 (limites). Regra 13A: erro de negocio e RETORNO
-- ({"ok":false,"error":...}), conferido com `->> 'error'`.
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; PINs gerados na transacao, so no GUC `tests.pin`):
--   admin ADM; tutora A (Ana Souza, celular confirmado, Rex e Mel e Zeca); tutor B (Beto Lima, Bidu e Nina).
--   Lote lote-909 com 7 codigos: T1 ABCDEFGHV (assigned, A/Rex), T2 ZZZZZZZZ8 (available), T3 JKMNPQRSR (blocked),
--   T4 TVWXYZ01S (void), T5 0123456Z3 (assigned, B/Bidu), T6 1NDAN8EKS (available), T8 BZCH5NVX1 (assigned, B/Nina).

BEGIN;

SELECT plan(128);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('role', 'authenticated', true);
$$;
CREATE OR REPLACE FUNCTION tests.set_anon() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"anon"}'::text, true),
         set_config('request.jwt.claim.sub', '', true),
         set_config('role', 'anon', true);
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
-- PIN da transacao: gerado agora, so no GUC `tests.pin` (nunca escrito no arquivo).
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

SELECT set_config('tests.pin', public.new_activation_pin(), true);
SELECT tests.mk_user('f8f8f8f8-0000-0000-0000-0000000000ad', 'admin.adm@faro.test', 'Admin Adm');
SELECT tests.mk_user('f8f8f8f8-0000-0000-0000-0000000000a1', 'ana.adm@faro.test', 'Ana Souza');
SELECT tests.mk_user('f8f8f8f8-0000-0000-0000-0000000000b2', 'beto.adm@faro.test', 'Beto Lima');
UPDATE public.perfis SET papel = 'admin' WHERE id = 'f8f8f8f8-0000-0000-0000-0000000000ad';
UPDATE public.perfis SET celular = '+5511900000081', celular_confirmado_em = now() WHERE id = 'f8f8f8f8-0000-0000-0000-0000000000a1';
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('f8f8f8f8-1111-0000-0000-000000000001', 'f8f8f8f8-0000-0000-0000-0000000000a1', 'Rex Adm', 'dog'),
  ('f8f8f8f8-1111-0000-0000-000000000002', 'f8f8f8f8-0000-0000-0000-0000000000a1', 'Mel Adm', 'cat'),
  ('f8f8f8f8-1111-0000-0000-000000000003', 'f8f8f8f8-0000-0000-0000-0000000000a1', 'Zeca Adm', 'dog'),
  ('f8f8f8f8-1111-0000-0000-000000000004', 'f8f8f8f8-0000-0000-0000-0000000000b2', 'Bidu Adm', 'dog'),
  ('f8f8f8f8-1111-0000-0000-000000000005', 'f8f8f8f8-0000-0000-0000-0000000000b2', 'Nina Adm', 'cat');
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-909', 7);
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(current_setting('tests.pin'), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-909', c.status, h.hash, 0
  FROM t_hash h, (VALUES ('ABCDEFGHV', 'assigned'), ('ZZZZZZZZ8', 'available'), ('JKMNPQRSR', 'blocked'), ('TVWXYZ01S', 'void'),
                         ('0123456Z3', 'assigned'), ('1NDAN8EKS', 'available'), ('BZCH5NVX1', 'assigned')) AS c (code, status);
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id) VALUES
  ('f8f8f8f8-2222-0000-0000-000000000001', 'ABCDEFGHV', 'f8f8f8f8-1111-0000-0000-000000000001', 'f8f8f8f8-0000-0000-0000-0000000000a1'),
  ('f8f8f8f8-2222-0000-0000-000000000005', '0123456Z3', 'f8f8f8f8-1111-0000-0000-000000000004', 'f8f8f8f8-0000-0000-0000-0000000000b2'),
  ('f8f8f8f8-2222-0000-0000-000000000008', 'BZCH5NVX1', 'f8f8f8f8-1111-0000-0000-000000000005', 'f8f8f8f8-0000-0000-0000-0000000000b2');
UPDATE public.rescue_profiles SET lost_mode = true, lost_since = now() WHERE pet_id = 'f8f8f8f8-1111-0000-0000-000000000004';
INSERT INTO public.scan_events (tag_code, assignment_id, status_at_scan, ip_hash, geo_method, lat, lng, accuracy_m, city) VALUES
  ('ABCDEFGHV', 'f8f8f8f8-2222-0000-0000-000000000001', 'assigned', 'ip-adm-segredo-1', 'gps', -23.5, -46.6, 20, 'Sao Paulo'),
  ('ABCDEFGHV', 'f8f8f8f8-2222-0000-0000-000000000001', 'assigned', 'ip-adm-segredo-2', 'ip', NULL, NULL, NULL, 'Santos'),
  ('JKMNPQRSR', NULL, 'blocked', 'ip-adm-segredo-3', 'ip', NULL, NULL, NULL, 'Recife'),
  ('JKMNPQRSR', NULL, 'blocked', 'ip-adm-segredo-4', 'none', NULL, NULL, NULL, NULL),
  ('TVWXYZ01S', NULL, 'void', 'ip-adm-segredo-5', 'none', NULL, NULL, NULL, NULL),
  ('ZZZZZZZZ8', NULL, 'available', 'ip-adm-segredo-6', 'none', NULL, NULL, NULL, NULL);
INSERT INTO public.tag_replacement_requests (id, tag_code, pet_id, tutor_id, kind) VALUES
  ('f8f8f8f8-3333-0000-0000-000000000001', 'ABCDEFGHV', 'f8f8f8f8-1111-0000-0000-000000000001', 'f8f8f8f8-0000-0000-0000-0000000000a1', 'damaged'),
  ('f8f8f8f8-3333-0000-0000-000000000002', '0123456Z3', 'f8f8f8f8-1111-0000-0000-000000000004', 'f8f8f8f8-0000-0000-0000-0000000000b2', 'lost');
CREATE TEMP TABLE t_res (k text PRIMARY KEY, r jsonb NOT NULL);
GRANT ALL ON t_res TO authenticated, service_role;

-- ═══════════════ Tutor comum: tudo forbidden; anon: sem EXECUTE ═══════════════

SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000a1');
SELECT is(
  (SELECT array_agg(v.x ->> 'error') FROM (VALUES
     (public.admin_list_batches()), (public.admin_list_codes()), (public.admin_code_detail('ABCDEFGHV')),
     (public.admin_set_status('ABCDEFGHV', 'blocked', NULL)), (public.admin_reissue_pin('ZZZZZZZZ8')),
     (public.admin_end_assignment('ABCDEFGHV', 'admin')), (public.admin_resolve_replacement('f8f8f8f8-3333-0000-0000-000000000001', 'done')),
     (public.admin_scan_queue()), (public.admin_audit()), (public.admin_dashboard_counters()), (public.admin_export_codes('lote-909'))) AS v (x)),
  ARRAY['forbidden', 'forbidden', 'forbidden', 'forbidden', 'forbidden', 'forbidden', 'forbidden', 'forbidden', 'forbidden', 'forbidden', 'forbidden'],
  'tutor comum chamando qualquer admin_*: forbidden (as 11)');
SELECT is(tests.denied($$ SELECT public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 1, NULL, '[]'::jsonb) $$), true, 'authenticated nao executa admin_insert_batch (so service_role)');
SELECT is(tests.denied($$ SELECT public.admin_mark_package_downloaded('lote-909', NULL) $$), true, 'authenticated nao executa admin_mark_package_downloaded');
SELECT is(tests.denied($$ SELECT public.global_rate_hit('x', 1, 60) $$), true, 'authenticated nao executa global_rate_hit');
SELECT is(tests.denied($$ SELECT public.admin_rate_hit('f8f8f8f8-0000-0000-0000-0000000000ad', 'x', 1, 60) $$), true, 'authenticated nao executa admin_rate_hit');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE code = 'ZZZZZZZZ8' AND status = 'available'), 1, 'o tutor nao mudou nada (forbidden nao tem efeito)');

SELECT tests.set_anon();
SELECT is(
  (SELECT bool_and(tests.denied(format('SELECT public.%s', f))) FROM unnest(ARRAY[
     'admin_list_batches()', 'admin_list_codes()', 'admin_code_detail(''ABCDEFGHV'')', 'admin_set_status(''ABCDEFGHV'', ''blocked'', NULL)',
     'admin_reissue_pin(''ZZZZZZZZ8'')', 'admin_end_assignment(''ABCDEFGHV'', ''admin'')',
     'admin_resolve_replacement(''f8f8f8f8-3333-0000-0000-000000000001'', ''done'')', 'admin_scan_queue()', 'admin_audit()',
     'admin_dashboard_counters()', 'admin_export_codes(''lote-909'')', 'tutor_short_name(''x'')']) f),
  true, 'anon sem EXECUTE em nenhuma admin_* (nem no auxiliar)');
RESET ROLE;

-- ═══════════════ Admin: leitura ═══════════════

SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
INSERT INTO t_res VALUES ('batches', public.admin_list_batches());
INSERT INTO t_res VALUES ('by_code', public.admin_list_codes('abcd'));
INSERT INTO t_res VALUES ('by_pet', public.admin_list_codes('REX'));
INSERT INTO t_res VALUES ('by_tutor', public.admin_list_codes('ana.adm@'));
INSERT INTO t_res VALUES ('by_name', public.admin_list_codes('beto'));
INSERT INTO t_res VALUES ('blocked', public.admin_list_codes(NULL, 'blocked', 'lote-909'));
INSERT INTO t_res VALUES ('page', public.admin_list_codes(NULL, NULL, 'lote-909', 2, 0));
INSERT INTO t_res VALUES ('page3', public.admin_list_codes(NULL, NULL, 'lote-909', 2, 6));
INSERT INTO t_res VALUES ('badstatus', public.admin_list_codes(NULL, 'xyz'));
INSERT INTO t_res VALUES ('detail', public.admin_code_detail('abcd-efgh-v'));
INSERT INTO t_res VALUES ('detail_free', public.admin_code_detail('ZZZZZZZZ8'));
RESET ROLE;

SELECT is((SELECT (x -> 'counts')::text FROM t_res, jsonb_array_elements(r -> 'batches') x WHERE k = 'batches' AND x ->> 'id' = 'lote-909'),
          '{"void": 1, "blocked": 1, "assigned": 3, "available": 2}', 'admin_list_batches: o lote com a contagem por situacao');
SELECT is((SELECT r ->> 'total' FROM t_res WHERE k = 'by_code'), '1', 'admin_list_codes: busca por parte do codigo (normalizada)');
SELECT is((SELECT r -> 'rows' -> 0 ->> 'code' || '|' || (r -> 'rows' -> 0 ->> 'pet_name') || '|' || (r -> 'rows' -> 0 ->> 'tutor') || '|' || (r -> 'rows' -> 0 ->> 'status') FROM t_res WHERE k = 'by_code'),
          'ABCD-EFGH-V|Rex Adm|Ana S.|assigned', 'admin_list_codes: linha com codigo, pet, tutor (primeiro nome + inicial) e situacao');
SELECT ok((SELECT (r -> 'rows' -> 0 ->> 'last_scan_at') IS NOT NULL FROM t_res WHERE k = 'by_code'), 'admin_list_codes: traz o ultimo scan');
SELECT is((SELECT r ->> 'total' FROM t_res WHERE k = 'by_pet'), '1', 'admin_list_codes: busca pelo nome do pet (sem diferenciar maiusculas)');
SELECT is((SELECT r ->> 'total' FROM t_res WHERE k = 'by_tutor'), '1', 'admin_list_codes: busca pelo e-mail do tutor');
SELECT is((SELECT r -> 'rows' -> 0 ->> 'code' FROM t_res WHERE k = 'by_tutor'), 'ABCD-EFGH-V', 'admin_list_codes: o e-mail da Ana leva ao codigo dela');
SELECT is((SELECT r ->> 'total' FROM t_res WHERE k = 'by_name'), '2', 'admin_list_codes: busca pelo nome do tutor (Beto tem 2 tags)');
SELECT is((SELECT r ->> 'total' || ':' || (r -> 'rows' -> 0 ->> 'code') FROM t_res WHERE k = 'blocked'), '1:JKMN-PQRS-R', 'admin_list_codes: filtro por situacao e lote');
SELECT is((SELECT r ->> 'total' || ':' || jsonb_array_length(r -> 'rows') FROM t_res WHERE k = 'page'), '7:2', 'admin_list_codes: pagina de 2 com total 7');
SELECT is((SELECT jsonb_array_length(r -> 'rows') FROM t_res WHERE k = 'page3'), 1, 'admin_list_codes: a ultima pagina traz o resto');
SELECT is((SELECT r ->> 'error' FROM t_res WHERE k = 'badstatus'), 'invalid_status', 'admin_list_codes: situacao desconhecida: invalid_status');
SELECT is((SELECT bool_or(r::text ~* '(activation_pin_hash|\$2[abxy]\$|ip_hash|ip-adm-segredo)') FROM t_res WHERE k IN ('batches', 'by_code', 'page')), false, 'as listas nao carregam hash de PIN nem ip_hash');

SELECT is((SELECT r ->> 'status' || ':' || (r -> 'assignment' ->> 'pet_name') || ':' || (r -> 'assignment' ->> 'tutor') FROM t_res WHERE k = 'detail'), 'assigned:Rex Adm:Ana S.', 'admin_code_detail: situacao e vinculo atual');
SELECT is((SELECT jsonb_array_length(r -> 'history') || ':' || jsonb_array_length(r -> 'scans') || ':' || jsonb_array_length(r -> 'replacement_requests') FROM t_res WHERE k = 'detail'), '1:2:1', 'admin_code_detail: historico de vinculos, scans e pedidos de 2a via');
SELECT is((SELECT (r -> 'pin' ->> 'used') || ':' || (r -> 'pin' ->> 'fail_count_24h') || ':' || (r -> 'pin' -> 'locked_until')::text FROM t_res WHERE k = 'detail'), 'true:0:null', 'admin_code_detail: estado do PIN (usado, 0 erros, sem trava)');
SELECT is((SELECT r ->> 'batch_id' || ':' || (r ->> 'qr_version') || ':' || (r ->> 'qr_mask') FROM t_res WHERE k = 'detail'), 'lote-909:3:0', 'admin_code_detail: lote, versao e mascara do QR');
SELECT is((SELECT (r::text ~* '(activation_pin_hash|\$2[abxy]\$|ip_hash|ip-adm-segredo|location_token)') FROM t_res WHERE k = 'detail'), false, 'admin_code_detail: nunca o hash do PIN, ip_hash nem token');
SELECT is((SELECT (r -> 'pin' ->> 'used') || ':' || (r -> 'assignment')::text FROM t_res WHERE k = 'detail_free'), 'false:null', 'admin_code_detail: tag livre: PIN nao usado e sem vinculo');
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
SELECT is(public.admin_code_detail('H8ZWE5XGH') ->> 'error', 'not_found', 'admin_code_detail: codigo valido inexistente: not_found');
SELECT is(public.admin_code_detail('7K3MQ9XAD') ->> 'error', 'invalid_code', 'admin_code_detail: digito invalido: invalid_code');
RESET ROLE;
UPDATE public.tag_codes SET pin_fail_count_24h = 4, pin_fail_window_start = now(), pin_locked_until = now() + interval '1 hour' WHERE code = '1NDAN8EKS';
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
SELECT is((SELECT (public.admin_code_detail('1NDAN8EKS') -> 'pin' ->> 'fail_count_24h') || ':' || ((public.admin_code_detail('1NDAN8EKS') -> 'pin' ->> 'locked_until') IS NOT NULL)::text), '4:true', 'admin_code_detail: mostra os erros em 24 h e a trava vigente');
RESET ROLE;

-- ═══════════════ admin_set_status ═══════════════

SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
SELECT is(public.admin_set_status('ZZZZZZZZ8', 'blocked', 'suspeita de fraude') ->> 'status', 'blocked', 'available -> blocked');
SELECT is(public.admin_set_status('JKMNPQRSR', 'available', NULL) ->> 'status', 'available', 'blocked -> available (sem vinculo ativo)');
SELECT is(public.admin_set_status('ABCDEFGHV', 'blocked', NULL) ->> 'status', 'blocked', 'assigned -> blocked');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV' AND ended_at IS NULL), 1, 'bloquear tag vinculada MANTEM o vinculo');
SELECT tests.set_service();
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-adm-x') ->> 'state', 'not_found', 'tag bloqueada: a pagina publica responde "nao encontrada"');
RESET ROLE;
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
SELECT is(public.admin_set_status('ABCDEFGHV', 'available', NULL) ->> 'status', 'assigned', 'blocked -> assigned (desbloquear com vinculo ativo devolve assigned)');
SELECT is(public.admin_set_status('ABCDEFGHV', 'available', NULL) ->> 'error', 'invalid_transition', 'assigned -> available so por release_tag / admin_end_assignment: invalid_transition');
SELECT is(public.admin_set_status('1NDAN8EKS', 'available', NULL) ->> 'error', 'invalid_transition', 'available -> available: invalid_transition');
SELECT is(public.admin_set_status('JKMNPQRSR', 'blocked', NULL) ->> 'status', 'blocked', 'available -> blocked de novo');
SELECT is(public.admin_set_status('TVWXYZ01S', 'available', NULL) ->> 'error', 'invalid_transition', 'void -> available: invalid_transition');
SELECT is(public.admin_set_status('TVWXYZ01S', 'blocked', NULL) ->> 'error', 'invalid_transition', 'void -> blocked: invalid_transition');
SELECT is(public.admin_set_status('TVWXYZ01S', 'void', NULL) ->> 'error', 'invalid_transition', 'void -> void: invalid_transition');
SELECT is(public.admin_set_status('ABCDEFGHV', 'assigned', NULL) ->> 'error', 'invalid_status', 'situacao fora de available/blocked/void: invalid_status');
SELECT is(public.admin_set_status('7K3MQ9XAD', 'void', NULL) ->> 'error', 'invalid_code', 'admin_set_status: digito invalido: invalid_code');
SELECT is(public.admin_set_status('H8ZWE5XGH', 'void', NULL) ->> 'error', 'not_found', 'admin_set_status: codigo inexistente: not_found');
-- void com vinculo ativo: encerra o vinculo com `admin`, desliga o modo perdido, e e irreversivel.
SELECT is(public.admin_set_status('0123456Z3', 'void', 'tag destruida') ->> 'status', 'void', 'assigned -> void');
RESET ROLE;
SELECT is((SELECT end_reason FROM public.tag_assignments WHERE id = 'f8f8f8f8-2222-0000-0000-000000000005'), 'admin', 'void encerra o vinculo ativo com o motivo admin');
SELECT is((SELECT lost_mode FROM public.rescue_profiles WHERE pet_id = 'f8f8f8f8-1111-0000-0000-000000000004'), false, 'void desliga o modo perdido do pet');
SELECT tests.set_service();
SELECT is(public.resolve_tag('0123456Z3', 'ip-adm-y') ->> 'state', 'not_found', 'tag anulada: "nao encontrada" na pagina publica');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'tag_status_changed' AND entity_id = 'ZZZZZZZZ8' AND detail = '{"from": "available", "to": "blocked", "note": "suspeita de fraude"}'::jsonb), 1, 'grava tag_status_changed com de, para e a nota');
SELECT is((SELECT actor_role FROM public.audit_log WHERE event = 'tag_status_changed' AND entity_id = 'ZZZZZZZZ8'), 'authenticated', 'a auditoria registra o admin (papel do JWT) como ator');
SELECT throws_ok($$ DELETE FROM public.tag_codes WHERE code = 'ZZZZZZZZ8' $$, 'P0001', 'tag_code_never_deleted', 'nao existe apagar codigo: o gatilho recusa ate o dono do banco');
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
SELECT is(tests.denied($$ DELETE FROM public.tag_codes WHERE code = 'ZZZZZZZZ8' $$), true, 'o admin tambem nao apaga codigo (sem privilegio)');
SELECT is(tests.denied($$ SELECT activation_pin_hash FROM public.tag_codes $$), true, 'o admin nao le o hash do PIN direto na tabela');
RESET ROLE;

-- ═══════════════ admin_reissue_pin ═══════════════

SELECT set_config('tests.old_pin', tests.pin(), true);
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
INSERT INTO t_res VALUES ('reissue', public.admin_reissue_pin('1NDAN8EKS'));
SELECT is(public.admin_reissue_pin('ABCDEFGHV') ->> 'error', 'tag_not_available', 'reemitir PIN de tag vinculada: tag_not_available');
SELECT is(public.admin_reissue_pin('JKMNPQRSR') ->> 'error', 'tag_not_available', 'reemitir PIN de tag bloqueada: tag_not_available');
SELECT is(public.admin_reissue_pin('TVWXYZ01S') ->> 'error', 'tag_not_available', 'reemitir PIN de tag anulada: tag_not_available');
SELECT is(public.admin_reissue_pin('H8ZWE5XGH') ->> 'error', 'not_found', 'reemitir PIN de codigo inexistente: not_found');
SELECT is(public.admin_reissue_pin('7K3MQ9XAD') ->> 'error', 'invalid_code', 'reemitir PIN com digito invalido: invalid_code');
RESET ROLE;
SELECT set_config('tests.pin', (SELECT r ->> 'new_pin' FROM t_res WHERE k = 'reissue'), true);
SELECT is((SELECT r ->> 'ok' || ':' || (r ->> 'code') FROM t_res WHERE k = 'reissue'), 'true:1NDA-N8EK-S', 'reemitir PIN: ok e codigo');
SELECT ok(tests.pin() ~ '^[0-9A-HJKMNP-TV-Z]{6}$' AND tests.pin() <> current_setting('tests.old_pin'), 'reemitir PIN: devolve um PIN novo de 6 caracteres, em claro, uma vez');
SELECT ok((SELECT activation_pin_hash ~ '^\$2[abxy]\$12\$' AND extensions.crypt(tests.pin(), activation_pin_hash) = activation_pin_hash AND extensions.crypt(current_setting('tests.old_pin'), activation_pin_hash) <> activation_pin_hash FROM public.tag_codes WHERE code = '1NDAN8EKS'), 'reemitir PIN: grava so o hash; o antigo deixa de valer');
SELECT is((SELECT pin_fail_count_24h || ':' || coalesce(pin_locked_until::text, 'nulo') FROM public.tag_codes WHERE code = '1NDAN8EKS'), '0:nulo', 'reemitir PIN: zera contadores e a trava');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'pin_reissued' AND entity_id = '1NDAN8EKS' AND detail = '{}'::jsonb), 1, 'grava pin_reissued sem nenhum dado do PIN');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE detail::text LIKE '%' || tests.pin() || '%'), 0, 'o PIN novo nunca aparece na auditoria');
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('1NDAN8EKS', tests.pin(), 'f8f8f8f8-1111-0000-0000-000000000003') ->> 'ok', 'true', 'o PIN reemitido ativa a tag para o tutor');
RESET ROLE;

-- ═══════════════ admin_end_assignment ═══════════════

SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
SELECT is(public.admin_end_assignment('BZCH5NVX1', 'xyz') ->> 'error', 'invalid_reason', 'encerrar vinculo: motivo fora de admin/damaged/lost: invalid_reason');
SELECT is(public.admin_end_assignment('ZZZZZZZZ8', 'admin') ->> 'error', 'no_active_assignment', 'encerrar vinculo de tag sem vinculo: no_active_assignment');
SELECT is(public.admin_end_assignment('H8ZWE5XGH', 'admin') ->> 'error', 'not_found', 'encerrar vinculo de codigo inexistente: not_found');
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
INSERT INTO t_res VALUES ('end', public.admin_end_assignment('BZCH5NVX1', 'damaged'));
SELECT is(public.admin_end_assignment('BZCH5NVX1', 'damaged') ->> 'error', 'no_active_assignment', 'encerrar de novo: no_active_assignment');
RESET ROLE;
SELECT set_config('tests.pin', (SELECT r ->> 'new_pin' FROM t_res WHERE k = 'end'), true);
SELECT ok((SELECT r ->> 'ok' = 'true' AND r ->> 'code' = 'BZCH-5NVX-1' AND (r ->> 'new_pin') ~ '^[0-9A-HJKMNP-TV-Z]{6}$' FROM t_res WHERE k = 'end'), 'encerrar vinculo: ok, codigo e PIN novo de 6 caracteres');
SELECT is((SELECT end_reason FROM public.tag_assignments WHERE id = 'f8f8f8f8-2222-0000-0000-000000000008'), 'damaged', 'encerrar vinculo: grava o motivo pedido');
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'BZCH5NVX1'), 'available', 'encerrar vinculo: a tag volta a available');
SELECT ok((SELECT extensions.crypt(tests.pin(), activation_pin_hash) = activation_pin_hash AND extensions.crypt(current_setting('tests.old_pin'), activation_pin_hash) <> activation_pin_hash FROM public.tag_codes WHERE code = 'BZCH5NVX1'), 'encerrar vinculo: PIN novo gravado so como hash; o antigo deixa de valer');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'assignment_ended_by_admin' AND entity_id = 'BZCH5NVX1' AND detail = '{"reason": "damaged"}'::jsonb), 1, 'grava assignment_ended_by_admin com o motivo e sem PIN');

-- ═══════════════ admin_resolve_replacement ═══════════════

SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
SELECT is(public.admin_resolve_replacement('f8f8f8f8-3333-0000-0000-000000000001', 'open') ->> 'error', 'invalid_status', 'resolver pedido: situacao invalida');
SELECT is(public.admin_resolve_replacement('f8f8f8f8-3333-0000-0000-0000000000ff', 'done') ->> 'error', 'not_found', 'resolver pedido inexistente: not_found');
SELECT is(public.admin_resolve_replacement('f8f8f8f8-3333-0000-0000-000000000001', 'done') ->> 'ok', 'true', 'resolver pedido aberto: ok');
SELECT is(public.admin_resolve_replacement('f8f8f8f8-3333-0000-0000-000000000001', 'cancelled') ->> 'error', 'invalid_transition', 'resolver de novo: invalid_transition');
RESET ROLE;
SELECT is((SELECT status || ':' || (resolved_by = 'f8f8f8f8-0000-0000-0000-0000000000ad')::text || ':' || (resolved_at IS NOT NULL)::text FROM public.tag_replacement_requests WHERE id = 'f8f8f8f8-3333-0000-0000-000000000001'), 'done:true:true', 'o pedido fecha com a data e o admin que resolveu');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'replacement_resolved' AND entity_id = 'ABCDEFGHV'), 1, 'grava replacement_resolved');

-- ═══════════════ Fila, auditoria, contadores, exportacao ═══════════════

SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
INSERT INTO t_res VALUES ('queue', public.admin_scan_queue(100, 0));
INSERT INTO t_res VALUES ('audit', public.admin_audit('tag_status_changed', 'zzzz-zzzz-8', 1, 0));
INSERT INTO t_res VALUES ('audit_all', public.admin_audit(NULL, NULL, 5, 0));
INSERT INTO t_res VALUES ('counters', public.admin_dashboard_counters());
INSERT INTO t_res VALUES ('export', public.admin_export_codes('lote-909'));
RESET ROLE;
UPDATE public.tag_codes SET pin_locked_until = now() + interval '1 hour' WHERE code = 'ZZZZZZZZ8';
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
INSERT INTO t_res VALUES ('queue2', public.admin_scan_queue(100, 0));
RESET ROLE;

SELECT is((SELECT count(*)::integer FROM t_res, jsonb_array_elements(r -> 'scans') s WHERE k = 'queue' AND s ->> 'code' IN ('JKMN-PQRS-R', 'TVWX-YZ01-S', 'ZZZZ-ZZZZ-8')), 4, 'fila: os 4 scans de tags bloqueada, anulada e disponivel');
SELECT is((SELECT count(*)::integer FROM t_res, jsonb_array_elements(r -> 'scans') s WHERE k = 'queue' AND s ->> 'code' = 'ABCD-EFGH-V'), 0, 'fila: scans de tag vinculada (assigned) nao entram');
SELECT is((SELECT count(*)::integer FROM t_res, jsonb_array_elements(r -> 'replacements') s WHERE k = 'queue' AND s ->> 'code' = '0123-456Z-3'), 1, 'fila: o pedido de 2a via aberto aparece (o resolvido nao)');
SELECT is((SELECT count(*)::integer FROM t_res, jsonb_array_elements(r -> 'replacements') s WHERE k = 'queue' AND s ->> 'code' = 'ABCD-EFGH-V'), 0, 'fila: pedido ja resolvido nao aparece');
SELECT is((SELECT count(*)::integer FROM t_res, jsonb_array_elements(r -> 'locked_tags') s WHERE k = 'queue2' AND s ->> 'code' = 'ZZZZ-ZZZZ-8'), 1, 'fila: tag travada por tentativas aparece');
SELECT is((SELECT (r::text ~* '(ip_hash|ip-adm-segredo|"lat"|"lng")') FROM t_res WHERE k = 'queue'), false, 'fila: sem ip_hash e sem coordenadas');
SELECT is((SELECT jsonb_array_length(r -> 'rows') || ':' || (r -> 'rows' -> 0 ->> 'event') FROM t_res WHERE k = 'audit'), '1:tag_status_changed', 'auditoria: filtro por evento e por codigo (aceita a forma de exibicao), limite de 1');
SELECT ok((SELECT (SELECT bool_and((a.v ->> 'at')::timestamptz >= (b.v ->> 'at')::timestamptz) FROM jsonb_array_elements(r -> 'rows') WITH ORDINALITY a (v, i) JOIN jsonb_array_elements(r -> 'rows') WITH ORDINALITY b (v, i) ON b.i = a.i + 1) IS NOT FALSE FROM t_res WHERE k = 'audit_all'), 'auditoria: mais recentes primeiro');
SELECT is((SELECT (r::text ~* '(activation_pin_hash|\$2[abxy]\$|ip_hash)' OR r::text LIKE '%' || tests.pin() || '%' OR r::text LIKE '%' || current_setting('tests.old_pin') || '%') FROM t_res WHERE k = 'audit_all'), false, 'auditoria: nenhum PIN nem hash');
SELECT is((SELECT r ->> 'generated' FROM t_res WHERE k = 'counters'), (SELECT count(*)::text FROM public.tag_codes), 'contadores: gerados = todos os codigos');
SELECT is((SELECT r ->> 'active' || ':' || (r ->> 'void') FROM t_res WHERE k = 'counters'), (SELECT count(*) FILTER (WHERE status = 'assigned') || ':' || count(*) FILTER (WHERE status = 'void') FROM public.tag_codes), 'contadores: ativos e anulados batem com a tabela');
SELECT is((SELECT r ->> 'available' || ':' || (r ->> 'blocked') FROM t_res WHERE k = 'counters'), (SELECT count(*) FILTER (WHERE status = 'available') || ':' || count(*) FILTER (WHERE status = 'blocked') FROM public.tag_codes), 'contadores: disponiveis e bloqueados batem com a tabela');
SELECT is((SELECT r ->> 'count' || ':' || split_part(r ->> 'csv', E'\n', 1) FROM t_res WHERE k = 'export'), '7:code,qr_version,qr_mask', 'exportar codigos: 7 codigos e o cabecalho (T086)');
SELECT ok((SELECT (r ->> 'csv') LIKE '%' || E'\n' || 'ABCD-EFGH-V,3,0' || '%' AND array_length(string_to_array(r ->> 'csv', E'\n'), 1) = 8 FROM t_res WHERE k = 'export'), 'exportar codigos: uma linha por codigo, formato de exibicao, com versao e mascara');
SELECT is((SELECT (r ->> 'csv') ~* '(\$2[abxy]\$|pin|hash)' OR (r ->> 'csv') LIKE '%' || tests.pin() || '%' OR (r ->> 'csv') LIKE '%' || current_setting('tests.old_pin') || '%' FROM t_res WHERE k = 'export'), false, 'exportar codigos: NUNCA PIN nem hash');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'codes_exported' AND entity_id = 'lote-909' AND detail = '{"count": 7}'::jsonb), 1, 'exportar codigos: grava codes_exported');
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000ad');
SELECT is(public.admin_export_codes('lote-nao-existe') ->> 'error', 'not_found', 'exportar codigos de lote inexistente: not_found');
RESET ROLE;

-- ═══════════════ admin_insert_batch (service_role) e o pacote ═══════════════

SELECT set_config('tests.pin_a', public.new_activation_pin(), true);
SELECT set_config('tests.pin_b', public.new_activation_pin(), true);
SELECT tests.set_service();
SELECT is(public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 3, NULL, '[]'::jsonb) ->> 'error', 'invalid_input', 'lote: quantidade diferente do numero de itens: invalid_input');
SELECT is(public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 0, NULL, '[]'::jsonb) ->> 'error', 'invalid_input', 'lote: quantidade 0: invalid_input');
SELECT is(public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 1, NULL, format('[{"code":"7K3MQ9XAD","pin":"%s","qr_mask":0}]', current_setting('tests.pin_a'))::jsonb) ->> 'error', 'invalid_input', 'lote: codigo com digito invalido: invalid_input');
SELECT is(public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 1, NULL, '[{"code":"10000000Z","pin":"abc","qr_mask":0}]'::jsonb) ->> 'error', 'invalid_input', 'lote: PIN fora do formato: invalid_input');
SELECT is(public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 1, NULL, format('[{"code":"10000000Z","pin":"%s","qr_mask":8}]', current_setting('tests.pin_a'))::jsonb) ->> 'error', 'invalid_input', 'lote: mascara fora de 0 a 7: invalid_input');
SELECT is(public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 1, NULL, format('[{"code":"abcdefghv","pin":"%s","qr_mask":0}]', current_setting('tests.pin_a'))::jsonb) ->> 'error', 'invalid_input', 'lote: codigo fora da forma canonica (minusculas): invalid_input');
INSERT INTO t_res VALUES ('collision', public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 2, NULL,
  format('[{"code":"ABCDEFGHV","pin":"%1$s","qr_mask":0},{"code":"10000000Z","pin":"%1$s","qr_mask":0}]', current_setting('tests.pin_a'))::jsonb));
INSERT INTO t_res VALUES ('dup', public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 2, NULL,
  format('[{"code":"10000000Z","pin":"%1$s","qr_mask":0},{"code":"10000000Z","pin":"%1$s","qr_mask":1}]', current_setting('tests.pin_a'))::jsonb));
INSERT INTO t_res VALUES ('batch1', public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 3, 'lote de teste',
  format('[{"code":"10000000Z","pin":"%1$s","qr_mask":5},{"code":"00000001Y","pin":"%2$s","qr_mask":0},{"code":"H8ZWE5XGH","pin":"%1$s","qr_mask":7}]',
         current_setting('tests.pin_a'), current_setting('tests.pin_b'))::jsonb));
INSERT INTO t_res VALUES ('batch2', public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 1, NULL,
  format('[{"code":"W030F52J1","pin":"%s","qr_mask":2}]', current_setting('tests.pin_a'))::jsonb));
RESET ROLE;

SELECT is((SELECT r ->> 'error' || ':' || (r -> 'codes')::text FROM t_res WHERE k = 'collision'), 'code_collision:["ABCDEFGHV"]', 'lote: codigo que ja existe: code_collision com o codigo (a funcao troca so ele)');
SELECT is((SELECT r ->> 'error' || ':' || (r -> 'codes')::text FROM t_res WHERE k = 'dup'), 'code_collision:["10000000Z"]', 'lote: codigo repetido nos itens: code_collision');
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE code IN ('10000000Z', '00000001Y', 'H8ZWE5XGH') AND batch_id <> 'lote-002'), 0, 'colisao e itens invalidos nao gravaram nada');
SELECT is((SELECT r ->> 'batch_id' FROM t_res WHERE k = 'batch1'), 'lote-002', 'o primeiro lote criado vira lote-002 (o lote-001 e o impresso; o lote-900 do seed nao conta)');
SELECT is((SELECT r ->> 'batch_id' FROM t_res WHERE k = 'batch2'), 'lote-003', 'o proximo e lote-003 (maior numero da faixa de producao mais um)');
SELECT is((SELECT quantity || ':' || created_by::text || ':' || coalesce(notes, 'nulo') || ':' || (package_downloaded_at IS NULL)::text FROM public.tag_batches WHERE id = 'lote-002'), '3:f8f8f8f8-0000-0000-0000-0000000000ad:lote de teste:true', 'lote: quantidade, criador, observacao e pacote ainda nao baixado');
SELECT is((SELECT count(*)::integer || ':' || min(qr_version) || ':' || bool_and(status = 'available')::text FROM public.tag_codes WHERE batch_id = 'lote-002'), '3:3:true', 'lote: 3 codigos available com versao 3');
SELECT is((SELECT qr_mask::text FROM public.tag_codes WHERE code = '10000000Z') || (SELECT qr_mask::text FROM public.tag_codes WHERE code = 'H8ZWE5XGH'), '57', 'lote: a mascara gravada e a enviada');
SELECT ok((SELECT bool_and(activation_pin_hash ~ '^\$2[abxy]\$12\$') FROM public.tag_codes WHERE batch_id = 'lote-002'), 'lote: so hashes bcrypt de custo 12 (nenhum PIN em claro)');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'batch_created' AND entity_id = 'lote-002' AND detail = '{"quantity": 3}'::jsonb AND actor_id = 'f8f8f8f8-0000-0000-0000-0000000000ad'), 1, 'lote: grava batch_created com a quantidade e o admin');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE detail::text LIKE '%' || current_setting('tests.pin_a') || '%' OR detail::text LIKE '%' || current_setting('tests.pin_b') || '%'), 0, 'lote: nenhum PIN na auditoria');
-- O PIN enviado ativa o codigo correspondente (e o do outro item nao).
SELECT tests.set_auth_uid('f8f8f8f8-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('00000001Y', current_setting('tests.pin_a'), 'f8f8f8f8-1111-0000-0000-000000000002') ->> 'error', 'wrong_pin', 'lote: o PIN de OUTRO item nao ativa');
SELECT is(public.activate_tag('00000001Y', current_setting('tests.pin_b'), 'f8f8f8f8-1111-0000-0000-000000000002') ->> 'ok', 'true', 'lote: o PIN do item ativa o codigo correspondente');
RESET ROLE;
-- Pacote: sai uma vez so.
SELECT tests.set_service();
SELECT is(public.admin_mark_package_downloaded('lote-002', 'f8f8f8f8-0000-0000-0000-0000000000ad') ->> 'ok', 'true', 'pacote: primeira marcacao ok');
SELECT is(public.admin_mark_package_downloaded('lote-002', 'f8f8f8f8-0000-0000-0000-0000000000ad') ->> 'error', 'package_already_downloaded', 'pacote: segundo pedido do mesmo lote e recusado');
SELECT is(public.admin_mark_package_downloaded('lote-999', 'f8f8f8f8-0000-0000-0000-0000000000ad') ->> 'error', 'not_found', 'pacote: lote inexistente: not_found');
RESET ROLE;
SELECT ok((SELECT package_downloaded_at IS NOT NULL FROM public.tag_batches WHERE id = 'lote-002'), 'pacote: package_downloaded_at gravado');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'batch_package_downloaded' AND entity_id = 'lote-002'), 1, 'pacote: grava batch_package_downloaded uma vez');
-- Faixa de producao esgotada (999 nao e produzido; ids de 900 em diante sao reservados).
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-899', 1);
SELECT tests.set_service();
SELECT is(public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 1, NULL, format('[{"code":"BZCH5NVX1","pin":"%s","qr_mask":0}]', current_setting('tests.pin_a'))::jsonb) ->> 'error', 'code_collision', 'faixa: codigo que ja existe continua colisao, mesmo com a faixa esgotada');
SELECT is(public.admin_insert_batch('f8f8f8f8-0000-0000-0000-0000000000ad', 1, NULL, format('[{"code":"T6EVBXPYW","pin":"%s","qr_mask":0}]', current_setting('tests.pin_a'))::jsonb) ->> 'error', 'batch_range_exhausted', 'faixa: depois do lote-899 nao ha proximo lote de producao (batch_range_exhausted)');
RESET ROLE;

-- ═══════════════ Estrutura ═══════════════

SELECT is((SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp']) FROM pg_proc WHERE proname LIKE 'admin\_%'), true, 'toda admin_* e security definer com search_path fixo');
SELECT is((SELECT count(*)::integer FROM pg_proc WHERE proname LIKE 'admin\_%' AND prosrc !~ 'is_admin\(\)' AND proname NOT IN ('admin_insert_batch', 'admin_mark_package_downloaded', 'admin_rate_hit')), 0, 'estrutural: toda admin_* de tela confere is_admin() DENTRO da funcao');
SELECT is((SELECT count(*)::integer FROM pg_proc WHERE proname LIKE 'admin\_%' AND has_function_privilege('anon', oid, 'EXECUTE')), 0, 'estrutural: anon nao executa nenhuma admin_*');
SELECT is(has_column_privilege('authenticated', 'public.tag_codes', 'activation_pin_hash', 'SELECT'), false, 'authenticated nao tem SELECT na coluna do hash do PIN');
SELECT is((SELECT count(*)::integer FROM pg_proc WHERE proname LIKE 'admin\_%' AND proname NOT IN ('admin_insert_batch', 'admin_mark_package_downloaded', 'admin_rate_hit') AND prosrc ~ 'new_pin' AND proname NOT IN ('admin_reissue_pin', 'admin_end_assignment')), 0, 'estrutural: so admin_reissue_pin e admin_end_assignment devolvem new_pin');

SELECT * FROM finish();
ROLLBACK;
