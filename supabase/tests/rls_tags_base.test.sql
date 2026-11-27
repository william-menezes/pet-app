-- pgTAP: rls_tags_base.test.sql
-- Spec 003-tag-qr, T022 (contracts/rls-expectations.md: "Regras gerais", a matriz das tabelas que existem na
-- fundacao, "Testes de isolamento entre vinculos" e "Testes do contrato fisico"). As RPCs das fases seguintes
-- (activate_tag, release_tag, resolve_tag...) ainda nao existem: o isolamento entre vinculos e simulado aqui por
-- escrita direta como dono do banco, que e exatamente o estado que as RPCs deixam.
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; nenhum PIN no arquivo):
--   tutor A: petA1 com a tag TA (vinculo aA); tutor B (celular NAO confirmado): petB1 com a tag TB (aB); admin.
-- Codigos: vetores sinteticos de contracts/tag-code.vectors.json (nenhum e codigo real).

BEGIN;

SELECT plan(129);

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
-- true se o comando falha com 42501 (privilegio ou politica de linha), no papel atual.
CREATE OR REPLACE FUNCTION tests.denied(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END;
$$;
-- SQLSTATE do erro do comando, ou 'ok' se passou.
CREATE OR REPLACE FUNCTION tests.sqlstate_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;
-- Mensagem do erro do comando, ou NULL se passou.
CREATE OR REPLACE FUNCTION tests.errmsg_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT tests.mk_user('eeeeeeee-0000-0000-0000-0000000000a1', 'rlstags.a@faro.test', 'Ana Rls');
SELECT tests.mk_user('eeeeeeee-0000-0000-0000-0000000000b2', 'rlstags.b@faro.test', 'Beto Rls');
SELECT tests.mk_user('eeeeeeee-0000-0000-0000-0000000000d4', 'rlstags.admin@faro.test', 'Admin Rls');
UPDATE public.perfis SET celular = '+5511900000021', celular_confirmado_em = now() WHERE id = 'eeeeeeee-0000-0000-0000-0000000000a1';
UPDATE public.perfis SET papel = 'admin' WHERE id = 'eeeeeeee-0000-0000-0000-0000000000d4';

INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1', 'PetDaAnaRls', 'dog'),
  ('eeeeeeee-1111-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-0000000000b2', 'PetDoBetoRls', 'dog'),
  ('eeeeeeee-1111-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-0000000000b2', 'SegundoPetDoBetoRls', 'cat');

INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-902', 4);

-- Um unico hash (bcrypt custo 12) de um PIN gerado agora e nunca escrito: serve de PIN de todos os codigos do teste.
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(public.new_activation_pin(), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-902', c.status, h.hash, 0
  FROM t_hash h, (VALUES ('ABCDEFGHV', 'assigned'), ('ZZZZZZZZ8', 'assigned'), ('JKMNPQRSR', 'available'), ('TVWXYZ01S', 'void')) AS c (code, status);

INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id, started_at) VALUES
  ('eeeeeeee-2222-0000-0000-00000000000a', 'ABCDEFGHV', 'eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1', now() - interval '5 days'),
  ('eeeeeeee-2222-0000-0000-00000000000b', 'ZZZZZZZZ8', 'eeeeeeee-1111-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-0000000000b2', now() - interval '4 days');
INSERT INTO public.scan_events (id, tag_code, assignment_id, status_at_scan, ip_hash, geo_method, lat, lng, accuracy_m, city, region, location_token_hash, location_token_expires_at) VALUES
  ('eeeeeeee-3333-0000-0000-00000000000a', 'ABCDEFGHV', 'eeeeeeee-2222-0000-0000-00000000000a', 'assigned', 'marcador-ip-a', 'ip', -23.55, -46.63, 3000, 'Sao Paulo', 'SP', 'marcador-token-a', now() + interval '1 hour'),
  ('eeeeeeee-3333-0000-0000-00000000000b', 'ZZZZZZZZ8', 'eeeeeeee-2222-0000-0000-00000000000b', 'assigned', 'marcador-ip-b', 'ip', -25.43, -49.27, 3000, 'Curitiba', 'PR', NULL, NULL);
INSERT INTO public.tag_pin_attempts (tag_code, tutor_id, fail_count, window_start) VALUES
  ('JKMNPQRSR', 'eeeeeeee-0000-0000-0000-0000000000a1', 1, now()),
  ('JKMNPQRSR', 'eeeeeeee-0000-0000-0000-0000000000b2', 1, now());
INSERT INTO public.pending_activations (tutor_id, tag_code) VALUES ('eeeeeeee-0000-0000-0000-0000000000a1', 'JKMNPQRSR');
INSERT INTO public.rate_limits (scope, key, window_start) VALUES ('teste', 'chave', now());
INSERT INTO public.audit_log (event, entity, entity_id) VALUES ('teste_rls', 'tag', 'ABCDEFGHV');
INSERT INTO public.tag_replacement_requests (id, tag_code, pet_id, tutor_id, kind) VALUES
  ('eeeeeeee-4444-0000-0000-00000000000a', 'ABCDEFGHV', 'eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1', 'damaged'),
  ('eeeeeeee-4444-0000-0000-00000000000b', 'ZZZZZZZZ8', 'eeeeeeee-1111-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-0000000000b2', 'damaged');

-- ═══════════════ Regras gerais (catalogo) ═══════════════

-- As onze tabelas desta spec: RLS ligada e nenhuma politica para anon.
SELECT is((SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
              AND c.relname IN ('pets', 'rescue_profiles', 'tag_batches', 'tag_codes', 'tag_assignments', 'tag_pin_attempts',
                                'pending_activations', 'rate_limits', 'scan_events', 'tag_replacement_requests', 'audit_log')),
  11, 'as 11 tabelas desta spec existem com RLS habilitada');
SELECT is_empty($$ SELECT tablename || '.' || policyname FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename IN ('pets', 'rescue_profiles', 'tag_batches', 'tag_codes', 'tag_assignments', 'tag_pin_attempts',
                                        'pending_activations', 'rate_limits', 'scan_events', 'tag_replacement_requests', 'audit_log')
                      AND roles && ARRAY['anon', 'public']::name[] $$,
  'nenhuma politica para anon (nem para PUBLIC) nas tabelas desta spec');
SELECT is_empty($$ SELECT tablename || '.' || policyname FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename IN ('pets', 'rescue_profiles', 'tag_batches', 'tag_codes', 'tag_assignments', 'tag_pin_attempts',
                                        'pending_activations', 'rate_limits', 'scan_events', 'tag_replacement_requests', 'audit_log')
                      AND roles <> ARRAY['authenticated']::name[] $$,
  'toda politica das tabelas desta spec e so para authenticated');
SELECT is_empty($$ SELECT t FROM unnest(ARRAY['pets', 'rescue_profiles', 'tag_batches', 'tag_codes', 'tag_assignments', 'tag_pin_attempts',
                                              'pending_activations', 'rate_limits', 'scan_events', 'tag_replacement_requests', 'audit_log', 'my_scans']) AS t
                    WHERE has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                       OR has_any_column_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,REFERENCES') $$,
  'anon sem nenhum privilegio nas tabelas e na visao my_scans');

-- Funcoes desta spec: anon nao executa nenhuma; authenticated so executa o que o contrato manda.
SELECT is_empty($$ SELECT p.oid::regprocedure::text FROM pg_proc p
                    WHERE p.pronamespace = 'public'::regnamespace
                      AND p.proname IN ('tag_normalize', 'tag_check_digit', 'tag_is_valid', 'tag_format', 'pet_temperament_ok',
                                        'touch_updated_at', 'pets_create_rescue_profile', 'rescue_profiles_check_phone',
                                        'tag_codes_guard_update', 'tag_codes_guard_delete', 'rate_limit_hit', 'audit',
                                        'can_link_tag', 'new_activation_pin', 'end_assignments_for_account', 'export_tutor_tag_data')
                      AND has_function_privilege('anon', p.oid, 'EXECUTE') $$,
  'anon nao executa nenhuma funcao desta spec');
SELECT is_empty($$ SELECT p.oid::regprocedure::text FROM pg_proc p
                    WHERE p.pronamespace = 'public'::regnamespace
                      AND p.proname IN ('tag_normalize', 'tag_check_digit', 'tag_is_valid', 'tag_format',
                                        'touch_updated_at', 'pets_create_rescue_profile', 'rescue_profiles_check_phone',
                                        'tag_codes_guard_update', 'tag_codes_guard_delete', 'rate_limit_hit', 'audit',
                                        'can_link_tag', 'new_activation_pin', 'end_assignments_for_account', 'export_tutor_tag_data')
                      AND has_function_privilege('authenticated', p.oid, 'EXECUTE') $$,
  'authenticated nao executa nenhuma funcao interna desta spec (so pet_temperament_ok, usada pela CHECK de pets)');
SELECT is((SELECT count(*)::integer FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND p.proname IN ('rate_limit_hit', 'audit', 'can_link_tag', 'new_activation_pin', 'end_assignments_for_account',
                                'export_tutor_tag_data', 'tag_normalize', 'tag_check_digit', 'tag_is_valid', 'tag_format')
              AND has_function_privilege('service_role', p.oid, 'EXECUTE')), 10,
  'service_role executa as dez funcoes que o contrato lhe da');
SELECT is_empty($$ SELECT p.oid::regprocedure::text FROM pg_proc p
                    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
                      AND p.proname IN ('pets_create_rescue_profile', 'rescue_profiles_check_phone', 'rate_limit_hit', 'audit',
                                        'end_assignments_for_account', 'export_tutor_tag_data')
                      AND p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] $$,
  'toda security definer desta spec tem search_path = public, pg_temp');

