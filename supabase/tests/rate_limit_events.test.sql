-- pgTAP: rate_limit_events.test.sql
-- Spec 004-conta-tutor, T013. Cobre a tabela e a funcao public.rate_limit_check (migration 0011).
-- Fonte: specs/004-conta-tutor/contracts/rate-limit.rpc.md (testes obrigatorios).
-- Cada bucket de teste usa chave propria, e tudo some no ROLLBACK.

BEGIN;

SELECT plan(33);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;

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

-- ── 1. Privilegios (catalogo e chamada real) ────────────────────────────
SELECT is(has_function_privilege('anon', 'public.rate_limit_check(jsonb,boolean)', 'EXECUTE'), false,
  'anon nao executa rate_limit_check (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.rate_limit_check(jsonb,boolean)', 'EXECUTE'), false,
  'authenticated nao executa rate_limit_check (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.rate_limit_check(jsonb,boolean)', 'EXECUTE'), true,
  'service_role executa rate_limit_check (catalogo)');
SELECT is(has_table_privilege('anon', 'public.rate_limit_events', 'SELECT')
       OR has_table_privilege('authenticated', 'public.rate_limit_events', 'SELECT')
       OR has_table_privilege('anon', 'public.rate_limit_events', 'INSERT')
       OR has_table_privilege('authenticated', 'public.rate_limit_events', 'INSERT'), false,
  'anon e authenticated nao tem SELECT nem INSERT em rate_limit_events (catalogo)');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rate_limit_events'::regclass), true,
  'rate_limit_events tem RLS habilitada');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rate_limit_events'), 0,
  'rate_limit_events nao tem nenhuma politica');

SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.rate_limit_check('[{"bucket":"t","key":"k","max":1,"window":60}]'::jsonb, true) $$,
  '42501', NULL, 'anon chamando rate_limit_check recebe 42501');
SELECT throws_ok($$ SELECT * FROM public.rate_limit_events $$, '42501', NULL, 'anon lendo a tabela recebe 42501');
SELECT throws_ok($$ INSERT INTO public.rate_limit_events (bucket, key) VALUES ('t', 'k') $$,
  '42501', NULL, 'anon inserindo na tabela recebe 42501');
RESET ROLE;

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');
SELECT throws_ok($$ SELECT public.rate_limit_check('[{"bucket":"t","key":"k","max":1,"window":60}]'::jsonb, true) $$,
  '42501', NULL, 'authenticated chamando rate_limit_check recebe 42501');
SELECT throws_ok($$ SELECT * FROM public.rate_limit_events $$, '42501', NULL, 'authenticated lendo a tabela recebe 42501');
SELECT throws_ok($$ INSERT INTO public.rate_limit_events (bucket, key) VALUES ('t', 'k') $$,
  '42501', NULL, 'authenticated inserindo na tabela recebe 42501');
SELECT throws_ok($$ DELETE FROM public.rate_limit_events $$, '42501', NULL, 'authenticated apagando da tabela recebe 42501');
RESET ROLE;

-- ── 2. service_role: primeira chamada permite, segunda nega (max = 1) ───
SELECT tests.set_service();
SELECT is(
  (SELECT (public.rate_limit_check('[{"bucket":"t1","key":"k","max":1,"window":60}]'::jsonb, true)->>'allowed')::boolean),
  true, 'service_role: 1a chamada permite');
SELECT is(
  (SELECT (public.rate_limit_check('[{"bucket":"t1","key":"k","max":1,"window":60}]'::jsonb, true)->>'allowed')::boolean),
  false, 'service_role: 2a chamada nega (max = 1)');
RESET ROLE;

-- ── 3. max = 3: tres permitem, a quarta nega com retry entre 1 e window ─
SELECT is(
  (SELECT bool_and((public.rate_limit_check('[{"bucket":"t3","key":"k","max":3,"window":600}]'::jsonb, true)->>'allowed')::boolean)
     FROM generate_series(1, 3)),
  true, 'max = 3: as tres primeiras chamadas permitem');
SELECT is(
  (SELECT (public.rate_limit_check('[{"bucket":"t3","key":"k","max":3,"window":600}]'::jsonb, true)->>'allowed')::boolean),
  false, 'max = 3: a quarta chamada nega');
SELECT ok(
  (SELECT (r->>'retry_after_seconds')::integer BETWEEN 1 AND 600
          AND r->>'denied_bucket' = 't3'
     FROM (SELECT public.rate_limit_check('[{"bucket":"t3","key":"k","max":3,"window":600}]'::jsonb, true) AS r) s),
  'a negativa informa denied_bucket e retry_after_seconds entre 1 e a janela');

