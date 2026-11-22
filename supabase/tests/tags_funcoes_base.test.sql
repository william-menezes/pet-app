-- pgTAP: tags_funcoes_base.test.sql
-- Spec 003-tag-qr, T015, T017 e T019 (migrations 0023, 0026 e 0027): rate_limit_hit, new_activation_pin, can_link_tag
-- e a auditoria (audit + audit_log so insercao). Nenhum PIN e escrito aqui; os gerados nao sao registrados.

BEGIN;

SELECT plan(53);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('role', 'authenticated', true);
$$;
CREATE OR REPLACE FUNCTION tests.claims_only(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true);
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
CREATE OR REPLACE FUNCTION tests.sqlstate_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;

-- ═══════════════ rate_limit_hit (T015) ═══════════════

-- 31 chamadas seguidas a um limite de 30 por minuto: so a 31a estoura.
CREATE TEMP TABLE t_rl (i integer PRIMARY KEY, exceeded boolean NOT NULL);
INSERT INTO t_rl SELECT i, public.rate_limit_hit('teste_limite', 'chave-a', 30, 60) FROM generate_series(1, 32) AS i;
SELECT is((SELECT count(*)::integer FROM t_rl WHERE i <= 30 AND exceeded), 0, 'as 30 primeiras chamadas (limite 30) nao estouram');
SELECT is((SELECT exceeded FROM t_rl WHERE i = 31), true, 'a 31a chamada estoura o limite de 30');
SELECT is((SELECT exceeded FROM t_rl WHERE i = 32), true, 'a 32a continua estourada na mesma janela');
SELECT is((SELECT count FROM public.rate_limits WHERE scope = 'teste_limite' AND key = 'chave-a'), 32, 'o contador guarda as 32 chamadas');

-- Isolamento por chave e por escopo.
SELECT is(public.rate_limit_hit('teste_limite', 'chave-b', 30, 60), false, 'outra chave tem o proprio contador');
SELECT is(public.rate_limit_hit('outro_escopo', 'chave-a', 30, 60), false, 'outro escopo tem o proprio contador');

-- A janela e fixa e alinhada ao multiplo de p_window_seconds desde a epoca.
DO $
BEGIN
  PERFORM public.rate_limit_hit('teste_janela', 'k60', 5, 60);
  PERFORM public.rate_limit_hit('teste_janela', 'k900', 5, 900);
  PERFORM public.rate_limit_hit('teste_janela', 'k3600', 5, 3600);
END;
$;
SELECT is((SELECT (extract(epoch FROM window_start))::bigint % 60 FROM public.rate_limits WHERE scope = 'teste_janela' AND key = 'k60'), 0::bigint,
  'janela de 60 s alinhada ao minuto');
SELECT is((SELECT (extract(epoch FROM window_start))::bigint % 900 FROM public.rate_limits WHERE scope = 'teste_janela' AND key = 'k900'), 0::bigint,
  'janela de 900 s alinhada a 15 minutos');
SELECT is((SELECT (extract(epoch FROM window_start))::bigint % 3600 FROM public.rate_limits WHERE scope = 'teste_janela' AND key = 'k3600'), 0::bigint,
  'janela de 3600 s alinhada a hora');

-- Uma janela antiga nao conta para a atual.
INSERT INTO public.rate_limits (scope, key, window_start, count) VALUES ('teste_antiga', 'k', now() - interval '10 minutes', 100);
SELECT is(public.rate_limit_hit('teste_antiga', 'k', 5, 60), false, 'a contagem de uma janela anterior nao vale na janela atual');

-- Parametros invalidos.
SELECT throws_ok($$ SELECT public.rate_limit_hit('s', 'k', 0, 60) $$, 'P0001', NULL, 'limite zero e recusado');
SELECT throws_ok($$ SELECT public.rate_limit_hit('s', 'k', 5, 0) $$, 'P0001', NULL, 'janela zero e recusada');
SELECT throws_ok($$ SELECT public.rate_limit_hit(NULL, 'k', 5, 60) $$, 'P0001', NULL, 'escopo nulo e recusado');

