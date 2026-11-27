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

-- ═════════════════════════════════════════
-- Fases 8 e 10 (T068, T087): my_dashboard, release_tag, request_tag_replacement.
-- Estas tres ja chamam `public.rpc_guard(...)`, que nasce na 0035 (endurecimento): o plpgsql resolve o nome na hora da
-- chamada, entao a ordem das migrations nao importa. A 0035 tambem redefine as RPCs das fases 4 e 6 com a mesma guarda.
-- ═════════════════════════════════════════

-- ─────────────────────────────────────────
-- my_dashboard() -> jsonb   (T068)
-- ─────────────────────────────────────────
-- Uma chamada para o painel. Por pet do tutor: id, nome, especie, photo_path (a URL assinada sai no cliente),
-- modo perdido, tag ativa (codigo formatado e situacao) ou nao, scans do mes e ultimo scan (so dos vinculos DESTE tutor
-- para o pet: scans de vinculos antigos de outro dono nunca entram) e "estranhos veem X de Y" (X = opcoes ligadas entre
-- temperamento, cuidados, primeiro nome, WhatsApp e telefone; Y = 5; nome e foto sao sempre mostrados e ficam de fora).
-- Mais a ativacao pendente. Nunca devolve ip_hash, token, hash de PIN nem dado de outro tutor.
CREATE OR REPLACE FUNCTION public.my_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard   jsonb;
  v_uid     uuid := auth.uid();
  v_month  timestamptz := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_pets    jsonb;
  v_pending character(9);
BEGIN
  IF v_uid IS NULL THEN
    RETURN public.tag_err('tag_unavailable');
  END IF;
  v_guard := public.rpc_guard('tutor_read_min', 120, 60);
  IF v_guard IS NOT NULL THEN
    RETURN v_guard;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id',          p.id,
           'name',        p.name,
           'species',     p.species,
           'photo_path',  p.photo_path,
           'lost_mode',   coalesce(r.lost_mode, false),
           'lost_since',  r.lost_since,
           'has_tag',     a.id IS NOT NULL,
           'tag_code',    CASE WHEN a.id IS NULL THEN NULL ELSE public.tag_format(a.tag_code) END,
           'tag_status',  t.status,
           'scans_month', (SELECT count(*) FROM public.scan_events s
                             JOIN public.tag_assignments sa ON sa.id = s.assignment_id
                            WHERE sa.pet_id = p.id AND sa.tutor_id = v_uid AND s.occurred_at >= v_month),
           'last_scan',   (SELECT jsonb_build_object('occurred_at', s.occurred_at, 'geo_method', s.geo_method)
                             FROM public.scan_events s
                             JOIN public.tag_assignments sa ON sa.id = s.assignment_id
                            WHERE sa.pet_id = p.id AND sa.tutor_id = v_uid
                            ORDER BY s.occurred_at DESC, s.id LIMIT 1),
           'visible_shown', (CASE WHEN r.show_temperament THEN 1 ELSE 0 END + CASE WHEN r.show_care THEN 1 ELSE 0 END
                             + CASE WHEN r.show_tutor_first_name THEN 1 ELSE 0 END + CASE WHEN r.show_whatsapp THEN 1 ELSE 0 END
                             + CASE WHEN r.show_phone THEN 1 ELSE 0 END),
           'visible_total', 5) ORDER BY p.created_at, p.id), '[]'::jsonb)
    INTO v_pets
    FROM public.pets p
    LEFT JOIN public.rescue_profiles r ON r.pet_id = p.id
    LEFT JOIN public.tag_assignments a ON a.pet_id = p.id AND a.tutor_id = v_uid AND a.ended_at IS NULL
    LEFT JOIN public.tag_codes t ON t.code = a.tag_code
   WHERE p.tutor_id = v_uid;

  SELECT pa.tag_code INTO v_pending
    FROM public.pending_activations pa WHERE pa.tutor_id = v_uid AND pa.expires_at > now();

  RETURN jsonb_build_object(
    'ok', true,
    'pets', v_pets,
    'pending_activation', CASE WHEN v_pending IS NULL THEN NULL ELSE public.tag_format(v_pending) END);
