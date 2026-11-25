-- pgTAP: rpc_activate_tag.test.sql
-- Spec 003-tag-qr, T038 (feito quando: ativa com o seed; erros com os codigos do contrato) e T039 (todos os itens de
-- "Testes obrigatorios" de contracts/tutor-rpcs.contract.md ligados a ativacao). Migration 0029.
-- Regra 13A: erro de negocio e RETORNO ({"ok":false,"error":...}); aqui TODO erro e conferido com `->> 'error'`, nunca com
-- throws_ok (o throws_ok desfaria a transacao e esconderia justamente o defeito que a regra evita).
--
-- Cenario (criado aqui, desfeito no ROLLBACK final):
--   tutores A, B e E com celular confirmado e C sem; um PIN gerado AGORA (new_activation_pin) e guardado so no GUC
--   `tests.pin` da transacao (nunca escrito no arquivo); um unico hash serve de PIN de todos os codigos do teste.
-- Codigos: vetores sinteticos de contracts/tag-code.vectors.json; nenhum e do seed nem do lote-001.
-- Concorrencia real (duas conexoes) nao cabe num arquivo pgTAP (uma sessao so): o script de CI
-- scripts/ci/supabase-checks.sh dispara duas ativacoes em paralelo contra o stack; aqui ficam a prova sequencial
-- (a segunda recebe tag_unavailable) e a prova estrutural (FOR UPDATE na linha da tag).

BEGIN;

SELECT plan(101);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

-- O limite de chamadas de activate_tag (30 em 15 min por conta, migration 0035) conta TODA chamada; este arquivo faz bem mais
-- de 30 chamadas com a conta A na mesma transacao (o relogio do pgTAP e fixo). O limite em si e provado em
-- endurecimento_tags.test.sql; aqui o contador e zerado a cada troca de identidade, so para os cenarios nao dependerem dele.
CREATE OR REPLACE FUNCTION tests.reset_activate_calls() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM public.rate_limits WHERE scope = 'activate_calls';
$$;
CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT tests.reset_activate_calls(),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('role', 'authenticated', true);
$$;
CREATE OR REPLACE FUNCTION tests.set_anon() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"anon"}'::text, true),
         set_config('request.jwt.claim.sub', '', true),
         set_config('role', 'anon', true);
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
-- O PIN certo da transacao e um PIN errado (primeiro caractere trocado). Lidos do GUC `tests.pin`.
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

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT set_config('tests.pin', public.new_activation_pin(), true);
SELECT tests.mk_user('d2d2d2d2-0000-0000-0000-0000000000a1', 'ativa.a@faro.test', 'Ana Ativa');
SELECT tests.mk_user('d2d2d2d2-0000-0000-0000-0000000000b2', 'ativa.b@faro.test', 'Beto Ativa');
SELECT tests.mk_user('d2d2d2d2-0000-0000-0000-0000000000c3', 'ativa.c@faro.test', 'Caio Ativa');
SELECT tests.mk_user('d2d2d2d2-0000-0000-0000-0000000000e5', 'ativa.e@faro.test', 'Eva Ativa');
UPDATE public.perfis SET celular = '+5511900000031', celular_confirmado_em = now() WHERE id = 'd2d2d2d2-0000-0000-0000-0000000000a1';
UPDATE public.perfis SET celular = '+5511900000032', celular_confirmado_em = now() WHERE id = 'd2d2d2d2-0000-0000-0000-0000000000b2';
UPDATE public.perfis SET celular = '+5511900000035', celular_confirmado_em = now() WHERE id = 'd2d2d2d2-0000-0000-0000-0000000000e5';

INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('d2d2d2d2-1111-0000-0000-0000000000a1', 'd2d2d2d2-0000-0000-0000-0000000000a1', 'Rex Ativa', 'dog'),
  ('d2d2d2d2-1111-0000-0000-0000000000a2', 'd2d2d2d2-0000-0000-0000-0000000000a1', 'Mel Ativa', 'cat'),
  ('d2d2d2d2-1111-0000-0000-0000000000a3', 'd2d2d2d2-0000-0000-0000-0000000000a1', 'Tobi Ativa', 'dog'),
  ('d2d2d2d2-1111-0000-0000-0000000000a4', 'd2d2d2d2-0000-0000-0000-0000000000a1', 'Lua Ativa', 'cat'),
  ('d2d2d2d2-1111-0000-0000-0000000000b1', 'd2d2d2d2-0000-0000-0000-0000000000b2', 'Bidu Ativa', 'dog'),
  ('d2d2d2d2-1111-0000-0000-0000000000b2', 'd2d2d2d2-0000-0000-0000-0000000000b2', 'Nina Ativa', 'cat'),
  ('d2d2d2d2-1111-0000-0000-0000000000b3', 'd2d2d2d2-0000-0000-0000-0000000000b2', 'Rolo Ativa', 'dog'),
  ('d2d2d2d2-1111-0000-0000-0000000000c1', 'd2d2d2d2-0000-0000-0000-0000000000c3', 'Pipoca Ativa', 'dog'),
  ('d2d2d2d2-1111-0000-0000-0000000000e1', 'd2d2d2d2-0000-0000-0000-0000000000e5', 'Fred Ativa', 'dog');

INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-904', 12);
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(current_setting('tests.pin'), extensions.gen_salt('bf', 12)) AS hash;
-- T1 ABCDEFGHV (ativacao feliz e troca), T2 ZZZZZZZZ8 (PIN errado e janelas), T3 JKMNPQRSR (trava da conta),
-- T4 TVWXYZ01S (trava da tag), T5 10000000Z (anulada), T6 00000001Y (bloqueada), T7 0123456Z3 (vinculada a B),
-- T8 1NDAN8EKS (com WhatsApp), T9 W030F52J1 (troca), T10 BZCH5NVX1 (limite e ativacao pendente).
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-904', c.status, h.hash, 0
  FROM t_hash h, (VALUES ('ABCDEFGHV', 'available'), ('ZZZZZZZZ8', 'available'), ('JKMNPQRSR', 'available'),
                         ('TVWXYZ01S', 'available'), ('10000000Z', 'void'), ('00000001Y', 'blocked'),
                         ('0123456Z3', 'assigned'), ('1NDAN8EKS', 'available'), ('W030F52J1', 'available'),
                         ('BZCH5NVX1', 'available')) AS c (code, status);
INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id)
VALUES ('0123456Z3', 'd2d2d2d2-1111-0000-0000-0000000000b1', 'd2d2d2d2-0000-0000-0000-0000000000b2');
-- (B tem a Bidu vinculada a T7; a Nina fica livre.)
CREATE TEMP TABLE t_chk (i integer PRIMARY KEY, r jsonb NOT NULL);
GRANT ALL ON t_chk TO authenticated;

-- ═══════════════ check_tag_for_link ═══════════════

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');

SELECT is(public.check_tag_for_link('ABCDEFGHV'), '{"ok":true,"code":"ABCD-EFGH-V"}'::jsonb, 'check: tag disponivel devolve ok e o codigo formatado');
SELECT is(public.check_tag_for_link('abcd efgh v') ->> 'ok', 'true', 'check: normaliza minusculas e espacos');
SELECT is(public.check_tag_for_link('7K3MQ9XAD') ->> 'error', 'invalid_code', 'check: digito verificador invalido: invalid_code');
SELECT is(public.check_tag_for_link('ABC') ->> 'error', 'invalid_code', 'check: codigo curto: invalid_code');
SELECT is(public.check_tag_for_link(NULL) ->> 'error', 'invalid_code', 'check: codigo nulo: invalid_code');
-- 4 chamadas (a conta A fez 5 ate aqui; o limite e 10 por minuto, entao esta ainda e a 9a).
SELECT is(
  (SELECT array_agg(DISTINCT v.x::text) FROM (VALUES (public.check_tag_for_link('0123456Z3')), (public.check_tag_for_link('00000001Y')),
                                                     (public.check_tag_for_link('10000000Z')), (public.check_tag_for_link('H8ZWE5XGH'))) AS v (x)),
  ARRAY['{"ok": false, "error": "tag_unavailable"}']::text[],
  'check: vinculada, bloqueada, anulada e inexistente: a MESMA resposta (tag_unavailable)');
RESET ROLE;

