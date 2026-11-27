-- Migration: 0023_pending_activations_e_rate_limits.sql
-- Spec 003-tag-qr, T015 (data-model.md). Ativacao pendente (codigo guardado enquanto o tutor cria a conta) e
-- contadores de janela fixa usados por resolve_tag (por ip_hash) e pelas RPCs do tutor.
-- RLS habilitada, SEM nenhuma politica e SEM privilegio para anon ou authenticated: so funcoes security
-- definer (e service_role) tocam estas tabelas.

-- ─────────────────────────────────────────
-- pending_activations
-- ─────────────────────────────────────────
-- Sem FK para tag_codes: o codigo pode nem existir, e a tabela nao pode servir de oraculo.
CREATE TABLE public.pending_activations (
  tutor_id   uuid         PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tag_code   character(9) NOT NULL CHECK (public.tag_is_valid(tag_code::text) AND tag_code = public.tag_normalize(tag_code::text)),
  created_at timestamptz  NOT NULL DEFAULT now(),
  expires_at timestamptz  NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX pending_activations_expires_at_idx ON public.pending_activations (expires_at);

ALTER TABLE public.pending_activations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_activations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pending_activations TO service_role;

COMMENT ON TABLE public.pending_activations IS
  'Codigo normalizado que o tutor tentou ativar antes de ter conta. So por RPC. Vale 7 dias; limpa pelo job de 0033.';

-- ─────────────────────────────────────────
-- rate_limits
-- ─────────────────────────────────────────
CREATE TABLE public.rate_limits (
  scope        text        NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 64),
  key          text        NOT NULL CHECK (char_length(key) BETWEEN 1 AND 128),
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 1 CHECK (count >= 1),
  PRIMARY KEY (scope, key, window_start)
);

CREATE INDEX rate_limits_window_start_idx ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

COMMENT ON TABLE public.rate_limits IS
  'Contadores de janela fixa (scope, key, window_start). Sem politica: so funcoes security definer. Linhas com mais de 48 h saem no job de 0033.';

-- ─────────────────────────────────────────
-- rate_limit_hit(scope, key, limit, window_seconds) -> boolean (true = ESTOUROU)
-- ─────────────────────────────────────────
-- Janela fixa: o inicio da janela e `now()` arredondado para baixo ao multiplo de p_window_seconds desde a epoca
-- (60 = minuto, 3600 = hora, 900 = 15 min). A chamada conta a si mesma: com limite 30, a 30a devolve false e a
-- 31a devolve true. O contador so sobrevive se quem chama NAO lancar excecao depois (por isso as RPCs do tutor
-- devolvem {"ok":false,...} em vez de RAISE; research/contratos).
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_scope text, p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start timestamptz;
  v_count integer;
BEGIN
  IF p_scope IS NULL OR p_key IS NULL OR p_limit IS NULL OR p_limit < 1
     OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'rate_limit_hit: parametros invalidos';
  END IF;
  v_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.rate_limits AS r (scope, key, window_start, count)
  VALUES (p_scope, p_key, v_start, 1)
  ON CONFLICT (scope, key, window_start) DO UPDATE SET count = r.count + 1
  RETURNING r.count INTO v_count;
  RETURN v_count > p_limit;
END;
$$;

-- Funcao interna: as funcoes security definer do banco a chamam como dono; as Edge Functions (service_role)
-- a chamam para os limites de register-scan.
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) TO service_role;
