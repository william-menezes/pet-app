-- pgTAP: rls_scans.test.sql
-- Spec 003-tag-qr, T058: "Testes de isolamento entre vinculos" de contracts/rls-expectations.md, com as RPCs REAIS de
-- scan (register_scan, set_scan_location), de ativacao (activate_tag) e de liberacao (release_tag, T087). Nada e simulado.
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; PINs gerados na transacao e guardados so em GUC):
--   tutora A com Rex e a tag T1 (ABCDEFGHV); tutor B com Bidu (tag T2 = ZZZZZZZZ8) e Nina (sem tag); admin.

BEGIN;

SELECT plan(48);

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
CREATE OR REPLACE FUNCTION tests.denied(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION tests.pin() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('tests.pin'); $$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT tests.mk_user('a5a5a5a5-0000-0000-0000-0000000000a1', 'iso.a@faro.test', 'Ana Iso');
SELECT tests.mk_user('a5a5a5a5-0000-0000-0000-0000000000b2', 'iso.b@faro.test', 'Beto Iso');
SELECT tests.mk_user('a5a5a5a5-0000-0000-0000-0000000000d4', 'iso.admin@faro.test', 'Admin Iso');
UPDATE public.perfis SET celular = '+5511900000051', celular_confirmado_em = now() WHERE id = 'a5a5a5a5-0000-0000-0000-0000000000a1';
UPDATE public.perfis SET celular = '+5511900000052', celular_confirmado_em = now() WHERE id = 'a5a5a5a5-0000-0000-0000-0000000000b2';
UPDATE public.perfis SET papel = 'admin' WHERE id = 'a5a5a5a5-0000-0000-0000-0000000000d4';
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('a5a5a5a5-1111-0000-0000-000000000001', 'a5a5a5a5-0000-0000-0000-0000000000a1', 'Rex Iso', 'dog'),
  ('a5a5a5a5-1111-0000-0000-000000000002', 'a5a5a5a5-0000-0000-0000-0000000000b2', 'Bidu Iso', 'dog'),
  ('a5a5a5a5-1111-0000-0000-000000000003', 'a5a5a5a5-0000-0000-0000-0000000000b2', 'Nina Iso', 'cat');
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-907', 2);
SELECT set_config('tests.pin', public.new_activation_pin(), true);
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
VALUES ('ABCDEFGHV', 'lote-907', 'assigned', extensions.crypt(public.new_activation_pin(), extensions.gen_salt('bf', 12)), 0),
       ('ZZZZZZZZ8', 'lote-907', 'assigned', extensions.crypt(public.new_activation_pin(), extensions.gen_salt('bf', 12)), 0);
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id, started_at) VALUES
  ('a5a5a5a5-2222-0000-0000-00000000000a', 'ABCDEFGHV', 'a5a5a5a5-1111-0000-0000-000000000001', 'a5a5a5a5-0000-0000-0000-0000000000a1', now() - interval '5 days'),
  ('a5a5a5a5-2222-0000-0000-00000000000b', 'ZZZZZZZZ8', 'a5a5a5a5-1111-0000-0000-000000000002', 'a5a5a5a5-0000-0000-0000-0000000000b2', now() - interval '4 days');

CREATE TEMP TABLE t_res (k text PRIMARY KEY, r jsonb NOT NULL);
GRANT ALL ON t_res TO service_role;

-- Scans de A em T1 (duas origens) e de B em T2, com as RPCs reais.
SELECT tests.set_service();
INSERT INTO t_res VALUES ('a1', public.register_scan('ABCDEFGHV', 'iso-1', NULL, -23.55, -46.63, 'Sao Paulo', 'SP'));
INSERT INTO t_res VALUES ('a2', public.register_scan('ABCDEFGHV', 'iso-2', NULL, -22.90, -43.17, 'Rio de Janeiro', 'RJ'));
INSERT INTO t_res VALUES ('b1', public.register_scan('ZZZZZZZZ8', 'iso-3', NULL, -25.43, -49.27, 'Curitiba', 'PR'));
RESET ROLE;

-- ═══════════════ Antes da troca ═══════════════

SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.my_scans), 2, 'A le os 2 scans do proprio vinculo em my_scans');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE tag_code = 'ZZZZZZZZ8'), 0, 'A nao le scan da tag do tutor B');
SELECT is((SELECT count(*)::integer FROM public.scan_events), 2, 'A le so 2 linhas de scan_events (a RLS filtra o resto)');
RESET ROLE;
SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.my_scans), 1, 'B le so o scan da propria tag (T2)');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE tag_code = 'ABCDEFGHV'), 0, 'B ainda nao le nada da tag T1 (ela e da A)');
RESET ROLE;

