-- pgTAP: pin_contadores_laterais.test.sql
-- Spec 003-tag-qr, rodada de QA (gate: PIN). Prova com chamadas reais que nenhum CAMINHO LATERAL desfaz ou reduz os contadores de
-- PIN (por conta+tag e por tag) nem levanta o bloqueio antes da hora: PIN certo de OUTRA tag, liberar/trocar outra tag, trocar de
-- pet, criar e remover pet, ativacao pendente (comecar e abandonar), nova sessao, outra conta na mesma tag (o limite de 20 em 24 h
-- soma entre contas), os jobs de limpeza do cron e a exclusao de uma conta. O unico caminho que zera, de proposito, e a reemissao
-- do PIN pelo admin (contracts/admin.contract.md: "gera PIN novo, zera contadores"): provado ao final, com o PIN antigo recusado.
-- Regra 13A: erro de negocio e RETORNO ({"ok":false,"error":...}), conferido com `->> 'error'`.
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; o PIN e gerado na transacao, so no GUC `tests.pin`; nunca escrito no arquivo):
--   tutores A, B, C, D e E (celular confirmado) e o admin ADM. Codigos: vetores sinteticos de contracts/tag-code.vectors.json.
--   T1 ZZZZZZZZ8 = alvo dos erros; T2 ABCDEFGHV, T3 JKMNPQRSR, T4 TVWXYZ01S, T5 1NDAN8EKS, T6 W030F52J1 = "outras tags".
-- Limites de chamada (activate_calls, 30 em 15 min por conta) sao zerados a cada troca de identidade: o limite em si e provado em
-- endurecimento_tags.test.sql; aqui eles nao podem mascarar o que se mede.

BEGIN;

SELECT plan(84);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

CREATE OR REPLACE FUNCTION tests.reset_activate_calls() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM public.rate_limits WHERE scope = 'activate_calls';
$$;
CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT tests.reset_activate_calls(),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('role', 'authenticated', true);
$$;
-- Nova sessao do mesmo usuario (sair e entrar de novo): outro session_id nos claims, mesma identidade.
CREATE OR REPLACE FUNCTION tests.new_session(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT tests.reset_activate_calls(),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated',
                                                           'session_id', gen_random_uuid()::text)::text, true),
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
CREATE OR REPLACE FUNCTION tests.pin() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('tests.pin'); $$;
CREATE OR REPLACE FUNCTION tests.wrong_pin() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN left(current_setting('tests.pin'), 1) = '0' THEN '1' ELSE '0' END || substr(current_setting('tests.pin'), 2);
$$;
-- Estado dos contadores de (tutor, tag): conta, bloqueio da conta, tag, bloqueio da tag. Le como dono (a tabela e fechada).
CREATE OR REPLACE FUNCTION tests.snap(p_tutor uuid, p_tag text) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT 'acct=' || coalesce((SELECT a.fail_count::text FROM public.tag_pin_attempts a
                               WHERE a.tag_code = p_tag::character(9) AND a.tutor_id = p_tutor), 'none')
      || ' acct_lock=' || coalesce((SELECT (a.locked_until IS NOT NULL)::text FROM public.tag_pin_attempts a
                                     WHERE a.tag_code = p_tag::character(9) AND a.tutor_id = p_tutor), 'none')
      || ' tag=' || (SELECT t.pin_fail_count_24h::text FROM public.tag_codes t WHERE t.code = p_tag::character(9))
      || ' tag_lock=' || (SELECT (t.pin_locked_until IS NOT NULL)::text FROM public.tag_codes t WHERE t.code = p_tag::character(9));
$$;
-- Bloqueios exatos (instantes), para provar que nada os encurta nem os empurra.
CREATE OR REPLACE FUNCTION tests.locks(p_tutor uuid, p_tag text) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((SELECT a.locked_until::text FROM public.tag_pin_attempts a
                    WHERE a.tag_code = p_tag::character(9) AND a.tutor_id = p_tutor), 'none') || ' | '
      || coalesce((SELECT t.pin_locked_until::text FROM public.tag_codes t WHERE t.code = p_tag::character(9)), 'none');
