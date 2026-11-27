-- Migration: 0026_audit_log.sql
-- Spec 003-tag-qr, T019 (data-model.md). Auditoria de tags: so insercao, por funcao `audit(...)`.
-- RLS na mesma migration; nenhum privilegio nem politica para `anon`. Nem `authenticated` le direto: o admin
-- le por RPC (admin_audit, 0030). `detail` nunca guarda PIN, telefone nem IP.

CREATE TABLE public.audit_log (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor_id   uuid,        -- sem FK: o registro sobrevive a exclusao da conta
  actor_role text,
  event      text        NOT NULL CHECK (char_length(event) BETWEEN 1 AND 64),
  entity     text,
  entity_id  text,
  detail     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_log_detail_objeto CHECK (jsonb_typeof(detail) = 'object'),
  -- Barreira de ultima linha contra vazamento: chaves de primeiro nivel que nunca podem existir.
  CONSTRAINT audit_log_detail_sem_segredos CHECK (
    NOT (detail ?| ARRAY['pin', 'new_pin', 'activation_pin', 'pin_hash', 'activation_pin_hash',
                         'ip', 'ip_hash', 'phone', 'celular', 'token', 'password', 'senha'])
  )
);

CREATE INDEX audit_log_at_idx ON public.audit_log (at DESC);
CREATE INDEX audit_log_event_idx ON public.audit_log (event, at DESC);
CREATE INDEX audit_log_entity_idx ON public.audit_log (entity_id, at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Ninguem de aplicacao le ou escreve direto, e ninguem altera ou apaga: append-only (service_role incluido).
REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated;
-- service_role so insere e le (append-only); explicito, sem depender dos privilegios padrao.
REVOKE ALL ON public.audit_log FROM service_role;
GRANT SELECT, INSERT ON public.audit_log TO service_role;
REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.audit_log_id_seq TO service_role;

-- audit(event, entity, entity_id, detail): unico caminho de escrita para as RPCs. Identidade vem do JWT
-- (null quando chamada por service_role ou por funcao interna sem sessao).
CREATE OR REPLACE FUNCTION public.audit(p_event text, p_entity text, p_entity_id text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, actor_role, event, entity, entity_id, detail)
  VALUES (auth.uid(), coalesce(auth.role(), 'system'), p_event, p_entity, p_entity_id, coalesce(p_detail, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.audit(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit(text, text, text, jsonb) TO service_role;

COMMENT ON TABLE public.audit_log IS
  'Auditoria das tags (so insercao). detail nunca tem PIN, telefone nem IP. Leitura so por admin_audit.';
