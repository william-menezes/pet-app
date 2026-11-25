-- Migration: 0013_auditoria_auth_users.sql
-- Spec 004-conta-tutor, T017 (contracts/account.rpc.md). Auditoria por gatilho de eventos que o
-- Supabase Auth faz sozinho em auth.users: e-mail confirmado, senha alterada, recuperacao enviada.
-- O gatilho NUNCA derruba login, confirmacao ou troca de senha: corpo em EXCEPTION e RETURN NEW sempre.
-- Nao le nem registra o valor de encrypted_password; so compara.

CREATE OR REPLACE FUNCTION public.audit_auth_user_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
      INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe)
      VALUES ('email_confirmado', NEW.id, '', '', '{}'::jsonb);
    END IF;

    IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
       AND NEW.encrypted_password IS NOT NULL THEN
      INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe)
      VALUES (
        'senha_alterada', NEW.id, '', '',
        jsonb_build_object(
          'apos_recuperacao',
          COALESCE(NEW.recovery_sent_at > now() - interval '1 hour', false)
        )
      );
    END IF;

    IF NEW.recovery_sent_at IS DISTINCT FROM OLD.recovery_sent_at
       AND NEW.recovery_sent_at IS NOT NULL THEN
      INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe)
      VALUES ('senha_recuperacao_solicitada', NEW.id, '', '', jsonb_build_object('origem', 'envio'));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit_auth_user_changes: falha ao auditar (operacao mantida)';
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_auth_user_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at, encrypted_password, recovery_sent_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_auth_user_changes();
