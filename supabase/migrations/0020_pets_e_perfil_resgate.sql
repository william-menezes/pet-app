-- Migration: 0020_pets_e_perfil_resgate.sql
-- Spec 003-tag-qr, T012 (data-model.md: pets e rescue_profiles; contracts/rls-expectations.md).
-- RLS habilitada na mesma migration, nenhuma politica nem privilegio para `anon`. Depois da 0017, tabela nova
-- nasce sem acesso de `anon` mas COM todos os privilegios padrao de `authenticated`: por isso cada tabela comeca
-- com REVOKE ALL e so recebe os GRANTs (de coluna) que o contrato manda.

-- ─────────────────────────────────────────
-- Funcao de apoio: updated_at (trigger comum as tabelas desta spec)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Temperamento: ate 5 itens, cada um de 1 a 30 caracteres. Usada num CHECK, que roda com o papel de quem
-- grava (por isso `authenticated` precisa de EXECUTE). Pura: nao le tabela.
CREATE OR REPLACE FUNCTION public.pet_temperament_ok(p_items text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(cardinality(p_items), 0) <= 5
     AND coalesce((SELECT bool_and(i IS NOT NULL AND char_length(i) BETWEEN 1 AND 30) FROM unnest(p_items) AS i), true);
$$;

REVOKE ALL ON FUNCTION public.pet_temperament_ok(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pet_temperament_ok(text[]) TO authenticated, service_role;

-- ─────────────────────────────────────────
-- pets
-- ─────────────────────────────────────────
CREATE TABLE public.pets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  species     text        NOT NULL CHECK (species IN ('dog', 'cat')),
  breed       text        CHECK (breed IS NULL OR char_length(breed) <= 60),
  sex         text        CHECK (sex IS NULL OR sex IN ('male', 'female')),
  size        text        CHECK (size IS NULL OR size IN ('small', 'medium', 'large')),
  neutered    boolean,
  birth_month date        CHECK (birth_month IS NULL OR extract(day FROM birth_month) = 1),
  temperament text[]      NOT NULL DEFAULT '{}' CHECK (public.pet_temperament_ok(temperament)),
  care_notes  text        CHECK (care_notes IS NULL OR char_length(care_notes) <= 280),
  photo_path  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- A foto fica na pasta do proprio tutor no bucket `pet-photos` (0032): <tutor_id>/<pet_id>/<arquivo>.
  CONSTRAINT pets_photo_path_do_tutor CHECK (photo_path IS NULL OR photo_path LIKE tutor_id::text || '/%')
);

CREATE INDEX pets_tutor_id_idx ON public.pets (tutor_id);

CREATE TRIGGER pets_touch_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- Privilegios: o tutor cria, edita e remove os seus pets. `tutor_id` so no INSERT (a politica exige que seja
-- o proprio); depois de criado, o pet nao troca de dono.
REVOKE ALL ON public.pets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pets TO service_role;
GRANT SELECT, DELETE ON public.pets TO authenticated;
GRANT INSERT (tutor_id, name, species, breed, sex, size, neutered, birth_month, temperament, care_notes, photo_path)
  ON public.pets TO authenticated;
GRANT UPDATE (name, species, breed, sex, size, neutered, birth_month, temperament, care_notes, photo_path)
  ON public.pets TO authenticated;

CREATE POLICY pets_tutor_select ON public.pets
  FOR SELECT TO authenticated USING (tutor_id = auth.uid());
CREATE POLICY pets_tutor_insert ON public.pets
  FOR INSERT TO authenticated WITH CHECK (tutor_id = auth.uid());
CREATE POLICY pets_tutor_update ON public.pets
  FOR UPDATE TO authenticated USING (tutor_id = auth.uid()) WITH CHECK (tutor_id = auth.uid());
CREATE POLICY pets_tutor_delete ON public.pets
  FOR DELETE TO authenticated USING (tutor_id = auth.uid());
-- Admin le (suporte); nao altera.
CREATE POLICY pets_admin_select ON public.pets
  FOR SELECT TO authenticated USING (public.is_admin());

COMMENT ON TABLE public.pets IS
  'Pet do tutor (spec 003). RLS por tutor_id = auth.uid(); admin so le. photo_path aponta para o bucket privado pet-photos.';

-- ─────────────────────────────────────────
-- rescue_profiles: o que a pagina publica mostra (uma linha por pet, criada por gatilho)
-- ─────────────────────────────────────────
CREATE TABLE public.rescue_profiles (
  pet_id                uuid        PRIMARY KEY REFERENCES public.pets (id) ON DELETE CASCADE,
  show_temperament      boolean     NOT NULL DEFAULT true,
  show_care             boolean     NOT NULL DEFAULT true,
  show_tutor_first_name boolean     NOT NULL DEFAULT false,
  show_whatsapp         boolean     NOT NULL DEFAULT false,
  show_phone            boolean     NOT NULL DEFAULT false,
  lost_mode             boolean     NOT NULL DEFAULT false,
  lost_since            timestamptz,
  lost_message          text        CHECK (lost_message IS NULL OR char_length(lost_message) <= 280),
  lost_show_since       boolean     NOT NULL DEFAULT true,
  lost_show_reward      boolean     NOT NULL DEFAULT false,
  lost_show_message     boolean     NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER rescue_profiles_touch_updated_at
  BEFORE UPDATE ON public.rescue_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.rescue_profiles ENABLE ROW LEVEL SECURITY;

-- Criacao do perfil junto do pet. SECURITY DEFINER porque o tutor nao tem INSERT em rescue_profiles.
CREATE OR REPLACE FUNCTION public.pets_create_rescue_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.rescue_profiles (pet_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pets_create_rescue_profile() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pets_create_rescue_profile
  AFTER INSERT ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.pets_create_rescue_profile();

-- Regra do celular confirmado (spec 004 expoe phone_is_confirmed): show_whatsapp e show_phone so ligam com o
-- celular do tutor confirmado. So olha quando o campo VIRA verdadeiro, para nao travar edicoes de um perfil
-- que ja estava ligado. Erro de integridade (as RPCs devolvem phone_not_confirmed antes de chegar aqui).
CREATE OR REPLACE FUNCTION public.rescue_profiles_check_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tutor uuid;
BEGIN
  IF (NEW.show_whatsapp AND (TG_OP = 'INSERT' OR NOT OLD.show_whatsapp))
     OR (NEW.show_phone AND (TG_OP = 'INSERT' OR NOT OLD.show_phone)) THEN
    SELECT p.tutor_id INTO v_tutor FROM public.pets p WHERE p.id = NEW.pet_id;
    IF v_tutor IS NULL OR NOT public.phone_is_confirmed(v_tutor) THEN
      RAISE EXCEPTION 'phone_not_confirmed' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.rescue_profiles_check_phone() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rescue_profiles_check_phone
  BEFORE INSERT OR UPDATE ON public.rescue_profiles
  FOR EACH ROW EXECUTE FUNCTION public.rescue_profiles_check_phone();

-- Privilegios: o tutor le e altera so os campos de visibilidade. `lost_mode`, `lost_since` e `lost_message`
-- so mudam por set_lost_mode (security definer). Sem INSERT nem DELETE para o cliente (cascata do pet).
REVOKE ALL ON public.rescue_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rescue_profiles TO service_role;
GRANT SELECT ON public.rescue_profiles TO authenticated;
GRANT UPDATE (show_temperament, show_care, show_tutor_first_name, show_whatsapp, show_phone,
              lost_show_since, lost_show_reward, lost_show_message)
  ON public.rescue_profiles TO authenticated;

CREATE POLICY rescue_profiles_tutor_select ON public.rescue_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.tutor_id = auth.uid()));
CREATE POLICY rescue_profiles_tutor_update ON public.rescue_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.tutor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.tutor_id = auth.uid()));
CREATE POLICY rescue_profiles_admin_select ON public.rescue_profiles
  FOR SELECT TO authenticated USING (public.is_admin());

COMMENT ON TABLE public.rescue_profiles IS
  'Perfil de resgate (spec 003): o que a pagina publica mostra. Modo perdido so por RPC. show_whatsapp/show_phone exigem celular confirmado.';