-- Colunas sensiveis e de escrita: authenticated nunca tem.
SELECT is_empty($$ SELECT x.t || '.' || x.c || ' ' || x.p
                     FROM (VALUES ('tag_codes', 'activation_pin_hash', 'SELECT'), ('tag_codes', 'code', 'SELECT'), ('tag_codes', 'status', 'SELECT'),
                                  ('tag_codes', 'status', 'UPDATE'), ('tag_codes', 'pin_locked_until', 'SELECT'),
                                  ('scan_events', 'ip_hash', 'SELECT'), ('scan_events', 'location_token_hash', 'SELECT'),
                                  ('scan_events', 'location_token_expires_at', 'SELECT'), ('scan_events', 'notified_at', 'SELECT'),
                                  ('scan_events', 'notify_attempts', 'SELECT'), ('scan_events', 'lat', 'UPDATE'),
                                  ('rescue_profiles', 'lost_mode', 'UPDATE'), ('rescue_profiles', 'lost_since', 'UPDATE'),
                                  ('rescue_profiles', 'lost_message', 'UPDATE'), ('rescue_profiles', 'pet_id', 'INSERT'),
                                  ('pets', 'tutor_id', 'UPDATE'), ('pets', 'id', 'UPDATE'),
                                  ('tag_assignments', 'ended_at', 'UPDATE'), ('tag_assignments', 'pet_id', 'INSERT'),
                                  ('tag_batches', 'quantity', 'INSERT'), ('audit_log', 'detail', 'SELECT'), ('audit_log', 'detail', 'INSERT'),
                                  ('rate_limits', 'count', 'SELECT'), ('pending_activations', 'tag_code', 'SELECT'),
                                  ('tag_pin_attempts', 'fail_count', 'UPDATE'), ('tag_replacement_requests', 'status', 'UPDATE')) AS x (t, c, p)
                    WHERE has_column_privilege('authenticated', 'public.' || x.t, x.c, x.p) $$,
  'authenticated sem os privilegios de coluna proibidos (hash do PIN, ip_hash, tokens, modo perdido, escrita direta)');
