-- pgTAP: rpc_register_scan.test.sql
-- Spec 003-tag-qr, T050 (feito quando: pgTAP cobre novo scan, duplicado e dono) e T053 (os jobs aparecem em cron.job).
-- Migrations 0030 (register_scan, set_scan_location, scan_notices_pending, scan_notice_sent) e 0033.
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; nenhum PIN):
--   tutora A (celular confirmado) com o pet Rex e a tag ABCDEFGHV; tutor B com Bidu e a tag 00000001Y BLOQUEADA com vinculo
--   ativo; ZZZZZZZZ8 disponivel; JKMNPQRSR bloqueada sem vinculo; TVWXYZ01S anulada; H8ZWE5XGH nao existe.
-- `ip_hash` aqui e um rotulo (a Edge Function recebe o HMAC pronto do servidor SSR; nunca o IP).

BEGIN;

SELECT plan(100);

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
CREATE OR REPLACE FUNCTION tests.sha(p_t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT encode(extensions.digest(p_t, 'sha256'), 'hex'); $$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT tests.mk_user('e3e3e3e3-0000-0000-0000-0000000000a1', 'scan.a@faro.test', 'Ana Scan Silva');
SELECT tests.mk_user('e3e3e3e3-0000-0000-0000-0000000000b2', 'scan.b@faro.test', 'Beto Scan');
UPDATE public.perfis SET nome = 'Ana Scan Silva', celular = '+5511900000041', celular_confirmado_em = now() WHERE id = 'e3e3e3e3-0000-0000-0000-0000000000a1';
UPDATE public.perfis SET nome = 'Beto Scan' WHERE id = 'e3e3e3e3-0000-0000-0000-0000000000b2';
INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('e3e3e3e3-1111-0000-0000-000000000001', 'e3e3e3e3-0000-0000-0000-0000000000a1', 'Rex Scan', 'dog'),
  ('e3e3e3e3-1111-0000-0000-000000000002', 'e3e3e3e3-0000-0000-0000-0000000000b2', 'Bidu Scan', 'dog');
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-905', 6);
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(public.new_activation_pin(), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-905', c.status, h.hash, 0
  FROM t_hash h, (VALUES ('ABCDEFGHV', 'assigned'), ('ZZZZZZZZ8', 'available'), ('JKMNPQRSR', 'blocked'),
                         ('TVWXYZ01S', 'void'), ('00000001Y', 'blocked')) AS c (code, status);
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id, started_at) VALUES
  ('e3e3e3e3-2222-0000-0000-00000000000a', 'ABCDEFGHV', 'e3e3e3e3-1111-0000-0000-000000000001', 'e3e3e3e3-0000-0000-0000-0000000000a1', now() - interval '5 days'),
  ('e3e3e3e3-2222-0000-0000-00000000000b', '00000001Y', 'e3e3e3e3-1111-0000-0000-000000000002', 'e3e3e3e3-0000-0000-0000-0000000000b2', now() - interval '4 days');

CREATE TEMP TABLE t_res (k text PRIMARY KEY, r jsonb NOT NULL);
GRANT ALL ON t_res TO service_role;
-- Token (texto) guardado na entrada `k` da tabela de respostas (criada antes: o corpo da funcao SQL e validado ao criar).
CREATE OR REPLACE FUNCTION tests.tok(p_k text) RETURNS text LANGUAGE sql STABLE AS $ SELECT r ->> 'scan_token' FROM t_res WHERE k = p_k; $;

-- ═══════════════ Scan novo ═══════════════

SELECT tests.set_service();
INSERT INTO t_res VALUES ('s1', public.register_scan('ABCDEFGHV', 'h-1', NULL, -23.55, -46.63, 'São Paulo', 'SP'));
RESET ROLE;

SELECT is((SELECT r ->> 'recorded' || ':' || (r ->> 'duplicate') || ':' || (r ->> 'owner') FROM t_res WHERE k = 's1'), 'true:false:false', 'scan novo: recorded, nao duplicado, nao dono');
SELECT ok((SELECT tests.tok('s1') ~ '^[0-9a-f]{64}$'), 'scan novo: devolve scan_token aleatorio de 64 hex');
SELECT is((SELECT status_at_scan || ':' || geo_method || ':' || accuracy_m || ':' || city || ':' || region
             FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')),
  'assigned:ip:3000:São Paulo:SP', 'scan novo: status_at_scan, metodo ip, margem de 3000 m, cidade e regiao');
SELECT is((SELECT assignment_id FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')),
  'e3e3e3e3-2222-0000-0000-00000000000a'::uuid, 'scan novo: referencia o vinculo vigente');
SELECT is((SELECT location_token_hash FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')),
  tests.sha(tests.tok('s1')), 'scan novo: so o HASH do token e guardado (sha256)');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE location_token_hash = tests.tok('s1')), 0, 'o token em claro nao esta em nenhuma coluna');
SELECT is((SELECT location_token_expires_at FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')),
  now() + interval '30 minutes', 'scan novo: o token vale 30 minutos');
SELECT is((SELECT ip_hash FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')), 'h-1', 'scan novo: grava o ip_hash recebido');
SELECT is((SELECT r -> 'notify' ->> 'to' FROM t_res WHERE k = 's1'), 'scan.a@faro.test', 'scan novo de tag vinculada: devolve notify para o e-mail do tutor');
SELECT is((SELECT (r -> 'notify') - 'scan_id' - 'occurred_at' FROM t_res WHERE k = 's1'),
  '{"to":"scan.a@faro.test","city":"São Paulo","region":"SP","pet_name":"Rex Scan","geo_method":"ip","tutor_first_name":"Ana"}'::jsonb,
  'notify: so e-mail, nome do pet, primeiro nome, metodo e cidade/regiao (nada de ip_hash nem token)');
SELECT is(position('h-1' IN (SELECT r::text FROM t_res WHERE k = 's1')), 0, 'a resposta nunca devolve o ip_hash');
SELECT is((SELECT notify_attempts FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')), 1::smallint, 'scan novo com aviso: conta a primeira tentativa');
SELECT is((SELECT notified_at FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')), NULL::timestamptz, 'notified_at fica nulo ate o e-mail sair (scan_notice_sent)');

-- ═══════════════ Duplicado (10 minutos) ═══════════════

SELECT tests.set_service();
INSERT INTO t_res VALUES ('s2', public.register_scan('ABCDEFGHV', 'h-1', NULL, -23.55, -46.63, 'São Paulo', 'SP'));
RESET ROLE;
SELECT is((SELECT r ->> 'duplicate' FROM t_res WHERE k = 's2'), 'true', 'mesmo codigo e origem em 10 minutos: duplicado');
SELECT is((SELECT r ->> 'scan_id' FROM t_res WHERE k = 's2'), (SELECT r ->> 'scan_id' FROM t_res WHERE k = 's1'), 'duplicado: atualiza o mesmo scan');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE tag_code = 'ABCDEFGHV' AND ip_hash = 'h-1'), 1, 'duplicado: nao cria outra linha');
SELECT ok(NOT ((SELECT r FROM t_res WHERE k = 's2') ? 'notify'), 'duplicado: nao gera aviso (sem notify)');
SELECT ok((SELECT tests.tok('s2') ~ '^[0-9a-f]{64}$' AND tests.tok('s2') <> tests.tok('s1')), 'duplicado sem localizacao precisa: devolve um token NOVO');
SELECT is((SELECT location_token_hash FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')),
  tests.sha(tests.tok('s2')), 'duplicado: o hash gravado e o do token novo');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE location_token_hash = tests.sha(tests.tok('s1'))), 0, 'o token antigo deixa de valer');

-- ═══════════════ Dono ═══════════════

SELECT tests.set_service();
INSERT INTO t_res VALUES ('own', public.register_scan('ABCDEFGHV', 'h-3', 'e3e3e3e3-0000-0000-0000-0000000000a1'));
INSERT INTO t_res VALUES ('oth', public.register_scan('ABCDEFGHV', 'h-4', 'e3e3e3e3-0000-0000-0000-0000000000b2'));
INSERT INTO t_res VALUES ('av', public.register_scan('ZZZZZZZZ8', 'h-5', 'e3e3e3e3-0000-0000-0000-0000000000a1'));
RESET ROLE;
SELECT is((SELECT r FROM t_res WHERE k = 'own'), '{"ok":true,"owner":true}'::jsonb, 'dono logado (viewer = tutor do vinculo): owner true');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE ip_hash = 'h-3'), 0, 'dono: nada e gravado');
SELECT is((SELECT r ->> 'recorded' || ':' || (r ->> 'owner') FROM t_res WHERE k = 'oth'), 'true:false', 'outro usuario logado nao e o dono: o scan e gravado');
SELECT is((SELECT r ->> 'recorded' || ':' || (r ->> 'owner') FROM t_res WHERE k = 'av'), 'true:false', 'tag sem vinculo: ninguem e dono (o scan e gravado)');

-- ═══════════════ Codigo invalido, inexistente e origem vazia: nao grava ═══════════════

SELECT tests.set_service();
SELECT is(public.register_scan('7K3MQ9XAD', 'h-6'), '{"ok":true,"owner":false,"recorded":false}'::jsonb, 'digito invalido: nao grava');
SELECT is(public.register_scan('H8ZWE5XGH', 'h-6'), '{"ok":true,"owner":false,"recorded":false}'::jsonb, 'codigo inexistente: nao grava');
SELECT is(public.register_scan('ABCDEFGHV', ''), '{"ok":true,"owner":false,"recorded":false}'::jsonb, 'ip_hash vazio: nao grava');
SELECT is(public.register_scan('ABCDEFGHV', NULL), '{"ok":true,"owner":false,"recorded":false}'::jsonb, 'ip_hash nulo: nao grava');
SELECT is(public.register_scan(NULL, 'h-6'), '{"ok":true,"owner":false,"recorded":false}'::jsonb, 'codigo nulo: nao grava');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE ip_hash = 'h-6'), 0, 'nenhuma dessas chamadas gravou scan');

-- ═══════════════ Tag disponivel, bloqueada e anulada: grava para a fila do admin, sem aviso ═══════════════

SELECT tests.set_service();
INSERT INTO t_res VALUES ('blk', public.register_scan('JKMNPQRSR', 'h-7'));
INSERT INTO t_res VALUES ('void', public.register_scan('TVWXYZ01S', 'h-7'));
INSERT INTO t_res VALUES ('blkasg', public.register_scan('00000001Y', 'h-7'));
RESET ROLE;
SELECT is((SELECT status_at_scan || ':' || coalesce(assignment_id::text, 'sem-vinculo') FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'av')),
  'available:sem-vinculo', 'tag disponivel: grava com status_at_scan available e sem vinculo');
SELECT is((SELECT status_at_scan || ':' || coalesce(assignment_id::text, 'sem-vinculo') FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'blk')),
  'blocked:sem-vinculo', 'tag bloqueada sem vinculo: grava com status blocked');
