-- pgTAP: endurecimento_tags.test.sql
-- Spec 003-tag-qr, T101 e T105 (contracts/security-hardening.contract.md secoes 4, 5, 6 e 7). Migration 0035.
-- Prova: o limite de chamadas conta TODA chamada (inclusive a que falha antes do PIN) porque as RPCs RETORNAM o erro em vez de
-- lancar (regra 13A); os escopos do contrato; o teto de 20 pets; o teto de 3 pedidos de 2a via abertos; os limites do bucket
-- `pet-photos`; os limites do admin e os tetos globais, com UM evento de auditoria por janela.
-- O relogio do pgTAP e fixo (now() congelado na transacao), entao uma janela de rate_limit_hit nunca vira no meio do teste.
--
-- Cenario (criado aqui, desfeito no ROLLBACK final): tutores A, B, X, Y e Z; admins ADM1 e ADM2; lote-910 com 4 tags de Z.

BEGIN;

SELECT plan(61);

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

SELECT tests.mk_user('f9f9f9f9-0000-0000-0000-0000000000a1', 'endur.a@faro.test', 'Ana Endur');
SELECT tests.mk_user('f9f9f9f9-0000-0000-0000-0000000000b2', 'endur.b@faro.test', 'Beto Endur');
SELECT tests.mk_user('f9f9f9f9-0000-0000-0000-0000000000c3', 'endur.x@faro.test', 'Xavier Endur');
SELECT tests.mk_user('f9f9f9f9-0000-0000-0000-0000000000d4', 'endur.y@faro.test', 'Yara Endur');
SELECT tests.mk_user('f9f9f9f9-0000-0000-0000-0000000000e5', 'endur.z@faro.test', 'Zeca Endur');
SELECT tests.mk_user('f9f9f9f9-0000-0000-0000-0000000000f1', 'endur.adm1@faro.test', 'Admin Um');
SELECT tests.mk_user('f9f9f9f9-0000-0000-0000-0000000000f2', 'endur.adm2@faro.test', 'Admin Dois');
UPDATE public.perfis SET papel = 'admin' WHERE id IN ('f9f9f9f9-0000-0000-0000-0000000000f1', 'f9f9f9f9-0000-0000-0000-0000000000f2');
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('f9f9f9f9-1111-0000-0000-000000000001', 'f9f9f9f9-0000-0000-0000-0000000000e5', 'Z1 Endur', 'dog'),
  ('f9f9f9f9-1111-0000-0000-000000000002', 'f9f9f9f9-0000-0000-0000-0000000000e5', 'Z2 Endur', 'dog'),
  ('f9f9f9f9-1111-0000-0000-000000000003', 'f9f9f9f9-0000-0000-0000-0000000000e5', 'Z3 Endur', 'cat'),
  ('f9f9f9f9-1111-0000-0000-000000000004', 'f9f9f9f9-0000-0000-0000-0000000000e5', 'Z4 Endur', 'cat');
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-910', 4);
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-910', 'assigned', extensions.crypt(public.new_activation_pin(), extensions.gen_salt('bf', 12)), 0
  FROM (VALUES ('W030F52J1'), ('1NDAN8EKS'), ('BZCH5NVX1'), ('10000000Z')) AS c (code);
INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id) VALUES
  ('W030F52J1', 'f9f9f9f9-1111-0000-0000-000000000001', 'f9f9f9f9-0000-0000-0000-0000000000e5'),
  ('1NDAN8EKS', 'f9f9f9f9-1111-0000-0000-000000000002', 'f9f9f9f9-0000-0000-0000-0000000000e5'),
  ('BZCH5NVX1', 'f9f9f9f9-1111-0000-0000-000000000003', 'f9f9f9f9-0000-0000-0000-0000000000e5'),
  ('10000000Z', 'f9f9f9f9-1111-0000-0000-000000000004', 'f9f9f9f9-0000-0000-0000-0000000000e5');
CREATE TEMP TABLE t_chk (k text NOT NULL, i integer NOT NULL, r jsonb NOT NULL, PRIMARY KEY (k, i));
GRANT ALL ON t_chk TO authenticated, service_role;
CREATE TEMP TABLE t_res (k text PRIMARY KEY, r jsonb NOT NULL);
GRANT ALL ON t_res TO authenticated, service_role;

-- ═══════════════ activate_calls: 30 em 15 min, TODA chamada conta (contrato, secao 4) ═══════════════

