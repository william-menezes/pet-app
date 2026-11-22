-- pgTAP: rpc_set_lost_mode.test.sql
-- Spec 003-tag-qr, T059 (feito quando: pgTAP cobre ligar, desligar, sem tag ativa e a preservacao de lost_since ao
-- religar). Migration 0031 (set_lost_mode). Regra 13A: erro de negocio e retorno {"ok":false,"error":...}, conferido
-- com `->> 'error'`; throws_ok so para o que NAO e erro de negocio (p_on nulo e a CHECK do recado).
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; nenhum PIN):
--   tutora A com Rex (tag ABCDEFGHV ativa) e Mel (sem tag); tutor B com Bidu (tag ZZZZZZZZ8 ativa).

BEGIN;

SELECT plan(46);

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

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT tests.mk_user('f4f4f4f4-0000-0000-0000-0000000000a1', 'perdido.a@faro.test', 'Ana Perdido');
SELECT tests.mk_user('f4f4f4f4-0000-0000-0000-0000000000b2', 'perdido.b@faro.test', 'Beto Perdido');
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('f4f4f4f4-1111-0000-0000-000000000001', 'f4f4f4f4-0000-0000-0000-0000000000a1', 'Rex Perdido', 'dog'),
  ('f4f4f4f4-1111-0000-0000-000000000002', 'f4f4f4f4-0000-0000-0000-0000000000a1', 'Mel Perdida', 'cat'),
  ('f4f4f4f4-1111-0000-0000-000000000003', 'f4f4f4f4-0000-0000-0000-0000000000b2', 'Bidu Perdido', 'dog');
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-906', 2);
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(public.new_activation_pin(), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-906', 'assigned', h.hash, 0 FROM t_hash h, (VALUES ('ABCDEFGHV'), ('ZZZZZZZZ8')) AS c (code);
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id) VALUES
  ('f4f4f4f4-2222-0000-0000-00000000000a', 'ABCDEFGHV', 'f4f4f4f4-1111-0000-0000-000000000001', 'f4f4f4f4-0000-0000-0000-0000000000a1'),
  ('f4f4f4f4-2222-0000-0000-00000000000b', 'ZZZZZZZZ8', 'f4f4f4f4-1111-0000-0000-000000000003', 'f4f4f4f4-0000-0000-0000-0000000000b2');

-- ═══════════════ Ligar ═══════════════

SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000a1');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000001', true, 'Ele se assusta com barulho.', true, true), '{"ok":true}'::jsonb, 'ligar com tag ativa: {"ok":true}');
RESET ROLE;
SELECT is((SELECT lost_mode FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), true, 'ligar: lost_mode true');
SELECT is((SELECT lost_since FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), now(), 'ligar: lost_since = agora');
SELECT is((SELECT lost_message FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'Ele se assusta com barulho.', 'ligar: grava o recado');
SELECT is((SELECT lost_show_since::text || lost_show_reward::text FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'truetrue', 'ligar: grava as duas opcoes (since e recompensa)');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'lost_mode_on' AND entity = 'pet' AND entity_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 1, 'ligar: grava lost_mode_on');
SELECT is((SELECT actor_id FROM public.audit_log WHERE event = 'lost_mode_on' AND entity_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'f4f4f4f4-0000-0000-0000-0000000000a1'::uuid, 'a auditoria registra o tutor como ator');
SELECT is((SELECT detail FROM public.audit_log WHERE event = 'lost_mode_on' AND entity_id = 'f4f4f4f4-1111-0000-0000-000000000001'), '{}'::jsonb, 'o recado nao vai para a auditoria');

-- A pagina publica passa a mostrar o modo perdido (resolve_tag le o mesmo perfil).
SELECT tests.set_service();
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-lm1') -> 'profile' -> 'lost' ->> 'message', 'Ele se assusta com barulho.', 'resolve_tag mostra o recado do modo perdido');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-lm2') -> 'profile' -> 'lost' -> 'reward', 'true'::jsonb, 'resolve_tag mostra o selo de recompensa');
RESET ROLE;

-- ═══════════════ Religar preserva lost_since ═══════════════

UPDATE public.rescue_profiles SET lost_since = '2026-11-19 12:00:00+00' WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001';
SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000a1');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000001', true, 'Novo recado.', false, false) ->> 'ok', 'true', 'religar com o modo ja ligado: ok');
RESET ROLE;
SELECT is((SELECT lost_since FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), '2026-11-19 12:00:00+00'::timestamptz, 'religar: a data original de lost_since e preservada');
SELECT is((SELECT lost_message FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'Novo recado.', 'religar: o recado e atualizado');
SELECT is((SELECT lost_show_since::text || lost_show_reward::text FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'falsefalse', 'religar: as opcoes sao atualizadas');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'lost_mode_on' AND entity_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 1, 'religar sem mudar de estado nao repete lost_mode_on');

-- ═══════════════ Desligar ═══════════════

SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000a1');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000001', false, 'texto ignorado ao desligar', true, true), '{"ok":true}'::jsonb, 'desligar: {"ok":true}');
RESET ROLE;
SELECT is((SELECT lost_mode::text || ':' || coalesce(lost_since::text, 'nulo') FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'false:nulo', 'desligar: lost_mode false e lost_since nulo');
SELECT is((SELECT lost_message FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'Novo recado.', 'desligar: o recado anterior e mantido como rascunho');
SELECT is((SELECT lost_show_since::text || lost_show_reward::text FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'falsefalse', 'desligar: as opcoes tambem ficam como estavam');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'lost_mode_off' AND entity_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 1, 'desligar: grava lost_mode_off');
SELECT tests.set_service();
SELECT ok(NOT (public.resolve_tag('ABCDEFGHV', 'ip-lm3') -> 'profile' ? 'lost'), 'depois de desligar a pagina publica nao mostra mais o modo perdido');
RESET ROLE;

SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000a1');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000001', false, NULL, NULL, NULL) ->> 'ok', 'true', 'desligar de novo (ja desligado): ok');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'lost_mode_off' AND entity_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 1, 'desligar sem mudar de estado nao repete lost_mode_off');

