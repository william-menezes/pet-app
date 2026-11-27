-- pgTAP: rpc_release_tag.test.sql
-- Spec 003-tag-qr, T087 (feito quando: pgTAP cobre os itens do contrato e o isolamento apos a troca de dono).
-- Migrations 0031 (release_tag, request_tag_replacement, gatilho pets_guard_delete) e 0035 (teto de 3 pedidos abertos).
-- Regra 13A: erro de negocio e RETORNO ({"ok":false,"error":...}), conferido com `->> 'error'`; throws_ok so para o que NAO e
-- erro de negocio (p_reason e p_kind invalidos, e os gatilhos de tabela).
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; um PIN gerado AGORA, so no GUC `tests.pin`):
--   tutores A e B com celular confirmado, D com um pet e a tag T9. A: Rex (T1), Mel (T3), Tobi (T4), Pipa (T5), Lua (T6),
--   Kiko (T8, tag bloqueada) e Zeca (sem tag). B: Bidu (T2) e Nina (sem tag).

BEGIN;

SELECT plan(67);

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
SELECT tests.mk_user('f7f7f7f7-0000-0000-0000-0000000000a1', 'libera.a@faro.test', 'Ana Libera');
SELECT tests.mk_user('f7f7f7f7-0000-0000-0000-0000000000b2', 'libera.b@faro.test', 'Beto Libera');
SELECT tests.mk_user('f7f7f7f7-0000-0000-0000-0000000000d4', 'libera.d@faro.test', 'Duda Libera');
UPDATE public.perfis SET celular = '+5511900000071', celular_confirmado_em = now() WHERE id = 'f7f7f7f7-0000-0000-0000-0000000000a1';
UPDATE public.perfis SET celular = '+5511900000072', celular_confirmado_em = now() WHERE id = 'f7f7f7f7-0000-0000-0000-0000000000b2';
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('f7f7f7f7-1111-0000-0000-000000000001', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'Rex Libera', 'dog'),
  ('f7f7f7f7-1111-0000-0000-000000000002', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'Mel Libera', 'cat'),
  ('f7f7f7f7-1111-0000-0000-000000000003', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'Tobi Libera', 'dog'),
  ('f7f7f7f7-1111-0000-0000-000000000004', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'Pipa Libera', 'dog'),
  ('f7f7f7f7-1111-0000-0000-000000000005', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'Lua Libera', 'cat'),
  ('f7f7f7f7-1111-0000-0000-000000000006', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'Kiko Libera', 'dog'),
  ('f7f7f7f7-1111-0000-0000-000000000007', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'Zeca Libera', 'dog'),
  ('f7f7f7f7-1111-0000-0000-000000000008', 'f7f7f7f7-0000-0000-0000-0000000000b2', 'Bidu Libera', 'dog'),
  ('f7f7f7f7-1111-0000-0000-000000000009', 'f7f7f7f7-0000-0000-0000-0000000000b2', 'Nina Libera', 'cat'),
  ('f7f7f7f7-1111-0000-0000-00000000000d', 'f7f7f7f7-0000-0000-0000-0000000000d4', 'Dino Libera', 'dog');
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-908', 9);
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(current_setting('tests.pin'), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-908', c.status, h.hash, 0
  FROM t_hash h, (VALUES ('ABCDEFGHV', 'assigned'), ('ZZZZZZZZ8', 'assigned'), ('JKMNPQRSR', 'assigned'), ('TVWXYZ01S', 'assigned'),
                         ('0123456Z3', 'assigned'), ('1NDAN8EKS', 'assigned'), ('BZCH5NVX1', 'blocked'), ('00000001Y', 'assigned')) AS c (code, status);
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id) VALUES
  ('f7f7f7f7-2222-0000-0000-000000000001', 'ABCDEFGHV', 'f7f7f7f7-1111-0000-0000-000000000001', 'f7f7f7f7-0000-0000-0000-0000000000a1'),
  ('f7f7f7f7-2222-0000-0000-000000000002', 'ZZZZZZZZ8', 'f7f7f7f7-1111-0000-0000-000000000008', 'f7f7f7f7-0000-0000-0000-0000000000b2'),
  ('f7f7f7f7-2222-0000-0000-000000000003', 'JKMNPQRSR', 'f7f7f7f7-1111-0000-0000-000000000002', 'f7f7f7f7-0000-0000-0000-0000000000a1'),
  ('f7f7f7f7-2222-0000-0000-000000000004', 'TVWXYZ01S', 'f7f7f7f7-1111-0000-0000-000000000003', 'f7f7f7f7-0000-0000-0000-0000000000a1'),
  ('f7f7f7f7-2222-0000-0000-000000000005', '0123456Z3', 'f7f7f7f7-1111-0000-0000-000000000004', 'f7f7f7f7-0000-0000-0000-0000000000a1'),
  ('f7f7f7f7-2222-0000-0000-000000000006', '1NDAN8EKS', 'f7f7f7f7-1111-0000-0000-000000000005', 'f7f7f7f7-0000-0000-0000-0000000000a1'),
  ('f7f7f7f7-2222-0000-0000-000000000008', 'BZCH5NVX1', 'f7f7f7f7-1111-0000-0000-000000000006', 'f7f7f7f7-0000-0000-0000-0000000000a1'),
  ('f7f7f7f7-2222-0000-0000-000000000009', '00000001Y', 'f7f7f7f7-1111-0000-0000-00000000000d', 'f7f7f7f7-0000-0000-0000-0000000000d4');