DELETE FROM public.rate_limits;
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000a1');
INSERT INTO t_chk SELECT 'act', i, public.activate_tag('7K3MQ9XAD', 'AAAAAA', NULL) FROM generate_series(1, 32) AS i;
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM t_chk WHERE k = 'act' AND i <= 30 AND r ->> 'error' = 'invalid_code'), 30, 'activate_tag: as 30 primeiras chamadas (codigo INVALIDO, falham antes do PIN) respondem invalid_code');
SELECT is((SELECT r ->> 'error' FROM t_chk WHERE k = 'act' AND i = 31), 'locked', 'activate_tag: a 31a chamada em 15 min devolve locked, MESMO com codigo invalido');
SELECT ok((SELECT (r ->> 'retry_after_seconds')::integer BETWEEN 1 AND 900 FROM t_chk WHERE k = 'act' AND i = 31), 'activate_tag: locked do limite traz retry_after_seconds entre 1 e 900');
SELECT is((SELECT r ->> 'error' FROM t_chk WHERE k = 'act' AND i = 32), 'locked', 'activate_tag: a 32a continua locked');
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tutor_id = 'f9f9f9f9-0000-0000-0000-0000000000a1'), 0, 'o limite de chamadas nao cria tentativa de PIN (nao e erro de PIN)');
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('7K3MQ9XAD', 'AAAAAA', NULL) ->> 'error', 'invalid_code', 'activate_tag: outra conta tem o proprio limite');
RESET ROLE;
SELECT is((SELECT count FROM public.rate_limits WHERE scope = 'activate_calls' AND key = 'f9f9f9f9-0000-0000-0000-0000000000a1'), 32, 'o contador do limite sobreviveu as 32 chamadas (nenhuma desfez a transacao)');

-- ═══════════════ tutor_write_min: 30 por minuto, escopo unico para as escritas ═══════════════

DELETE FROM public.rate_limits;
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000a1');
INSERT INTO t_chk SELECT 'w', i, public.clear_pending_activation() FROM generate_series(1, 31) AS i;
INSERT INTO t_res VALUES ('w_set', public.set_pending_activation('ABCDEFGHV'));
INSERT INTO t_res VALUES ('w_lost', public.set_lost_mode('f9f9f9f9-1111-0000-0000-000000000001', false, NULL, NULL, NULL));
INSERT INTO t_res VALUES ('w_rel', public.release_tag('ABCDEFGHV', 'released'));
INSERT INTO t_res VALUES ('w_req', public.request_tag_replacement('ABCDEFGHV', 'damaged'));
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM t_chk WHERE k = 'w' AND i <= 30 AND r = '{"ok": true}'::jsonb), 30, 'escritas: as 30 primeiras em 1 minuto passam');
SELECT is((SELECT r ->> 'error' FROM t_chk WHERE k = 'w' AND i = 31), 'too_many_requests', 'escritas: a 31a em 1 minuto devolve too_many_requests');
SELECT ok((SELECT (r ->> 'retry_after_seconds')::integer BETWEEN 1 AND 60 FROM t_chk WHERE k = 'w' AND i = 31), 'escritas: too_many_requests traz retry_after_seconds entre 1 e 60');
SELECT is((SELECT array_agg(r ->> 'error' ORDER BY k) FROM t_res WHERE k LIKE 'w\_%'), ARRAY['too_many_requests', 'too_many_requests', 'too_many_requests', 'too_many_requests'], 'o escopo e um so: set_pending_activation, set_lost_mode, release_tag e request_tag_replacement tambem recebem too_many_requests');
SELECT is((SELECT count(*)::integer FROM public.pending_activations WHERE tutor_id = 'f9f9f9f9-0000-0000-0000-0000000000a1'), 0, 'o limite barrou a escrita (nenhuma ativacao pendente criada)');
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000b2');
SELECT is(public.clear_pending_activation(), '{"ok": true}'::jsonb, 'escritas: outra conta tem o proprio limite');
RESET ROLE;

-- ═══════════════ tutor_read_min: 120 por minuto ═══════════════

DELETE FROM public.rate_limits;
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000a1');
INSERT INTO t_chk SELECT 'rd', i, jsonb_build_object('e', public.my_dashboard() ->> 'error') FROM generate_series(1, 121) AS i;
INSERT INTO t_res VALUES ('rd_pend', public.get_pending_activation());
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM t_chk WHERE k = 'rd' AND i <= 120 AND r = '{"e": null}'::jsonb), 120, 'leituras: as 120 primeiras my_dashboard em 1 minuto passam');
SELECT is((SELECT r ->> 'e' FROM t_chk WHERE k = 'rd' AND i = 121), 'too_many_requests', 'leituras: a 121a my_dashboard devolve too_many_requests');
SELECT is((SELECT r ->> 'error' FROM t_res WHERE k = 'rd_pend'), 'too_many_requests', 'leituras: get_pending_activation divide o mesmo escopo (tutor_read_min)');