SELECT is(has_any_column_privilege('authenticated', 'public.tag_codes', 'SELECT,INSERT,UPDATE,REFERENCES')
          OR has_table_privilege('authenticated', 'public.tag_codes', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'), false,
  'authenticated sem nenhum privilegio em tag_codes');
SELECT is(has_table_privilege('authenticated', 'public.audit_log', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
          OR has_table_privilege('service_role', 'public.audit_log', 'UPDATE,DELETE,TRUNCATE'), false,
  'audit_log: ninguem de aplicacao le direto, e nem service_role atualiza ou apaga (so insercao)');
SELECT is_empty($$ SELECT column_name FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'my_scans'
                      AND column_name IN ('ip_hash', 'location_token_hash', 'location_token_expires_at', 'notified_at', 'notify_attempts') $$,
  'my_scans nao tem ip_hash, token nem campos de aviso');
SELECT is((SELECT reloptions FROM pg_class WHERE oid = 'public.my_scans'::regclass), ARRAY['security_invoker=true'],
  'my_scans e security_invoker (a RLS de scan_events vale para quem consulta)');

-- ═══════════════ Matriz: pets ═══════════════
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.pets), 1, 'tutor A: ve so o proprio pet');
SELECT is((SELECT count(*)::integer FROM public.pets WHERE id = 'eeeeeeee-1111-0000-0000-000000000002'), 0, 'tutor A: nao ve o pet do tutor B');
SELECT lives_ok($$ UPDATE public.pets SET name = 'NovoNomeRls' WHERE id = 'eeeeeeee-1111-0000-0000-000000000001' $$, 'tutor A: altera o proprio pet');
SELECT is((SELECT name FROM public.pets WHERE id = 'eeeeeeee-1111-0000-0000-000000000001'), 'NovoNomeRls', 'tutor A: a alteracao valeu');
SELECT lives_ok($$ UPDATE public.pets SET name = 'Invasao' WHERE id = 'eeeeeeee-1111-0000-0000-000000000002' $$, 'tutor A: update no pet de B nao da erro (0 linhas)');
SELECT lives_ok($$ DELETE FROM public.pets WHERE id = 'eeeeeeee-1111-0000-0000-000000000002' $$, 'tutor A: delete no pet de B nao da erro (0 linhas)');
SELECT ok(tests.denied($$ INSERT INTO public.pets (tutor_id, name, species) VALUES ('eeeeeeee-0000-0000-0000-0000000000b2', 'PetEnxertado', 'dog') $$),
  'tutor A: nao cria pet em nome do tutor B (politica de insercao)');