$$;
CREATE OR REPLACE FUNCTION tests.audit_count(p_event text, p_tag text) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::integer FROM public.audit_log WHERE event = p_event AND entity_id = p_tag;
$$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT set_config('tests.pin', public.new_activation_pin(), true);
SELECT tests.mk_user('c4c4c4c4-0000-0000-0000-0000000000a1', 'cont.a@faro.test', 'Ana Cont');
SELECT tests.mk_user('c4c4c4c4-0000-0000-0000-0000000000b2', 'cont.b@faro.test', 'Beto Cont');
SELECT tests.mk_user('c4c4c4c4-0000-0000-0000-0000000000c3', 'cont.c@faro.test', 'Caio Cont');
SELECT tests.mk_user('c4c4c4c4-0000-0000-0000-0000000000d4', 'cont.d@faro.test', 'Dara Cont');
SELECT tests.mk_user('c4c4c4c4-0000-0000-0000-0000000000e5', 'cont.e@faro.test', 'Eva Cont');
SELECT tests.mk_user('c4c4c4c4-0000-0000-0000-0000000000ad', 'cont.adm@faro.test', 'Admin Cont');
UPDATE public.perfis SET papel = 'admin' WHERE id = 'c4c4c4c4-0000-0000-0000-0000000000ad';
UPDATE public.perfis SET celular = '+5511900000041', celular_confirmado_em = now() WHERE id = 'c4c4c4c4-0000-0000-0000-0000000000a1';
UPDATE public.perfis SET celular = '+5511900000042', celular_confirmado_em = now() WHERE id = 'c4c4c4c4-0000-0000-0000-0000000000b2';
UPDATE public.perfis SET celular = '+5511900000043', celular_confirmado_em = now() WHERE id = 'c4c4c4c4-0000-0000-0000-0000000000c3';
UPDATE public.perfis SET celular = '+5511900000044', celular_confirmado_em = now() WHERE id = 'c4c4c4c4-0000-0000-0000-0000000000d4';
UPDATE public.perfis SET celular = '+5511900000045', celular_confirmado_em = now() WHERE id = 'c4c4c4c4-0000-0000-0000-0000000000e5';

INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('c4c4c4c4-1111-0000-0000-0000000000a1', 'c4c4c4c4-0000-0000-0000-0000000000a1', 'Rex Cont', 'dog'),
  ('c4c4c4c4-1111-0000-0000-0000000000a2', 'c4c4c4c4-0000-0000-0000-0000000000a1', 'Mel Cont', 'cat'),
  ('c4c4c4c4-1111-0000-0000-0000000000a3', 'c4c4c4c4-0000-0000-0000-0000000000a1', 'Tobi Cont', 'dog'),
  ('c4c4c4c4-1111-0000-0000-0000000000b1', 'c4c4c4c4-0000-0000-0000-0000000000b2', 'Bidu Cont', 'dog'),
  ('c4c4c4c4-1111-0000-0000-0000000000c1', 'c4c4c4c4-0000-0000-0000-0000000000c3', 'Pipoca Cont', 'dog'),
  ('c4c4c4c4-1111-0000-0000-0000000000d1', 'c4c4c4c4-0000-0000-0000-0000000000d4', 'Fred Cont', 'dog'),
  ('c4c4c4c4-1111-0000-0000-0000000000e1', 'c4c4c4c4-0000-0000-0000-0000000000e5', 'Lua Cont', 'cat');

INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-903', 6);
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(current_setting('tests.pin'), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-903', 'available', h.hash, 0
  FROM t_hash h, (VALUES ('ZZZZZZZZ8'), ('ABCDEFGHV'), ('JKMNPQRSR'), ('TVWXYZ01S'), ('1NDAN8EKS'), ('W030F52J1')) AS c (code);

CREATE TEMP TABLE t_mem (k text PRIMARY KEY, v text NOT NULL);
GRANT ALL ON t_mem TO authenticated;

-- ═══════════════ 1. A erra 3x em T1 (alternando de pet: trocar de pet nao reinicia nada) ═══════════════
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'A erra (1) com o pet Rex');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000a2') ->> 'error', 'wrong_pin', 'A erra (2) trocando para o pet Mel');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'A erra (3) voltando ao Rex: trocar de pet nao reinicia o contador');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=3 tag_lock=false', 'estado inicial: 3 erros da conta e 3 da tag');

