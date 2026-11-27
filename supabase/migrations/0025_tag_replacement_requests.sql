-- Migration: 0025_tag_replacement_requests.sql
-- Spec 003-tag-qr, T018 (data-model.md). Pedidos de segunda via (tag danificada ou perdida).
-- RLS na mesma migration; nenhum privilegio nem politica para `anon`. Criacao por RPC (request_tag_replacement);
-- resolucao por RPC do admin (admin_resolve_replacement).

CREATE TABLE public.tag_replacement_requests (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_code    character(9) NOT NULL REFERENCES public.tag_codes (code),
  pet_id      uuid         REFERENCES public.pets (id) ON DELETE SET NULL,
  tutor_id    uuid         REFERENCES auth.users (id) ON DELETE SET NULL,
  kind        text         NOT NULL CHECK (kind IN ('damaged', 'lost')),
  status      text         NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid         REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Aberto <=> sem data de resolucao.
  CONSTRAINT tag_replacement_requests_resolucao_coerente CHECK ((status = 'open') = (resolved_at IS NULL))
);

CREATE INDEX tag_replacement_requests_tutor_idx ON public.tag_replacement_requests (tutor_id, status);
CREATE INDEX tag_replacement_requests_open_idx ON public.tag_replacement_requests (created_at) WHERE status = 'open';

ALTER TABLE public.tag_replacement_requests ENABLE ROW LEVEL SECURITY;

-- O tutor le os seus; o admin le todos. Nenhuma escrita direta.
REVOKE ALL ON public.tag_replacement_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tag_replacement_requests TO service_role;
GRANT SELECT ON public.tag_replacement_requests TO authenticated;

CREATE POLICY tag_replacement_requests_tutor_select ON public.tag_replacement_requests
  FOR SELECT TO authenticated USING (tutor_id = auth.uid());
CREATE POLICY tag_replacement_requests_admin_select ON public.tag_replacement_requests
  FOR SELECT TO authenticated USING (public.is_admin());

COMMENT ON TABLE public.tag_replacement_requests IS
  'Pedidos de segunda via. Criacao por request_tag_replacement; fechamento por admin_resolve_replacement.';
