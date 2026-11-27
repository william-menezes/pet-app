-- pgTAP: batch_atomicidade.test.sql
-- Spec 003-tag-qr, rodada de QA (migration 0036, DEF-003-01). `admin_insert_batch` grava lote + codigos + UM evento de auditoria.
-- Prova REAL (no banco, sem falsos) de "tudo ou nada": uma falha NO MEIO da gravacao nao deixa lote, codigo nem auditoria.
-- A falha e provocada por um gatilho de teste (criado aqui, desfeito no ROLLBACK final; o produto nao e tocado):
--   (a) gatilho em tag_codes que levanta no 3o codigo do lote (os 2 primeiros ja foram inseridos);
--   (b) gatilho em audit_log que levanta no evento batch_created (lote e codigos ja inseridos).
-- Depois de cada falha o estado tem de ser identico ao anterior. O controle (sem gatilho) grava tudo e o lote existe: o teste
-- nao e vazio. A falha de uma FATIA de `admin_hash_pins` (antes de qualquer gravacao) e provada so com falsos, em
-- supabase/functions/admin-create-batch/handler.test.ts: aqui nao ha como derrubar uma chamada HTTP no meio.
-- Os PINs so existem na transacao (`tests.pin*`); nada de PIN em claro neste arquivo.

BEGIN;

SELECT plan(13);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

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
-- Estado observavel do lote: (lotes, codigos e eventos batch_created) dos codigos de teste.
CREATE OR REPLACE FUNCTION tests.state() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (SELECT count(*) FROM public.tag_batches)::text || '/'
      || (SELECT count(*) FROM public.tag_codes WHERE code IN ('10000000Z', '00000001Y', 'H8ZWE5XGH'))::text || '/'
      || (SELECT count(*) FROM public.audit_log WHERE event = 'batch_created' AND at = now())::text;
$$;
-- Gatilhos de teste.
CREATE OR REPLACE FUNCTION tests.boom_on_third() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code = 'H8ZWE5XGH' THEN RAISE EXCEPTION 'falha de teste no 3o codigo' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION tests.boom_on_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event = 'batch_created' THEN RAISE EXCEPTION 'falha de teste na auditoria' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END;
$$;

SELECT tests.mk_user('b5b5b5b5-0000-0000-0000-0000000000ad', 'atom.adm@faro.test', 'Admin Atom');
UPDATE public.perfis SET papel = 'admin' WHERE id = 'b5b5b5b5-0000-0000-0000-0000000000ad';
SELECT set_config('tests.pin_a', public.new_activation_pin(), true);
SELECT set_config('tests.pin_b', public.new_activation_pin(), true);
SELECT set_config('tests.pin_c', public.new_activation_pin(), true);
-- Hashes dos tres PINs, calculados como a Edge Function calcula (admin_hash_pins, so service_role), na mesma ordem.
CREATE TEMP TABLE t_h AS
  SELECT h.i, h.hash FROM (
    SELECT g AS i, (public.admin_hash_pins(ARRAY[current_setting('tests.pin_a'), current_setting('tests.pin_b'),
                                                  current_setting('tests.pin_c')]))[g] AS hash
      FROM generate_series(1, 3) g) h;
CREATE OR REPLACE FUNCTION tests.items() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('code', '10000000Z', 'pin_hash', (SELECT hash FROM t_h WHERE i = 1), 'qr_mask', 5),
    jsonb_build_object('code', '00000001Y', 'pin_hash', (SELECT hash FROM t_h WHERE i = 2), 'qr_mask', 0),
    jsonb_build_object('code', 'H8ZWE5XGH', 'pin_hash', (SELECT hash FROM t_h WHERE i = 3), 'qr_mask', 7));
$$;
GRANT SELECT ON t_h TO service_role;

SELECT is(tests.state(), (SELECT count(*) FROM public.tag_batches)::text || '/0/0', 'partida: nenhum dos 3 codigos existe e nao ha batch_created desta transacao');
CREATE TEMP TABLE t_mem (k text PRIMARY KEY, v text NOT NULL);
INSERT INTO t_mem VALUES ('antes', tests.state());

