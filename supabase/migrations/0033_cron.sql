-- Migration: 0033_cron.sql
-- Spec 003-tag-qr, T053 (research.md secao 7; contracts/public-page.contract.md "Modo reenvio").
-- Dois jobs do pg_cron:
--   faro-resend-scan-notices (a cada 5 min): chama a Edge Function `register-scan` em modo `resend` para os scans das
--       ultimas 24 h sem aviso (ate 3 tentativas). A URL das funcoes e a chave do servidor (`x-faro-ssr-key`) NAO ficam
--       nesta migration nem em nenhum arquivo: o operador as cria no Vault (`faro_functions_url` e `faro_ssr_key`).
--       Sem os dois segredos (ou sem Vault, como no banco local e no CI) o job nao faz nada.
--   faro-cleanup-tags (diario, 03:17 UTC): apaga ativacoes pendentes vencidas e contadores de limite com mais de 48 h.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─────────────────────────────────────────
-- Funcoes dos jobs (security definer; ninguem de aplicacao as executa: o pg_cron roda como dono)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cron_resend_scan_notices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Vault e opcional: sem ele (ou sem os segredos) nao ha o que chamar.
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
    INTO v_url USING 'faro_functions_url';
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
    INTO v_key USING 'faro_ssr_key';
  IF coalesce(v_url, '') = '' OR coalesce(v_key, '') = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/register-scan',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-faro-ssr-key', v_key),
    body    := jsonb_build_object('action', 'resend'),
    timeout_milliseconds := 10000);
END;
$$;

CREATE OR REPLACE FUNCTION public.cron_cleanup_tags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.pending_activations WHERE expires_at < now();
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '48 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.cron_resend_scan_notices() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_cleanup_tags() FROM PUBLIC, anon, authenticated;

-- `cron.schedule` com nome e idempotente: rodar a migration de novo substitui o job.
SELECT cron.schedule('faro-resend-scan-notices', '*/5 * * * *', 'SELECT public.cron_resend_scan_notices()');
SELECT cron.schedule('faro-cleanup-tags', '17 3 * * *', 'SELECT public.cron_cleanup_tags()');
