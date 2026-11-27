-- pgTAP: correcoes_gate_humano.test.sql
-- Spec 003-tag-qr, migration 0037 (correcoes do gate humano):
--   S1  pets.photo_path so aceita <tutor_id>/<id do pet>/<uuid>.(webp|jpg); a migration zera o que nao casa;
--   C3  request_tag_replacement: pedido aberto igual devolve o existente; `lost` converte um `damaged` aberto da mesma tag;
--   C5  exclusao de conta em cascata nao falha por causa do gatilho de auditoria de pets (a prova do pet_deleted do tutor
--       esta em auditoria_eventos.test.sql).
-- C1 (bloqueio de PIN com chamadas paralelas) e C2 (token de localizacao) tem teste proprio: C1 em
-- scripts/ci/pin-lock-concurrency.sh (precisa de sessoes simultaneas de verdade) e C2 em rpc_register_scan.test.sql.
-- Cenario criado aqui e desfeito no ROLLBACK final. Regra 13A: erro de negocio e RETORNO (`->> 'error'`).

BEGIN;

SELECT plan(40);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('role', 'authenticated', true);
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
-- true se o comando falha com 23514 (CHECK), no papel atual.
CREATE OR REPLACE FUNCTION tests.check_fails(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN check_violation THEN
  RETURN true;
END;
$$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT tests.mk_user('0a0a0a0a-0000-0000-0000-0000000000a1', 'gate.a@faro.test', 'Ana Gate');
SELECT tests.mk_user('0a0a0a0a-0000-0000-0000-0000000000b2', 'gate.b@faro.test', 'Beto Gate');
SELECT tests.mk_user('0a0a0a0a-0000-0000-0000-0000000000c3', 'gate.c@faro.test', 'Caio Gate');
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('0a0a0a0a-1111-0000-0000-000000000001', '0a0a0a0a-0000-0000-0000-0000000000a1', 'Rex Gate', 'dog'),
  ('0a0a0a0a-1111-0000-0000-000000000002', '0a0a0a0a-0000-0000-0000-0000000000a1', 'Mel Gate', 'cat'),
  ('0a0a0a0a-1111-0000-0000-000000000003', '0a0a0a0a-0000-0000-0000-0000000000a1', 'Tobi Gate', 'dog'),
  ('0a0a0a0a-1111-0000-0000-000000000004', '0a0a0a0a-0000-0000-0000-0000000000a1', 'Lua Gate', 'cat'),
  ('0a0a0a0a-1111-0000-0000-000000000005', '0a0a0a0a-0000-0000-0000-0000000000b2', 'Bidu Gate', 'dog'),
  ('0a0a0a0a-1111-0000-0000-000000000006', '0a0a0a0a-0000-0000-0000-0000000000c3', 'Nina Gate', 'cat');

-- ═══════════════ S1: photo_path por lista de permissao ═══════════════
SELECT tests.set_auth_uid('0a0a0a0a-0000-0000-0000-0000000000a1');

-- Formato do app.
SELECT lives_ok($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$,
  'S1: aceita <tutor>/<pet>/<uuid>.webp');
SELECT lives_ok($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.jpg' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$,
  'S1: aceita <tutor>/<pet>/<uuid>.jpg');
SELECT lives_ok($$ UPDATE public.pets SET photo_path = NULL WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$, 'S1: aceita remover a foto (NULL)');

-- O que NAO pode passar (cada caso e uma das formas do achado).
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/../../../../storage/v1/object/empty/pet-photos' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa ".." (rota de outra chamada)');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/../../x.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa ".." depois do prefixo correto');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/%2e%2e/aaaaaaaa-1111-4222-8333-444444444444.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa "%2e%2e"');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1\0a0a0a0a-1111-0000-0000-000000000001\aaaaaaaa-1111-4222-8333-444444444444.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa barra invertida no lugar de "/"');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.webp?x=1' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa "?"');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.webp#x' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa "#"');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.webp/x' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa segmento a mais depois da extensao');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = E'0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.webp\n' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa quebra de linha no fim');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000b2/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa pasta de outro tutor');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000002/aaaaaaaa-1111-4222-8333-444444444444.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa id de outro pet (mesmo do tutor)');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.png' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa .png');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.jpeg' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa .jpeg');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/AAAAAAAA-1111-4222-8333-444444444444.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa UUID em maiusculas (o app grava minusculas)');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/foto.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa nome que nao e UUID');
SELECT is(tests.check_fails($$ UPDATE public.pets SET photo_path = ' 0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000001' $$), true, 'S1: recusa espaco no comeco');
SELECT is(tests.check_fails($$ INSERT INTO public.pets (tutor_id, name, species, photo_path) VALUES ('0a0a0a0a-0000-0000-0000-0000000000a1', 'Novo', 'dog', '0a0a0a0a-0000-0000-0000-0000000000a1/../../x') $$), true, 'S1: o INSERT tambem recusa');
RESET ROLE;

