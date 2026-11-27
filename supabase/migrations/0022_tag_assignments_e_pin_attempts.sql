-- Migration: 0022_tag_assignments_e_pin_attempts.sql
-- Spec 003-tag-qr, T014 (data-model.md). Vinculo tag-pet-tutor (com historico) e tentativas de PIN por conta+tag.
-- RLS na mesma migration; nenhum privilegio nem politica para `anon`.

-- ─────────────────────────────────────────
-- tag_assignments (vinculos)
-- ─────────────────────────────────────────
CREATE TABLE public.tag_assignments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_code   character(9) NOT NULL REFERENCES public.tag_codes (code),
  -- set null (e nao cascade): o historico da tag sobrevive a exclusao do pet ou da conta (data-model.md).
  pet_id     uuid        REFERENCES public.pets (id) ON DELETE SET NULL,
  tutor_id   uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz,
  end_reason text        CHECK (end_reason IS NULL OR end_reason IN
                                ('released', 'transferred', 'lost', 'damaged', 'admin', 'account_deleted')),
  -- ended_at e end_reason: nulos juntos ou preenchidos juntos.
  CONSTRAINT tag_assignments_fim_coerente CHECK ((ended_at IS NULL) = (end_reason IS NULL)),
  CONSTRAINT tag_assignments_fim_depois_do_inicio CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Uma tag tem no maximo um vinculo ativo; um pet tem no maximo uma tag ativa.
CREATE UNIQUE INDEX tag_assignments_tag_ativa_uq ON public.tag_assignments (tag_code) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX tag_assignments_pet_ativo_uq ON public.tag_assignments (pet_id) WHERE ended_at IS NULL;
CREATE INDEX tag_assignments_tutor_id_idx ON public.tag_assignments (tutor_id);
CREATE INDEX tag_assignments_tag_code_idx ON public.tag_assignments (tag_code, started_at DESC);

ALTER TABLE public.tag_assignments ENABLE ROW LEVEL SECURITY;

-- O tutor le os seus (ativos e encerrados); o admin le todos. Escrita so por RPC security definer.
REVOKE ALL ON public.tag_assignments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tag_assignments TO service_role;
GRANT SELECT ON public.tag_assignments TO authenticated;

CREATE POLICY tag_assignments_tutor_select ON public.tag_assignments
  FOR SELECT TO authenticated USING (tutor_id = auth.uid());
CREATE POLICY tag_assignments_admin_select ON public.tag_assignments
  FOR SELECT TO authenticated USING (public.is_admin());

COMMENT ON TABLE public.tag_assignments IS
  'Vinculo tag-pet-tutor com inicio e fim. Isola os scans: cada scan referencia o vinculo vigente (scan_events.assignment_id).';

-- ─────────────────────────────────────────
-- tag_pin_attempts (PIN errado por conta e tag)
-- ─────────────────────────────────────────
CREATE TABLE public.tag_pin_attempts (
  tag_code     character(9) NOT NULL REFERENCES public.tag_codes (code),
  tutor_id     uuid         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fail_count   integer      NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  window_start timestamptz,
  locked_until timestamptz,
  PRIMARY KEY (tag_code, tutor_id)
);

CREATE INDEX tag_pin_attempts_tutor_id_idx ON public.tag_pin_attempts (tutor_id);

ALTER TABLE public.tag_pin_attempts ENABLE ROW LEVEL SECURITY;

-- So o admin le (fila de tags travadas). O tutor nunca: so as RPCs tocam a tabela.
REVOKE ALL ON public.tag_pin_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tag_pin_attempts TO service_role;
GRANT SELECT ON public.tag_pin_attempts TO authenticated;

CREATE POLICY tag_pin_attempts_admin_select ON public.tag_pin_attempts
  FOR SELECT TO authenticated USING (public.is_admin());

COMMENT ON TABLE public.tag_pin_attempts IS
  'Erros de PIN por conta+tag (5 em 15 min travam a conta naquela tag). Sem acesso do tutor; admin so le.';