UPDATE public.rescue_profiles SET lost_mode = true, lost_since = now(), lost_message = 'recado' WHERE pet_id = 'f7f7f7f7-1111-0000-0000-000000000001';
-- Dois scans do vinculo da Ana na T1 (antes de passar a tag adiante).
INSERT INTO public.scan_events (tag_code, assignment_id, status_at_scan, ip_hash, geo_method, city) VALUES
  ('ABCDEFGHV', 'f7f7f7f7-2222-0000-0000-000000000001', 'assigned', 'ip-lib-1', 'ip', 'Santos'),
  ('ABCDEFGHV', 'f7f7f7f7-2222-0000-0000-000000000001', 'assigned', 'ip-lib-2', 'ip', 'Santos');
CREATE TEMP TABLE t_res (k text PRIMARY KEY, r jsonb NOT NULL);
GRANT ALL ON t_res TO authenticated;

-- ═══════════════ release_tag: erros ═══════════════

SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
INSERT INTO t_res VALUES ('outra', public.release_tag('ZZZZZZZZ8', 'released'));
INSERT INTO t_res VALUES ('inexistente', public.release_tag('H8ZWE5XGH', 'released'));
SELECT is((SELECT r ->> 'error' FROM t_res WHERE k = 'outra'), 'not_owner', 'release: tag de OUTRO tutor: not_owner');
SELECT is((SELECT r FROM t_res WHERE k = 'inexistente'), (SELECT r FROM t_res WHERE k = 'outra'), 'release: tag inexistente: a MESMA resposta de uma tag de outra pessoa');
SELECT is(public.release_tag('7K3MQ9XAD', 'released') ->> 'error', 'invalid_code', 'release: digito invalido: invalid_code');
SELECT is(public.release_tag(NULL, 'released') ->> 'error', 'invalid_code', 'release: codigo nulo: invalid_code');
SELECT throws_ok($$ SELECT public.release_tag('ABCDEFGHV', 'lost') $$, 'P0001', 'release_tag: p_reason invalido', 'release: motivo fora de released/transferred e erro de programacao');
SELECT throws_ok($$ SELECT public.release_tag('ABCDEFGHV', NULL) $$, 'P0001', 'release_tag: p_reason invalido', 'release: motivo nulo e erro de programacao');
RESET ROLE;
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'assigned', 'os erros nao mexem na tag');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'ZZZZZZZZ8' AND ended_at IS NULL), 1, 'o vinculo do outro tutor segue intacto');

-- ═══════════════ release_tag: sucesso (passar adiante) ═══════════════

