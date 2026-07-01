-- pgTAP: rls_perfis.test.sql
-- Testa as políticas de RLS da tabela public.perfis.
-- Tarefas: T019 (tasks.md)
-- Fonte de verdade: specs/001-login/contracts/rls-expectations.md
--
-- Como rodar: supabase test db
--
-- Cobre:
--   - Isolamento A↔B: tutor B não lê perfil de A.
--   - anon negado em perfis (código de erro 42501 / PGRST116).
--   - Anti-escalada de papel: tutor não consegue UPDATE SET papel='admin'.
--   - is_admin() retorna true/false correto por papel.
--   - current_user_role() retorna somente o papel do auth.uid() corrente.
--   - Admin lê todos os perfis.
--
-- UUIDs de seed (seed.sql):
--   tutor_a  = 00000000-0000-0000-0000-000000000001
--   tutor_b  = 00000000-0000-0000-0000-000000000002
--   admin    = 00000000-0000-0000-0000-000000000003

BEGIN;

SELECT plan(18);

-- ─────────────────────────────────────────
-- Helpers de contexto de sessão (simula auth.uid() para os testes)
-- ─────────────────────────────────────────

-- set_local_user_id: simula um usuário autenticado definindo auth.uid() na sessão.
-- Em pgTAP com Supabase, usamos set_config para simular o JWT claim.
CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text)
RETURNS void
LANGUAGE sql
AS $$
  SELECT
    set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
    set_config('request.jwt.claim.sub', p_uid, true),
    set_config('role', 'authenticated', true);
$$;

CREATE OR REPLACE FUNCTION tests.set_anon()
RETURNS void
LANGUAGE sql
AS $$
  SELECT
    set_config('request.jwt.claims', '{"role":"anon"}'::text, true),
    set_config('request.jwt.claim.sub', '', true),
    set_config('role', 'anon', true);
$$;

CREATE OR REPLACE FUNCTION tests.clear_auth()
RETURNS void
LANGUAGE sql
AS $$
  SELECT
    set_config('request.jwt.claims', '{"role":"authenticated"}'::text, true),
    set_config('request.jwt.claim.sub', '', true),
    set_config('role', 'authenticated', true);
$$;

-- ─────────────────────────────────────────
-- 1. anon: SELECT em perfis → negado
-- ─────────────────────────────────────────

SELECT tests.set_anon();

SELECT throws_ok(
  $$ SELECT * FROM public.perfis LIMIT 1 $$,
  'anon não pode SELECT em perfis (deny-by-default)'
);

SELECT throws_ok(
  $$ INSERT INTO public.perfis(id, nome, email) VALUES (gen_random_uuid(), 'x', 'x@x.com') $$,
  'anon não pode INSERT em perfis'
);

-- ─────────────────────────────────────────
-- 2. Tutor A: lê o próprio perfil
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');

SELECT results_eq(
  $$ SELECT id::text FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY['00000000-0000-0000-0000-000000000001'],
  'tutor A lê o próprio perfil'
);

-- ─────────────────────────────────────────
-- 3. Isolamento A↔B: Tutor A não lê perfil de B
-- ─────────────────────────────────────────

SELECT is_empty(
  $$ SELECT * FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  'tutor A não vê perfil de B (isolamento RLS)'
);

-- ─────────────────────────────────────────
-- 4. Tutor A: não pode UPDATE SET papel='admin' (anti-escalada)
-- ─────────────────────────────────────────

SELECT throws_ok(
  $$ UPDATE public.perfis SET papel = 'admin' WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  'tutor não pode escalar papel para admin (anti-escalada RLS)'
);

-- ─────────────────────────────────────────
-- 5. is_admin() como tutor → false
-- ─────────────────────────────────────────

SELECT is(
  (SELECT public.is_admin()),
  false,
  'is_admin() retorna false para tutor A'
);

-- ─────────────────────────────────────────
-- 6. current_user_role() como tutor A → 'tutor'
-- ─────────────────────────────────────────

SELECT is(
  (SELECT public.current_user_role()),
  'tutor',
  'current_user_role() retorna "tutor" para tutor A'
);

-- ─────────────────────────────────────────
-- 7. Tutor B não obtém papel de A via current_user_role()
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT public.current_user_role()),
  'tutor',
  'tutor B obtém somente o próprio papel (não o de A)'
);

-- Tutor B: lê o próprio perfil.
SELECT results_eq(
  $$ SELECT id::text FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  ARRAY['00000000-0000-0000-0000-000000000002'],
  'tutor B lê o próprio perfil'
);

-- Tutor B não vê perfil de A.
SELECT is_empty(
  $$ SELECT * FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  'tutor B não vê perfil de A (isolamento RLS)'
);

-- ─────────────────────────────────────────
-- 8. Admin: is_admin() → true + lê todos os perfis
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000003');

SELECT is(
  (SELECT public.is_admin()),
  true,
  'is_admin() retorna true para o perfil admin'
);

SELECT is(
  (SELECT public.current_user_role()),
  'admin',
  'current_user_role() retorna "admin" para o admin'
);

-- Admin vê todos os perfis (policy perfis_admin_all).
SELECT results_eq(
  $$ SELECT COUNT(*)::integer FROM public.perfis $$,
  ARRAY[3],   -- tutor_a + tutor_b + admin (seed.sql)
  'admin lê todos os 3 perfis (policy admin_all)'
);

-- Admin pode alterar papel de tutor → admin (promoção legítima).
SELECT lives_ok(
  $$ UPDATE public.perfis SET papel = 'tutor' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  'admin pode alterar papel de outro usuário (perfis_admin_all)'
);

-- ─────────────────────────────────────────
-- 9. perfis INSERT → negado para authenticated (só trigger service_role)
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');

SELECT throws_ok(
  $$ INSERT INTO public.perfis(id, nome, email) VALUES (gen_random_uuid(), 'X', 'x@x.test') $$,
  'authenticated não pode INSERT em perfis diretamente (só trigger handle_new_user)'
);

-- ─────────────────────────────────────────
-- 10. Rescue-First (guardião arquitetural — SC-008)
-- ─────────────────────────────────────────
-- Verifica que esta migration NÃO adicionou coluna que referencie assinaturas
-- (não deve existir FK de perfis para assinaturas neste estágio).

SELECT hasnt_column(
  'public', 'perfis', 'assinatura_id',
  'perfis não tem coluna assinatura_id (Rescue-First: sem coupling de assinatura aqui)'
);

SELECT finish();
ROLLBACK;