-- ═══════════════ 2. Caminhos laterais com A (sem bloqueio ainda) ═══════════════
-- 2.1 PIN CERTO de OUTRA tag.
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'ok', 'true', 'A ativa T2 com o PIN certo (outra tag)');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=3 tag_lock=false', 'PIN certo de OUTRA tag nao zera nem reduz os contadores de T1');
-- 2.2 Liberar outra tag.
SELECT is(public.release_tag('ABCDEFGHV', 'released') ->> 'ok', 'true', 'A libera T2');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=3 tag_lock=false', 'liberar OUTRA tag nao mexe nos contadores de T1');
-- 2.3 Trocar a tag de um pet (activate com p_replace): T3 ativa e depois T4 no lugar dela.
SELECT is(public.activate_tag('JKMNPQRSR', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000a2') ->> 'ok', 'true', 'A ativa T3 no pet Mel');
SELECT is(public.activate_tag('TVWXYZ01S', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000a2', true) ->> 'ok', 'true', 'A troca a tag da Mel por T4 (p_replace)');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=3 tag_lock=false', 'trocar a tag de um pet nao mexe nos contadores de T1');
-- 2.4 Criar e remover um pet.
INSERT INTO public.pets (tutor_id, name, species) VALUES ('c4c4c4c4-0000-0000-0000-0000000000a1', 'Efemero', 'dog');
DELETE FROM public.pets WHERE tutor_id = 'c4c4c4c4-0000-0000-0000-0000000000a1' AND name = 'Efemero';
SELECT is((SELECT count(*)::integer FROM public.pets WHERE tutor_id = 'c4c4c4c4-0000-0000-0000-0000000000a1' AND name = 'Efemero'), 0, 'o pet temporario foi criado e removido');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=3 tag_lock=false', 'criar e remover pet nao mexe nos contadores de T1');
-- 2.5 Ativacao pendente: comecar (T1), trocar de ideia (T5) e abandonar.
SELECT is(public.set_pending_activation('ZZZZZZZZ8') ->> 'ok', 'true', 'A comeca a ativacao pendente de T1');
SELECT is(public.get_pending_activation() ->> 'code', 'ZZZZ-ZZZZ-8', 'a ativacao pendente de T1 existe');
SELECT is(public.set_pending_activation('1NDAN8EKS') ->> 'ok', 'true', 'A troca a pendente para T5 e a abandona (nao conclui)');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=3 tag_lock=false', 'comecar e abandonar a ativacao pendente nao mexe nos contadores de T1');
SELECT is(public.clear_pending_activation() ->> 'ok', 'true', 'A limpa a pendente');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=3 tag_lock=false', 'limpar a pendente nao mexe nos contadores de T1');
-- 2.6 Sair e entrar de novo (outra sessao, mesma conta).
SELECT tests.new_session('c4c4c4c4-0000-0000-0000-0000000000a1');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=3 tag_lock=false', 'nova sessao da mesma conta: os contadores continuam (o estado nao fica na sessao)');

-- ═══════════════ 3. Outra conta na mesma tag: soma na tag, nao mexe na conta de A ═══════════════
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000b1') ->> 'error', 'wrong_pin', 'B erra (1) em T1');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000b1') ->> 'error', 'wrong_pin', 'B erra (2) em T1');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000b2', 'ZZZZZZZZ8'), 'acct=2 acct_lock=false tag=5 tag_lock=false', 'B: 2 erros na conta dele; a tag soma 5 (3 de A + 2 de B)');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=3 acct_lock=false tag=5 tag_lock=false', 'a conta de A continua em 3: os erros de B nao a alteram');