-- ═══════════════ A libera a T1 (release_tag REAL) e B a ativa com o PIN novo ═══════════════

SELECT set_config('tests.old_pin', tests.pin(), true);
SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000a1');
SELECT set_config('tests.pin', public.release_tag('ABCDEFGHV', 'released') ->> 'new_pin', true);
RESET ROLE;
SELECT isnt(tests.pin(), current_setting('tests.old_pin'), 'release_tag devolveu um PIN novo (diferente do anterior)');
SELECT is((SELECT status || ':' || (extensions.crypt(tests.pin(), activation_pin_hash) = activation_pin_hash)::text FROM public.tag_codes WHERE code = 'ABCDEFGHV'),
          'available:true', 'release_tag: tag available e o hash gravado confere com o PIN novo');

SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'a5a5a5a5-1111-0000-0000-000000000003') ->> 'ok', 'true', 'B ativa a T1 liberada com o PIN novo (activate_tag real)');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE tag_code = 'ABCDEFGHV'), 0, 'item 1: B NAO le nenhum scan anterior de T1');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE tag_code = 'ABCDEFGHV'), 0, 'item 1: nem por scan_events');
SELECT is((SELECT count(*)::integer FROM public.my_scans), 1, 'B continua lendo so o scan de T2');
RESET ROLE;

-- ═══════════════ Scan novo da T1 depois da troca ═══════════════

SELECT tests.set_service();
INSERT INTO t_res VALUES ('n1', public.register_scan('ABCDEFGHV', 'iso-4', NULL, -23.00, -46.00, 'Campinas', 'SP'));
INSERT INTO t_res VALUES ('n2', public.register_scan('ABCDEFGHV', 'iso-5', 'a5a5a5a5-0000-0000-0000-0000000000a1'));
RESET ROLE;
SELECT is((SELECT r -> 'notify' ->> 'to' FROM t_res WHERE k = 'n1'), 'iso.b@faro.test', 'o aviso do scan novo vai para o NOVO tutor (B), nunca para a A');
SELECT is((SELECT r ->> 'owner' FROM t_res WHERE k = 'n2'), 'false', 'A (dona anterior) vendo a T1 depois da troca nao e a dona: o scan e gravado');

SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.my_scans), 2, 'item 2: A continua lendo so os 2 scans do vinculo antigo');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE assignment_id <> 'a5a5a5a5-2222-0000-0000-00000000000a'), 0, 'item 2: A nao le nenhum scan do vinculo novo');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE occurred_at >= now()), 2, 'item 2: os scans de A sao so os anteriores (na transacao todos tem o mesmo now(); a conta e pelo vinculo)');
RESET ROLE;
SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE tag_code = 'ABCDEFGHV'), 2, 'item 2: B le os 2 scans novos de T1 (n1 e n2)');
SELECT is((SELECT count(DISTINCT assignment_id)::integer FROM public.my_scans WHERE tag_code = 'ABCDEFGHV'), 1, 'B le so scans de um vinculo (o dele)');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE city IN ('Sao Paulo', 'Rio de Janeiro')), 0, 'B nao le a cidade de nenhum scan antigo da T1');
RESET ROLE;

-- ═══════════════ Historico de vinculos ═══════════════

SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV'), 1, 'item 3: A le so o proprio (encerrado) vinculo de T1');
RESET ROLE;
SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV'), 1, 'item 3: B le so o proprio (ativo) vinculo de T1');
RESET ROLE;
SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000d4');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV'), 2, 'item 3: o admin le o historico completo de vinculos de T1');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE tag_code = 'ABCDEFGHV'), 4, 'o admin le todos os scans de T1 (sem as colunas sensiveis)');
SELECT is(tests.denied($$ SELECT ip_hash FROM public.scan_events $$), true, 'o admin tambem nao le ip_hash');
SELECT is(tests.denied($$ SELECT location_token_hash FROM public.scan_events $$), true, 'o admin tambem nao le location_token_hash');
SELECT is(tests.denied($$ SELECT * FROM public.scan_events $$), true, 'SELECT * em scan_events falha ate para o admin (lista inclui coluna sensivel)');
RESET ROLE;

-- ═══════════════ Token de localizacao de um vinculo encerrado ═══════════════

