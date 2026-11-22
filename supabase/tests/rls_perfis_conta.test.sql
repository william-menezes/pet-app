-- pgTAP: rls_perfis_conta.test.sql
-- Spec 004-conta-tutor, T011. Cobre TODAS as linhas de `perfis` da matriz de
-- specs/004-conta-tutor/contracts/rls-expectations.md (migration 0010) e os testes de seguranca
-- nº 3 ("nao se autoconfirma") e nº 4 ("nao escala papel").
-- Cada "nega" de coluna espera o erro 42501 (privilegio de coluna), nao "zero linhas".
--
-- UUIDs de seed: A = ...0001 (aceite + celular), B = ...0002 (sem aceite e sem celular), admin = ...0003.
-- O estado de que o teste precisa e preparado aqui (como dono do banco) e some no ROLLBACK.

BEGIN;

SELECT plan(54);

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

-- ── Precondicao: o seed da T014 (como dono) ─────────────────────────────
SELECT ok(
  (SELECT celular IS NOT NULL AND celular_confirmado_em IS NOT NULL AND termos_versao = '2026-11'
     FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000001')
  AND (SELECT celular IS NULL AND termos_versao IS NULL
         FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000002'),
  'precondicao: tutor A tem aceite e celular; tutor B tem os dois nulos'
);

-- ── Privilegios de coluna no catalogo ───────────────────────────────────
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'nome', 'UPDATE'), true,
  'authenticated pode UPDATE em nome (catalogo)');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'celular', 'UPDATE'), false,
  'authenticated nao pode UPDATE em celular (catalogo)');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'celular_confirmado_em', 'UPDATE'), false,
  'authenticated nao pode UPDATE em celular_confirmado_em (catalogo)');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'celular_pendente', 'UPDATE'), false,
  'authenticated nao pode UPDATE em celular_pendente (catalogo)');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'termos_aceitos_em', 'UPDATE'), false,
  'authenticated nao pode UPDATE em termos_aceitos_em (catalogo)');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'termos_versao', 'UPDATE'), false,
  'authenticated nao pode UPDATE em termos_versao (catalogo)');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'email', 'UPDATE'), false,
  'authenticated nao pode UPDATE em email (catalogo)');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'papel', 'UPDATE'), false,
  'authenticated nao pode UPDATE em papel (catalogo)');
SELECT is(has_table_privilege('anon', 'public.perfis', 'SELECT'), false,
  'anon nao tem SELECT em perfis (catalogo)');

-- ── anon: nega tudo ─────────────────────────────────────────────────────
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT * FROM public.perfis $$, '42501', NULL, 'anon: SELECT em perfis negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET nome = 'x' $$, '42501', NULL, 'anon: UPDATE nome negado (42501)');
SELECT throws_ok($$ INSERT INTO public.perfis (id, nome, email) VALUES (gen_random_uuid(), 'x', 'x@x.test') $$,
  '42501', NULL, 'anon: INSERT negado (42501)');
SELECT throws_ok($$ DELETE FROM public.perfis $$, '42501', NULL, 'anon: DELETE negado (42501)');
RESET ROLE;

