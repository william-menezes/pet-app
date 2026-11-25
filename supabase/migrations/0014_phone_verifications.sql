-- Migration: 0014_phone_verifications.sql
-- Spec 004-conta-tutor, T041 (data-model.md §2). Uma linha por codigo de SMS emitido; no maximo uma aberta por conta.
-- INVARIANTE: RLS habilitada + deny-by-default NA MESMA MIGRATION que cria a tabela.
-- O codigo NUNCA e gravado: so o HMAC com chave (PHONE_OTP_PEPPER, que nao vai ao banco). O numero em claro
-- fica em perfis.celular_pendente (dado da propria conta); aqui so ha o HMAC do numero.

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.perfis (id) ON DELETE CASCADE,
  phone_hash     text        NOT NULL,
  code_hash      text        NOT NULL,
  attempts       smallint    NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts   smallint    NOT NULL DEFAULT 5,
  expires_at     timestamptz NOT NULL,
  consumed_at    timestamptz,
  invalidated_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.phone_verifications IS
  'Codigos de confirmacao de celular (spec 004). Somente HMACs com chave; nunca o codigo nem o numero. '
  'Acesso so por service_role e funcoes security definer.';

-- Uma verificacao aberta por conta.
CREATE UNIQUE INDEX IF NOT EXISTS uq_phone_verifications_open_per_user
  ON public.phone_verifications (user_id)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_created
  ON public.phone_verifications (user_id, created_at DESC);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma politica: negar por padrao.
REVOKE ALL ON public.phone_verifications FROM anon, authenticated;