SELECT ok(tests.denied($$ UPDATE public.pets SET tutor_id = 'eeeeeeee-0000-0000-0000-0000000000b2' WHERE id = 'eeeeeeee-1111-0000-0000-000000000001' $$),
  'tutor A: nao troca o dono do pet (privilegio de coluna)');
SELECT lives_ok($$ INSERT INTO public.pets (tutor_id, name, species, temperament) VALUES ('eeeeeeee-0000-0000-0000-0000000000a1', 'PetCriadoRls', 'cat', ARRAY['Calmo']) $$,
  'tutor A: cria o proprio pet');
SELECT is((SELECT count(*)::integer FROM public.rescue_profiles rp JOIN public.pets p ON p.id = rp.pet_id WHERE p.name = 'PetCriadoRls'), 1,
  'o perfil de resgate nasce junto do pet (gatilho)');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.pets (tutor_id, name, species, photo_path) VALUES ('eeeeeeee-0000-0000-0000-0000000000a1', 'FotoDeOutro', 'dog', 'eeeeeeee-0000-0000-0000-0000000000b2/x/foto.webp') $$),
  '23514', 'a foto do pet tem de ficar na pasta do proprio tutor (CHECK)');
SELECT lives_ok($$ DELETE FROM public.pets WHERE name = 'PetCriadoRls' $$, 'tutor A: remove o proprio pet');
SELECT is((SELECT count(*)::integer FROM public.rescue_profiles rp WHERE NOT EXISTS (SELECT 1 FROM public.pets p WHERE p.id = rp.pet_id)), 0,
  'o perfil de resgate some com o pet (cascata)');
RESET ROLE;
SELECT is((SELECT name FROM public.pets WHERE id = 'eeeeeeee-1111-0000-0000-000000000002'), 'PetDoBetoRls', 'o pet de B segue intacto depois das tentativas de A');

SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT is((SELECT count(*)::integer FROM public.pets WHERE id IN ('eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-1111-0000-0000-000000000002')), 2,
  'admin: le os pets de todos');
SELECT lives_ok($$ UPDATE public.pets SET name = 'AdminAltera' WHERE id = 'eeeeeeee-1111-0000-0000-000000000001' $$, 'admin: update nao da erro (0 linhas: so leitura)');
RESET ROLE;
SELECT is((SELECT name FROM public.pets WHERE id = 'eeeeeeee-1111-0000-0000-000000000001'), 'NovoNomeRls', 'admin nao altera pet');
SELECT tests.set_anon();
SELECT ok(tests.denied($$ SELECT count(*) FROM public.pets $$), 'anon: sem acesso a pets');
RESET ROLE;

