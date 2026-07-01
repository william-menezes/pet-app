-- Migration: 0007_trigger_handle_new_user.sql
-- Cria o trigger que provisiona automaticamente uma linha em public.perfis
-- para cada novo usuário registrado em auth.users (signup via e-mail ou Google OAuth).
--
-- Comportamento:
--   - Papel default: 'tutor' (todo novo usuário é tutor; admin é promovido manualmente).
--   - Nome: prefer raw_user_meta_data->>'name' (Google OAuth) | parte local do e-mail (fallback).
--   - E-mail: espelhado de auth.users.email (conveniência; auth é a fonte de verdade).
--   - Idempotente: ON CONFLICT DO NOTHING evita erro se o trigger disparar mais de uma vez.
--
-- Segurança: SECURITY DEFINER com SET search_path para evitar substituição de schema.
--            Sem lógica além do INSERT mínimo (sem chamadas externas, sem SQL dinâmico).
--
-- Fonte de verdade: specs/001-login/data-model.md §1b + docs/backend-supabase.md §4.3.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, email, nome, papel)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'name',      -- nome do Google OAuth
      NEW.raw_user_meta_data ->> 'full_name', -- alternativa OAuth
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)  -- parte local do e-mail como fallback
    ),
    'tutor'   -- todo novo usuário nasce como tutor; promoção a admin é operação controlada
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotente: signup repetido (ex.: retry) não quebra

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Provisiona uma linha em public.perfis no signup de auth.users. '
  'Papel default: tutor. Nome: raw_user_meta_data.name (OAuth) ou parte local do e-mail. '
  'SECURITY DEFINER + search_path fixo + ON CONFLICT DO NOTHING (idempotente).';

-- Trigger disparado APÓS INSERT em auth.users (signup ou criação manual via admin API).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Cria a linha correspondente em public.perfis a cada novo usuário. '
  'Gatilho de spec 001-login; não remover sem atualizar a spec de signup.';
