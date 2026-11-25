-- pgTAP: rpc_my_dashboard.test.sql
-- Spec 003-tag-qr, T068 (feito quando: pgTAP confere o conteudo para a tutora e que nao traz nada de outro tutor).
-- Migration 0031 (my_dashboard). Regra 13A: erro de negocio e retorno {"ok":false,"error":...}.
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; nenhum PIN escrito no arquivo):
--   tutora A (Ana) com Rex (tag ABCDEFGHV ativa, modo perdido ligado, 2 scans neste mes e 1 de 2020) e Mel (sem tag);
--   tutor B com Bidu (tag ZZZZZZZZ8 ativa, 1 scan); a tag ABCDEFGHV teve antes um vinculo ENCERRADO de B com 3 scans
--   (o isolamento entre vinculos: a Ana nunca conta nem le esses scans); tutor C sem nenhum pet.

BEGIN;

SELECT plan(25);

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
SELECT tests.mk_user('f6f6f6f6-0000-0000-0000-0000000000a1', 'painel.a@faro.test', 'Ana Painel');
SELECT tests.mk_user('f6f6f6f6-0000-0000-0000-0000000000b2', 'painel.b@faro.test', 'Beto Painel');
SELECT tests.mk_user('f6f6f6f6-0000-0000-0000-0000000000c3', 'painel.c@faro.test', 'Caio Painel');
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('f6f6f6f6-1111-0000-0000-000000000001', 'f6f6f6f6-0000-0000-0000-0000000000a1', 'Rex Painel', 'dog'),
  ('f6f6f6f6-1111-0000-0000-000000000002', 'f6f6f6f6-0000-0000-0000-0000000000a1', 'Mel Painel', 'cat'),
  ('f6f6f6f6-1111-0000-0000-000000000003', 'f6f6f6f6-0000-0000-0000-0000000000b2', 'Bidu Painel', 'dog');
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-907', 2);
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(current_setting('tests.pin'), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-907', 'assigned', h.hash, 0 FROM t_hash h, (VALUES ('ABCDEFGHV'), ('ZZZZZZZZ8')) AS c (code);
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id, started_at, ended_at, end_reason) VALUES
  ('f6f6f6f6-2222-0000-0000-00000000000c', 'ABCDEFGHV', NULL, 'f6f6f6f6-0000-0000-0000-0000000000b2', '2026-01-01', '2026-02-01', 'released');
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id) VALUES
  ('f6f6f6f6-2222-0000-0000-00000000000a', 'ABCDEFGHV', 'f6f6f6f6-1111-0000-0000-000000000001', 'f6f6f6f6-0000-0000-0000-0000000000a1'),
  ('f6f6f6f6-2222-0000-0000-00000000000b', 'ZZZZZZZZ8', 'f6f6f6f6-1111-0000-0000-000000000003', 'f6f6f6f6-0000-0000-0000-0000000000b2');
INSERT INTO public.scan_events (tag_code, assignment_id, status_at_scan, occurred_at, last_seen_at, ip_hash, geo_method, city) VALUES
  ('ABCDEFGHV', 'f6f6f6f6-2222-0000-0000-00000000000a', 'assigned', now(), now(), 'ip-hash-secreto-a1', 'ip', 'Santos'),
  ('ABCDEFGHV', 'f6f6f6f6-2222-0000-0000-00000000000a', 'assigned', now(), now(), 'ip-hash-secreto-a2', 'ip', 'Santos'),
  ('ABCDEFGHV', 'f6f6f6f6-2222-0000-0000-00000000000a', 'assigned', '2020-01-01', '2020-01-01', 'ip-hash-secreto-a3', 'none', NULL),
  ('ABCDEFGHV', 'f6f6f6f6-2222-0000-0000-00000000000c', 'assigned', now(), now(), 'ip-hash-antigo-1', 'ip', 'Natal'),
  ('ABCDEFGHV', 'f6f6f6f6-2222-0000-0000-00000000000c', 'assigned', now(), now(), 'ip-hash-antigo-2', 'ip', 'Natal'),
  ('ABCDEFGHV', 'f6f6f6f6-2222-0000-0000-00000000000c', 'assigned', now(), now(), 'ip-hash-antigo-3', 'ip', 'Natal'),
  ('ZZZZZZZZ8', 'f6f6f6f6-2222-0000-0000-00000000000b', 'assigned', now(), now(), 'ip-hash-b1', 'ip', 'Recife');
UPDATE public.rescue_profiles SET lost_mode = true, lost_since = now() WHERE pet_id = 'f6f6f6f6-1111-0000-0000-000000000001';

-- ═══════════════ A ═══════════════

SELECT tests.set_auth_uid('f6f6f6f6-0000-0000-0000-0000000000a1');
CREATE TEMP TABLE t_dash AS SELECT public.my_dashboard() AS d;
GRANT SELECT ON t_dash TO authenticated;
RESET ROLE;