SELECT is((SELECT status_at_scan FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'void')), 'void', 'tag anulada: grava com status void');
SELECT is((SELECT status_at_scan || ':' || coalesce(assignment_id::text, 'sem-vinculo') FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'blkasg')),
  'blocked:e3e3e3e3-2222-0000-0000-00000000000b', 'tag bloqueada COM vinculo: grava com status blocked e o vinculo vigente');
SELECT is((SELECT count(*)::integer FROM t_res WHERE k IN ('av', 'blk', 'void', 'blkasg') AND r ? 'notify'), 0, 'disponivel, bloqueada e anulada: nenhuma devolve notify (sem e-mail)');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE ip_hash IN ('h-5', 'h-7') AND (notify_attempts <> 0 OR notified_at IS NOT NULL)), 0, 'sem aviso: notify_attempts 0 e notified_at nulo');

-- ═══════════════ Geolocalizacao ═══════════════

SELECT tests.set_service();
INSERT INTO t_res VALUES ('g1', public.register_scan('ABCDEFGHV', 'h-8', NULL, 100, -46.63, 'X', 'Y'));
INSERT INTO t_res VALUES ('g2', public.register_scan('ABCDEFGHV', 'h-9', NULL, NULL, NULL, 'Cidade sem coordenada', 'SP'));
INSERT INTO t_res VALUES ('g3', public.register_scan('ABCDEFGHV', 'h-10', NULL, -23.5, -46.6, repeat('c', 100), '  '));
RESET ROLE;
SELECT is((SELECT geo_method || ':' || coalesce(lat::text, 'sem') || ':' || coalesce(city, 'sem') FROM public.scan_events WHERE ip_hash = 'h-8'), 'none:sem:sem', 'latitude fora de faixa: geo none, sem coordenada e sem cidade');
SELECT is((SELECT geo_method || ':' || coalesce(city, 'sem') FROM public.scan_events WHERE ip_hash = 'h-9'), 'none:sem', 'sem coordenadas: geo none (a cidade sozinha nao conta como localizacao)');
SELECT is((SELECT char_length(city) FROM public.scan_events WHERE ip_hash = 'h-10'), 80, 'cidade truncada em 80 caracteres');
SELECT is((SELECT region FROM public.scan_events WHERE ip_hash = 'h-10'), NULL::text, 'regiao em branco vira nula');