-- ── 4. Duas checagens, a segunda no limite: nega e NAO incrementa a primeira ──
SELECT public.rate_limit_check('[{"bucket":"t4b","key":"k","max":1,"window":60}]'::jsonb, true);
SELECT is(
  (SELECT public.rate_limit_check(
    '[{"bucket":"t4a","key":"k","max":5,"window":60},{"bucket":"t4b","key":"k","max":1,"window":60}]'::jsonb, true)->>'denied_bucket'),
  't4b', 'duas checagens: nega pelo eixo que estourou');
SELECT is((SELECT count(*)::integer FROM public.rate_limit_events WHERE bucket = 't4a'), 0,
  'negativa em um eixo nao consome cota do outro (t4a continua com 0)');

-- ── 5. p_record = false so consulta ─────────────────────────────────────
SELECT public.rate_limit_check('[{"bucket":"t5","key":"k","max":2,"window":60}]'::jsonb, false);
SELECT is((SELECT count(*)::integer FROM public.rate_limit_events WHERE bucket = 't5'), 0,
  'p_record = false nao grava');

-- ── 6. Linhas fora da janela nao contam ─────────────────────────────────
INSERT INTO public.rate_limit_events (bucket, key, at)
VALUES ('t6', 'k', now() - interval '2 hours'), ('t6', 'k', now() - interval '3 hours');
SELECT is(
  (SELECT (public.rate_limit_check('[{"bucket":"t6","key":"k","max":1,"window":3600}]'::jsonb, true)->>'allowed')::boolean),
  true, 'linhas anteriores a janela (1 h) nao contam');

-- ── 7. Linhas com mais de 48 h do par consultado sao apagadas ───────────
INSERT INTO public.rate_limit_events (bucket, key, at)
VALUES ('t7', 'k', now() - interval '49 hours'), ('t7', 'k', now() - interval '47 hours'),
       ('t7', 'outra', now() - interval '49 hours');
SELECT public.rate_limit_check('[{"bucket":"t7","key":"k","max":10,"window":60}]'::jsonb, false);
SELECT is((SELECT count(*)::integer FROM public.rate_limit_events WHERE bucket = 't7' AND key = 'k'), 1,
  'a linha de 49 h do par consultado foi apagada; a de 47 h ficou');
SELECT is((SELECT count(*)::integer FROM public.rate_limit_events WHERE bucket = 't7' AND key = 'outra'), 1,
  'linhas de outro par nao sao apagadas');

-- ── 8. Entrada malformada lanca invalid_checks ──────────────────────────
SELECT throws_ok($$ SELECT public.rate_limit_check('{}'::jsonb, true) $$, 'P0001', 'invalid_checks', 'objeto no lugar de array');
SELECT throws_ok($$ SELECT public.rate_limit_check('[]'::jsonb, true) $$, 'P0001', 'invalid_checks', 'array vazio');
SELECT throws_ok($$ SELECT public.rate_limit_check(NULL, true) $$, 'P0001', 'invalid_checks', 'entrada nula');
SELECT throws_ok(
  $$ SELECT public.rate_limit_check('[{"bucket":"t","key":"k","max":1,"window":60},{"bucket":"t","key":"k","max":1,"window":60},{"bucket":"t","key":"k","max":1,"window":60},{"bucket":"t","key":"k","max":1,"window":60},{"bucket":"t","key":"k","max":1,"window":60},{"bucket":"t","key":"k","max":1,"window":60},{"bucket":"t","key":"k","max":1,"window":60},{"bucket":"t","key":"k","max":1,"window":60},{"bucket":"t","key":"k","max":1,"window":60}]'::jsonb, true) $$,
  'P0001', 'invalid_checks', 'mais de 8 checagens');
SELECT throws_ok($$ SELECT public.rate_limit_check('[{"bucket":"","key":"k","max":1,"window":60}]'::jsonb, true) $$,
  'P0001', 'invalid_checks', 'bucket vazio');
SELECT throws_ok($$ SELECT public.rate_limit_check('[{"bucket":"t","key":"k","max":0,"window":60}]'::jsonb, true) $$,
  'P0001', 'invalid_checks', 'max menor que 1');
SELECT throws_ok($$ SELECT public.rate_limit_check('[{"bucket":"t","key":"k","max":1,"window":604801}]'::jsonb, true) $$,
  'P0001', 'invalid_checks', 'janela maior que 604800 s');
SELECT throws_ok($$ SELECT public.rate_limit_check('[{"bucket":"t","key":"k","max":1}]'::jsonb, true) $$,
  'P0001', 'invalid_checks', 'campo window ausente');
SELECT throws_ok($$ SELECT public.rate_limit_check('[{"bucket":"t","key":"k","max":"1","window":60}]'::jsonb, true) $$,
  'P0001', 'invalid_checks', 'max como texto');

SELECT * FROM finish();
ROLLBACK;