-- 11a chamada em um minuto com codigo INVALIDO: locked (a conta E nao fez nenhuma chamada antes).
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000e5');
INSERT INTO t_chk SELECT i, public.check_tag_for_link('7K3MQ9XAD') FROM generate_series(1, 12) AS i;
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM t_chk WHERE i <= 10 AND r ->> 'error' = 'invalid_code'), 10, 'check: as 10 primeiras chamadas (invalidas) respondem invalid_code');
SELECT is((SELECT r ->> 'error' FROM t_chk WHERE i = 11), 'locked', 'check: a 11a chamada em um minuto devolve locked, mesmo com codigo invalido');
SELECT ok((SELECT (r ->> 'retry_after_seconds')::integer BETWEEN 1 AND 60 FROM t_chk WHERE i = 11), 'check: locked traz retry_after_seconds entre 1 e 60');
SELECT is((SELECT r ->> 'error' FROM t_chk WHERE i = 12), 'locked', 'check: a 12a continua locked');
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000b2');
SELECT is(public.check_tag_for_link('ABCDEFGHV') ->> 'ok', 'true', 'check: outra conta tem o proprio limite');
RESET ROLE;

-- ═══════════════ activate_tag: erros que vem antes do PIN ═══════════════

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');

SELECT is(public.activate_tag('7K3MQ9XAD', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') ->> 'error', 'invalid_code', 'activate: digito invalido: invalid_code');
SELECT is(public.activate_tag(NULL, tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') ->> 'error', 'invalid_code', 'activate: codigo nulo: invalid_code');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000b2') ->> 'error', 'pet_not_found', 'activate: pet de outro tutor: pet_not_found');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'd2d2d2d2-1111-0000-0000-00000000ffff') ->> 'error', 'pet_not_found', 'activate: pet inexistente: pet_not_found');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), NULL) ->> 'error', 'pet_not_found', 'activate: pet nulo: pet_not_found');
SELECT is((public.activate_tag('7K3MQ9XAD', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000b2')) ->> 'error', 'invalid_code', 'activate: o codigo e conferido ANTES do pet');
RESET ROLE;

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000c3');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000c1') ->> 'error', 'phone_not_confirmed', 'activate: celular nao confirmado: phone_not_confirmed (mesmo com PIN certo)');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000c3'), 0, 'activate: phone_not_confirmed nao conta tentativa de PIN');

-- Tag assigned, blocked, void e inexistente: a mesma resposta, com o PIN certo, e sem tocar os contadores.
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(
  public.activate_tag('0123456Z3', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') = public.activate_tag('00000001Y', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1')
  AND public.activate_tag('00000001Y', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') = public.activate_tag('10000000Z', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1')
  AND public.activate_tag('10000000Z', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') = public.activate_tag('H8ZWE5XGH', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1')
  AND public.activate_tag('H8ZWE5XGH', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') = '{"ok":false,"error":"tag_unavailable"}'::jsonb, true,
  'activate: vinculada, bloqueada, anulada e inexistente: a MESMA resposta (tag_unavailable), mesmo com o PIN certo');
SELECT is(public.activate_tag('0123456Z3', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') ->> 'error', 'tag_unavailable', 'activate: PIN errado numa tag vinculada tambem e tag_unavailable (o PIN nem e olhado)');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tag_code IN ('0123456Z3', '00000001Y', '10000000Z')), 0, 'activate: tag_unavailable nao grava tentativa de PIN');
SELECT is((SELECT pin_fail_count_24h FROM public.tag_codes WHERE code = '0123456Z3'), 0, 'activate: tag_unavailable nao mexe no contador da tag');

-- ═══════════════ PIN errado conta e sobrevive (nao e desfeito pelo erro) ═══════════════

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'activate: PIN errado: wrong_pin');
RESET ROLE;
SELECT is((SELECT fail_count FROM public.tag_pin_attempts WHERE tag_code = 'ZZZZZZZZ8' AND tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1'), 1,
  'depois do wrong_pin a linha de tag_pin_attempts EXISTE com fail_count 1 (a contagem nao foi desfeita)');
SELECT is((SELECT pin_fail_count_24h FROM public.tag_codes WHERE code = 'ZZZZZZZZ8'), 1, 'depois do wrong_pin tag_codes.pin_fail_count_24h subiu para 1');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'activation_failed' AND entity_id = 'ZZZZZZZZ8'), 1, 'wrong_pin grava activation_failed na auditoria');

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('ZZZZZZZZ8', 'abc', 'd2d2d2d2-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'activate: PIN fora do formato: wrong_pin (e conta)');
SELECT is(public.activate_tag('ZZZZZZZZ8', NULL, 'd2d2d2d2-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'activate: PIN nulo: wrong_pin (e conta)');
RESET ROLE;
SELECT is((SELECT fail_count FROM public.tag_pin_attempts WHERE tag_code = 'ZZZZZZZZ8' AND tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1'), 3, 'tres erros de PIN: fail_count 3');
SELECT is((SELECT pin_fail_count_24h FROM public.tag_codes WHERE code = 'ZZZZZZZZ8'), 3, 'tres erros de PIN: pin_fail_count_24h 3');

-- O PIN nunca vai para a auditoria (nem o certo, nem o errado).
SELECT is((SELECT count(*)::integer FROM public.audit_log
            WHERE detail::text LIKE '%' || tests.pin() || '%' OR detail::text LIKE '%' || tests.wrong_pin() || '%'
               OR coalesce(entity_id, '') LIKE '%' || tests.pin() || '%'), 0, 'o PIN (certo ou errado) nao aparece em nenhuma linha de audit_log');

-- Janelas: a janela da conta (15 min) e a da tag (24 h) recomecam depois de vencidas.
UPDATE public.tag_pin_attempts SET window_start = now() - interval '16 minutes'
 WHERE tag_code = 'ZZZZZZZZ8' AND tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1';
UPDATE public.tag_codes SET pin_fail_window_start = now() - interval '25 hours' WHERE code = 'ZZZZZZZZ8';
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'janela vencida: o erro seguinte e wrong_pin, nao locked');
RESET ROLE;
SELECT is((SELECT fail_count FROM public.tag_pin_attempts WHERE tag_code = 'ZZZZZZZZ8' AND tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1'), 1, 'janela de 15 min vencida: a contagem da conta recomeca em 1');
SELECT is((SELECT pin_fail_count_24h FROM public.tag_codes WHERE code = 'ZZZZZZZZ8'), 1, 'janela de 24 h vencida: a contagem da tag recomeca em 1');

-- Medida pedida por T039: tempo de uma verificacao de PIN (bcrypt custo 12), media de 5. Aparece no log do CI.
DO $m$
DECLARE
  t0 timestamptz := clock_timestamp();
  h  text := (SELECT hash FROM t_hash);
  i  integer;
BEGIN
  FOR i IN 1..5 LOOP
    PERFORM extensions.crypt(current_setting('tests.pin'), h);
  END LOOP;
  PERFORM set_config('tests.pin_ms', round(extract(epoch FROM (clock_timestamp() - t0)) * 1000 / 5)::text, true);
END
$m$;
SELECT diag('tempo de uma verificacao de PIN (bcrypt custo 12), media de 5: ' || current_setting('tests.pin_ms') || ' ms');

-- ═══════════════ Ativacao feliz ═══════════════

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('abcd-efgh-v', lower(tests.pin()), 'd2d2d2d2-1111-0000-0000-0000000000a1'),
  '{"ok":true,"code":"ABCD-EFGH-V","pet_id":"d2d2d2d2-1111-0000-0000-0000000000a1","pet_name":"Rex Ativa","whatsapp_enabled":false}'::jsonb,
  'activate: PIN certo (normalizado) ativa e devolve code, pet_id, pet_name e whatsapp_enabled falso');
RESET ROLE;
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'assigned', 'ativacao: a tag passa a assigned');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV' AND ended_at IS NULL
            AND pet_id = 'd2d2d2d2-1111-0000-0000-0000000000a1' AND tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1'), 1, 'ativacao: vinculo ativo da Rex com a Ana');
SELECT is((SELECT show_whatsapp FROM public.rescue_profiles WHERE pet_id = 'd2d2d2d2-1111-0000-0000-0000000000a1'), false, 'activate sem p_enable_whatsapp: show_whatsapp fica false');
SELECT is((SELECT pin_fail_count_24h || ':' || coalesce(pin_locked_until::text, 'nulo') FROM public.tag_codes WHERE code = 'ABCDEFGHV'), '0:nulo', 'ativacao zera os contadores da tag');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'tag_activated' AND entity_id = 'ABCDEFGHV'), 1, 'ativacao grava tag_activated');
SELECT is((SELECT activation_pin_hash FROM public.tag_codes WHERE code = 'ABCDEFGHV'), (SELECT hash FROM t_hash), 'ativacao nao troca o hash do PIN (o PIN deixa de ser util porque a tag nao e mais available)');

-- O PIN vale uma vez: com a tag vinculada, a segunda tentativa (outra conta, PIN certo) e tag_unavailable.
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000b2') ->> 'error', 'tag_unavailable',
  'activate: PIN certo numa tag que acabou de ser vinculada: tag_unavailable (o PIN vale uma vez; a segunda ativacao seguida perde)');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV' AND ended_at IS NULL), 1, 'no maximo um vinculo ativo por tag');

SELECT is((SELECT prosrc ~* 'FOR UPDATE' FROM pg_proc WHERE oid = 'public.activate_tag(text,text,uuid,boolean,boolean)'::regprocedure), true,
  'estrutural: activate_tag trava a linha da tag (FOR UPDATE) antes de conferir o status');

-- ═══════════════ WhatsApp so com p_enable_whatsapp ═══════════════

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('1NDAN8EKS', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a2', false, true) ->> 'whatsapp_enabled', 'true', 'activate com p_enable_whatsapp = true: whatsapp_enabled true');
RESET ROLE;
SELECT is((SELECT show_whatsapp FROM public.rescue_profiles WHERE pet_id = 'd2d2d2d2-1111-0000-0000-0000000000a2'), true, 'activate com p_enable_whatsapp = true: show_whatsapp liga');

-- ═══════════════ Pet com tag ativa: pet_has_tag e troca ═══════════════

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('W030F52J1', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1') ->> 'error', 'pet_has_tag', 'activate: pet que ja tem tag e p_replace falso: pet_has_tag');
RESET ROLE;
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'W030F52J1'), 'available', 'pet_has_tag nao altera a tag nova (continua available)');
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'assigned', 'pet_has_tag nao altera a tag antiga');

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('W030F52J1', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a1', true) ->> 'ok', 'true', 'activate com p_replace = true: troca a tag do pet');
RESET ROLE;
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'available', 'troca: a tag anterior volta a available');
SELECT is((SELECT activation_pin_hash FROM public.tag_codes WHERE code = 'ABCDEFGHV'), (SELECT hash FROM t_hash), 'troca: o activation_pin_hash da tag anterior NAO muda (o PIN vigente e mantido)');
SELECT is((SELECT end_reason FROM public.tag_assignments WHERE tag_code = 'ABCDEFGHV' AND ended_at IS NOT NULL), 'released', 'troca: o vinculo anterior termina com released');
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'W030F52J1'), 'assigned', 'troca: a tag nova fica assigned');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE pet_id = 'd2d2d2d2-1111-0000-0000-0000000000a1' AND ended_at IS NULL), 1, 'troca: o pet continua com uma unica tag ativa');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'tag_released' AND entity_id = 'ABCDEFGHV' AND detail ->> 'reason' = 'replaced'), 1, 'troca: grava tag_released (replaced) da tag anterior');