-- ═══════════════ set_scan_location ═══════════════

SELECT tests.set_service();
SELECT is(public.set_scan_location(repeat('x', 40), -23.5, -46.6, 10), '{"ok":true,"updated":false}'::jsonb, 'token desconhecido: sem efeito');
SELECT is(public.set_scan_location(tests.tok('s1'), -23.5, -46.6, 10), '{"ok":true,"updated":false}'::jsonb, 'token antigo (trocado pelo duplicado): sem efeito');
SELECT is(public.set_scan_location('curto', -23.5, -46.6, 10), '{"ok":true,"updated":false}'::jsonb, 'token curto: sem efeito');
SELECT is(public.set_scan_location(NULL, -23.5, -46.6, 10), '{"ok":true,"updated":false}'::jsonb, 'token nulo: sem efeito');
-- Dados invalidos nao gastam o token.
SELECT is(public.set_scan_location(tests.tok('s2'), 91, -46.6, 10), '{"ok":true,"updated":false}'::jsonb, 'latitude invalida: sem efeito');
SELECT is(public.set_scan_location(tests.tok('s2'), -23.5, -181, 10), '{"ok":true,"updated":false}'::jsonb, 'longitude invalida: sem efeito');
SELECT is(public.set_scan_location(tests.tok('s2'), -23.5, -46.6, -1), '{"ok":true,"updated":false}'::jsonb, 'precisao negativa: sem efeito');
SELECT is(public.set_scan_location(tests.tok('s2'), -23.5, -46.6, NULL), '{"ok":true,"updated":false}'::jsonb, 'precisao nula: sem efeito');
INSERT INTO t_res VALUES ('loc', public.set_scan_location(tests.tok('s2'), -23.5614, -46.6559, 12));
RESET ROLE;
SELECT is((SELECT r ->> 'updated' FROM t_res WHERE k = 'loc'), 'true', 'token valido: updated true (os dados invalidos nao gastaram o token)');
SELECT is((SELECT geo_method || ':' || lat || ':' || lng || ':' || accuracy_m FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')),
  'gps:-23.5614:-46.6559:12', 'localizacao precisa: metodo gps, coordenadas e margem gravados');
SELECT is((SELECT coalesce(location_token_hash, 'nulo') || ':' || coalesce(location_token_expires_at::text, 'nulo') FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')),
  'nulo:nulo', 'o token e invalidado depois do uso (uso unico)');
SELECT is((SELECT r -> 'notify' ->> 'geo_method' FROM t_res WHERE k = 'loc'), 'gps', 'location: devolve notify com metodo gps (aviso "quem achou enviou a localizacao")');
SELECT is((SELECT r -> 'notify' ->> 'to' FROM t_res WHERE k = 'loc'), 'scan.a@faro.test', 'location: o aviso vai para o tutor do vinculo');
SELECT tests.set_service();
SELECT is(public.set_scan_location(tests.tok('s2'), -23.5, -46.6, 10), '{"ok":true,"updated":false}'::jsonb, 'reusar o mesmo token: sem efeito');
-- Localizacao precisa ja enviada: um scan duplicado nao devolve token.
INSERT INTO t_res VALUES ('s3', public.register_scan('ABCDEFGHV', 'h-1'));
RESET ROLE;
SELECT is((SELECT r ->> 'duplicate' FROM t_res WHERE k = 's3'), 'true', 'duplicado depois da localizacao precisa: ainda duplicado');
SELECT ok(NOT ((SELECT r FROM t_res WHERE k = 's3') ? 'scan_token'), 'duplicado com localizacao precisa: nao devolve token');
SELECT is((SELECT geo_method FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1')), 'gps', 'o duplicado nao rebaixa a localizacao precisa');

-- Token vencido.
UPDATE public.scan_events SET location_token_expires_at = now() - interval '1 second' WHERE ip_hash = 'h-8';
SELECT tests.set_service();
INSERT INTO t_res VALUES ('exp', public.register_scan('ABCDEFGHV', 'h-11', NULL, -23.5, -46.6, 'SP', 'SP'));
RESET ROLE;
UPDATE public.scan_events SET location_token_expires_at = now() - interval '1 second' WHERE ip_hash = 'h-11';
SELECT tests.set_service();
SELECT is(public.set_scan_location(tests.tok('exp'), -23.5, -46.6, 10), '{"ok":true,"updated":false}'::jsonb, 'token vencido: sem efeito');
-- Scan de tag bloqueada: a localizacao e gravada, mas nao ha aviso.
INSERT INTO t_res VALUES ('blkloc', public.set_scan_location(tests.tok('blk'), -23.5, -46.6, 10));
RESET ROLE;
SELECT is((SELECT r ->> 'updated' FROM t_res WHERE k = 'blkloc'), 'true', 'scan de tag bloqueada: a localizacao e gravada (fila do admin)');
SELECT ok(NOT ((SELECT r FROM t_res WHERE k = 'blkloc') ? 'notify'), 'scan de tag bloqueada: sem aviso ao tutor');

-- ═══════════════ Deduplicacao depois de 10 minutos e entre vinculos ═══════════════

UPDATE public.scan_events SET occurred_at = now() - interval '11 minutes', last_seen_at = now() - interval '11 minutes'
 WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's1');
SELECT tests.set_service();
INSERT INTO t_res VALUES ('s4', public.register_scan('ABCDEFGHV', 'h-1'));
RESET ROLE;
SELECT is((SELECT r ->> 'duplicate' FROM t_res WHERE k = 's4'), 'false', 'mais de 10 minutos depois: scan novo (nao duplicado)');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE tag_code = 'ABCDEFGHV' AND ip_hash = 'h-1'), 2, 'agora ha duas linhas do mesmo codigo e origem');

-- Mesmo codigo e origem em outro vinculo: nao deduplica com o scan do vinculo anterior (isolamento).
UPDATE public.tag_assignments SET ended_at = now(), end_reason = 'released' WHERE id IN ('e3e3e3e3-2222-0000-0000-00000000000a', 'e3e3e3e3-2222-0000-0000-00000000000b');
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id) VALUES
  ('e3e3e3e3-2222-0000-0000-0000000000a9', 'ABCDEFGHV', 'e3e3e3e3-1111-0000-0000-000000000002', 'e3e3e3e3-0000-0000-0000-0000000000b2');