-- ═══════════════ A guarda esta em cada RPC da tabela do contrato, com os numeros do contrato ═══════════════

SELECT is((SELECT count(*)::integer FROM pg_proc WHERE oid IN (
    'public.activate_tag(text,text,uuid,boolean,boolean)'::regprocedure, 'public.release_tag(text,text)'::regprocedure,
    'public.request_tag_replacement(text,text)'::regprocedure, 'public.set_lost_mode(uuid,boolean,text,boolean,boolean)'::regprocedure,
    'public.set_pending_activation(text)'::regprocedure, 'public.clear_pending_activation()'::regprocedure,
    'public.my_dashboard()'::regprocedure, 'public.get_pending_activation()'::regprocedure) AND prosrc ~ 'rpc_guard\('), 8, 'as 8 RPCs do contrato chamam rpc_guard');
SELECT is((SELECT prosrc ~ 'rpc_guard\(''activate_calls'', 30, 900\)' FROM pg_proc WHERE oid = 'public.activate_tag(text,text,uuid,boolean,boolean)'::regprocedure), true, 'activate_tag: activate_calls, 30 em 900 s');
SELECT is((SELECT bool_and(prosrc ~ 'rpc_guard\(''tutor_write_min'', 30, 60\)') FROM pg_proc WHERE oid IN (
    'public.release_tag(text,text)'::regprocedure, 'public.request_tag_replacement(text,text)'::regprocedure,
    'public.set_lost_mode(uuid,boolean,text,boolean,boolean)'::regprocedure, 'public.set_pending_activation(text)'::regprocedure,
    'public.clear_pending_activation()'::regprocedure)), true, 'as 5 escritas: tutor_write_min, 30 em 60 s');
SELECT is((SELECT bool_and(prosrc ~ 'rpc_guard\(''tutor_read_min'', 120, 60\)') FROM pg_proc WHERE oid IN (
    'public.my_dashboard()'::regprocedure, 'public.get_pending_activation()'::regprocedure)), true, 'as 2 leituras: tutor_read_min, 120 em 60 s');
SELECT is((SELECT prosrc !~* 'RAISE EXCEPTION' FROM pg_proc WHERE oid = 'public.activate_tag(text,text,uuid,boolean,boolean)'::regprocedure), true, 'a guarda nao introduziu excecao em activate_tag (13A)');

SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000a1');
SELECT is(tests.denied($$ SELECT public.rpc_guard('x', 1, 60) $$), true, 'authenticated nao executa rpc_guard');
SELECT is(tests.denied($$ SELECT public.rate_hit_audited('x', 'y', 1, 60, 'e', NULL, 'r') $$), true, 'authenticated nao executa rate_hit_audited');
SELECT is(tests.denied($$ SELECT * FROM public.rate_limits $$), true, 'authenticated nao le rate_limits');
RESET ROLE;
SELECT tests.set_anon();
SELECT is(tests.denied($$ SELECT public.rpc_guard('x', 1, 60) $$), true, 'anon nao executa rpc_guard');
RESET ROLE;

-- ═══════════════ Tetos de recurso ═══════════════

-- 20 pets por tutor.
INSERT INTO public.pets (tutor_id, name, species) SELECT 'f9f9f9f9-0000-0000-0000-0000000000c3', 'Pet ' || i, 'dog' FROM generate_series(1, 20) AS i;
SELECT is((SELECT count(*)::integer FROM public.pets WHERE tutor_id = 'f9f9f9f9-0000-0000-0000-0000000000c3'), 20, 'o tutor X chegou a 20 pets');
SELECT throws_ok($$ INSERT INTO public.pets (tutor_id, name, species) VALUES ('f9f9f9f9-0000-0000-0000-0000000000c3', 'Pet 21', 'dog') $$, 'P0001', 'pet_limit', 'o 21o pet e recusado (pet_limit)');
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000c3');
SELECT throws_ok($$ INSERT INTO public.pets (tutor_id, name, species) VALUES ('f9f9f9f9-0000-0000-0000-0000000000c3', 'Pet 21', 'dog') $$, 'P0001', 'pet_limit', 'o 21o pet pela API (authenticated) tambem e recusado');
RESET ROLE;
SELECT lives_ok($$ INSERT INTO public.pets (tutor_id, name, species) VALUES ('f9f9f9f9-0000-0000-0000-0000000000d4', 'Pet do Y', 'dog') $$, 'o limite e por tutor: outro tutor cadastra normalmente');
DELETE FROM public.pets WHERE tutor_id = 'f9f9f9f9-0000-0000-0000-0000000000c3' AND name = 'Pet 20';
SELECT lives_ok($$ INSERT INTO public.pets (tutor_id, name, species) VALUES ('f9f9f9f9-0000-0000-0000-0000000000c3', 'Pet novo', 'dog') $$, 'removendo um pet, abre vaga');