SELECT set_config('tests.old_pin', tests.pin(), true);
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
INSERT INTO t_res VALUES ('rel', public.release_tag('abcd-efgh-v', 'transferred'));
RESET ROLE;
SELECT set_config('tests.pin', (SELECT r ->> 'new_pin' FROM t_res WHERE k = 'rel'), true);
SELECT is((SELECT r ->> 'ok' || ':' || (r ->> 'code') FROM t_res WHERE k = 'rel'), 'true:ABCD-EFGH-V', 'release: ok e codigo no formato de exibicao (aceita minusculas e hifen)');
SELECT ok(tests.pin() ~ '^[0-9A-HJKMNP-TV-Z]{6}$', 'release: devolve o PIN novo em claro (6 caracteres Crockford)');
SELECT isnt(tests.pin(), current_setting('tests.old_pin'), 'release: o PIN novo e diferente do anterior');
SELECT is((SELECT (SELECT array_agg(kk ORDER BY kk) FROM jsonb_object_keys(r) kk) FROM t_res WHERE k = 'rel'), ARRAY['code', 'new_pin', 'ok'], 'release: a resposta tem so ok, code e new_pin');
SELECT is((SELECT end_reason FROM public.tag_assignments WHERE id = 'f7f7f7f7-2222-0000-0000-000000000001'), 'transferred', 'release: o vinculo termina com o motivo pedido');
SELECT ok((SELECT ended_at IS NOT NULL FROM public.tag_assignments WHERE id = 'f7f7f7f7-2222-0000-0000-000000000001'), 'release: o vinculo foi encerrado');
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'available', 'release: a tag volta a available');
SELECT ok((SELECT activation_pin_hash ~ '^\$2[abxy]\$12\$' AND extensions.crypt(tests.pin(), activation_pin_hash) = activation_pin_hash FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'release: grava so o hash (bcrypt custo 12) do PIN novo');
SELECT ok((SELECT extensions.crypt(current_setting('tests.old_pin'), activation_pin_hash) <> activation_pin_hash FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'release: o PIN antigo deixa de conferir');
SELECT is((SELECT lost_mode::text || ':' || coalesce(lost_since::text, 'nulo') FROM public.rescue_profiles WHERE pet_id = 'f7f7f7f7-1111-0000-0000-000000000001'), 'false:nulo', 'release: desliga o modo perdido do pet');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'tag_released' AND entity_id = 'ABCDEFGHV' AND detail = '{"reason": "transferred"}'::jsonb), 1, 'release: grava tag_released com o motivo e mais nada');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE detail::text LIKE '%' || tests.pin() || '%' OR detail::text LIKE '%' || current_setting('tests.old_pin') || '%'), 0, 'o PIN (novo ou antigo) nunca aparece na auditoria');
SELECT is((SELECT (r::text ~* 'activation_pin_hash|\$2[abxy]\$') FROM t_res WHERE k = 'rel'), false, 'a resposta nao traz o hash do PIN');

-- Quem nao e mais dono nao libera de novo, e a resposta continua a mesma.
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
SELECT is(public.release_tag('ABCDEFGHV', 'released') ->> 'error', 'not_owner', 'release: depois de liberar, a tutora nao e mais dona (not_owner)');
RESET ROLE;

-- ═══════════════ Troca de dono: o PIN antigo falha, o novo ativa uma vez, e os scans ficam isolados ═══════════════

SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('ABCDEFGHV', current_setting('tests.old_pin'), 'f7f7f7f7-1111-0000-0000-000000000009') ->> 'error', 'wrong_pin', 'troca: o PIN ANTIGO falha na ativacao do novo tutor');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'f7f7f7f7-1111-0000-0000-000000000009') ->> 'ok', 'true', 'troca: o PIN NOVO ativa para o novo tutor');
RESET ROLE;
INSERT INTO public.scan_events (tag_code, assignment_id, status_at_scan, ip_hash, geo_method, city)
SELECT 'ABCDEFGHV', a.id, 'assigned', 'ip-lib-3', 'ip', 'Curitiba'
  FROM public.tag_assignments a WHERE a.tag_code = 'ABCDEFGHV' AND a.ended_at IS NULL;
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE tag_code = 'ABCDEFGHV'), 1, 'isolamento: o novo dono le so o scan do vinculo dele');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE city = 'Santos'), 0, 'isolamento: o novo dono nao le os scans antigos');
SELECT is(public.activate_tag('ABCDEFGHV', tests.pin(), 'f7f7f7f7-1111-0000-0000-000000000009') ->> 'error', 'tag_unavailable', 'troca: o PIN novo vale uma vez (a tag ja esta vinculada)');
RESET ROLE;
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE tag_code = 'ABCDEFGHV'), 2, 'isolamento: a tutora anterior le so os 2 scans do vinculo dela');
SELECT is((SELECT count(*)::integer FROM public.my_scans WHERE city = 'Curitiba'), 0, 'isolamento: a tutora anterior nao le o scan do novo dono');
RESET ROLE;

-- Tag bloqueada: liberar encerra o vinculo mas NAO desbloqueia.
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
SELECT is(public.release_tag('BZCH5NVX1', 'released') ->> 'ok', 'true', 'release de tag bloqueada: ok');
RESET ROLE;
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'BZCH5NVX1'), 'blocked', 'release de tag bloqueada: continua bloqueada');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = 'BZCH5NVX1' AND ended_at IS NULL), 0, 'release de tag bloqueada: o vinculo foi encerrado');

