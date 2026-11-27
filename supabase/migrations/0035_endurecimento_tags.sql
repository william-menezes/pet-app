-- Migration: 0035_endurecimento_tags.sql
-- Spec 003-tag-qr, T101/T102/T105 (contracts/security-hardening.contract.md, secoes 2 a 6).
-- Conteudo: rpc_guard e os escopos novos; limites globais e de admin com auditoria de um evento por janela; teto de 20 pets
-- por tutor; teto de 3 pedidos de 2a via abertos; limites do bucket `pet-photos`; e a redefinicao (CREATE OR REPLACE, mesmo
-- corpo mais a guarda no comeco) das RPCs das fases 4 e 6 que o contrato manda proteger. As tres RPCs novas da 0031
-- (my_dashboard, release_tag, request_tag_replacement) ja nascem com a guarda.
-- Regra 13A: a guarda DEVOLVE o erro, a RPC o RETORNA; so assim a contagem sobrevive (excecao desfaria a transacao).

-- ─────────────────────────────────────────
-- rpc_guard(p_scope, p_limit, p_window_seconds) -> jsonb   (NULL = pode seguir)
-- ─────────────────────────────────────────
-- Chave = auth.uid(). Toda chamada conta, inclusive as que falham depois. No estouro devolve o erro do contrato:
-- `locked` para `activate_calls` (e `check_link_min`); `too_many_requests` para os demais, ambos com retry_after_seconds.
-- Sem sessao (auth.uid() nulo) nao conta: a RPC trata a falta de sessao por conta propria. Interna: so as funcoes
-- security definer a chamam (como dono).
CREATE OR REPLACE FUNCTION public.rpc_guard(p_scope text, p_limit integer, p_window_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  IF public.rate_limit_hit(p_scope, v_uid::text, p_limit, p_window_seconds) THEN
    RETURN public.tag_err(
      CASE WHEN p_scope IN ('activate_calls', 'check_link_min') THEN 'locked' ELSE 'too_many_requests' END,
      public.rate_retry_after(p_window_seconds));
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_guard(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────
-- Limites com auditoria (tetos globais das Edge Functions e limites do admin)
-- ─────────────────────────────────────────
-- Interna. Conta a chamada; se estourou, grava UM evento de auditoria por janela (a primeira chamada acima do limite em
-- cada janela) e devolve true. `p_actor` e `p_role` entram so na auditoria (detail nunca leva chave, IP nem PIN).
CREATE OR REPLACE FUNCTION public.rate_hit_audited(
  p_scope text, p_key text, p_limit integer, p_window_seconds integer,
  p_event text, p_actor uuid, p_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.rate_limit_hit(p_scope, p_key, p_limit, p_window_seconds) THEN
    RETURN false;
  END IF;
  -- Primeira vez nesta janela: o contador de auditoria (limite 1) ainda nao estourou.
  IF NOT public.rate_limit_hit(p_scope || '_audit', p_key, 1, p_window_seconds) THEN
    INSERT INTO public.audit_log (actor_id, actor_role, event, entity, entity_id, detail)
    VALUES (p_actor, coalesce(p_role, 'system'), p_event, 'rate_limit', p_scope,
            jsonb_build_object('scope', p_scope, 'limit', p_limit, 'window_seconds', p_window_seconds));
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_hit_audited(text, text, integer, integer, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- Teto global das Edge Functions (resolve_global_min 3000/min; scan_global_min 600/min). true = estourou.
-- Um evento `global_rate_limit` por minuto. So service_role (as funcoes chamam com a role de servico).
CREATE OR REPLACE FUNCTION public.global_rate_hit(p_scope text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.rate_hit_audited(p_scope, 'global', p_limit, p_window_seconds, 'global_rate_limit', NULL, 'system');
$$;

REVOKE ALL ON FUNCTION public.global_rate_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.global_rate_hit(text, integer, integer) TO service_role;

-- Limite por admin (admin-create-batch 10/h). true = estourou; evento `admin_rate_limited` por janela.
CREATE OR REPLACE FUNCTION public.admin_rate_hit(p_admin uuid, p_scope text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.rate_hit_audited(p_scope, p_admin::text, p_limit, p_window_seconds, 'admin_rate_limited', p_admin, 'admin');
$$;

REVOKE ALL ON FUNCTION public.admin_rate_hit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rate_hit(uuid, text, integer, integer) TO service_role;

-- ─────────────────────────────────────────
-- Tetos de recurso
-- ─────────────────────────────────────────
-- No maximo 20 pets por tutor: o 21o e recusado com `pet_limit` (tabela nao devolve {"ok":false}, entao e excecao).
CREATE OR REPLACE FUNCTION public.pets_guard_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT count(*) FROM public.pets p WHERE p.tutor_id = NEW.tutor_id) >= 20 THEN
    RAISE EXCEPTION 'pet_limit' USING ERRCODE = 'P0001',
      HINT = 'No maximo 20 pets por conta';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pets_guard_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pets_guard_limit
  BEFORE INSERT ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.pets_guard_limit();

-- No maximo 3 pedidos de 2a via ABERTOS por tutor. A RPC ja devolve `replacement_limit`; o gatilho e a defesa no banco.
CREATE OR REPLACE FUNCTION public.replacement_requests_guard_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'open' AND NEW.tutor_id IS NOT NULL
     AND (SELECT count(*) FROM public.tag_replacement_requests q
           WHERE q.tutor_id = NEW.tutor_id AND q.status = 'open') >= 3 THEN
    RAISE EXCEPTION 'replacement_limit' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.replacement_requests_guard_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER replacement_requests_guard_limit
  BEFORE INSERT ON public.tag_replacement_requests
  FOR EACH ROW EXECUTE FUNCTION public.replacement_requests_guard_limit();

-- Bucket pet-photos: 5 MB e so JPEG, PNG e WebP. A politica de caminho (<uid>/<pet_id>/...) continua.
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'pet-photos';

-- ─────────────────────────────────────────
-- RPCs das fases 4 e 6 com a guarda (mesmo corpo de 0029/0031, mais o rpc_guard no comeco)
-- ─────────────────────────────────────────

-- activate_tag: TODA chamada conta (30 em 15 min por conta), inclusive as que falham antes do PIN; estouro: locked.
CREATE OR REPLACE FUNCTION public.activate_tag(
  p_code            text,
  p_pin             text,
  p_pet_id          uuid,
  p_replace         boolean DEFAULT false,
  p_enable_whatsapp boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_code         text;
  v_pin          text;
  v_pet_name     text;
  v_tag          record;
  v_old          record;
  v_locked_until timestamptz;
  v_pin_ok       boolean;
  v_acc_fails    integer;
  v_tag_fails    integer;
  v_lock_now     boolean := false;
  v_wa           boolean;
  v_replaced     boolean := false;
  v_guard        jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN public.tag_err('tag_unavailable');
  END IF;

  -- 0. Limite de chamadas (contrato de endurecimento, secao 4): conta antes de qualquer verificacao.
  v_guard := public.rpc_guard('activate_calls', 30, 900);
  IF v_guard IS NOT NULL THEN
    RETURN v_guard;
  END IF;

  -- 1. Codigo.
  v_code := public.tag_normalize(p_code);
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;

  -- 2. Celular confirmado.
  IF NOT public.phone_is_confirmed(v_uid) THEN
    RETURN public.tag_err('phone_not_confirmed');
  END IF;

  -- 3. O pet e do tutor.
  SELECT p.name INTO v_pet_name FROM public.pets p WHERE p.id = p_pet_id AND p.tutor_id = v_uid;
  IF NOT FOUND THEN
    RETURN public.tag_err('pet_not_found');
  END IF;

  -- 4. Bloqueio vigente: desta conta nesta tag, ou da tag para todos.
  SELECT max(q.lk) INTO v_locked_until FROM (
    SELECT a.locked_until AS lk
      FROM public.tag_pin_attempts a
      JOIN public.tag_codes t ON t.code = a.tag_code
     WHERE a.tag_code = v_code::character(9) AND a.tutor_id = v_uid AND t.status = 'available' AND a.locked_until > now()
    UNION ALL
    SELECT t.pin_locked_until
      FROM public.tag_codes t
     WHERE t.code = v_code::character(9) AND t.status = 'available' AND t.pin_locked_until > now()
  ) q;
  IF v_locked_until IS NOT NULL THEN
    RETURN public.tag_err('locked', greatest(1, ceil(extract(epoch FROM (v_locked_until - now())))::integer));
  END IF;

  -- 5. Trava a linha da tag. Duas ativacoes simultaneas: a segunda espera, ve `assigned` e recebe tag_unavailable.
  SELECT t.code, t.status, t.activation_pin_hash INTO v_tag
    FROM public.tag_codes t WHERE t.code = v_code::character(9) FOR UPDATE;
  IF NOT FOUND OR v_tag.status <> 'available' THEN
    RETURN public.tag_err('tag_unavailable');
  END IF;

  -- 6. PIN. Normaliza como o codigo (maiusculas, sem hifen/espaco, O->0, I e L->1). O hash e conferido SEMPRE (mesmo
  --    com o formato errado), para o custo nao depender da entrada.
  v_pin := public.tag_normalize(p_pin);
  v_pin_ok := (extensions.crypt(coalesce(v_pin, ''), v_tag.activation_pin_hash) = v_tag.activation_pin_hash)
              AND coalesce(v_pin ~ '^[0-9A-HJKMNP-TV-Z]{6}$', false);

  IF NOT v_pin_ok THEN
    -- Contador da conta nesta tag (janela de 15 min).
    INSERT INTO public.tag_pin_attempts AS a (tag_code, tutor_id, fail_count, window_start)
    VALUES (v_code::character(9), v_uid, 1, now())
    ON CONFLICT (tag_code, tutor_id) DO UPDATE
      SET fail_count   = CASE WHEN a.window_start IS NULL OR a.window_start <= now() - interval '15 minutes'
                              THEN 1 ELSE a.fail_count + 1 END,
          window_start = CASE WHEN a.window_start IS NULL OR a.window_start <= now() - interval '15 minutes'
                              THEN now() ELSE a.window_start END
    RETURNING a.fail_count INTO v_acc_fails;

    -- Contador da tag para todos (janela de 24 h).
    UPDATE public.tag_codes t
       SET pin_fail_count_24h   = CASE WHEN t.pin_fail_window_start IS NULL OR t.pin_fail_window_start <= now() - interval '24 hours'
                                       THEN 1 ELSE t.pin_fail_count_24h + 1 END,
           pin_fail_window_start = CASE WHEN t.pin_fail_window_start IS NULL OR t.pin_fail_window_start <= now() - interval '24 hours'
                                       THEN now() ELSE t.pin_fail_window_start END
     WHERE t.code = v_code::character(9)
    RETURNING t.pin_fail_count_24h INTO v_tag_fails;

    PERFORM public.audit('activation_failed', 'tag', v_code, jsonb_build_object('fail_count', v_acc_fails));

    IF v_acc_fails >= 5 THEN
      UPDATE public.tag_pin_attempts a SET locked_until = now() + interval '15 minutes'
       WHERE a.tag_code = v_code::character(9) AND a.tutor_id = v_uid;
      PERFORM public.audit('activation_locked_account', 'tag', v_code, jsonb_build_object('fail_count', v_acc_fails));
      v_lock_now := true;
    END IF;
    IF v_tag_fails >= 20 THEN
      UPDATE public.tag_codes t SET pin_locked_until = now() + interval '24 hours' WHERE t.code = v_code::character(9);
      PERFORM public.audit('activation_locked_tag', 'tag', v_code, jsonb_build_object('fail_count_24h', v_tag_fails));
      v_lock_now := true;
    END IF;

    IF v_lock_now THEN
      RETURN public.tag_err('locked',
        CASE WHEN v_tag_fails >= 20 THEN 24 * 3600 ELSE 15 * 60 END);
    END IF;
    RETURN public.tag_err('wrong_pin');
  END IF;

  -- 7. Direito de criar um NOVO vinculo (hoje sempre permite; TODO(BILLING_MODEL)).
  IF NOT public.can_link_tag(v_uid) THEN
    RETURN public.tag_err('not_entitled');
  END IF;

  -- 8. Pet com tag ativa.
  SELECT a.id, a.tag_code INTO v_old
    FROM public.tag_assignments a WHERE a.pet_id = p_pet_id AND a.ended_at IS NULL FOR UPDATE;
  IF FOUND THEN
    IF NOT coalesce(p_replace, false) THEN
      RETURN public.tag_err('pet_has_tag');
    END IF;
    -- Troca: encerra o vinculo anterior (`released`) e devolve a tag anterior a `available` MANTENDO o PIN vigente
    -- (activation_pin_hash nao muda: nao ha tela de PIN para receber um novo; constituicao v2.1.0).
    UPDATE public.tag_assignments SET ended_at = now(), end_reason = 'released' WHERE id = v_old.id;
    UPDATE public.tag_codes
       SET status = CASE WHEN status = 'assigned' THEN 'available' ELSE status END
     WHERE code = v_old.tag_code;
    PERFORM public.audit('tag_released', 'tag', v_old.tag_code::text, jsonb_build_object('reason', 'replaced'));
    v_replaced := true;
  END IF;

  -- 9. Cria o vinculo e fecha a ativacao.
  BEGIN
    INSERT INTO public.tag_assignments (tag_code, pet_id, tutor_id)
    VALUES (v_code::character(9), p_pet_id, v_uid);
  EXCEPTION WHEN unique_violation THEN
    -- O pet ganhou uma tag entre a leitura e a escrita (outra chamada simultanea). Sem troca em andamento nada foi
    -- alterado por esta chamada; com troca, relanca o erro para desfazer o encerramento do vinculo anterior.
    IF v_replaced THEN
      RAISE;
    END IF;
    RETURN public.tag_err('pet_has_tag');
  END;

  UPDATE public.tag_codes
     SET status = 'assigned', pin_fail_count_24h = 0, pin_fail_window_start = NULL, pin_locked_until = NULL
   WHERE code = v_code::character(9);
  DELETE FROM public.tag_pin_attempts WHERE tag_code = v_code::character(9);
  DELETE FROM public.pending_activations WHERE tutor_id = v_uid AND tag_code = v_code::character(9);

  -- So LIGA o WhatsApp quando o parametro e verdadeiro (o padrao da RPC e falso: sem parametro nenhum contato abre).
  IF coalesce(p_enable_whatsapp, false) THEN
    UPDATE public.rescue_profiles SET show_whatsapp = true WHERE pet_id = p_pet_id AND NOT show_whatsapp;
  END IF;
  SELECT r.show_whatsapp INTO v_wa FROM public.rescue_profiles r WHERE r.pet_id = p_pet_id;

  PERFORM public.audit('tag_activated', 'tag', v_code, jsonb_build_object('pet_id', p_pet_id));

  RETURN jsonb_build_object(
    'ok', true,
    'code', public.tag_format(v_code::character(9)),
    'pet_id', p_pet_id,
    'pet_name', v_pet_name,
    'whatsapp_enabled', coalesce(v_wa, false));
END;
$$;

REVOKE ALL ON FUNCTION public.activate_tag(text, text, uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_tag(text, text, uuid, boolean, boolean) TO authenticated;

-- set_lost_mode: tutor_write_min (30 por minuto).
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
  v_uid   uuid := auth.uid();
  v_was   boolean;
  v_guard jsonb;
BEGIN
  IF p_on IS NULL THEN
    RAISE EXCEPTION 'set_lost_mode: p_on nao pode ser nulo' USING ERRCODE = 'P0001';
  END IF;
  IF v_uid IS NULL THEN
    RETURN public.tag_err('pet_not_found');
  END IF;
  v_guard := public.rpc_guard('tutor_write_min', 30, 60);
  IF v_guard IS NOT NULL THEN
    RETURN v_guard;
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

-- Ativacao pendente: set e clear em tutor_write_min; get em tutor_read_min (120 por minuto; passa a ser VOLATILE
-- porque a guarda grava o contador).
CREATE OR REPLACE FUNCTION public.set_pending_activation(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_code  text;
  v_guard jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN public.tag_err('tag_unavailable');
  END IF;
  v_guard := public.rpc_guard('tutor_write_min', 30, 60);
  IF v_guard IS NOT NULL THEN
    RETURN v_guard;
  END IF;
  v_code := public.tag_normalize(p_code);
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;
  INSERT INTO public.pending_activations AS pa (tutor_id, tag_code, created_at, expires_at)
  VALUES (v_uid, v_code::character(9), now(), now() + interval '7 days')
  ON CONFLICT (tutor_id) DO UPDATE
    SET tag_code = EXCLUDED.tag_code, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_activation()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_code  character(9);
  v_guard jsonb;
BEGIN
  IF v_uid IS NOT NULL THEN
    v_guard := public.rpc_guard('tutor_read_min', 120, 60);
    IF v_guard IS NOT NULL THEN
      RETURN v_guard;
    END IF;
    SELECT pa.tag_code INTO v_code
      FROM public.pending_activations pa WHERE pa.tutor_id = v_uid AND pa.expires_at > now();
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', CASE WHEN v_code IS NULL THEN NULL ELSE public.tag_format(v_code) END);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_pending_activation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard jsonb;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_guard := public.rpc_guard('tutor_write_min', 30, 60);
    IF v_guard IS NOT NULL THEN
      RETURN v_guard;
    END IF;
    DELETE FROM public.pending_activations WHERE tutor_id = auth.uid();
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_pending_activation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_pending_activation() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_pending_activation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_pending_activation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_activation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_pending_activation() TO authenticated;

COMMENT ON FUNCTION public.rpc_guard(text, integer, integer) IS
  'Limite de chamadas por conta (spec 003, endurecimento). NULL = segue; no estouro devolve o erro que a RPC deve RETORNAR (nunca lancar).';