-- ── Tutor A ─────────────────────────────────────────────────────────────
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');
SELECT results_eq(
  $$ SELECT id::text FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY['00000000-0000-0000-0000-000000000001'],
  'tutor A le a propria linha'
);
SELECT is_empty(
  $$ SELECT * FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  'tutor A nao ve a linha de B'
);
SELECT lives_ok(
  $$ UPDATE public.perfis SET nome = 'Tutor A Renomeado' WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  'tutor A altera o proprio nome'
);
SELECT is_empty(
  $$ WITH u AS (UPDATE public.perfis SET nome = 'invadido' WHERE id = '00000000-0000-0000-0000-000000000002' RETURNING 1) SELECT * FROM u $$,
  'tutor A nao altera o nome de B (0 linhas)'
);
SELECT throws_ok($$ UPDATE public.perfis SET celular = '+5511999999999' WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: UPDATE celular negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET celular_confirmado_em = now() WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: UPDATE celular_confirmado_em negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET celular_pendente = '+5511999999999' WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: UPDATE celular_pendente negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET termos_aceitos_em = now() WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: UPDATE termos_aceitos_em negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET termos_versao = '2099-01' WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: UPDATE termos_versao negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET email = 'novo@faro.test' WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: UPDATE email negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET papel = 'admin' WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: UPDATE papel negado (42501) - nao escala papel');
SELECT throws_ok($$ UPDATE public.perfis SET id = gen_random_uuid() WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: UPDATE id negado (42501)');
SELECT throws_ok($$ INSERT INTO public.perfis (id, nome, email) VALUES (gen_random_uuid(), 'x', 'x@x.test') $$,
  '42501', NULL, 'tutor A: INSERT negado (42501)');
SELECT throws_ok($$ DELETE FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor A: DELETE negado (42501)');
RESET ROLE;

-- ── Tutor B: nao se autoconfirma (seguranca nº 3) e nao escala papel (nº 4) ──
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000002');
SELECT throws_ok(
  $$ UPDATE public.perfis SET celular = '+5511999999999', celular_confirmado_em = now() WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'tutor B nao se autoconfirma o celular (42501)');
SELECT throws_ok(
  $$ UPDATE public.perfis SET celular_pendente = '+5511999999999' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'tutor B nao grava celular_pendente (42501)');
SELECT throws_ok(
  $$ UPDATE public.perfis SET termos_aceitos_em = now(), termos_versao = '2026-11' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'tutor B nao se autoaceita os termos (42501)');
SELECT throws_ok(
  $$ UPDATE public.perfis SET papel = 'admin' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'tutor B nao vira admin (42501)');
RESET ROLE;
SELECT ok(
  (SELECT celular IS NULL AND celular_confirmado_em IS NULL AND celular_pendente IS NULL
          AND termos_versao IS NULL AND papel = 'tutor'
     FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000002'),
  'depois das tentativas, a linha de B continua intacta (sem celular, sem aceite, papel tutor)'
);

-- ── Admin ───────────────────────────────────────────────────────────────
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000003');
SELECT ok((SELECT count(*) FROM public.perfis) >= 3, 'admin le todas as linhas');
SELECT lives_ok(
  $$ UPDATE public.perfis SET nome = 'Nome pelo admin' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  'admin altera nome de outra conta');
SELECT throws_ok($$ UPDATE public.perfis SET celular = '+5511999999999' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'admin: UPDATE celular negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET celular_confirmado_em = now() WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'admin: UPDATE celular_confirmado_em negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET celular_pendente = '+5511999999999' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'admin: UPDATE celular_pendente negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET termos_aceitos_em = now() WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'admin: UPDATE termos_aceitos_em negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET termos_versao = '2026-11' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'admin: UPDATE termos_versao negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET email = 'x@faro.test' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'admin: UPDATE email negado (42501)');
SELECT throws_ok($$ UPDATE public.perfis SET papel = 'admin' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'admin: UPDATE papel negado (42501) - so por SQL de manutencao');
SELECT throws_ok($$ INSERT INTO public.perfis (id, nome, email) VALUES (gen_random_uuid(), 'x', 'x@x.test') $$,
  '42501', NULL, 'admin: INSERT negado (42501)');
SELECT throws_ok($$ DELETE FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL, 'admin: DELETE negado (42501)');
RESET ROLE;

-- ── service_role: permite ───────────────────────────────────────────────
SELECT tests.set_service();
SELECT ok((SELECT count(*) FROM public.perfis) >= 3, 'service_role le todas as linhas');
SELECT lives_ok(
  $$ UPDATE public.perfis SET celular = '+5511911111111', celular_confirmado_em = now() WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  'service_role grava celular confirmado (par coerente)');
RESET ROLE;

-- ── Restricoes de dados (como dono) ─────────────────────────────────────
SELECT throws_ok(
  $$ UPDATE public.perfis SET celular = '+14155550100', celular_confirmado_em = now() WHERE id = '00000000-0000-0000-0000-000000000003' $$,
  '23514', NULL, 'celular fora do formato E.164 brasileiro e recusado');
SELECT throws_ok(
  $$ UPDATE public.perfis SET celular = '+5511922222222' WHERE id = '00000000-0000-0000-0000-000000000003' $$,
  '23514', NULL, 'celular sem celular_confirmado_em e recusado (coerencia)');
SELECT throws_ok(
  $$ UPDATE public.perfis SET termos_aceitos_em = now(), termos_versao = 'abc' WHERE id = '00000000-0000-0000-0000-000000000003' $$,
  '23514', NULL, 'termos_versao fora do formato AAAA-MM e recusada');
SELECT throws_ok(
  $$ UPDATE public.perfis SET termos_aceitos_em = now() WHERE id = '00000000-0000-0000-0000-000000000003' $$,
  '23514', NULL, 'termos_aceitos_em sem termos_versao e recusado (coerencia)');
SELECT throws_ok(
  $$ UPDATE public.perfis SET nome = repeat('a', 81) WHERE id = '00000000-0000-0000-0000-000000000003' $$,
  '23514', NULL, 'nome com 81 caracteres e recusado');

-- ── Gatilho de updated_at ───────────────────────────────────────────────
UPDATE public.perfis SET nome = 'Admin Faro Teste' WHERE id = '00000000-0000-0000-0000-000000000003';
SELECT ok(
  (SELECT updated_at = now() FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000003'),
  'perfis_set_updated_at atualiza updated_at em todo UPDATE'
);

-- ── Politicas da 001 intactas ───────────────────────────────────────────
SELECT is(
  (SELECT count(*)::integer FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'perfis'
      AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])),
  0, 'nenhuma politica de perfis vale para anon ou public');
SELECT is(
  (SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'public' AND tablename = 'perfis'),
  3, 'perfis continua com exatamente as 3 politicas da 001');

SELECT * FROM finish();
ROLLBACK;