-- Privilegios: so service_role (e as funcoes security definer do dono).
SELECT tests.set_service();
SELECT is(public.rate_limit_hit('teste_papel', 'k', 1, 60), false, 'service_role chama rate_limit_hit (1a chamada, limite 1)');
SELECT is(public.rate_limit_hit('teste_papel', 'k', 1, 60), true, 'service_role: a 2a chamada estoura o limite de 1');
RESET ROLE;
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.rate_limit_hit('s', 'k', 5, 60) $$, '42501', NULL, 'anon nao chama rate_limit_hit');
RESET ROLE;
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000099');
SELECT throws_ok($$ SELECT public.rate_limit_hit('s', 'k', 5, 60) $$, '42501', NULL, 'authenticated nao chama rate_limit_hit');
RESET ROLE;

-- ═══════════════ new_activation_pin e can_link_tag (T017) ═══════════════

SELECT is(length(public.new_activation_pin()), 6, 'new_activation_pin devolve 6 caracteres');

-- 1.000 PINs: so caracteres do alfabeto Crockford, todos os 32 simbolos aparecem, distribuicao sem viés grosseiro.
-- Os PINs ficam so nesta transacao e nao sao registrados em lugar nenhum.
CREATE TEMP TABLE t_chars (ch text NOT NULL);
INSERT INTO t_chars
SELECT substr(p, g, 1) FROM (SELECT public.new_activation_pin() AS p FROM generate_series(1, 1000)) AS pins, generate_series(1, 6) AS g;
SELECT is((SELECT count(*)::integer FROM t_chars), 6000, '1.000 PINs geram 6.000 caracteres');
SELECT is((SELECT count(*)::integer FROM t_chars WHERE ch !~ '^[0-9A-HJKMNP-TV-Z]$'), 0, 'so caracteres do alfabeto (sem I, L, O, U)');
SELECT is((SELECT count(DISTINCT ch)::integer FROM t_chars), 32, 'os 32 simbolos do alfabeto aparecem');
SELECT is((SELECT count(*)::integer FROM (SELECT ch, count(*) AS n FROM t_chars GROUP BY ch) c WHERE n < 100 OR n > 280), 0,
  'nenhum simbolo foge de 100 a 280 ocorrencias (esperado: cerca de 187)');
SELECT ok((SELECT count(DISTINCT p) > 990 FROM (SELECT public.new_activation_pin() AS p FROM generate_series(1, 1000)) AS pins),
  'os PINs nao se repetem (mais de 990 distintos em 1.000)');

SELECT is(public.can_link_tag('00000000-0000-0000-0000-000000000099'), true, 'can_link_tag permite (TODO(BILLING_MODEL): sempre true hoje)');
SELECT is(public.can_link_tag(NULL), true, 'can_link_tag nao depende do tutor informado');

SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.new_activation_pin() $$, '42501', NULL, 'anon nao chama new_activation_pin');
SELECT throws_ok($$ SELECT public.can_link_tag('00000000-0000-0000-0000-000000000099') $$, '42501', NULL, 'anon nao chama can_link_tag');
RESET ROLE;
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000099');
SELECT throws_ok($$ SELECT public.new_activation_pin() $$, '42501', NULL, 'authenticated nao chama new_activation_pin (so RPCs security definer a usam)');
SELECT throws_ok($$ SELECT public.can_link_tag('00000000-0000-0000-0000-000000000099') $$, '42501', NULL, 'authenticated nao chama can_link_tag direto');
RESET ROLE;
SELECT tests.set_service();
SELECT is(length(public.new_activation_pin()), 6, 'service_role chama new_activation_pin');
RESET ROLE;

-- ═══════════════ audit e audit_log (T019) ═══════════════

-- Chamada por funcao interna, com sessao de tutor: identidade vem do JWT.
SELECT tests.claims_only('00000000-0000-0000-0000-000000000099');
SELECT lives_ok($$ SELECT public.audit('evento_teste_a', 'tag', 'ABCDEFGHV', '{"k": 1}'::jsonb) $$, 'audit grava com sessao de tutor');
SELECT is((SELECT actor_id::text || '/' || actor_role FROM public.audit_log WHERE event = 'evento_teste_a'),
  '00000000-0000-0000-0000-000000000099/authenticated', 'o ator e o papel vem do JWT');