-- ═══════════════ Matriz: rescue_profiles ═══════════════
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.rescue_profiles), 1, 'tutor A: ve so o proprio perfil de resgate');
SELECT is((SELECT count(*)::integer FROM public.rescue_profiles WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000002'), 0, 'tutor A: nao ve o perfil do pet de B');
SELECT lives_ok($$ UPDATE public.rescue_profiles SET show_care = false, show_tutor_first_name = true, lost_show_reward = true WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000001' $$,
  'tutor A: altera os campos show_* e lost_show_*');
SELECT lives_ok($$ UPDATE public.rescue_profiles SET show_whatsapp = true, show_phone = true WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000001' $$,
  'tutor A (celular confirmado): liga whatsapp e telefone');
SELECT ok(tests.denied($$ UPDATE public.rescue_profiles SET lost_mode = true WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000001' $$),
  'tutor A: nao liga lost_mode direto (so por RPC)');
SELECT ok(tests.denied($$ UPDATE public.rescue_profiles SET lost_since = now() WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000001' $$),
  'tutor A: nao altera lost_since direto');
SELECT ok(tests.denied($$ UPDATE public.rescue_profiles SET lost_message = 'x' WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000001' $$),
  'tutor A: nao altera lost_message direto');
SELECT ok(tests.denied($$ INSERT INTO public.rescue_profiles (pet_id) VALUES ('eeeeeeee-1111-0000-0000-000000000001') $$),
  'tutor A: nao insere perfil de resgate (so o gatilho)');
SELECT lives_ok($$ UPDATE public.rescue_profiles SET show_care = true WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000002' $$,
  'tutor A: update no perfil do pet de B nao da erro (0 linhas)');
RESET ROLE;
SELECT is((SELECT show_care FROM public.rescue_profiles WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000002'), true,
  'o perfil de B segue com o padrao (show_care true) e nao foi tocado');

SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000b2');
SELECT is(tests.errmsg_of($$ UPDATE public.rescue_profiles SET show_whatsapp = true WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000002' $$),
  'phone_not_confirmed', 'tutor B (celular nao confirmado): show_whatsapp recusado');
SELECT is(tests.errmsg_of($$ UPDATE public.rescue_profiles SET show_phone = true WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000002' $$),
  'phone_not_confirmed', 'tutor B (celular nao confirmado): show_phone recusado');
SELECT lives_ok($$ UPDATE public.rescue_profiles SET show_tutor_first_name = true WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000002' $$,
  'tutor B: altera campos que nao dependem do celular');
SELECT is((SELECT count(*)::integer FROM public.rescue_profiles WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000001'), 0, 'tutor B: nao ve o perfil do pet de A');
RESET ROLE;
SELECT is((SELECT show_tutor_first_name FROM public.rescue_profiles WHERE pet_id = 'eeeeeeee-1111-0000-0000-000000000001'), true,
  'o perfil de A mantem o que A salvou (B nao alterou)');

SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT is((SELECT count(*)::integer FROM public.rescue_profiles WHERE pet_id IN ('eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-1111-0000-0000-000000000002')), 2,
  'admin: le os perfis de resgate');
RESET ROLE;
SELECT tests.set_anon();
SELECT ok(tests.denied($$ SELECT count(*) FROM public.rescue_profiles $$), 'anon: sem acesso a rescue_profiles');
RESET ROLE;

-- ═══════════════ Matriz: tag_codes e tag_batches ═══════════════
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000a1');
SELECT ok(tests.denied($$ SELECT code FROM public.tag_codes $$), 'tutor A: tag_codes direto negado');
SELECT ok(tests.denied($$ SELECT activation_pin_hash FROM public.tag_codes $$), 'tutor A: activation_pin_hash negado');
SELECT is((SELECT count(*)::integer FROM public.tag_batches), 0, 'tutor A: tag_batches devolve 0 linhas (so o admin le)');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000b2');
SELECT ok(tests.denied($$ SELECT code FROM public.tag_codes $$), 'tutor B: tag_codes direto negado');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT ok(tests.denied($$ SELECT code FROM public.tag_codes $$), 'admin: tag_codes direto negado (so por RPC, sem o hash)');
SELECT is((SELECT count(*)::integer FROM public.tag_batches WHERE id = 'lote-902'), 1, 'admin: le tag_batches');
SELECT ok(tests.denied($$ INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-903', 1) $$), 'admin: nao grava tag_batches direto');
RESET ROLE;
SELECT tests.set_anon();
SELECT ok(tests.denied($$ SELECT code FROM public.tag_codes $$), 'anon: tag_codes negado');
SELECT ok(tests.denied($$ SELECT id FROM public.tag_batches $$), 'anon: tag_batches negado');
RESET ROLE;

-- ═══════════════ Matriz: tag_assignments, tag_pin_attempts, tag_replacement_requests ═══════════════
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments), 1, 'tutor A: ve so o proprio vinculo');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE id = 'eeeeeeee-2222-0000-0000-00000000000b'), 0, 'tutor A: nao ve o vinculo de B');
SELECT ok(tests.denied($$ UPDATE public.tag_assignments SET ended_at = now(), end_reason = 'released' WHERE id = 'eeeeeeee-2222-0000-0000-00000000000a' $$),
  'tutor A: nao encerra vinculo direto (so por RPC)');
SELECT ok(tests.denied($$ INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id) VALUES ('JKMNPQRSR', 'eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1') $$),
  'tutor A: nao cria vinculo direto (so por RPC com PIN)');
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts), 0, 'tutor A: tag_pin_attempts devolve 0 linhas (so o admin le)');
SELECT is((SELECT count(*)::integer FROM public.tag_replacement_requests), 1, 'tutor A: ve so o proprio pedido de 2a via');
SELECT ok(tests.denied($$ INSERT INTO public.tag_replacement_requests (tag_code, tutor_id, kind) VALUES ('ABCDEFGHV', 'eeeeeeee-0000-0000-0000-0000000000a1', 'lost') $$),
  'tutor A: nao cria pedido de 2a via direto');
SELECT ok(tests.denied($$ UPDATE public.tag_replacement_requests SET status = 'done', resolved_at = now() WHERE id = 'eeeeeeee-4444-0000-0000-00000000000a' $$),
  'tutor A: nao fecha o proprio pedido');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV'), 0, 'tutor B: nao ve o vinculo da tag de A');
SELECT is((SELECT count(*)::integer FROM public.tag_replacement_requests WHERE tag_code = 'ABCDEFGHV'), 0, 'tutor B: nao ve o pedido de A');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE id IN ('eeeeeeee-2222-0000-0000-00000000000a', 'eeeeeeee-2222-0000-0000-00000000000b')), 2, 'admin: le todos os vinculos');
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tag_code = 'JKMNPQRSR'), 2, 'admin: le tag_pin_attempts');
SELECT is((SELECT count(*)::integer FROM public.tag_replacement_requests WHERE id IN ('eeeeeeee-4444-0000-0000-00000000000a', 'eeeeeeee-4444-0000-0000-00000000000b')), 2, 'admin: le os pedidos de 2a via');
RESET ROLE;
SELECT tests.set_anon();
SELECT ok(tests.denied($$ SELECT 1 FROM public.tag_assignments $$), 'anon: tag_assignments negado');
SELECT ok(tests.denied($$ SELECT 1 FROM public.tag_pin_attempts $$), 'anon: tag_pin_attempts negado');
SELECT ok(tests.denied($$ SELECT 1 FROM public.tag_replacement_requests $$), 'anon: tag_replacement_requests negado');
RESET ROLE;

-- ═══════════════ Matriz: pending_activations, rate_limits, audit_log (so funcoes) ═══════════════
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000a1');
SELECT ok(tests.denied($$ SELECT 1 FROM public.pending_activations $$), 'tutor A: pending_activations negado (so por RPC)');
SELECT ok(tests.denied($$ SELECT 1 FROM public.rate_limits $$), 'tutor A: rate_limits negado');
SELECT ok(tests.denied($$ SELECT 1 FROM public.audit_log $$), 'tutor A: audit_log negado');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT ok(tests.denied($$ SELECT 1 FROM public.pending_activations $$), 'admin: pending_activations negado');
SELECT ok(tests.denied($$ SELECT 1 FROM public.rate_limits $$), 'admin: rate_limits negado');
SELECT ok(tests.denied($$ SELECT 1 FROM public.audit_log $$), 'admin: audit_log direto negado (le por admin_audit)');
RESET ROLE;
SELECT tests.set_anon();
SELECT ok(tests.denied($$ SELECT 1 FROM public.pending_activations $$), 'anon: pending_activations negado');
SELECT ok(tests.denied($$ SELECT 1 FROM public.rate_limits $$), 'anon: rate_limits negado');
SELECT ok(tests.denied($$ SELECT 1 FROM public.audit_log $$), 'anon: audit_log negado');
RESET ROLE;

-- ═══════════════ Matriz: scan_events e my_scans ═══════════════
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.my_scans), 1, 'tutor A: my_scans mostra so o scan do proprio vinculo');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE id = 'eeeeeeee-3333-0000-0000-00000000000b'), 0, 'tutor A: nao ve o scan do vinculo de B');
SELECT is((SELECT city FROM public.my_scans WHERE id = 'eeeeeeee-3333-0000-0000-00000000000a'), 'Sao Paulo', 'tutor A: my_scans traz a cidade do proprio scan');
SELECT is((SELECT count(*)::integer FROM public.scan_events), 1, 'tutor A: scan_events (colunas liberadas) tambem filtra pelo vinculo');
SELECT ok(tests.denied($$ SELECT ip_hash FROM public.scan_events $$), 'tutor A: ip_hash negado');
SELECT ok(tests.denied($$ SELECT location_token_hash FROM public.scan_events $$), 'tutor A: location_token_hash negado');
SELECT ok(tests.denied($$ SELECT * FROM public.scan_events $$), 'tutor A: SELECT * em scan_events negado (a lista inclui colunas proibidas)');
SELECT ok(tests.denied($$ INSERT INTO public.scan_events (tag_code, status_at_scan, ip_hash, geo_method) VALUES ('ABCDEFGHV', 'assigned', 'x', 'none') $$),
  'tutor A: nao grava scan direto');