-- A migration zera o que nao casa: reexecuta o mesmo UPDATE da 0037 com a regra desligada (tudo desfeito no ROLLBACK).
ALTER TABLE public.pets DROP CONSTRAINT pets_photo_path_formato;
UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/../../../../bucket/pet-photos/empty' WHERE id = '0a0a0a0a-1111-0000-0000-000000000002';
UPDATE public.pets SET photo_path = '0a0a0a0a-0000-0000-0000-0000000000a1/0a0a0a0a-1111-0000-0000-000000000003/aaaaaaaa-1111-4222-8333-444444444444.webp' WHERE id = '0a0a0a0a-1111-0000-0000-000000000003';
UPDATE public.pets p
   SET photo_path = NULL
 WHERE p.photo_path IS NOT NULL
   AND p.photo_path !~ ('^' || p.tutor_id::text || '/' || p.id::text
                        || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$');
SELECT is((SELECT photo_path FROM public.pets WHERE id = '0a0a0a0a-1111-0000-0000-000000000002'), NULL, 'S1: a migration zera o photo_path que nao casa');
SELECT isnt((SELECT photo_path FROM public.pets WHERE id = '0a0a0a0a-1111-0000-0000-000000000003'), NULL, 'S1: e preserva o que casa');
ALTER TABLE public.pets ADD CONSTRAINT pets_photo_path_formato CHECK (
    photo_path IS NULL
    OR photo_path ~ ('^' || tutor_id::text || '/' || id::text
                     || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'));

-- ═══════════════ C3: pedidos de 2a via duplicados ═══════════════
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-910', 5);
CREATE TEMP TABLE t_hash AS SELECT extensions.crypt(public.new_activation_pin(), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-910', 'assigned', h.hash, 0
  FROM t_hash h, (VALUES ('ABCDEFGHV'), ('ZZZZZZZZ8'), ('JKMNPQRSR'), ('TVWXYZ01S'), ('1NDAN8EKS')) AS c (code);
INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id) VALUES
  ('ABCDEFGHV', '0a0a0a0a-1111-0000-0000-000000000001', '0a0a0a0a-0000-0000-0000-0000000000a1'),
  ('ZZZZZZZZ8', '0a0a0a0a-1111-0000-0000-000000000002', '0a0a0a0a-0000-0000-0000-0000000000a1'),
  ('JKMNPQRSR', '0a0a0a0a-1111-0000-0000-000000000003', '0a0a0a0a-0000-0000-0000-0000000000a1'),
  ('TVWXYZ01S', '0a0a0a0a-1111-0000-0000-000000000004', '0a0a0a0a-0000-0000-0000-0000000000a1'),
  ('1NDAN8EKS', '0a0a0a0a-1111-0000-0000-000000000005', '0a0a0a0a-0000-0000-0000-0000000000b2');
CREATE TEMP TABLE t_req (k text PRIMARY KEY, r jsonb NOT NULL);
GRANT ALL ON t_req TO authenticated;

SELECT tests.set_auth_uid('0a0a0a0a-0000-0000-0000-0000000000a1');
INSERT INTO t_req VALUES ('a1', public.request_tag_replacement('ABCDEFGHV', 'damaged'));
INSERT INTO t_req VALUES ('a2', public.request_tag_replacement('ABCDEFGHV', 'damaged'));
SELECT is((SELECT r ->> 'ok' FROM t_req WHERE k = 'a1'), 'true', 'C3: o 1o pedido (damaged) entra');
SELECT is((SELECT r ->> 'request_id' FROM t_req WHERE k = 'a2'), (SELECT r ->> 'request_id' FROM t_req WHERE k = 'a1'),
          'C3: o mesmo pedido aberto (mesma tag e tipo) devolve o existente');
SELECT public.request_tag_replacement('ABCDEFGHV', 'damaged');
SELECT public.request_tag_replacement('ABCDEFGHV', 'damaged');
SELECT public.request_tag_replacement('ABCDEFGHV', 'damaged');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_replacement_requests WHERE tag_code = 'ABCDEFGHV' AND status = 'open'), 1,
          'C3: seis chamadas iguais deixam um unico pedido aberto');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'replacement_requested' AND entity_id = 'ABCDEFGHV'), 1,
          'C3: o duplicado nao grava auditoria de novo');