SELECT is((SELECT detail FROM public.audit_log WHERE event = 'evento_teste_a'), '{"k": 1}'::jsonb, 'o detalhe fica como enviado');

-- Chamada pelo service_role (Edge Function): sem ator.
SELECT tests.set_service();
SELECT lives_ok($$ SELECT public.audit('evento_teste_b', NULL, NULL, NULL) $$, 'service_role chama audit (detalhe nulo)');
RESET ROLE;
SELECT is((SELECT actor_id IS NULL AND actor_role = 'service_role' AND detail = '{}'::jsonb FROM public.audit_log WHERE event = 'evento_teste_b'), true,
  'service_role: sem ator, papel service_role e detalhe {} quando nulo');
SELECT ok((SELECT (SELECT max(id) FROM public.audit_log WHERE event = 'evento_teste_b') > (SELECT max(id) FROM public.audit_log WHERE event = 'evento_teste_a')),
  'o identificador cresce a cada linha');

-- Quem pode chamar.
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.audit('x', NULL, NULL, '{}') $$, '42501', NULL, 'anon nao chama audit');
RESET ROLE;
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000099');
SELECT throws_ok($$ SELECT public.audit('x', NULL, NULL, '{}') $$, '42501', NULL, 'authenticated nao chama audit direto (so RPCs security definer)');
RESET ROLE;

-- So insercao: update e delete falham para authenticated e para service_role.
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000099');
SELECT throws_ok($$ UPDATE public.audit_log SET event = 'adulterado' $$, '42501', NULL, 'authenticated nao atualiza audit_log');
SELECT throws_ok($$ DELETE FROM public.audit_log $$, '42501', NULL, 'authenticated nao apaga audit_log');
SELECT throws_ok($$ SELECT 1 FROM public.audit_log $$, '42501', NULL, 'authenticated nao le audit_log direto');
RESET ROLE;
SELECT tests.set_service();
SELECT throws_ok($$ UPDATE public.audit_log SET event = 'adulterado' $$, '42501', NULL, 'service_role nao atualiza audit_log');
SELECT throws_ok($$ DELETE FROM public.audit_log $$, '42501', NULL, 'service_role nao apaga audit_log');
SELECT throws_ok($$ TRUNCATE public.audit_log $$, '42501', NULL, 'service_role nao da TRUNCATE em audit_log');
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event IN ('evento_teste_a', 'evento_teste_b')), 2, 'service_role le e insere');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'adulterado'), 0, 'nenhuma linha foi adulterada');

-- Barreira contra segredos no detalhe (chaves de primeiro nivel).
SELECT is(tests.sqlstate_of($$ SELECT public.audit('x', NULL, NULL, '{"pin":"ABC123"}') $$), '23514', 'detail com chave pin e recusado');
SELECT is(tests.sqlstate_of($$ SELECT public.audit('x', NULL, NULL, '{"new_pin":"ABC123"}') $$), '23514', 'detail com chave new_pin e recusado');
SELECT is(tests.sqlstate_of($$ SELECT public.audit('x', NULL, NULL, '{"ip_hash":"abc"}') $$), '23514', 'detail com chave ip_hash e recusado');
SELECT is(tests.sqlstate_of($$ SELECT public.audit('x', NULL, NULL, '{"phone":"+5511900000000"}') $$), '23514', 'detail com chave phone e recusado');
SELECT is(tests.sqlstate_of($$ SELECT public.audit('x', NULL, NULL, '[1]'::jsonb) $$), '23514', 'detail que nao e objeto e recusado');
SELECT is(tests.sqlstate_of($$ SELECT public.audit('', NULL, NULL, '{}') $$), '23514', 'evento vazio e recusado');
SELECT is(tests.sqlstate_of($$ SELECT public.audit('ok_evento', 'tag', 'ABCDEFGHV', '{"count": 2, "motivo": "teste"}') $$), 'ok', 'controle: detalhe sem chave proibida e aceito');

SELECT * FROM finish();
ROLLBACK;