-- O PIN da tag anterior CONTINUA funcionando: outra conta ativa a tag liberada com o PIN original.
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000b2') ->> 'ok', 'true', 'troca: a tag anterior, liberada, e ativada por outra conta com o PIN de sempre');
RESET ROLE;

-- ═══════════════ Bloqueio por conta (5 erros em 15 min) ═══════════════

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
INSERT INTO t_chk SELECT 100 + i, public.activate_tag('JKMNPQRSR', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000a3') FROM generate_series(1, 5) AS i;
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM t_chk WHERE i BETWEEN 101 AND 104 AND r ->> 'error' = 'wrong_pin'), 4, 'os 4 primeiros erros de PIN da conta respondem wrong_pin');
SELECT is((SELECT r ->> 'error' FROM t_chk WHERE i = 105), 'locked', 'o 5o erro em 15 min trava a conta naquela tag: locked');
SELECT is((SELECT (r ->> 'retry_after_seconds')::integer FROM t_chk WHERE i = 105), 900, 'locked da conta: retry_after_seconds 900');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'activation_locked_account' AND entity_id = 'JKMNPQRSR'), 1, 'o bloqueio da conta grava activation_locked_account');
SELECT is((SELECT fail_count FROM public.tag_pin_attempts WHERE tag_code = 'JKMNPQRSR' AND tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1'), 5, 'fail_count da conta chegou a 5 e ficou gravado');

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('JKMNPQRSR', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a3') ->> 'error', 'locked', 'PIN CERTO durante o bloqueio da conta: locked');
SELECT ok((public.activate_tag('JKMNPQRSR', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a3') ->> 'retry_after_seconds')::integer BETWEEN 1 AND 900, 'locked traz retry_after_seconds');
RESET ROLE;
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'JKMNPQRSR'), 'available', 'a tag travada para a conta continua available');

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('JKMNPQRSR', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000b3') ->> 'ok', 'true', 'outra conta ainda consegue tentar (e ativar) a mesma tag');
RESET ROLE;

-- ═══════════════ Bloqueio da tag (20 erros em 24 h) ═══════════════

-- 19 erros ja acumulados (escrita direta: 19 tentativas reais de bcrypt custo 12 so atrasariam o CI); o 20o e real.
UPDATE public.tag_codes SET pin_fail_count_24h = 19, pin_fail_window_start = now() WHERE code = 'TVWXYZ01S';
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000e5');
SELECT is(public.activate_tag('TVWXYZ01S', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000e1') ->> 'error', 'locked', 'o 20o erro de PIN em 24 h trava a tag: locked');
SELECT is(public.activate_tag('TVWXYZ01S', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000e1') ->> 'retry_after_seconds', (24 * 3600 - 0)::text, 'travada: retry_after_seconds de 24 h (em pgTAP now() e fixo)');
RESET ROLE;
SELECT ok((SELECT pin_locked_until > now() FROM public.tag_codes WHERE code = 'TVWXYZ01S'), 'a tag guarda pin_locked_until no futuro');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'activation_locked_tag' AND entity_id = 'TVWXYZ01S'), 1, 'a trava da tag grava activation_locked_tag (aparece na fila do admin)');

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('TVWXYZ01S', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a3') ->> 'error', 'locked', 'tag travada: TODAS as contas recebem locked, mesmo com o PIN certo');
RESET ROLE;

-- Vencida a trava, o PIN certo ativa.
UPDATE public.tag_codes SET pin_locked_until = now() - interval '1 second', pin_fail_window_start = now() - interval '25 hours' WHERE code = 'TVWXYZ01S';
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('TVWXYZ01S', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a3') ->> 'ok', 'true', 'trava vencida: o PIN certo ativa');
RESET ROLE;

-- ═══════════════ not_entitled e ativacao pendente ═══════════════

-- can_link_tag negando: o novo vinculo e barrado, depois do PIN (a tag nao muda).
CREATE OR REPLACE FUNCTION public.can_link_tag(p_tutor uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $f$ SELECT false; $f$;
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('BZCH5NVX1', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a4') ->> 'error', 'not_entitled', 'can_link_tag falso: not_entitled');
SELECT is(public.activate_tag('BZCH5NVX1', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000a4') ->> 'error', 'wrong_pin', 'not_entitled so vem depois do PIN: PIN errado continua wrong_pin');
RESET ROLE;
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'BZCH5NVX1'), 'available', 'not_entitled nao altera a tag');
CREATE OR REPLACE FUNCTION public.can_link_tag(p_tutor uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $f$ SELECT true; $f$;

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.set_pending_activation('bzch-5nvx-1'), '{"ok":true}'::jsonb, 'set_pending_activation: guarda o codigo normalizado');
SELECT is(public.get_pending_activation(), '{"ok":true,"code":"BZCH-5NVX-1"}'::jsonb, 'get_pending_activation: devolve o codigo formatado');
SELECT is(public.set_pending_activation('7K3MQ9XAD') ->> 'error', 'invalid_code', 'set_pending_activation: codigo invalido: invalid_code');
RESET ROLE;
SELECT is((SELECT tag_code::text FROM public.pending_activations WHERE tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1'), 'BZCH5NVX1', 'a ativacao pendente guarda o codigo normalizado');
SELECT ok((SELECT expires_at > now() + interval '6 days 23 hours' AND expires_at <= now() + interval '7 days' FROM public.pending_activations WHERE tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1'), 'a ativacao pendente vale 7 dias');

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.set_pending_activation('H8ZWE5XGH'), '{"ok":true}'::jsonb, 'set_pending_activation de codigo inexistente (mas valido) funciona: nao e oraculo');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.pending_activations WHERE tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1'), 1, 'uma nova ativacao pendente substitui a anterior');
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000b2');
SELECT is(public.get_pending_activation(), '{"ok":true,"code":null}'::jsonb, 'get_pending_activation: so a propria conta (B nao ve a da Ana)');
RESET ROLE;
UPDATE public.pending_activations SET expires_at = now() - interval '1 second' WHERE tutor_id = 'd2d2d2d2-0000-0000-0000-0000000000a1';
SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000a1');
SELECT is(public.get_pending_activation(), '{"ok":true,"code":null}'::jsonb, 'get_pending_activation: ativacao vencida nao e devolvida');
SELECT is(public.set_pending_activation('BZCH5NVX1'), '{"ok":true}'::jsonb, 'set_pending_activation de novo (preparo da ativacao)');
-- Ativar a tag da ativacao pendente a apaga.
SELECT is(public.activate_tag('BZCH5NVX1', tests.pin(), 'd2d2d2d2-1111-0000-0000-0000000000a4') ->> 'ok', 'true', 'activate da tag pendente: ativa');
SELECT is(public.get_pending_activation(), '{"ok":true,"code":null}'::jsonb, 'a ativacao pendente e apagada ao ativar a tag');
SELECT is(public.clear_pending_activation(), '{"ok":true}'::jsonb, 'clear_pending_activation: ok');
RESET ROLE;

-- ═══════════════ Nenhum segredo nas respostas, privilegios e estrutura ═══════════════

SELECT tests.set_auth_uid('d2d2d2d2-0000-0000-0000-0000000000e5');
SELECT is(position('$2' IN public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000e1')::text), 0, 'a resposta (wrong_pin) nao carrega hash de PIN');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'd2d2d2d2-1111-0000-0000-0000000000e1')::text, '{"ok": false, "error": "wrong_pin"}', 'resposta de erro: so ok e error (sem hash, ip_hash, PIN nem contador)');
RESET ROLE;

SELECT tests.set_anon();
SELECT is(tests.denied($$ SELECT public.activate_tag('ABCDEFGHV', 'AAAAAA', NULL) $$), true, 'anon nao executa activate_tag');
SELECT is(tests.denied($$ SELECT public.check_tag_for_link('ABCDEFGHV') $$), true, 'anon nao executa check_tag_for_link');
SELECT is(tests.denied($$ SELECT public.set_pending_activation('ABCDEFGHV') $$), true, 'anon nao executa set_pending_activation');
SELECT is(tests.denied($$ SELECT public.get_pending_activation() $$), true, 'anon nao executa get_pending_activation');
SELECT is(tests.denied($$ SELECT public.clear_pending_activation() $$), true, 'anon nao executa clear_pending_activation');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('activate_tag', 'check_tag_for_link', 'set_pending_activation', 'get_pending_activation', 'clear_pending_activation')
            AND has_function_privilege('authenticated', p.oid, 'EXECUTE') AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')), 5,
  'as cinco funcoes: authenticated executa e anon nao');
SELECT is((SELECT count(*)::integer FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('tag_err', 'rate_retry_after')
            AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'))), 0,
  'tag_err e rate_retry_after (internas) nao sao executaveis por authenticated nem anon');
SELECT is((SELECT count(*)::integer FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('activate_tag', 'check_tag_for_link', 'set_pending_activation', 'get_pending_activation', 'clear_pending_activation')
            AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']), 5, 'as cinco sao security definer com search_path fixo');
SELECT is((SELECT count(*)::integer FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('activate_tag', 'check_tag_for_link', 'set_pending_activation')
            AND p.prosrc ~* 'RAISE EXCEPTION'), 0, 'estrutural (13A): nenhuma RPC de ativacao lanca excecao para erro de negocio');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.audit_log WHERE detail::text LIKE '%$2a$%' OR detail::text LIKE '%$2b$%'), 'a auditoria nao guarda hash de PIN');

SELECT * FROM finish();
ROLLBACK;
