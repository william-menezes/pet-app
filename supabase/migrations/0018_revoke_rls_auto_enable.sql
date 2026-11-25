-- Migration: 0018_revoke_rls_auto_enable.sql
-- O projeto hospedado tem a função public.rls_auto_enable(), criada pelo painel do Supabase (ela liga
-- a RLS automaticamente em toda tabela nova de public, por um gatilho de evento). Ela é SECURITY
-- DEFINER e nascia chamável por anon e authenticated pela API. O gatilho não depende dessa permissão.
-- No Supabase local a função não existe: por isso o bloco é condicional e a migration é idempotente.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;