SELECT ok(tests.denied($$ UPDATE public.scan_events SET lat = 0, lng = 0 WHERE id = 'eeeeeeee-3333-0000-0000-00000000000a' $$), 'tutor A: nao altera scan');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE id = 'eeeeeeee-3333-0000-0000-00000000000a'), 0, 'tutor B: nao le o scan de A');
SELECT is((SELECT count(*)::integer FROM public.my_scans), 1, 'tutor B: le so o proprio scan');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE id IN ('eeeeeeee-3333-0000-0000-00000000000a', 'eeeeeeee-3333-0000-0000-00000000000b')), 2,
  'admin: le os scans (colunas liberadas)');
SELECT ok(tests.denied($$ SELECT ip_hash FROM public.scan_events $$), 'admin: tambem nao le ip_hash');
RESET ROLE;
SELECT tests.set_anon();
SELECT ok(tests.denied($$ SELECT 1 FROM public.scan_events $$), 'anon: scan_events negado');
SELECT ok(tests.denied($$ SELECT 1 FROM public.my_scans $$), 'anon: my_scans negado');
RESET ROLE;

-- ═══════════════ Isolamento entre vinculos (LGPD), simulado como dono do banco ═══════════════
-- 1. A libera TA; B a ativa (novo vinculo). B nao le nenhum scan anterior de TA.
UPDATE public.tag_assignments SET ended_at = now(), end_reason = 'released' WHERE id = 'eeeeeeee-2222-0000-0000-00000000000a';
UPDATE public.tag_codes SET status = 'available' WHERE code = 'ABCDEFGHV';
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id) VALUES
  ('eeeeeeee-2222-0000-0000-0000000000a2', 'ABCDEFGHV', 'eeeeeeee-1111-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-0000000000b2');