-- ═══════════════ (a) falha no 3o codigo: os 2 primeiros ja tinham sido inseridos ═══════════════
CREATE TRIGGER qa_boom_codes BEFORE INSERT ON public.tag_codes FOR EACH ROW EXECUTE FUNCTION tests.boom_on_third();
SELECT tests.set_service();
SELECT throws_ok($$ SELECT public.admin_insert_batch('b5b5b5b5-0000-0000-0000-0000000000ad', 3, 'atomicidade', tests.items()) $$,
                 'P0001', 'falha de teste no 3o codigo', '(a) a gravacao falha no 3o codigo (erro do gatilho de teste)');
RESET ROLE;
SELECT is(tests.state(), (SELECT v FROM t_mem WHERE k = 'antes'), '(a) nada ficou: nem lote, nem os 2 primeiros codigos, nem auditoria');
DROP TRIGGER qa_boom_codes ON public.tag_codes;

-- ═══════════════ (b) falha na auditoria: lote e codigos ja tinham sido inseridos ═══════════════
CREATE TRIGGER qa_boom_audit BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION tests.boom_on_audit();
SELECT tests.set_service();
SELECT throws_ok($$ SELECT public.admin_insert_batch('b5b5b5b5-0000-0000-0000-0000000000ad', 3, 'atomicidade', tests.items()) $$,
                 'P0001', 'falha de teste na auditoria', '(b) a gravacao falha na auditoria (ultimo passo)');
RESET ROLE;
SELECT is(tests.state(), (SELECT v FROM t_mem WHERE k = 'antes'), '(b) nada ficou: nem lote, nem os 3 codigos');
SELECT is((SELECT count(*)::integer FROM public.tag_batches WHERE notes = 'atomicidade'), 0, '(b) nenhum lote com a observacao do teste');
DROP TRIGGER qa_boom_audit ON public.audit_log;

-- ═══════════════ controle: sem gatilho, grava tudo (o teste nao e vazio) ═══════════════
SELECT tests.set_service();
CREATE TEMP TABLE t_res AS SELECT public.admin_insert_batch('b5b5b5b5-0000-0000-0000-0000000000ad', 3, 'atomicidade', tests.items()) AS r;
GRANT SELECT ON t_res TO service_role;
RESET ROLE;
SELECT is((SELECT r ->> 'ok' FROM t_res), 'true', 'controle: sem falha injetada o lote e criado');
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE batch_id = (SELECT r ->> 'batch_id' FROM t_res)), 3, 'controle: os 3 codigos entraram');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'batch_created' AND entity_id = (SELECT r ->> 'batch_id' FROM t_res)), 1, 'controle: exatamente UM batch_created');
SELECT is((SELECT detail FROM public.audit_log WHERE event = 'batch_created' AND entity_id = (SELECT r ->> 'batch_id' FROM t_res)), '{"quantity": 3}'::jsonb, 'controle: o evento tem so a quantidade (sem PIN nem hash)');
-- A ordem das fatias: o hash de cada codigo e o do PIN dele.
SELECT ok(extensions.crypt(current_setting('tests.pin_a'), (SELECT activation_pin_hash FROM public.tag_codes WHERE code = '10000000Z'))
          = (SELECT activation_pin_hash FROM public.tag_codes WHERE code = '10000000Z')
          AND extensions.crypt(current_setting('tests.pin_c'), (SELECT activation_pin_hash FROM public.tag_codes WHERE code = 'H8ZWE5XGH'))
          = (SELECT activation_pin_hash FROM public.tag_codes WHERE code = 'H8ZWE5XGH'),
          'controle: o PIN de cada codigo confere com o hash gravado (ordem preservada)');
SELECT ok((SELECT activation_pin_hash FROM public.tag_codes WHERE code = '00000001Y') ~ '^\$2[aby]\$12\$',
          'controle: bcrypt custo 12 gravado');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE detail::text LIKE '%' || current_setting('tests.pin_a') || '%'
                                                            OR detail::text LIKE '%' || current_setting('tests.pin_b') || '%'
                                                            OR detail::text LIKE '%' || current_setting('tests.pin_c') || '%'), 0,
          'nenhum PIN do lote em audit_log');

SELECT * FROM finish();
ROLLBACK;