-- Ligar de novo depois de desligar: data nova (a antiga nao volta).
SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000a1');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000001', true, NULL, NULL, NULL) ->> 'ok', 'true', 'ligar depois de desligar: ok (opcoes nulas mantem as atuais)');
RESET ROLE;
SELECT is((SELECT lost_since FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), now(), 'ligar depois de desligar: lost_since volta a ser agora');
SELECT is((SELECT lost_message IS NULL FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), true, 'ligar com recado nulo apaga o recado (o tutor limpou o campo)');
SELECT is((SELECT lost_show_since::text || lost_show_reward::text FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 'falsefalse', 'opcoes nulas nao alteram as opcoes gravadas');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'lost_mode_on' AND entity_id = 'f4f4f4f4-1111-0000-0000-000000000001'), 2, 'a segunda ligacao (depois de desligar) grava lost_mode_on de novo');

-- ═══════════════ Sem tag ativa, pet alheio e inexistente ═══════════════

SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000a1');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000002', true, 'x', true, true), '{"ok":false,"error":"no_active_tag"}'::jsonb, 'pet sem tag ativa: no_active_tag');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000002', false, NULL, NULL, NULL) ->> 'ok', 'true', 'desligar um pet sem tag e permitido (nada muda)');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000003', true, 'x', true, true), '{"ok":false,"error":"pet_not_found"}'::jsonb, 'pet de outro tutor: pet_not_found');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-00000000ffff', true, 'x', true, true) ->> 'error', 'pet_not_found', 'pet inexistente: pet_not_found');
SELECT is(public.set_lost_mode(NULL, true, 'x', true, true) ->> 'error', 'pet_not_found', 'pet nulo: pet_not_found');
RESET ROLE;
SELECT is((SELECT lost_mode FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000002'), false, 'no_active_tag nao liga o modo perdido');
SELECT is((SELECT lost_mode FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000003'), false, 'o pet do outro tutor continua intocado');

-- Vinculo encerrado: ligar passa a ser no_active_tag.
UPDATE public.tag_assignments SET ended_at = now(), end_reason = 'released' WHERE id = 'f4f4f4f4-2222-0000-0000-00000000000a';
UPDATE public.rescue_profiles SET lost_mode = false, lost_since = NULL WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001';
SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000a1');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000001', true, 'x', true, true) ->> 'error', 'no_active_tag', 'vinculo encerrado: ligar devolve no_active_tag');
RESET ROLE;

-- ═══════════════ O que NAO e erro de negocio, privilegios e estrutura ═══════════════

SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000b2');
SELECT throws_ok($$ SELECT public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000003', NULL, 'x', true, true) $$, 'P0001', NULL, 'p_on nulo e erro de programacao (excecao), nao erro de negocio');
SELECT throws_ok($$ SELECT public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000003', true, repeat('a', 281), true, true) $$, '23514', NULL, 'recado com mais de 280 caracteres: a CHECK da tabela recusa');
SELECT is(public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000003', true, repeat('a', 280), true, true) ->> 'ok', 'true', 'recado de 280 caracteres: aceito');
RESET ROLE;
SELECT is((SELECT length(lost_message) FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000003'), 280, 'o recado de 280 caracteres foi gravado inteiro');
SELECT is((SELECT show_whatsapp::text || show_phone::text || show_care::text FROM public.rescue_profiles WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000003'), 'falsefalsetrue', 'o modo perdido nao altera os show_* do perfil');

SELECT tests.set_anon();
SELECT is(tests.denied($$ SELECT public.set_lost_mode('f4f4f4f4-1111-0000-0000-000000000003', true, 'x', true, true) $$), true, 'anon nao executa set_lost_mode');
RESET ROLE;
SELECT tests.set_auth_uid('f4f4f4f4-0000-0000-0000-0000000000a1');
SELECT is(tests.denied($$ UPDATE public.rescue_profiles SET lost_mode = true WHERE pet_id = 'f4f4f4f4-1111-0000-0000-000000000001' $$), true, 'o tutor nao liga o modo perdido por UPDATE direto (so pela RPC)');
RESET ROLE;
SELECT is(has_function_privilege('authenticated', 'public.set_lost_mode(uuid,boolean,text,boolean,boolean)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.set_lost_mode(uuid,boolean,text,boolean,boolean)', 'EXECUTE'), true, 'set_lost_mode: authenticated executa, anon nao');
SELECT is((SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid = 'public.set_lost_mode(uuid,boolean,text,boolean,boolean)'::regprocedure), true, 'set_lost_mode e security definer com search_path fixo');
SELECT is((SELECT count(*)::integer FROM regexp_matches((SELECT prosrc FROM pg_proc WHERE oid = 'public.set_lost_mode(uuid,boolean,text,boolean,boolean)'::regprocedure), 'RAISE EXCEPTION', 'g')), 1, 'estrutural (13A): set_lost_mode tem exatamente um RAISE EXCEPTION (erro de programacao)');

SELECT * FROM finish();
ROLLBACK;
