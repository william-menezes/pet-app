-- Migration: 0010_perfis_conta.sql
-- Spec 004-conta-tutor, T010 (data-model.md §1). Estende public.perfis com celular e aceite de termos.
-- As politicas de RLS da 001 (perfis_self_select, perfis_self_update, perfis_admin_all) NAO sao alteradas:
-- o privilegio de COLUNA e conferido antes da RLS, entao nem o dono da linha nem o admin alteram
-- celular, termos, e-mail ou papel pela API (so funcoes security definer e service_role).

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS celular               text,
  ADD COLUMN IF NOT EXISTS celular_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS celular_pendente      text,
  ADD COLUMN IF NOT EXISTS termos_aceitos_em     timestamptz,
  ADD COLUMN IF NOT EXISTS termos_versao         text;

COMMENT ON COLUMN public.perfis.celular IS
  'E.164. So recebe numero CONFIRMADO por SMS. celular IS NOT NULL <=> celular confirmado. '
  'E a coluna que a spec 003 le em resolve_tag.';
COMMENT ON COLUMN public.perfis.celular_confirmado_em IS 'Data da confirmacao do numero em celular.';
COMMENT ON COLUMN public.perfis.celular_pendente IS
  'E.164 informado e ainda nao confirmado (cadastro ou troca). Nunca exposto fora da propria conta.';
COMMENT ON COLUMN public.perfis.termos_aceitos_em IS 'Data e hora do aceite dos termos.';
COMMENT ON COLUMN public.perfis.termos_versao IS 'Versao dos termos aceita, formato AAAA-MM.';

-- Formato (o banco e a fonte de verdade; o cliente valida so por UX).
ALTER TABLE public.perfis
  ADD CONSTRAINT perfis_celular_formato
    CHECK (celular IS NULL OR celular ~ '^\+55[1-9][0-9]9[0-9]{8}$'),
  ADD CONSTRAINT perfis_celular_pendente_formato
    CHECK (celular_pendente IS NULL OR celular_pendente ~ '^\+55[1-9][0-9]9[0-9]{8}$'),
  ADD CONSTRAINT perfis_termos_versao_formato
    CHECK (termos_versao IS NULL OR termos_versao ~ '^[0-9]{4}-[0-9]{2}$');

-- Coerencia.
ALTER TABLE public.perfis
  ADD CONSTRAINT perfis_celular_confirmado_coerente
    CHECK ((celular IS NULL) = (celular_confirmado_em IS NULL)),
  ADD CONSTRAINT perfis_termos_coerente
    CHECK ((termos_aceitos_em IS NULL) = (termos_versao IS NULL)),
  ADD CONSTRAINT perfis_nome_tamanho
    CHECK (char_length(nome) <= 80);

-- Privilegios: deny-by-default por coluna. Nenhum privilegio para anon.
REVOKE ALL ON public.perfis FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.perfis FROM authenticated;
GRANT SELECT ON public.perfis TO authenticated;
GRANT UPDATE (nome) ON public.perfis TO authenticated;

-- updated_at acompanha toda atualizacao.
CREATE OR REPLACE FUNCTION public.perfis_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.perfis_set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS perfis_set_updated_at ON public.perfis;
CREATE TRIGGER perfis_set_updated_at
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.perfis_set_updated_at();