-- O token do primeiro scan de A (vinculo ja encerrado) ainda vale 30 minutos: a localizacao e gravada na linha antiga,
-- mas nenhum aviso sai (nem para A, nem para B).
SELECT tests.set_service();
INSERT INTO t_res VALUES ('loc', public.set_scan_location((SELECT r ->> 'scan_token' FROM t_res WHERE k = 'a1'), -23.5614, -46.6559, 12));
RESET ROLE;
SELECT is((SELECT r ->> 'updated' FROM t_res WHERE k = 'loc'), 'true', 'token do vinculo antigo: a localizacao e gravada na linha do vinculo antigo');
SELECT ok(NOT ((SELECT r FROM t_res WHERE k = 'loc') ? 'notify'), 'vinculo encerrado: a localizacao nao gera aviso a ninguem');
SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE geo_method = 'gps'), 0, 'B nao ve a localizacao precisa gravada no vinculo antigo');
RESET ROLE;
SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE geo_method = 'gps'), 1, 'A ve a propria localizacao precisa do vinculo dela');
RESET ROLE;

-- ═══════════════ anon e escrita ═══════════════

SELECT tests.set_anon();
SELECT is(tests.denied($$ SELECT count(*) FROM public.my_scans $$), true, 'anon nao le my_scans');
SELECT is(tests.denied($$ SELECT count(*) FROM public.scan_events $$), true, 'anon nao le scan_events');
SELECT is(tests.denied($$ SELECT count(*) FROM public.tag_assignments $$), true, 'anon nao le tag_assignments');
-- my_scans e somente leitura: escrita responde permissao negada (42501), nunca "view nao atualizavel" (500 no PostgREST).
SELECT is(tests.denied($$ INSERT INTO public.my_scans (id) VALUES (gen_random_uuid()) $$), true, 'anon: INSERT em my_scans e permissao negada');
SELECT is(tests.denied($$ UPDATE public.my_scans SET city = 'x' $$), true, 'anon: UPDATE em my_scans e permissao negada');
SELECT is(tests.denied($$ DELETE FROM public.my_scans $$), true, 'anon: DELETE em my_scans e permissao negada');
RESET ROLE;
SELECT tests.set_auth_uid('a5a5a5a5-0000-0000-0000-0000000000a1');
SELECT is(tests.denied($$ INSERT INTO public.scan_events (tag_code, status_at_scan, ip_hash, geo_method) VALUES ('ABCDEFGHV', 'assigned', 'x', 'none') $$), true, 'o tutor nao grava scan direto (so register_scan)');
SELECT is(tests.denied($$ UPDATE public.scan_events SET lat = 0 $$), true, 'o tutor nao altera scan direto');
SELECT is(tests.denied($$ DELETE FROM public.scan_events $$), true, 'o tutor nao apaga scan');
SELECT is(tests.denied($$ INSERT INTO public.my_scans (id) VALUES (gen_random_uuid()) $$), true, 'tutor: INSERT em my_scans e permissao negada');
SELECT is(tests.denied($$ UPDATE public.my_scans SET city = 'x' $$), true, 'tutor: UPDATE em my_scans e permissao negada');
SELECT is(tests.denied($$ DELETE FROM public.my_scans $$), true, 'tutor: DELETE em my_scans e permissao negada');
RESET ROLE;
SELECT is(has_table_privilege('service_role', 'public.my_scans', 'INSERT') OR has_table_privilege('service_role', 'public.my_scans', 'UPDATE') OR has_table_privilege('service_role', 'public.my_scans', 'DELETE') OR has_table_privilege('anon', 'public.my_scans', 'SELECT'), false, 'my_scans: sem escrita para service_role e sem SELECT para anon');

-- my_scans nao tem coluna sensivel.
SELECT is((SELECT count(*)::integer FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'my_scans'
            AND column_name IN ('ip_hash', 'location_token_hash', 'location_token_expires_at', 'notified_at', 'notify_attempts')), 0, 'my_scans nao expoe ip_hash, token nem estado de aviso');

-- ═══════════════ Exclusao de conta: os scans do vinculo ficam sem localizacao ═══════════════

SELECT tests.set_service();
SELECT is(public.end_assignments_for_account('a5a5a5a5-0000-0000-0000-0000000000b2'), 2, 'preparo: a exclusao da conta de B encerra os 2 vinculos dela');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE tag_code IN ('ABCDEFGHV', 'ZZZZZZZZ8') AND assignment_id IN
             ('a5a5a5a5-2222-0000-0000-00000000000b', (SELECT id FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV' AND tutor_id = 'a5a5a5a5-0000-0000-0000-0000000000b2'))
            AND (lat IS NOT NULL OR city IS NOT NULL OR geo_method <> 'none')), 0, 'exclusao da conta de B: os scans dos vinculos dela ficam sem localizacao');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE assignment_id = 'a5a5a5a5-2222-0000-0000-00000000000a' AND geo_method = 'gps'), 1, 'a localizacao dos scans de A (outro tutor) nao foi tocada');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE tag_code IN ('ABCDEFGHV', 'ZZZZZZZZ8')), 5, 'as linhas de scan continuam (so a localizacao some)');

SELECT * FROM finish();
ROLLBACK;
