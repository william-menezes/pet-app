-- Migration: 0011_rate_limit_events.sql
-- Spec 004-conta-tutor, T012 (data-model.md §3, contracts/rate-limit.rpc.md).
-- Limitador generico de janela deslizante. Nao substitui auth_login_attempts (limite de login da 001).
-- INVARIANTE: RLS habilitada + deny-by-default NA MESMA MIGRATION que cria a tabela.

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id     bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text        NOT NULL,
  key    text        NOT NULL,
  at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rate_limit_events IS
  'Contador de janela deslizante (spec 004). key e id de conta, hash de numero, hash de IP, hash de e-mail '
  'ou global: NUNCA e-mail, telefone ou IP em claro. Acesso so por service_role e funcoes security definer.';

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_bucket_key_at
  ON public.rate_limit_events (bucket, key, at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma politica: negar por padrao.
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.rate_limit_events_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rate_limit_check(p_checks jsonb, p_record boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n             integer;
  v_item          jsonb;
  v_i             integer;
  v_rec           record;
  v_bucket        text;
  v_key           text;
  v_max           integer;
  v_window        integer;
  v_count         integer;
  v_oldest        timestamptz;
  v_retry         integer;
  v_denied_bucket text    := NULL;
  v_max_retry     integer := 0;
BEGIN
  -- Entrada: array de 1 a 8 objetos {bucket, key, max, window}.
  IF p_checks IS NULL OR jsonb_typeof(p_checks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_checks';
  END IF;
  v_n := jsonb_array_length(p_checks);
  IF v_n < 1 OR v_n > 8 THEN
    RAISE EXCEPTION 'invalid_checks';
  END IF;

  FOR v_i IN 0 .. v_n - 1 LOOP
    v_item := p_checks -> v_i;
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item -> 'bucket') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item -> 'key') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item -> 'max') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_item -> 'window') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'invalid_checks';
    END IF;
    v_bucket := v_item ->> 'bucket';
    v_key    := v_item ->> 'key';
    IF char_length(btrim(v_bucket)) < 1 OR char_length(v_bucket) > 200
       OR char_length(btrim(v_key)) < 1 OR char_length(v_key) > 200 THEN
      RAISE EXCEPTION 'invalid_checks';
    END IF;
    IF (v_item ->> 'max') !~ '^[0-9]{1,9}$' OR (v_item ->> 'window') !~ '^[0-9]{1,9}$' THEN
      RAISE EXCEPTION 'invalid_checks';
    END IF;
    IF (v_item ->> 'max')::integer < 1
       OR (v_item ->> 'window')::integer < 1
       OR (v_item ->> 'window')::integer > 604800 THEN
      RAISE EXCEPTION 'invalid_checks';
    END IF;
  END LOOP;

  -- 1. Travas em ordem alfabetica de bucket|key (evita impasse entre chamadas concorrentes).
  FOR v_rec IN
    SELECT (e ->> 'bucket') AS b, (e ->> 'key') AS k
    FROM jsonb_array_elements(p_checks) AS e
    ORDER BY (e ->> 'bucket') || '|' || (e ->> 'key')
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_rec.b || '|' || v_rec.k, 0));
  END LOOP;

  -- 2 a 5. Avalia cada checagem na ordem recebida.
  FOR v_rec IN
    SELECT e AS item
    FROM jsonb_array_elements(p_checks) WITH ORDINALITY AS t(e, ord)
    ORDER BY ord
  LOOP
    v_bucket := v_rec.item ->> 'bucket';
    v_key    := v_rec.item ->> 'key';
    v_max    := (v_rec.item ->> 'max')::integer;
    v_window := (v_rec.item ->> 'window')::integer;

    DELETE FROM public.rate_limit_events
     WHERE bucket = v_bucket AND key = v_key AND at < now() - interval '48 hours';

    SELECT count(*), min(at)
      INTO v_count, v_oldest
      FROM public.rate_limit_events
     WHERE bucket = v_bucket AND key = v_key
       AND at > now() - make_interval(secs => v_window);

    IF v_count >= v_max THEN
      v_retry := GREATEST(
        1,
        ceil(extract(epoch FROM (v_oldest + make_interval(secs => v_window) - now())))::integer
      );
      IF v_denied_bucket IS NULL THEN
        v_denied_bucket := v_bucket;
      END IF;
      v_max_retry := GREATEST(v_max_retry, v_retry);
    END IF;
  END LOOP;

  -- 5. Se alguma negou: nada e gravado (tudo ou nada).
  IF v_denied_bucket IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'denied_bucket', v_denied_bucket,
      'retry_after_seconds', v_max_retry
    );
  END IF;

  -- 6. Todas permitiram: grava um evento por checagem.
  IF p_record THEN
    INSERT INTO public.rate_limit_events (bucket, key)
    SELECT (e ->> 'bucket'), (e ->> 'key')
    FROM jsonb_array_elements(p_checks) AS e;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'denied_bucket', NULL, 'retry_after_seconds', 0);
END;
$$;

COMMENT ON FUNCTION public.rate_limit_check(jsonb, boolean) IS
  'Limitador de janela deslizante (spec 004). So service_role e funcoes security definer. '
  'Tudo ou nada: negativa em um eixo nao consome cota dos outros.';

REVOKE ALL ON FUNCTION public.rate_limit_check(jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(jsonb, boolean) TO service_role;