SELECT tests.set_auth_uid('0a0a0a0a-0000-0000-0000-0000000000a1');
SELECT is(public.request_tag_replacement('ZZZZZZZZ8', 'damaged') ->> 'ok', 'true', 'C3: tag B: entra');
SELECT is(public.request_tag_replacement('JKMNPQRSR', 'damaged') ->> 'ok', 'true', 'C3: tag C: entra (3 abertos)');
SELECT is(public.request_tag_replacement('TVWXYZ01S', 'damaged') ->> 'error', 'replacement_limit', 'C3: outra tag com 3 abertos: replacement_limit (limite preservado)');

-- "Perdi a tag" da tag que ja tem pedido aberto nunca e barrado pelo limite: converte o pedido.
INSERT INTO t_req VALUES ('lost', public.request_tag_replacement('ABCDEFGHV', 'lost'));
RESET ROLE;
SELECT is((SELECT r ->> 'ok' FROM t_req WHERE k = 'lost'), 'true', 'C3: lost com 3 pedidos abertos e um deles da propria tag: nao e barrado');
SELECT is((SELECT r ->> 'request_id' FROM t_req WHERE k = 'lost'), (SELECT r ->> 'request_id' FROM t_req WHERE k = 'a1'),
          'C3: o pedido damaged aberto foi convertido (mesmo id)');
SELECT is((SELECT kind || ':' || status FROM public.tag_replacement_requests WHERE id = (SELECT (r ->> 'request_id')::uuid FROM t_req WHERE k = 'lost')),
          'lost:open', 'C3: o pedido agora e lost e segue aberto');
SELECT is((SELECT count(*)::integer FROM public.tag_replacement_requests WHERE tutor_id = '0a0a0a0a-0000-0000-0000-0000000000a1' AND status = 'open'), 3,
          'C3: continuam 3 abertos (nada novo foi inserido)');
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'void', 'C3: lost anula o codigo (comportamento do contrato mantido)');
SELECT is((SELECT end_reason FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV'), 'lost', 'C3: lost encerra o vinculo com lost');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'replacement_requested' AND entity_id = 'ABCDEFGHV' AND detail ->> 'kind' = 'lost'), 1,
          'C3: lost grava replacement_requested');

-- Outro tutor nao e afetado pelo pedido do primeiro.
SELECT tests.set_auth_uid('0a0a0a0a-0000-0000-0000-0000000000b2');
SELECT is(public.request_tag_replacement('1NDAN8EKS', 'damaged') ->> 'ok', 'true', 'C3: outro tutor abre o seu pedido normalmente');
SELECT is(public.request_tag_replacement('ABCDEFGHV', 'damaged') ->> 'error', 'not_owner', 'C3: tag de outro tutor continua not_owner');
RESET ROLE;

-- ═══════════════ C5: exclusao de conta em cascata nao falha ═══════════════
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true); -- sem sessao: como a exclusao pelo servidor
DELETE FROM auth.users WHERE id = '0a0a0a0a-0000-0000-0000-0000000000c3';
SELECT is((SELECT count(*)::integer FROM public.pets WHERE tutor_id = '0a0a0a0a-0000-0000-0000-0000000000c3'), 0, 'C5: a exclusao da conta apaga os pets em cascata sem falhar');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'pet_deleted' AND entity_id = '0a0a0a0a-1111-0000-0000-000000000006'
              AND detail = '{"reason": "account_deleted"}'::jsonb AND actor_id IS NULL AND actor_role = 'system'), 1,
          'C5: na cascata o evento sai com ator nulo, papel system e so o motivo (sem nome)');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'pet_deleted' AND (detail::text || entity_id) ILIKE '%Nina%'), 0, 'C5: o nome do pet nao vai para a auditoria');

SELECT * FROM finish();
ROLLBACK;
