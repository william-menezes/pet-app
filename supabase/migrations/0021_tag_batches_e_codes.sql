-- Migration: 0021_tag_batches_e_codes.sql
-- Spec 003-tag-qr, T013 (data-model.md; contracts/tag-code.contract.md; Principio VIII, contrato fisico).
-- Primeiro as funcoes do codigo da tag (a CHECK de tag_codes depende delas), depois as tabelas.
-- tag_normalize / tag_is_valid / tag_format seguem EXATAMENTE a regra de
-- src/app/core/tag-code/tag-code.ts (copiada em supabase/functions/_shared/tag-code.ts): se um teste cruzado
-- divergir, o erro esta aqui, nunca no lote-001.

-- ─────────────────────────────────────────
-- Funcoes do codigo da tag (immutable, puras)
-- ─────────────────────────────────────────

-- Maiusculas ASCII (a-z), sem hifen e sem espacos ASCII (espaco, tab, LF, VT, FF, CR); O vira 0, I e L viram 1.
-- ASCII de proposito, igual ao TypeScript: nada de locale nem dobra de caixa Unicode. Nao valida.
CREATE OR REPLACE FUNCTION public.tag_normalize(p_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
  -- 1o translate: a-z -> A-Z. 2o: O->0, I->1, L->1 e remocao (caracteres de `from` sem par em `to` somem).
  SELECT translate(
    translate(p_input, 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
    'OIL-' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || ' ',
    '011'
  );
$$;

-- Luhn mod 32 sobre o alfabeto Crockford (research.md secao 2): da direita para a esquerda, fator 2 no
-- caractere mais a direita e alternando 2, 1, 2, 1...; soma floor(a/32) + a mod 32; digito = (32 - total mod 32) mod 32.
-- Devolve NULL se o corpo nao tem exatamente 8 caracteres do alfabeto.
CREATE OR REPLACE FUNCTION public.tag_check_digit(p_body text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  c_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_factor   integer := 2;
  v_total    integer := 0;
  v_addend   integer;
  v_index    integer;
  i          integer;
BEGIN
  IF p_body IS NULL OR p_body !~ '^[0-9A-HJKMNP-TV-Z]{8}$' THEN
    RETURN NULL;
  END IF;
  FOR i IN REVERSE 8..1 LOOP
    v_index  := strpos(c_alphabet, substr(p_body, i, 1)) - 1;
    v_addend := v_factor * v_index;
    v_total  := v_total + (v_addend / 32) + (v_addend % 32);
    v_factor := 3 - v_factor;
  END LOOP;
  RETURN substr(c_alphabet, ((32 - (v_total % 32)) % 32) + 1, 1);
END;
$$;

-- true se, depois de normalizar, tem 9 caracteres do alfabeto e o digito confere. NULL nunca e valido:
-- numa CHECK, NULL passaria, por isso a funcao devolve false (nao NULL) para entrada nula.
CREATE OR REPLACE FUNCTION public.tag_is_valid(p_input text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    public.tag_normalize(p_input) ~ '^[0-9A-HJKMNP-TV-Z]{9}$'
    AND public.tag_check_digit(substr(public.tag_normalize(p_input), 1, 8)) = substr(public.tag_normalize(p_input), 9, 1),
    false);
$$;

-- 'XXXX-XXXX-X'. NULL se a entrada nao for um codigo valido (no TypeScript, `format` lanca erro).
CREATE OR REPLACE FUNCTION public.tag_format(p_code character)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN public.tag_is_valid(p_code::text)
              THEN substr(public.tag_normalize(p_code::text), 1, 4) || '-'
                || substr(public.tag_normalize(p_code::text), 5, 4) || '-'
                || substr(public.tag_normalize(p_code::text), 9, 1)
         END;
$$;

-- Pure, sem dado nenhum: so o dono do banco e o service_role as chamam (o CHECK de tag_codes roda como quem
-- grava, e quem grava codigos e sempre uma funcao do dono ou o service_role).
REVOKE ALL ON FUNCTION public.tag_normalize(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tag_check_digit(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tag_is_valid(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tag_format(character) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tag_normalize(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tag_check_digit(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tag_is_valid(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tag_format(character) TO service_role;

-- ─────────────────────────────────────────
-- tag_batches
-- ─────────────────────────────────────────
CREATE TABLE public.tag_batches (
  id                    text        PRIMARY KEY CHECK (id ~ '^lote-[0-9]{3,}$'),
  quantity              integer     NOT NULL CHECK (quantity BETWEEN 1 AND 500),
  created_by            uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  notes                 text,
  package_downloaded_at timestamptz
);

ALTER TABLE public.tag_batches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tag_batches FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tag_batches TO service_role;
GRANT SELECT ON public.tag_batches TO authenticated;

CREATE POLICY tag_batches_admin_select ON public.tag_batches
  FOR SELECT TO authenticated USING (public.is_admin());

-- ─────────────────────────────────────────
-- tag_codes: o contrato fisico no banco
-- ─────────────────────────────────────────
CREATE TABLE public.tag_codes (
  code                  character(9) PRIMARY KEY
                          CHECK (code ~ '^[0-9A-HJKMNP-TV-Z]{9}$')
                          CHECK (public.tag_is_valid(code::text)),
  batch_id              text         NOT NULL REFERENCES public.tag_batches (id),
  status                text         NOT NULL DEFAULT 'available'
                          CHECK (status IN ('available', 'assigned', 'blocked', 'void')),
  -- So hash bcrypt de custo 12 (crypt(pin, gen_salt('bf', 12))); nunca o PIN, nunca outro custo.
  activation_pin_hash   text         NOT NULL CHECK (activation_pin_hash ~ '^\$2[abxy]\$12\$.{53}$'),
  pin_fail_count_24h   integer      NOT NULL DEFAULT 0 CHECK (pin_fail_count_24h >= 0),
  pin_fail_window_start timestamptz,
  pin_locked_until      timestamptz,
  qr_version            smallint     NOT NULL DEFAULT 3,
  qr_mask               smallint     NOT NULL CHECK (qr_mask BETWEEN 0 AND 7),
  notes                 text,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  -- Com o dominio fixo a URL tem 32 caracteres: sempre versao 3 com correcao H (research.md secao 11).
  CONSTRAINT tag_codes_qr_version_3 CHECK (qr_version = 3)
);

CREATE INDEX tag_codes_batch_id_idx ON public.tag_codes (batch_id);
CREATE INDEX tag_codes_status_idx ON public.tag_codes (status);

-- Imutabilidade (Principio VIII): `code`, `batch_id`, `qr_version` e `qr_mask` nunca mudam; ninguem sai de `void`.
CREATE OR REPLACE FUNCTION public.tag_codes_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code
     OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
     OR NEW.qr_version IS DISTINCT FROM OLD.qr_version
     OR NEW.qr_mask IS DISTINCT FROM OLD.qr_mask THEN
    RAISE EXCEPTION 'tag_code_immutable' USING ERRCODE = 'P0001',
      HINT = 'code, batch_id, qr_version e qr_mask nunca mudam (Principio VIII)';
  END IF;
  IF OLD.status = 'void' AND NEW.status IS DISTINCT FROM 'void' THEN
    RAISE EXCEPTION 'tag_code_void_is_final' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tag_codes_guard_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'tag_code_never_deleted' USING ERRCODE = 'P0001',
    HINT = 'codigo nunca e apagado; "excluir" e o status void (Principio VIII)';
END;
$$;

REVOKE ALL ON FUNCTION public.tag_codes_guard_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tag_codes_guard_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tag_codes_guard_update
  BEFORE UPDATE ON public.tag_codes
  FOR EACH ROW EXECUTE FUNCTION public.tag_codes_guard_update();
CREATE TRIGGER tag_codes_guard_delete
  BEFORE DELETE ON public.tag_codes
  FOR EACH ROW EXECUTE FUNCTION public.tag_codes_guard_delete();
-- TRUNCATE tambem e DELETE: bloqueado para todos, dono do banco inclusive.
CREATE TRIGGER tag_codes_guard_truncate
  BEFORE TRUNCATE ON public.tag_codes
  FOR EACH STATEMENT EXECUTE FUNCTION public.tag_codes_guard_delete();

ALTER TABLE public.tag_codes ENABLE ROW LEVEL SECURITY;

-- Nenhum privilegio e nenhuma politica para `authenticated` nem `anon`: nunca direto, so por RPC security
-- definer (inclusive o admin, que nao ve `activation_pin_hash`). Fecha o acesso as colunas sensiveis.
REVOKE ALL ON public.tag_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tag_codes TO service_role;

COMMENT ON TABLE public.tag_codes IS
  'Codigos impressos (Principio VIII). Nunca apagados (void). Sem acesso direto de anon/authenticated; so RPC security definer.';
COMMENT ON COLUMN public.tag_codes.activation_pin_hash IS 'bcrypt custo 12 do PIN do cartao. Nunca exposto a authenticated.';
COMMENT ON COLUMN public.tag_codes.qr_mask IS 'Mascara do QR gravada por codigo, para a reimpressao sair identica.';