SELECT tests.set_service();
INSERT INTO t_res VALUES ('s5', public.register_scan('ABCDEFGHV', 'h-1'));
RESET ROLE;
SELECT is((SELECT r ->> 'duplicate' FROM t_res WHERE k = 's5'), 'false', 'vinculo novo da tag: o scan nao deduplica com o do vinculo anterior');
SELECT is((SELECT assignment_id FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 's5')),
  'e3e3e3e3-2222-0000-0000-0000000000a9'::uuid, 'o scan novo referencia o vinculo novo');
SELECT is((SELECT r -> 'notify' ->> 'to' FROM t_res WHERE k = 's5'), 'scan.b@faro.test', 'o aviso do vinculo novo vai para o NOVO tutor');

-- ═══════════════ Reenvio do aviso (scan_notices_pending / scan_notice_sent) ═══════════════

UPDATE public.scan_events SET notified_at = now() WHERE notified_at IS NULL;
SELECT tests.set_service();
INSERT INTO t_res VALUES ('rs', public.register_scan('ABCDEFGHV', 'h-20'));
RESET ROLE;
-- Recente (menos de 2 minutos): o primeiro envio ainda esta em andamento, o job nao pega.
SELECT tests.set_service();
SELECT is(public.scan_notices_pending(10) -> 'items', '[]'::jsonb, 'reenvio: scan com menos de 2 minutos nao e reservado');
RESET ROLE;
UPDATE public.scan_events SET occurred_at = now() - interval '5 minutes', last_seen_at = now() - interval '5 minutes'
 WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'rs');
