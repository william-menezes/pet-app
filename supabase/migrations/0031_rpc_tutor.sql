-- Migration: 0031_rpc_tutor.sql
-- Spec 003-tag-qr (contracts/tutor-rpcs.contract.md). Operacoes do tutor sobre o pet e a tag. Este arquivo recebe
-- funcoes em mais de uma fase (a branch ainda nao foi mesclada em `develop`): T059 (set_lost_mode) agora;
-- T068 (my_dashboard) e T087 (release_tag, request_tag_replacement) entram nas fases deles.
-- Regra 13A: nenhuma RPC daqui lanca excecao para erro de negocio; devolve {"ok":false,"error":"<codigo>"}.
-- EXECUTE so para `authenticated`; identidade = auth.uid().

-- ─────────────────────────────────────────
-- set_lost_mode(p_pet_id, p_on, p_message, p_show_since, p_show_reward) -> jsonb
-- ─────────────────────────────────────────
-- (O contrato escrevia `returns void`; vale a regra 13A: {"ok":true}.)
--  * pet do tutor, senao `pet_not_found`; ligar exige tag ativa, senao `no_active_tag`;
--  * ligar: lost_mode = true; lost_since = now() so se estava desligado (religar em modo ja ligado preserva a data);
--    grava o recado (ate 280 caracteres, pela CHECK da tabela) e as duas opcoes;
--  * desligar: lost_mode = false, lost_since = NULL; o recado e as opcoes ficam como rascunho para a proxima vez;
--  * auditoria `lost_mode_on` / `lost_mode_off` so quando o estado MUDA (o recado nunca vai para a auditoria).
-- `p_on` nulo e erro de programacao (RAISE): nao se adivinha se o modo perdido deve ligar ou desligar.
CREATE OR REPLACE FUNCTION public.set_lost_mode(
  p_pet_id      uuid,
  p_on          boolean,
  p_message     text,
  p_show_since  boolean,
  p_show_reward boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_was boolean;
BEGIN
  IF p_on IS NULL THEN
    RAISE EXCEPTION 'set_lost_mode: p_on nao pode ser nulo' USING ERRCODE = 'P0001';
  END IF;
  IF v_uid IS NULL THEN
    RETURN public.tag_err('pet_not_found');
  END IF;

  -- O pet e do tutor (e trava a linha do perfil de resgate).
  SELECT r.lost_mode INTO v_was
    FROM public.rescue_profiles r
    JOIN public.pets p ON p.id = r.pet_id
   WHERE p.id = p_pet_id AND p.tutor_id = v_uid
     FOR UPDATE OF r;
  IF NOT FOUND THEN
    RETURN public.tag_err('pet_not_found');
  END IF;

  IF p_on THEN
    IF NOT EXISTS (SELECT 1 FROM public.tag_assignments a
                    WHERE a.pet_id = p_pet_id AND a.tutor_id = v_uid AND a.ended_at IS NULL) THEN
      RETURN public.tag_err('no_active_tag');
    END IF;
    UPDATE public.rescue_profiles
       SET lost_mode         = true,
           lost_since        = CASE WHEN v_was THEN coalesce(lost_since, now()) ELSE now() END,
           lost_message      = p_message,
           lost_show_since   = coalesce(p_show_since, lost_show_since),
           lost_show_reward  = coalesce(p_show_reward, lost_show_reward)
     WHERE pet_id = p_pet_id;
    IF NOT v_was THEN
      PERFORM public.audit('lost_mode_on', 'pet', p_pet_id::text, '{}'::jsonb);
    END IF;
  ELSE
    UPDATE public.rescue_profiles SET lost_mode = false, lost_since = NULL WHERE pet_id = p_pet_id;
    IF v_was THEN
      PERFORM public.audit('lost_mode_off', 'pet', p_pet_id::text, '{}'::jsonb);
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_lost_mode(uuid, boolean, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_lost_mode(uuid, boolean, text, boolean, boolean) TO authenticated;

COMMENT ON FUNCTION public.set_lost_mode(uuid, boolean, text, boolean, boolean) IS
  'Modo perdido (spec 003): liga/desliga no perfil de resgate do pet do tutor. Ligar exige tag ativa; religar preserva lost_since.';