-- 3 pedidos de 2a via abertos por tutor.
DELETE FROM public.rate_limits;
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000e5');
SELECT is(public.request_tag_replacement('W030F52J1', 'damaged') ->> 'ok', 'true', 'pedido 1 de 3 entra');
SELECT is(public.request_tag_replacement('1NDAN8EKS', 'damaged') ->> 'ok', 'true', 'pedido 2 de 3 entra');
SELECT is(public.request_tag_replacement('BZCH5NVX1', 'damaged') ->> 'ok', 'true', 'pedido 3 de 3 entra');
SELECT is(public.request_tag_replacement('10000000Z', 'damaged') ->> 'error', 'replacement_limit', 'o 4o pedido de 2a via aberto e recusado (replacement_limit)');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_replacement_requests WHERE tutor_id = 'f9f9f9f9-0000-0000-0000-0000000000e5' AND status = 'open'), 3, 'ficam 3 pedidos abertos');

-- Bucket pet-photos.
SELECT is((SELECT file_size_limit FROM storage.buckets WHERE id = 'pet-photos'), 5242880::bigint, 'bucket pet-photos: limite de 5 MB');
SELECT is((SELECT allowed_mime_types FROM storage.buckets WHERE id = 'pet-photos'), ARRAY['image/jpeg', 'image/png', 'image/webp'], 'bucket pet-photos: so jpeg, png e webp');
SELECT is((SELECT public FROM storage.buckets WHERE id = 'pet-photos'), false, 'bucket pet-photos continua privado');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'pet\_photos\_tutor\_%'), 4, 'as 4 politicas de caminho do bucket continuam (<uid>/...)');

-- ═══════════════ Admin: 60 por hora em reemitir PIN e encerrar vinculo; evento de auditoria uma vez por janela ═══════════════

DELETE FROM public.rate_limits;
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000a1');
SELECT is(public.admin_reissue_pin('H8ZWE5XGH') ->> 'error', 'forbidden', 'admin_reissue_pin: tutor comum: forbidden');
SELECT is(public.admin_end_assignment('H8ZWE5XGH', 'admin') ->> 'error', 'forbidden', 'admin_end_assignment: tutor comum: forbidden');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.rate_limits WHERE scope LIKE 'admin\_%'), 0, 'forbidden nao consome o limite do admin');
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000f1');
INSERT INTO t_chk SELECT 'ri', i, public.admin_reissue_pin('H8ZWE5XGH') FROM generate_series(1, 62) AS i;
INSERT INTO t_chk SELECT 'en', i, public.admin_end_assignment('H8ZWE5XGH', 'admin') FROM generate_series(1, 62) AS i;
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM t_chk WHERE k = 'ri' AND i <= 60 AND r ->> 'error' = 'not_found'), 60, 'admin_reissue_pin: as 60 primeiras em 1 hora passam pelo limite');
SELECT is((SELECT r ->> 'error' FROM t_chk WHERE k = 'ri' AND i = 61), 'too_many_requests', 'admin_reissue_pin: a 61a em 1 hora devolve too_many_requests');
SELECT ok((SELECT (r ->> 'retry_after_seconds')::integer BETWEEN 1 AND 3600 FROM t_chk WHERE k = 'ri' AND i = 61), 'admin_reissue_pin: retry_after_seconds entre 1 e 3600');
SELECT is((SELECT count(*)::integer FROM t_chk WHERE k = 'en' AND i <= 60 AND r ->> 'error' = 'not_found'), 60, 'admin_end_assignment: as 60 primeiras em 1 hora passam pelo limite');
SELECT is((SELECT r ->> 'error' FROM t_chk WHERE k = 'en' AND i = 62), 'too_many_requests', 'admin_end_assignment: a 62a em 1 hora devolve too_many_requests (o limite e proprio, separado do de reemitir)');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'admin_rate_limited' AND entity_id = 'admin_reissue_hour' AND actor_id = 'f9f9f9f9-0000-0000-0000-0000000000f1'), 1, 'estouro do limite: UM evento de auditoria por janela (reemitir PIN), com o admin como ator');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'admin_rate_limited' AND entity_id = 'admin_end_hour' AND actor_id = 'f9f9f9f9-0000-0000-0000-0000000000f1'), 1, 'estouro do limite: UM evento de auditoria por janela (encerrar vinculo)');
SELECT tests.set_auth_uid('f9f9f9f9-0000-0000-0000-0000000000f2');
SELECT is(public.admin_reissue_pin('H8ZWE5XGH') ->> 'error', 'not_found', 'o limite e por admin: o outro admin segue normalmente');
RESET ROLE;