SELECT tests.set_service();
INSERT INTO t_res VALUES ('p1', public.scan_notices_pending(10));
RESET ROLE;
SELECT is((SELECT jsonb_array_length(r -> 'items') FROM t_res WHERE k = 'p1'), 1, 'reenvio: um scan sem aviso, com mais de 2 minutos, e reservado');
SELECT is((SELECT r -> 'items' -> 0 ->> 'scan_id' FROM t_res WHERE k = 'p1'), (SELECT r ->> 'scan_id' FROM t_res WHERE k = 'rs'), 'reenvio: o item e o scan certo');
SELECT is((SELECT r -> 'items' -> 0 ->> 'to' FROM t_res WHERE k = 'p1'), 'scan.b@faro.test', 'reenvio: o item traz o e-mail do tutor atual do vinculo');
SELECT is((SELECT notify_attempts FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'rs')), 2::smallint, 'reenvio: a reserva soma uma tentativa (2: a do envio direto mais esta)');
SELECT tests.set_service();
SELECT is(jsonb_array_length(public.scan_notices_pending(10) -> 'items'), 1, 'reenvio: segunda rodada ainda reserva (2 tentativas < 3)');
SELECT is(public.scan_notices_pending(10) -> 'items', '[]'::jsonb, 'reenvio: depois de 3 tentativas o scan nao e mais reservado');
RESET ROLE;
UPDATE public.scan_events SET notify_attempts = 1
 WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'rs');