-- ═══════════════ request_tag_replacement ═══════════════

SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
SELECT is(public.request_tag_replacement('ZZZZZZZZ8', 'damaged') ->> 'error', 'not_owner', 'segunda via: tag de outro tutor: not_owner');
SELECT is(public.request_tag_replacement('H8ZWE5XGH', 'lost') ->> 'error', 'not_owner', 'segunda via: tag inexistente: not_owner');
SELECT is(public.request_tag_replacement('7K3MQ9XAD', 'lost') ->> 'error', 'invalid_code', 'segunda via: digito invalido: invalid_code');
SELECT throws_ok($$ SELECT public.request_tag_replacement('JKMNPQRSR', 'outro') $$, 'P0001', 'request_tag_replacement: p_kind invalido', 'segunda via: tipo invalido e erro de programacao');
INSERT INTO t_res VALUES ('dam', public.request_tag_replacement('JKMNPQRSR', 'damaged'));
INSERT INTO t_res VALUES ('lost', public.request_tag_replacement('TVWXYZ01S', 'lost'));
RESET ROLE;
SELECT ok((SELECT (r ->> 'request_id')::uuid IS NOT NULL AND (r ->> 'ok') = 'true' FROM t_res WHERE k = 'dam'), 'danificada: ok e request_id');
SELECT is((SELECT kind || ':' || status FROM public.tag_replacement_requests WHERE id = (SELECT (r ->> 'request_id')::uuid FROM t_res WHERE k = 'dam')), 'damaged:open', 'danificada: pedido aberto');
SELECT is((SELECT t.status || ':' || (SELECT count(*) FROM public.tag_assignments a WHERE a.tag_code = t.code AND a.ended_at IS NULL) FROM public.tag_codes t WHERE t.code = 'JKMNPQRSR'), 'assigned:1', 'danificada: a tag continua assigned e o vinculo ativo (o MESMO codigo sera reimpresso)');
SELECT tests.set_service();
SELECT is(public.resolve_tag('JKMNPQRSR', 'ip-lib-x') ->> 'state', 'assigned', 'danificada: a pagina publica continua mostrando o resgate');
RESET ROLE;
SELECT is((SELECT kind || ':' || status FROM public.tag_replacement_requests WHERE id = (SELECT (r ->> 'request_id')::uuid FROM t_res WHERE k = 'lost')), 'lost:open', 'perdida: pedido aberto');
SELECT is((SELECT t.status FROM public.tag_codes t WHERE t.code = 'TVWXYZ01S'), 'void', 'perdida: o codigo e anulado na hora (void)');
SELECT is((SELECT end_reason FROM public.tag_assignments WHERE id = 'f7f7f7f7-2222-0000-0000-000000000004'), 'lost', 'perdida: o vinculo termina com lost');
SELECT tests.set_service();
SELECT is(public.resolve_tag('TVWXYZ01S', 'ip-lib-y') ->> 'state', 'not_found', 'perdida: o endereco antigo passa a responder "nao encontrada"');
RESET ROLE;
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000b2');
SELECT is(public.activate_tag('TVWXYZ01S', tests.pin(), 'f7f7f7f7-1111-0000-0000-000000000009', true) ->> 'error', 'tag_unavailable', 'perdida: ninguem reativa um codigo anulado (void e irreversivel)');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'replacement_requested' AND detail ->> 'kind' IN ('damaged', 'lost') AND entity_id IN ('JKMNPQRSR', 'TVWXYZ01S')), 2, 'segunda via: grava replacement_requested dos dois pedidos');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'tag_status_changed' AND entity_id = 'TVWXYZ01S' AND detail ->> 'to' = 'void'), 1, 'perdida: grava tag_status_changed para void');