UPDATE public.tag_codes SET status = 'assigned' WHERE code = 'ABCDEFGHV';
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE tag_code = 'ABCDEFGHV'), 0, 'isolamento 1: B (novo dono de TA) nao le o scan anterior de TA');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV'), 1, 'isolamento 3: B ve so o proprio vinculo de TA, nao o historico');
RESET ROLE;
-- 2. Scan novo de TA (vinculo de B): A nao le; B le.
INSERT INTO public.scan_events (id, tag_code, assignment_id, status_at_scan, ip_hash, geo_method) VALUES
  ('eeeeeeee-3333-0000-0000-0000000000a2', 'ABCDEFGHV', 'eeeeeeee-2222-0000-0000-0000000000a2', 'assigned', 'marcador-ip-novo', 'none');
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE id = 'eeeeeeee-3333-0000-0000-0000000000a2'), 0, 'isolamento 2: A (ex-dono) nao le o scan novo de TA');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE id = 'eeeeeeee-3333-0000-0000-00000000000a'), 1, 'A segue lendo os scans do proprio vinculo antigo');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV'), 1, 'isolamento 3: A ve so o proprio vinculo encerrado de TA');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE id = 'eeeeeeee-3333-0000-0000-0000000000a2'), 1, 'B le o scan novo de TA');
RESET ROLE;
-- 3. O historico completo de vinculos de TA so o admin ve.
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV'), 2, 'isolamento 3: o admin ve o historico de vinculos de TA (2)');
RESET ROLE;