SELECT tests.set_service();
SELECT is(public.scan_notice_sent((SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'rs')), '{"ok":true}'::jsonb, 'scan_notice_sent: ok');
SELECT is(public.scan_notices_pending(10) -> 'items', '[]'::jsonb, 'reenvio: scan com aviso enviado nao e reservado');
RESET ROLE;
SELECT ok((SELECT notified_at IS NOT NULL FROM public.scan_events WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'rs')), 'scan_notice_sent grava notified_at');
-- Nao elegiveis: mais de 24 h, tag nao vinculada e ativa (status do scan), tag bloqueada agora.
UPDATE public.scan_events SET notified_at = NULL, notify_attempts = 1, occurred_at = now() - interval '25 hours', last_seen_at = now() - interval '25 hours'
 WHERE id = (SELECT (r ->> 'scan_id')::uuid FROM t_res WHERE k = 'rs');
UPDATE public.scan_events SET notified_at = NULL, notify_attempts = 0, occurred_at = now() - interval '10 minutes', last_seen_at = now() - interval '10 minutes'
 WHERE ip_hash IN ('h-5', 'h-7');
SELECT tests.set_service();
SELECT is(public.scan_notices_pending(10) -> 'items', '[]'::jsonb, 'reenvio: scan com mais de 24 h, e scans de tag disponivel, bloqueada ou anulada, nunca sao reservados');
RESET ROLE;

-- ═══════════════ Rescue-First e estrutura ═══════════════

