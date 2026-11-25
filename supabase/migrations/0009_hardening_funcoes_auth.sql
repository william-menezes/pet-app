-- Migration: 0009_hardening_funcoes_auth.sql
-- Spec 004-conta-tutor, T008 (research.md R13). Corrige os privilegios de EXECUTE das funcoes da 001:
-- no Supabase, funcoes criadas em public nascem executaveis por anon e authenticated.
--   log_auth_event, record_login_attempt -> so service_role (auditoria nao forjavel; limite nao envenenavel)
--   is_admin, current_user_role          -> authenticated e service_role (nunca anon)

REVOKE ALL ON FUNCTION public.log_auth_event(public.evento_auth_enum, uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_event(public.evento_auth_enum, uuid, text, text, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.record_login_attempt(text, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, text, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