-- admin-create-batch: 10 lotes por hora por admin (a Edge Function chama admin_rate_hit com a role de servico).
SELECT tests.set_service();
INSERT INTO t_chk SELECT 'ab', i, to_jsonb(public.admin_rate_hit('f9f9f9f9-0000-0000-0000-0000000000f1', 'admin_batch_hour', 10, 3600)) FROM generate_series(1, 12) AS i;
INSERT INTO t_chk SELECT 'ab2', i, to_jsonb(public.admin_rate_hit('f9f9f9f9-0000-0000-0000-0000000000f2', 'admin_batch_hour', 10, 3600)) FROM generate_series(1, 1) AS i;
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM t_chk WHERE k = 'ab' AND i <= 10 AND r = 'false'::jsonb), 10, 'admin_rate_hit: os 10 primeiros lotes por hora passam');
SELECT is((SELECT array_agg(r::text ORDER BY i) FROM t_chk WHERE k = 'ab' AND i > 10), ARRAY['true', 'true'], 'admin_rate_hit: o 11o e o 12o estouram');
SELECT is((SELECT r::text FROM t_chk WHERE k = 'ab2'), 'false', 'admin_rate_hit: o limite e por admin');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'admin_rate_limited' AND entity_id = 'admin_batch_hour'), 1, 'admin_rate_hit: um evento de auditoria por janela, mesmo com dois estouros');

-- ═══════════════ Tetos globais (resolve-tag e register-scan): um evento por minuto ═══════════════

SELECT tests.set_service();
INSERT INTO t_chk SELECT 'gl', i, to_jsonb(public.global_rate_hit('resolve_global_min', 3, 60)) FROM generate_series(1, 6) AS i;
RESET ROLE;
SELECT is((SELECT array_agg(r::text ORDER BY i) FROM t_chk WHERE k = 'gl'), ARRAY['false', 'false', 'false', 'true', 'true', 'true'], 'teto global: os 3 primeiros passam e o resto estoura (limite 3 no teste)');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'global_rate_limit' AND entity_id = 'resolve_global_min'), 1, 'teto global: UM evento global_rate_limit por minuto, mesmo com 3 estouros');
SELECT is((SELECT detail FROM public.audit_log WHERE event = 'global_rate_limit' AND entity_id = 'resolve_global_min'), '{"limit": 3, "scope": "resolve_global_min", "window_seconds": 60}'::jsonb, 'o evento traz so escopo, limite e janela (nada de chave, IP ou PIN)');
SELECT is((SELECT actor_id IS NULL AND actor_role = 'system' FROM public.audit_log WHERE event = 'global_rate_limit' AND entity_id = 'resolve_global_min'), true, 'o evento do teto global e do sistema (sem ator)');
SELECT tests.set_service();
SELECT is(public.global_rate_hit('scan_global_min', 600, 60), false, 'teto global do scan: abaixo de 600 por minuto nao estoura');
RESET ROLE;
SELECT is(has_function_privilege('anon', 'public.global_rate_hit(text,integer,integer)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.global_rate_hit(text,integer,integer)', 'EXECUTE') OR has_function_privilege('anon', 'public.admin_rate_hit(uuid,text,integer,integer)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.admin_rate_hit(uuid,text,integer,integer)', 'EXECUTE'), false, 'so service_role executa global_rate_hit e admin_rate_hit');
SELECT is((SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp']) FROM pg_proc WHERE proname IN ('rpc_guard', 'rate_hit_audited', 'global_rate_hit', 'admin_rate_hit')), true, 'as funcoes do endurecimento sao security definer com search_path fixo');

SELECT * FROM finish();
ROLLBACK;