CREATE OR REPLACE FUNCTION public.can_link_tag(p_tutor uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $f$ SELECT false; $f$;
SELECT tests.set_service();
SELECT is(public.register_scan('ABCDEFGHV', 'h-30') ->> 'recorded', 'true', 'can_link_tag falso: o scan continua sendo registrado (Rescue-First)');
RESET ROLE;
CREATE OR REPLACE FUNCTION public.can_link_tag(p_tutor uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $f$ SELECT true; $f$;
SELECT is((SELECT prosrc !~* '(plan|subscription|assinatura|entitlement|can_link_tag)' FROM pg_proc WHERE oid = 'public.register_scan(text,text,uuid,double precision,double precision,text,text)'::regprocedure), true,
  'estrutural: register_scan nao referencia nenhum objeto de cobranca nem can_link_tag');

-- ═══════════════ Privilegios ═══════════════

SELECT tests.set_anon();
SELECT is(tests.denied($$ SELECT public.register_scan('ABCDEFGHV', 'x') $$), true, 'anon nao executa register_scan');
SELECT is(tests.denied($$ SELECT public.set_scan_location('x', 0, 0, 0) $$), true, 'anon nao executa set_scan_location');
SELECT is(tests.denied($$ SELECT public.scan_notices_pending(1) $$), true, 'anon nao executa scan_notices_pending');
RESET ROLE;
SELECT tests.set_auth_uid('e3e3e3e3-0000-0000-0000-0000000000a1');
SELECT is(tests.denied($$ SELECT public.register_scan('ABCDEFGHV', 'x') $$), true, 'authenticated nao executa register_scan');
SELECT is(tests.denied($$ SELECT public.set_scan_location('x', 0, 0, 0) $$), true, 'authenticated nao executa set_scan_location');
SELECT is(tests.denied($$ SELECT public.scan_notices_pending(1) $$), true, 'authenticated nao executa scan_notices_pending');
SELECT is(tests.denied($$ SELECT public.scan_notice_sent('e3e3e3e3-0000-0000-0000-0000000000a1') $$), true, 'authenticated nao executa scan_notice_sent');
SELECT is(tests.denied($$ SELECT public.scan_notice_info('e3e3e3e3-0000-0000-0000-0000000000a1') $$), true, 'authenticated nao executa scan_notice_info');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('register_scan', 'set_scan_location', 'scan_notice_info', 'scan_notices_pending', 'scan_notice_sent')
            AND has_function_privilege('service_role', p.oid, 'EXECUTE')
            AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')), 5,
  'as cinco funcoes de scan: service_role executa; anon e authenticated nao');
SELECT is((SELECT count(*)::integer FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('register_scan', 'set_scan_location', 'scan_notice_info', 'scan_notices_pending', 'scan_notice_sent')
            AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']), 5, 'as cinco sao security definer com search_path fixo');

-- Privacidade: ip_hash e token nunca saem do banco para o tutor (so a visao my_scans, sem as colunas sensiveis).
SELECT tests.set_auth_uid('e3e3e3e3-0000-0000-0000-0000000000b2');
SELECT is(tests.denied($$ SELECT ip_hash FROM public.scan_events $$), true, 'o tutor nao le ip_hash de scan_events');
SELECT is(tests.denied($$ SELECT location_token_hash FROM public.scan_events $$), true, 'o tutor nao le location_token_hash de scan_events');
RESET ROLE;

-- ═══════════════ Jobs do pg_cron (T053) ═══════════════

SELECT is((SELECT count(*)::integer FROM cron.job WHERE jobname IN ('faro-resend-scan-notices', 'faro-cleanup-tags')), 2, 'cron.job tem os dois jobs do Faro');
SELECT is((SELECT schedule FROM cron.job WHERE jobname = 'faro-resend-scan-notices'), '*/5 * * * *', 'reenvio de avisos a cada 5 minutos');
SELECT is((SELECT schedule FROM cron.job WHERE jobname = 'faro-cleanup-tags'), '17 3 * * *', 'limpeza diaria');
SELECT is((SELECT command FROM cron.job WHERE jobname = 'faro-resend-scan-notices'), 'SELECT public.cron_resend_scan_notices()', 'o job de reenvio chama a funcao propria');
SELECT is((SELECT count(*)::integer FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
            AND p.proname IN ('cron_resend_scan_notices', 'cron_cleanup_tags')
            AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))), 0, 'as funcoes dos jobs nao sao executaveis por anon nem authenticated');
-- A URL das funcoes e a chave do servidor nunca estao na migration nem no job: so no Vault, criadas pelo operador.
SELECT is((SELECT prosrc !~* 'https?://' AND prosrc !~ '[A-Za-z0-9]{40}' FROM pg_proc WHERE oid = 'public.cron_resend_scan_notices()'::regprocedure), true, 'a funcao do job de reenvio nao carrega URL nem chave');
SELECT lives_ok($$ SELECT public.cron_resend_scan_notices() $$, 'sem Vault ou sem segredos o job de reenvio nao faz nada e nao falha');
INSERT INTO public.pending_activations (tutor_id, tag_code, created_at, expires_at)
VALUES ('e3e3e3e3-0000-0000-0000-0000000000a1', 'ABCDEFGHV', now() - interval '8 days', now() - interval '1 day');
INSERT INTO public.rate_limits (scope, key, window_start, count) VALUES ('teste_cron', 'k-velha', now() - interval '49 hours', 1), ('teste_cron', 'k-nova', now(), 1);
SELECT lives_ok($$ SELECT public.cron_cleanup_tags() $$, 'a limpeza diaria roda');
SELECT is((SELECT count(*)::integer FROM public.pending_activations WHERE tutor_id = 'e3e3e3e3-0000-0000-0000-0000000000a1'), 0, 'a limpeza apaga ativacoes pendentes vencidas');
SELECT is((SELECT string_agg(key, ',' ORDER BY key) FROM public.rate_limits WHERE scope = 'teste_cron'), 'k-nova', 'a limpeza apaga contadores com mais de 48 h e mantem os recentes');

SELECT * FROM finish();
ROLLBACK;