-- ═══════════════ 4. A chega ao bloqueio (5 erros); depois nada o desfaz ═══════════════
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'A erra (4)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'error', 'locked', 'A erra (5): a conta fica bloqueada nesta tag');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=5 acct_lock=true tag=7 tag_lock=false', 'A: 5 erros, conta bloqueada; tag em 7');
INSERT INTO t_mem VALUES ('locks_a', tests.locks('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'));
-- PIN CERTO durante o bloqueio: recusado, sem mudar contador nem bloqueio.
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'error', 'locked', 'PIN certo durante o bloqueio da conta: locked');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=5 acct_lock=true tag=7 tag_lock=false', 'PIN certo recusado nao reduz os contadores');
SELECT is(tests.locks('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), (SELECT v FROM t_mem WHERE k = 'locks_a'), 'o instante do bloqueio nao mudou');

-- Todos os caminhos laterais, agora COM o bloqueio de pe.
SELECT is(public.activate_tag('W030F52J1', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000a3') ->> 'ok', 'true', 'bloqueada em T1, A ativa T6 (outra tag) com o PIN certo');
SELECT is(public.release_tag('W030F52J1', 'transferred') ->> 'ok', 'true', 'A libera T6 (transferred)');
INSERT INTO public.pets (tutor_id, name, species) VALUES ('c4c4c4c4-0000-0000-0000-0000000000a1', 'Efemero2', 'cat');
DELETE FROM public.pets WHERE tutor_id = 'c4c4c4c4-0000-0000-0000-0000000000a1' AND name = 'Efemero2';
SELECT is(public.set_pending_activation('ZZZZZZZZ8') ->> 'ok', 'true', 'A comeca a pendente de T1 com o bloqueio de pe');
SELECT tests.new_session('c4c4c4c4-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'error', 'locked', 'nova sessao: o PIN certo continua recusado (bloqueio e da conta, nao da sessao)');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=5 acct_lock=true tag=7 tag_lock=false', 'depois dos caminhos laterais, A segue em 5 erros e bloqueada');
SELECT is(tests.locks('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), (SELECT v FROM t_mem WHERE k = 'locks_a'), 'o bloqueio de A nao foi encurtado nem estendido pelos caminhos laterais');
-- Outra conta tentando a mesma tag durante o bloqueio de A.
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000e5');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000e1') ->> 'error', 'wrong_pin', 'E (conta nova) erra uma vez em T1 durante o bloqueio de A');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=5 acct_lock=true tag=8 tag_lock=false', 'a tag soma 8 (7 + 1 de E); A continua em 5 e bloqueada');

-- ═══════════════ 5. Jobs do cron (limpeza) ═══════════════
RESET ROLE;
INSERT INTO public.rate_limits (scope, key, window_start, count) VALUES
  ('qa_cron', 'dentro-da-janela', now() - interval '47 hours', 1),
  ('qa_cron', 'fora-da-janela', now() - interval '49 hours', 1);
INSERT INTO public.pending_activations (tutor_id, tag_code, created_at, expires_at)
VALUES ('c4c4c4c4-0000-0000-0000-0000000000d4', '1NDAN8EKS', now() - interval '8 days', now() - interval '1 day');
SELECT public.cron_cleanup_tags();
SELECT public.cron_resend_scan_notices();
SELECT is((SELECT count(*)::integer FROM public.rate_limits WHERE scope = 'qa_cron' AND key = 'fora-da-janela'), 0, 'controle: o job de limpeza roda e apaga o que passou de 48 h');
SELECT is((SELECT count(*)::integer FROM public.rate_limits WHERE scope = 'qa_cron' AND key = 'dentro-da-janela'), 1, 'o job nao apaga linha de limite dentro da janela de 48 h');
SELECT is((SELECT count(*)::integer FROM public.pending_activations WHERE tutor_id = 'c4c4c4c4-0000-0000-0000-0000000000d4'), 0, 'o job apaga a ativacao pendente vencida');
SELECT is((SELECT count(*)::integer FROM public.pending_activations WHERE tutor_id = 'c4c4c4c4-0000-0000-0000-0000000000a1'), 1, 'e mantem a pendente vigente de A');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=5 acct_lock=true tag=8 tag_lock=false', 'cron_cleanup_tags e cron_resend_scan_notices nao tocam nos contadores de PIN');
SELECT is(tests.locks('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), (SELECT v FROM t_mem WHERE k = 'locks_a'), 'nem no instante do bloqueio');
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tag_code = 'ZZZZZZZZ8'), 3, 'as 3 linhas de tentativas (A, B, E) continuam');

-- ═══════════════ 6. O limite POR TAG soma entre contas: 20 erros em 24 h travam a tag para todos ═══════════════
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000b1') ->> 'error', 'wrong_pin', 'B erra (3)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000b1') ->> 'error', 'wrong_pin', 'B erra (4)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000b1') ->> 'error', 'locked', 'B erra (5): conta de B bloqueada');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000b2', 'ZZZZZZZZ8'), 'acct=5 acct_lock=true tag=11 tag_lock=false', 'B bloqueado; a tag soma 11');
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000c3');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000c1') ->> 'error', 'wrong_pin', 'C erra (1)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000c1') ->> 'error', 'wrong_pin', 'C erra (2)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000c1') ->> 'error', 'wrong_pin', 'C erra (3)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000c1') ->> 'error', 'wrong_pin', 'C erra (4)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000c1') ->> 'error', 'locked', 'C erra (5): conta de C bloqueada');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000c3', 'ZZZZZZZZ8'), 'acct=5 acct_lock=true tag=16 tag_lock=false', 'C bloqueado; a tag soma 16');
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000d4');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000d1') ->> 'error', 'wrong_pin', 'D erra (1)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000d1') ->> 'error', 'wrong_pin', 'D erra (2)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000d1') ->> 'error', 'wrong_pin', 'D erra (3)');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.wrong_pin(), 'c4c4c4c4-1111-0000-0000-0000000000d1') ->> 'error', 'locked', 'D erra (4): o 20o erro da tag trava a tag para todos (24 h)');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000d4', 'ZZZZZZZZ8'), 'acct=4 acct_lock=false tag=20 tag_lock=true', 'D com so 4 erros na conta, mas a tag chegou a 20 e travou');
-- Conta que nunca errou, com o PIN CERTO: recusada pelo bloqueio da tag; a recusa nao mexe em nada.
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000e5');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000e1') ->> 'error', 'locked', 'PIN certo de uma conta com 1 erro, durante o bloqueio da TAG: locked');
SELECT is((public.activate_tag('ZZZZZZZZ8', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000e1') ->> 'retry_after_seconds')::integer > 3600, true, 'o retry_after do bloqueio da tag e de horas (24 h), nao de minutos');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000e5', 'ZZZZZZZZ8'), 'acct=1 acct_lock=false tag=20 tag_lock=true', 'a recusa por bloqueio nao altera a conta de E nem a tag');
SELECT is(tests.audit_count('activation_locked_account', 'ZZZZZZZZ8'), 3, 'auditoria: 3 bloqueios de conta (A, B, C)');
SELECT is(tests.audit_count('activation_locked_tag', 'ZZZZZZZZ8'), 1, 'auditoria: 1 bloqueio da tag');

-- ═══════════════ 6b. Os mesmos caminhos laterais e o cron, agora com a TAG travada (24 h) ═══════════════
RESET ROLE;
INSERT INTO t_mem VALUES ('locks_tag', tests.locks('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'));
SELECT public.cron_cleanup_tags();
SELECT public.cron_resend_scan_notices();
SELECT is(tests.locks('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), (SELECT v FROM t_mem WHERE k = 'locks_tag'), 'tag travada: o cron nao mexe nos instantes de bloqueio');
SELECT is((SELECT array_agg(jobname ORDER BY jobname)::text FROM cron.job), '{faro-cleanup-tags,faro-resend-scan-notices}', 'o cron tem so os 2 jobs conhecidos (nenhum outro job pode mexer nos contadores)');
SELECT is((SELECT count(*)::integer FROM cron.job WHERE command !~ '^SELECT public\.cron_(cleanup_tags|resend_scan_notices)\(\)$'), 0, 'e os dois so chamam as funcoes cron_cleanup_tags e cron_resend_scan_notices');
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('1NDAN8EKS', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000a3') ->> 'ok', 'true', 'tag travada: A ativa T5 (outra tag, PIN original) com o PIN certo');
SELECT is(public.release_tag('1NDAN8EKS', 'released') ->> 'ok', 'true', 'e libera T5 de novo');
SELECT tests.new_session('c4c4c4c4-0000-0000-0000-0000000000a1');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=5 acct_lock=true tag=20 tag_lock=true', 'tag travada: contadores e bloqueios iguais depois dos caminhos laterais');
SELECT is(tests.locks('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), (SELECT v FROM t_mem WHERE k = 'locks_tag'), 'e os instantes de bloqueio nao mudaram');

-- ═══════════════ 7. Excluir uma conta zera a conta dela, mas NAO o contador da tag ═══════════════
RESET ROLE;
DELETE FROM auth.users WHERE id = 'c4c4c4c4-0000-0000-0000-0000000000c3';
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tag_code = 'ZZZZZZZZ8' AND tutor_id = 'c4c4c4c4-0000-0000-0000-0000000000c3'), 0, 'a linha de tentativas da conta excluida sai (cascata): o contador POR CONTA e reiniciavel por excluir e recriar a conta');
SELECT is((SELECT pin_fail_count_24h::text || '/' || (pin_locked_until IS NOT NULL)::text FROM public.tag_codes WHERE code = 'ZZZZZZZZ8'), '20/true', 'mas o contador da TAG e o bloqueio dela ficam (a salvaguarda contra recriar contas)');

-- ═══════════════ 8. Reemissao do PIN pelo admin: o UNICO caminho que zera, de proposito ═══════════════
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000ad');
SELECT is(public.admin_reissue_pin('ZZZZZZZZ8') ->> 'ok', 'true', 'o admin reemite o PIN de T1 (disponivel e travada)');
-- guarda o PIN novo no GUC da transacao (nunca escrito no arquivo)
SELECT set_config('tests.newpin', (public.admin_reissue_pin('ZZZZZZZZ8') ->> 'new_pin'), true);
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=none acct_lock=none tag=0 tag_lock=false', 'a reemissao zera tentativas de TODAS as contas e o bloqueio da tag (contrato: "gera PIN novo, zera contadores")');
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tag_code = 'ZZZZZZZZ8'), 0, 'e nao sobra nenhuma linha de tentativas da tag');
SELECT is(length(current_setting('tests.newpin')), 6, 'o PIN novo tem 6 caracteres');
SELECT isnt(current_setting('tests.newpin'), current_setting('tests.pin'), 'e e diferente do antigo');
SELECT tests.set_auth_uid('c4c4c4c4-0000-0000-0000-0000000000a1');
SELECT is(public.activate_tag('ZZZZZZZZ8', tests.pin(), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'error', 'wrong_pin', 'depois da reemissao, o PIN ANTIGO (mesmo o que era certo) e recusado');
SELECT is(tests.snap('c4c4c4c4-0000-0000-0000-0000000000a1', 'ZZZZZZZZ8'), 'acct=1 acct_lock=false tag=1 tag_lock=false', 'e conta como erro 1 (contadores recomecam do zero)');
SELECT is(public.activate_tag('ZZZZZZZZ8', current_setting('tests.newpin'), 'c4c4c4c4-1111-0000-0000-0000000000a1') ->> 'ok', 'true', 'o PIN novo ativa a tag');
-- Auditoria da reemissao: sem PIN nenhum.
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'pin_reissued' AND entity_id = 'ZZZZZZZZ8'
            AND detail = '{}'::jsonb), 2, 'pin_reissued gravado com detalhe vazio (sem PIN)');
SELECT is((SELECT count(*)::integer FROM public.audit_log
            WHERE entity_id = 'ZZZZZZZZ8' AND (detail::text LIKE '%' || current_setting('tests.pin') || '%'
                                                OR detail::text LIKE '%' || current_setting('tests.newpin') || '%')), 0,
          'nenhum evento da tag guarda o PIN antigo nem o novo');

SELECT * FROM finish();
ROLLBACK;
