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

-- Schema de apoio do teste: criado dentro da transação (some no ROLLBACK).
-- anon e authenticated precisam de USAGE para chamar tests.* depois de trocar de papel.
CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated;
-- 0017: funcao criada sem GRANT nao e mais executavel por PUBLIC. Os auxiliares abaixo sao chamados depois de
-- trocar de papel, entao o schema do teste (so existe nesta transacao) mantem o padrao antigo.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

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
-- 1. anon: SELECT em perfis → negado (RLS devolve zero linhas)
-- ─────────────────────────────────────────

-- Precondição (como dono da tabela, antes de trocar de papel): o seed existe.
-- Sem isso, "zero linhas" poderia ser só tabela vazia.
SELECT ok(
  (SELECT COUNT(*) FROM public.perfis) >= 3,
  'precondição: perfis tem as linhas do seed (o teste de anon não é vazio por acaso)'
);

SELECT tests.set_anon();

-- Spec 004 (0010): anon perde todo privilégio em perfis; leitura agora dá 42501 (antes: zero linhas).
SELECT throws_ok(
  $$ SELECT * FROM public.perfis $$,
  '42501', NULL,
  'anon não lê perfis (deny-by-default: sem privilégio, 42501)'
);

SELECT throws_ok(
  $$ INSERT INTO public.perfis(id, nome, email) VALUES (gen_random_uuid(), 'x', 'x@x.com') $$,
  '42501', NULL,
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
  '42501', NULL,
  'tutor não pode escalar papel para admin (anti-escalada RLS)'
);

-- Tutor A também não altera o perfil de B (nenhuma linha afetada).
SELECT is_empty(
  $$ WITH u AS (UPDATE public.perfis SET nome = 'invadido' WHERE id = '00000000-0000-0000-0000-000000000002' RETURNING 1) SELECT * FROM u $$,
  'tutor A não altera o perfil de B (0 linhas afetadas)'
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
-- Spec 004 (0010): só "nome" é atualizável por authenticated; promoção de papel é operação controlada
-- (fora do PostgREST). Antes: lives_ok.
SELECT throws_ok(
  $$ UPDATE public.perfis SET papel = 'tutor' WHERE id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', NULL,
  'admin não altera papel por UPDATE direto (privilégio de coluna, 42501)'
);

-- ─────────────────────────────────────────
-- 9. perfis INSERT → negado para authenticated (só trigger service_role)
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');

SELECT throws_ok(
  $$ INSERT INTO public.perfis(id, nome, email) VALUES (gen_random_uuid(), 'X', 'x@x.test') $$,
  '42501', NULL,
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