END;
$$;

REVOKE ALL ON FUNCTION public.my_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_dashboard() TO authenticated;

-- ─────────────────────────────────────────
-- release_tag(p_code, p_reason) -> jsonb   (T087)
-- ─────────────────────────────────────────
-- p_reason em ('released','transferred'); outro valor e erro de programacao (RAISE). A tag precisa ter vinculo ativo do
-- tutor, senao `not_owner` (mesma resposta para tag inexistente ou de outra pessoa). Encerra o vinculo, desliga o modo
-- perdido do pet, gera PIN NOVO, grava so o hash (bcrypt custo 12) e devolve o PIN em claro UMA unica vez. O PIN nunca vai
-- para auditoria nem log. Tag `blocked` continua `blocked` (so o vinculo acaba; o admin decide o desbloqueio).
CREATE OR REPLACE FUNCTION public.release_tag(p_code text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_code  text;
  v_guard jsonb;
  v_asg   record;
  v_pin   text;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('released', 'transferred') THEN
    RAISE EXCEPTION 'release_tag: p_reason invalido' USING ERRCODE = 'P0001';
  END IF;
  IF v_uid IS NULL THEN
    RETURN public.tag_err('not_owner');
  END IF;
  v_guard := public.rpc_guard('tutor_write_min', 30, 60);
  IF v_guard IS NOT NULL THEN
    RETURN v_guard;
  END IF;

  v_code := public.tag_normalize(p_code);
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;

  -- Trava a tag e o vinculo ativo do proprio tutor.
  PERFORM 1 FROM public.tag_codes t WHERE t.code = v_code::character(9) FOR UPDATE;
  SELECT a.id, a.pet_id INTO v_asg
    FROM public.tag_assignments a
   WHERE a.tag_code = v_code::character(9) AND a.tutor_id = v_uid AND a.ended_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.tag_err('not_owner');
  END IF;

  UPDATE public.tag_assignments SET ended_at = now(), end_reason = p_reason WHERE id = v_asg.id;
  IF v_asg.pet_id IS NOT NULL THEN
    UPDATE public.rescue_profiles SET lost_mode = false, lost_since = NULL WHERE pet_id = v_asg.pet_id AND lost_mode;
  END IF;

  v_pin := public.new_activation_pin();
  UPDATE public.tag_codes
     SET status = CASE WHEN status = 'assigned' THEN 'available' ELSE status END,
         activation_pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf', 12)),
         pin_fail_count_24h = 0, pin_fail_window_start = NULL, pin_locked_until = NULL
   WHERE code = v_code::character(9);
  DELETE FROM public.tag_pin_attempts WHERE tag_code = v_code::character(9);

  PERFORM public.audit('tag_released', 'tag', v_code, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('ok', true, 'code', public.tag_format(v_code::character(9)), 'new_pin', v_pin);
END;
$$;

REVOKE ALL ON FUNCTION public.release_tag(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_tag(text, text) TO authenticated;

-- ─────────────────────────────────────────
-- request_tag_replacement(p_code, p_kind) -> jsonb   (T087)
-- ─────────────────────────────────────────
-- 'damaged': cria o pedido `open`; a tag continua funcionando (o MESMO codigo sera reimpresso). 'lost': cria o pedido,
-- encerra o vinculo com `lost`, anula o codigo (`void`, irreversivel), desliga o modo perdido. No maximo 3 pedidos
-- abertos por tutor (`replacement_limit`); a 0035 repete a regra num gatilho. Outro p_kind: erro de programacao.
CREATE OR REPLACE FUNCTION public.request_tag_replacement(p_code text, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_code  text;
  v_guard jsonb;
  v_asg   record;
  v_req   uuid;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('damaged', 'lost') THEN
    RAISE EXCEPTION 'request_tag_replacement: p_kind invalido' USING ERRCODE = 'P0001';
  END IF;
  IF v_uid IS NULL THEN
    RETURN public.tag_err('not_owner');
  END IF;
  v_guard := public.rpc_guard('tutor_write_min', 30, 60);
  IF v_guard IS NOT NULL THEN
    RETURN v_guard;
  END IF;

  v_code := public.tag_normalize(p_code);
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;

  PERFORM 1 FROM public.tag_codes t WHERE t.code = v_code::character(9) FOR UPDATE;
  SELECT a.id, a.pet_id INTO v_asg
    FROM public.tag_assignments a
   WHERE a.tag_code = v_code::character(9) AND a.tutor_id = v_uid AND a.ended_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.tag_err('not_owner');
  END IF;

  IF (SELECT count(*) FROM public.tag_replacement_requests q WHERE q.tutor_id = v_uid AND q.status = 'open') >= 3 THEN
    RETURN public.tag_err('replacement_limit');
  END IF;

  INSERT INTO public.tag_replacement_requests (tag_code, pet_id, tutor_id, kind)
  VALUES (v_code::character(9), v_asg.pet_id, v_uid, p_kind)
  RETURNING id INTO v_req;

  IF p_kind = 'lost' THEN
    UPDATE public.tag_assignments SET ended_at = now(), end_reason = 'lost' WHERE id = v_asg.id;
    IF v_asg.pet_id IS NOT NULL THEN
      UPDATE public.rescue_profiles SET lost_mode = false, lost_since = NULL WHERE pet_id = v_asg.pet_id AND lost_mode;
    END IF;
    UPDATE public.tag_codes
       SET status = 'void', pin_fail_count_24h = 0, pin_fail_window_start = NULL, pin_locked_until = NULL
     WHERE code = v_code::character(9);
    DELETE FROM public.tag_pin_attempts WHERE tag_code = v_code::character(9);
    PERFORM public.audit('tag_status_changed', 'tag', v_code, jsonb_build_object('to', 'void', 'reason', 'lost'));
  END IF;

  PERFORM public.audit('replacement_requested', 'tag', v_code, jsonb_build_object('kind', p_kind));

  RETURN jsonb_build_object('ok', true, 'request_id', v_req);
END;
$$;

REVOKE ALL ON FUNCTION public.request_tag_replacement(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_tag_replacement(text, text) TO authenticated;

-- ─────────────────────────────────────────
-- Defesa no banco: pet com tag ativa nao pode ser apagado (T087)
-- ─────────────────────────────────────────
-- Antes, DELETE em `pets` com vinculo ativo deixava o vinculo com pet_id nulo e a tag `assigned` sem dono de pet. O app
-- chama release_tag antes; o banco agora RECUSA a exclusao (erro `pet_has_active_tag`; tabela nao tem como devolver
-- {"ok":false}). Escolhido recusar e nao encerrar sozinho: encerrar exigiria decidir o PIN (nao ha tela para recebe-lo).
-- Excecao: exclusao em cascata da conta (auth.users ja removido; a 004 chama end_assignments_for_account antes).
CREATE OR REPLACE FUNCTION public.pets_guard_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tag_assignments a WHERE a.pet_id = OLD.id AND a.ended_at IS NULL)
     AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.tutor_id) THEN
    RAISE EXCEPTION 'pet_has_active_tag' USING ERRCODE = 'P0001',
      HINT = 'libere a tag (release_tag) antes de remover o pet';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.pets_guard_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pets_guard_delete
  BEFORE DELETE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.pets_guard_delete();

COMMENT ON FUNCTION public.release_tag(text, text) IS
  'Passar a tag adiante / desvincular (spec 003). Gera PIN novo, grava so o hash e devolve o PIN em claro uma unica vez.';
COMMENT ON FUNCTION public.request_tag_replacement(text, text) IS
  'Segunda via (spec 003): damaged mantem o codigo; lost anula o codigo (void) na hora, irreversivel.';