-- Teto de 3 pedidos abertos por tutor: 2 abertos ate aqui; o terceiro entra, o quarto e recusado.
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
SELECT is(public.request_tag_replacement('0123456Z3', 'damaged') ->> 'ok', 'true', 'teto: o 3o pedido aberto entra');
SELECT is(public.request_tag_replacement('1NDAN8EKS', 'damaged') ->> 'error', 'replacement_limit', 'teto: o 4o pedido aberto e recusado (replacement_limit)');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_replacement_requests WHERE tutor_id = 'f7f7f7f7-0000-0000-0000-0000000000a1' AND status = 'open'), 3, 'teto: ficam 3 pedidos abertos');
SELECT throws_ok($$ INSERT INTO public.tag_replacement_requests (tag_code, pet_id, tutor_id, kind) VALUES ('1NDAN8EKS', 'f7f7f7f7-1111-0000-0000-000000000005', 'f7f7f7f7-0000-0000-0000-0000000000a1', 'damaged') $$, 'P0001', 'replacement_limit', 'teto: o gatilho do banco tambem recusa o 4o (defesa em profundidade)');
-- Fechar um pedido libera vaga.
UPDATE public.tag_replacement_requests SET status = 'done', resolved_at = now() WHERE id = (SELECT (r ->> 'request_id')::uuid FROM t_res WHERE k = 'dam');
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
SELECT is(public.request_tag_replacement('1NDAN8EKS', 'damaged') ->> 'ok', 'true', 'teto: com um pedido fechado, entra de novo');
RESET ROLE;

-- ═══════════════ Defesa no banco: pet com tag ativa nao e apagado ═══════════════

SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
SELECT throws_ok($$ DELETE FROM public.pets WHERE id = 'f7f7f7f7-1111-0000-0000-000000000004' $$, 'P0001', 'pet_has_active_tag', 'apagar pet com tag ativa: recusado (pet_has_active_tag)');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.pets WHERE id = 'f7f7f7f7-1111-0000-0000-000000000004'), 1, 'o pet continua existindo');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE pet_id = 'f7f7f7f7-1111-0000-0000-000000000004' AND ended_at IS NULL), 1, 'e o vinculo continua ativo (nenhum vinculo orfao)');
SELECT tests.set_auth_uid('f7f7f7f7-0000-0000-0000-0000000000a1');
SELECT lives_ok($$ DELETE FROM public.pets WHERE id = 'f7f7f7f7-1111-0000-0000-000000000007' $$, 'apagar pet SEM tag: permitido');
SELECT is(public.release_tag('0123456Z3', 'released') ->> 'ok', 'true', 'liberar a tag da Pipa');
SELECT lives_ok($$ DELETE FROM public.pets WHERE id = 'f7f7f7f7-1111-0000-0000-000000000004' $$, 'depois de liberar a tag, o pet pode ser apagado');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code = '0123456Z3' AND ended_at IS NOT NULL AND pet_id IS NULL), 1, 'o historico do vinculo encerrado sobrevive ao pet apagado (pet_id nulo)');
-- Exclusao em cascata da conta (a 004 encerra os vinculos antes; o gatilho nao atrapalha o cascade do auth.users).
SELECT lives_ok($$ DELETE FROM auth.users WHERE id = 'f7f7f7f7-0000-0000-0000-0000000000d4' $$, 'excluir a conta em cascata nao e barrado pelo gatilho de pet com tag');
SELECT is((SELECT count(*)::integer FROM public.pets WHERE tutor_id = 'f7f7f7f7-0000-0000-0000-0000000000d4'), 0, 'os pets da conta excluida sairam');

-- ═══════════════ Privilegios e estrutura ═══════════════

SELECT tests.set_anon();
SELECT is(tests.denied($$ SELECT public.release_tag('ABCDEFGHV', 'released') $$), true, 'anon nao executa release_tag');
SELECT is(tests.denied($$ SELECT public.request_tag_replacement('ABCDEFGHV', 'lost') $$), true, 'anon nao executa request_tag_replacement');
RESET ROLE;
SELECT is(has_function_privilege('authenticated', 'public.release_tag(text,text)', 'EXECUTE') AND has_function_privilege('authenticated', 'public.request_tag_replacement(text,text)', 'EXECUTE'), true, 'authenticated executa as duas RPCs');
SELECT is((SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp']) FROM pg_proc WHERE proname IN ('release_tag', 'request_tag_replacement', 'pets_guard_delete', 'pets_guard_limit', 'replacement_requests_guard_limit')), true, 'todas security definer com search_path fixo');
SELECT is((SELECT count(*)::integer FROM regexp_matches((SELECT prosrc FROM pg_proc WHERE oid = 'public.release_tag(text,text)'::regprocedure), 'RAISE EXCEPTION', 'g')), 1, 'estrutural (13A): release_tag so lanca excecao para p_reason invalido (erro de programacao)');
SELECT is((SELECT count(*)::integer FROM regexp_matches((SELECT prosrc FROM pg_proc WHERE oid = 'public.request_tag_replacement(text,text)'::regprocedure), 'RAISE EXCEPTION', 'g')), 1, 'estrutural (13A): request_tag_replacement so lanca excecao para p_kind invalido');

SELECT * FROM finish();
ROLLBACK;