SELECT is((SELECT d ->> 'ok' FROM t_dash), 'true', 'my_dashboard: ok');
SELECT is((SELECT jsonb_array_length(d -> 'pets') FROM t_dash), 2, 'a Ana ve os 2 pets dela');
SELECT is((SELECT p ->> 'name' FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), 'Rex Painel', 'o Rex vem com o nome');
SELECT is((SELECT p ->> 'tag_code' FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), 'ABCD-EFGH-V', 'Rex: codigo da tag ativa no formato de exibicao');
SELECT is((SELECT p ->> 'has_tag' FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), 'true', 'Rex: has_tag true');
SELECT is((SELECT p ->> 'tag_status' FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), 'assigned', 'Rex: situacao da tag');
SELECT is((SELECT p ->> 'lost_mode' FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), 'true', 'Rex: modo perdido ligado');
SELECT is((SELECT (p ->> 'scans_month')::integer FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), 2, 'Rex: 2 scans neste mes (o de 2020 e os 3 do vinculo antigo de B ficam de fora)');
SELECT is((SELECT p -> 'last_scan' ->> 'geo_method' FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), 'ip', 'Rex: ultimo scan traz o metodo');
SELECT ok((SELECT (p -> 'last_scan' ->> 'occurred_at')::timestamptz >= now() - interval '1 minute' FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), 'Rex: ultimo scan e o mais recente');
SELECT is((SELECT (p ->> 'visible_shown')::integer || '/' || (p ->> 'visible_total') FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000001'), '2/5', 'Rex: estranhos veem 2 de 5 (padrao: temperamento e cuidados)');
SELECT is((SELECT p ->> 'has_tag' || ':' || coalesce(p ->> 'tag_code', 'nulo') || ':' || (p ->> 'scans_month') || ':' || (p -> 'last_scan')::text FROM t_dash, jsonb_array_elements(d -> 'pets') p WHERE p ->> 'id' = 'f6f6f6f6-1111-0000-0000-000000000002'), 'false:nulo:0:null', 'Mel (sem tag): has_tag false, sem codigo, 0 scans, sem ultimo scan');
SELECT is((SELECT d -> 'pending_activation' FROM t_dash), 'null'::jsonb, 'sem ativacao pendente: null');

-- Nada de outro tutor nem de segredo na resposta.
SELECT is((SELECT d::text ~* '(Bidu|ZZZZ|Recife|Natal|ip-hash|activation_pin_hash|\$2[abxy]\$|f6f6f6f6-0000-0000-0000-0000000000b2)' FROM t_dash), false, 'a resposta da Ana nao traz nada do tutor B, ip_hash, token nem hash de PIN');
SELECT is((SELECT d::text ~* '(ip_hash|location_token|tutor_id)' FROM t_dash), false, 'a resposta nao tem as colunas sensiveis nem o tutor_id');

-- Ativacao pendente (valida e vencida).
INSERT INTO public.pending_activations (tutor_id, tag_code) VALUES ('f6f6f6f6-0000-0000-0000-0000000000a1', 'JKMNPQRSR');
SELECT tests.set_auth_uid('f6f6f6f6-0000-0000-0000-0000000000a1');
SELECT is(public.my_dashboard() ->> 'pending_activation', 'JKMN-PQRS-R', 'ativacao pendente vem no formato de exibicao');
RESET ROLE;
UPDATE public.pending_activations SET expires_at = now() - interval '1 second' WHERE tutor_id = 'f6f6f6f6-0000-0000-0000-0000000000a1';
SELECT tests.set_auth_uid('f6f6f6f6-0000-0000-0000-0000000000a1');
SELECT is(public.my_dashboard() -> 'pending_activation', 'null'::jsonb, 'ativacao pendente vencida nao aparece');
RESET ROLE;

-- ═══════════════ B e C ═══════════════

SELECT tests.set_auth_uid('f6f6f6f6-0000-0000-0000-0000000000b2');
CREATE TEMP TABLE t_dash_b AS SELECT public.my_dashboard() AS d;
GRANT SELECT ON t_dash_b TO authenticated;
RESET ROLE;
SELECT is((SELECT jsonb_array_length(d -> 'pets') FROM t_dash_b), 1, 'B ve so o proprio pet');
SELECT is((SELECT (d -> 'pets' -> 0 ->> 'scans_month')::integer FROM t_dash_b), 1, 'B: o Bidu tem 1 scan (os do vinculo antigo sem pet nao entram em pet nenhum)');
SELECT is((SELECT d::text ~* '(Rex|Mel|Santos|ABCD-EFGH-V|ip-hash)' FROM t_dash_b), false, 'a resposta de B nao traz nada da Ana');

SELECT tests.set_auth_uid('f6f6f6f6-0000-0000-0000-0000000000c3');
SELECT is(public.my_dashboard(), '{"ok": true, "pets": [], "pending_activation": null}'::jsonb, 'tutor sem pets: lista vazia (estado vazio do painel)');
RESET ROLE;

-- ═══════════════ Privilegios e estrutura ═══════════════

SELECT tests.set_anon();
SELECT is(tests.denied($$ SELECT public.my_dashboard() $$), true, 'anon nao executa my_dashboard');
RESET ROLE;
SELECT is(has_function_privilege('authenticated', 'public.my_dashboard()', 'EXECUTE') AND NOT has_function_privilege('anon', 'public.my_dashboard()', 'EXECUTE'), true, 'my_dashboard: authenticated executa, anon nao');
SELECT is((SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid = 'public.my_dashboard()'::regprocedure), true, 'my_dashboard e security definer com search_path fixo');
SELECT is((SELECT prosrc !~* 'RAISE EXCEPTION' FROM pg_proc WHERE oid = 'public.my_dashboard()'::regprocedure), true, 'estrutural (13A): my_dashboard nao lanca excecao');

SELECT * FROM finish();
ROLLBACK;