-- ═══════════════ Contrato fisico (Principio VIII) ═══════════════
-- 1. UPDATE de code falha para qualquer role de aplicacao.
SELECT is(tests.errmsg_of($$ UPDATE public.tag_codes SET code = 'JKMNPQRSR' WHERE code = 'TVWXYZ01S' $$), 'tag_code_immutable', 'fisico 1: UPDATE de code falha (dono do banco)');
SELECT tests.set_service();
SELECT is(tests.errmsg_of($$ UPDATE public.tag_codes SET code = '000000000' WHERE code = 'TVWXYZ01S' $$), 'tag_code_immutable', 'fisico 1: UPDATE de code falha (service_role)');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT ok(tests.denied($$ UPDATE public.tag_codes SET code = '000000000' WHERE code = 'TVWXYZ01S' $$), 'fisico 1: UPDATE de code falha (admin autenticado)');
RESET ROLE;
SELECT is(tests.errmsg_of($$ UPDATE public.tag_codes SET batch_id = 'lote-902', qr_mask = 5 WHERE code = 'TVWXYZ01S' $$), 'tag_code_immutable', 'fisico 1: qr_mask e imutavel');
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE code = 'TVWXYZ01S' AND qr_mask = 0), 1, 'fisico 1: o codigo continua com a mascara original');
-- 2. DELETE e TRUNCATE falham.
SELECT is(tests.errmsg_of($$ DELETE FROM public.tag_codes WHERE code = 'JKMNPQRSR' $$), 'tag_code_never_deleted', 'fisico 2: DELETE falha (dono do banco)');
SELECT tests.set_service();
SELECT is(tests.errmsg_of($$ DELETE FROM public.tag_codes WHERE code = 'JKMNPQRSR' $$), 'tag_code_never_deleted', 'fisico 2: DELETE falha (service_role)');
RESET ROLE;
SELECT tests.set_auth_uid('eeeeeeee-0000-0000-0000-0000000000d4');
SELECT ok(tests.denied($$ DELETE FROM public.tag_codes WHERE code = 'JKMNPQRSR' $$), 'fisico 2: DELETE falha (admin autenticado)');
RESET ROLE;
SELECT is(tests.errmsg_of($$ TRUNCATE public.tag_codes CASCADE $$), 'tag_code_never_deleted', 'fisico 2: TRUNCATE tambem falha');
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE batch_id = 'lote-902'), 4, 'fisico 2: os quatro codigos do teste continuam');
-- 3. Sair de void falha.
SELECT is(tests.errmsg_of($$ UPDATE public.tag_codes SET status = 'available' WHERE code = 'TVWXYZ01S' $$), 'tag_code_void_is_final', 'fisico 3: void para available falha');
SELECT is(tests.errmsg_of($$ UPDATE public.tag_codes SET status = 'blocked' WHERE code = 'TVWXYZ01S' $$), 'tag_code_void_is_final', 'fisico 3: void para blocked falha');
SELECT is(tests.sqlstate_of($$ UPDATE public.tag_codes SET status = 'void', notes = 'segue anulado' WHERE code = 'TVWXYZ01S' $$), 'ok', 'fisico 3: continuar void (so a anotacao) e permitido');
-- 4. INSERT com digito verificador invalido falha (CHECK).
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_codes (code, batch_id, activation_pin_hash, qr_mask) SELECT '7K3MQ9XAD', 'lote-902', hash, 0 FROM t_hash $$), '23514',
  'fisico 4: codigo com digito verificador errado e recusado');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_codes (code, batch_id, activation_pin_hash, qr_mask) SELECT '7k3mq9xac', 'lote-902', hash, 0 FROM t_hash $$), '23514',
  'fisico 4: codigo em minusculas e recusado (so a forma canonica e gravada)');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_codes (code, batch_id, activation_pin_hash, qr_mask) SELECT 'T6EVBXPYW', 'lote-902', hash, 8 FROM t_hash $$), '23514',
  'fisico 4: mascara fora de 0 a 7 e recusada');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_codes (code, batch_id, activation_pin_hash, qr_mask) VALUES ('T6EVBXPYW', 'lote-902', 'texto-puro-nao-e-hash', 0) $$), '23514',
  'fisico 4: o que nao e hash bcrypt e recusado (nunca um PIN em texto)');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_codes (code, batch_id, activation_pin_hash, qr_mask) VALUES ('T6EVBXPYW', 'lote-902', extensions.crypt('x', extensions.gen_salt('bf', 6)), 0) $$), '23514',
  'fisico 4: hash bcrypt com custo diferente de 12 e recusado');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_codes (code, batch_id, activation_pin_hash, qr_mask) SELECT 'T6EVBXPYW', 'lote-902', hash, 0 FROM t_hash $$), 'ok',
  'controle: o mesmo codigo, com digito certo, hash certo e mascara certa, e aceito');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_codes (code, batch_id, activation_pin_hash, qr_mask) SELECT '000000000', 'lote-inexistente', hash, 0 FROM t_hash $$), '23503',
  'o lote tem de existir (chave estrangeira)');
-- 5. Segundo vinculo ativo para a mesma tag ou para o mesmo pet falha (indices unicos parciais).
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id) VALUES ('ABCDEFGHV', 'eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1') $$), '23505',
  'fisico 5: segundo vinculo ativo para a mesma tag falha');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id) VALUES ('JKMNPQRSR', 'eeeeeeee-1111-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-0000000000b2') $$), '23505',
  'fisico 5: segundo vinculo ativo para o mesmo pet falha');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id, ended_at) VALUES ('JKMNPQRSR', 'eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1', now()) $$), '23514',
  'ended_at sem end_reason e recusado');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id, ended_at, end_reason) VALUES ('JKMNPQRSR', 'eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1', now(), 'motivo-inventado') $$), '23514',
  'end_reason fora da lista e recusado');
SELECT is(tests.sqlstate_of($$ INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id, ended_at, end_reason) VALUES ('JKMNPQRSR', 'eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1', now(), 'released') $$), 'ok',
  'controle: vinculo encerrado (com motivo) nao conta como ativo e e aceito');

SELECT * FROM finish();
ROLLBACK;
