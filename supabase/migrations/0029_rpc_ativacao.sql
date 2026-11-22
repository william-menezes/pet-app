-- Migration: 0029_rpc_ativacao.sql
-- Spec 003-tag-qr, T038 (contracts/tutor-rpcs.contract.md: check_tag_for_link, activate_tag, ativacao pendente).
-- Regra 13A das tarefas: NENHUMA RPC daqui lanca excecao para erro de negocio. Erro de negocio e RETORNO
-- ({"ok":false,"error":"<codigo>"}), porque uma excecao desfaria o contador de PIN errado e o registro do limite
-- de chamadas (o PostgREST roda cada chamada numa transacao) e o bloqueio por tentativas nunca dispararia.
-- RAISE EXCEPTION fica so para o que nao deveria acontecer.
-- EXECUTE so para `authenticated` (identidade = auth.uid()). O PIN nunca e gravado em audit_log, nem em log, nem em
-- mensagem de erro; no banco existe so o hash bcrypt de custo 12.

-- ─────────────────────────────────────────
-- Auxiliares internas (chamadas pelas funcoes security definer como dono; ninguem mais as executa)
-- ─────────────────────────────────────────

-- {"ok":false,"error":"<codigo>"} com "retry_after_seconds" quando houver.
CREATE OR REPLACE FUNCTION public.tag_err(p_error text, p_retry integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object('ok', false, 'error', p_error, 'retry_after_seconds', p_retry));
$$;

-- Segundos ate o fim da janela fixa de `rate_limit_hit` (minimo 1).
CREATE OR REPLACE FUNCTION public.rate_retry_after(p_window_seconds integer)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT greatest(1, ceil(p_window_seconds - (extract(epoch FROM now())::numeric % p_window_seconds))::integer);
$$;

REVOKE ALL ON FUNCTION public.tag_err(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rate_retry_after(integer) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────
-- check_tag_for_link(p_code) -> jsonb
-- ─────────────────────────────────────────
-- Para a tela "Vincular tag" mostrar "Codigo valido · tag disponivel". 10 chamadas por minuto por conta (toda
-- chamada conta, inclusive as que falham depois); estouro: locked. Mesma resposta (`tag_unavailable`) para tag
-- vinculada, bloqueada, anulada e inexistente.
CREATE OR REPLACE FUNCTION public.check_tag_for_link(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_code   text;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN public.tag_err('tag_unavailable');
  END IF;
  IF public.rate_limit_hit('check_link_min', v_uid::text, 10, 60) THEN
    RETURN public.tag_err('locked', public.rate_retry_after(60));
  END IF;

  v_code := public.tag_normalize(p_code);
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;

  SELECT t.status INTO v_status FROM public.tag_codes t WHERE t.code = v_code::character(9);
  IF NOT FOUND OR v_status <> 'available' THEN
    RETURN public.tag_err('tag_unavailable');
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', public.tag_format(v_code::character(9)));
END;
$$;

REVOKE ALL ON FUNCTION public.check_tag_for_link(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_tag_for_link(text) TO authenticated;

-- ─────────────────────────────────────────
-- activate_tag(p_code, p_pin, p_pet_id, p_replace, p_enable_whatsapp) -> jsonb
-- ─────────────────────────────────────────
-- Ordem das verificacoes (a ordem importa para nao vazar informacao):
--   1 codigo (invalid_code)  2 celular confirmado  3 pet do tutor  4 bloqueio vigente (locked)
--   5 trava a linha da tag; inexistente ou nao available -> tag_unavailable  6 PIN  7 can_link_tag
--   8 pet com tag ativa (pet_has_tag ou troca)  9 cria o vinculo.
-- Limites do PIN (research.md secao 4): 5 erros em 15 min travam a conta naquela tag por 15 min; 20 erros em
-- 24 h travam a tag para todos por 24 h (evento de auditoria). PIN certo durante bloqueio: locked.
-- No passo 4 o bloqueio so conta para tag `available` (so ela tem tentativa de PIN em andamento): assim `locked`
-- nunca revela a situacao de uma tag vinculada, bloqueada ou anulada.
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN public.tag_err('tag_unavailable');
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

-- ─────────────────────────────────────────
-- Ativacao pendente (codigo guardado enquanto o tutor cria a conta)
-- ─────────────────────────────────────────
-- set: guarda o codigo normalizado para a conta, vale 7 dias, substitui o anterior. NAO consulta `tag_codes` (nao
-- e oraculo). Codigo invalido: invalid_code.
CREATE OR REPLACE FUNCTION public.set_pending_activation(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_code text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN public.tag_err('tag_unavailable');
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

-- get: {"ok":true,"code":"7K3M-Q9XA-C"}, ou {"ok":true,"code":null} quando nao ha ativacao pendente (ou ela venceu).
CREATE OR REPLACE FUNCTION public.get_pending_activation()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_code character(9);
BEGIN
  IF v_uid IS NOT NULL THEN
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
BEGIN
  IF auth.uid() IS NOT NULL THEN
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

COMMENT ON FUNCTION public.activate_tag(text, text, uuid, boolean, boolean) IS
  'Ativacao da tag (spec 003). Erro de negocio e retorno {ok:false,error}, nunca excecao: o contador de PIN errado precisa sobreviver.';
