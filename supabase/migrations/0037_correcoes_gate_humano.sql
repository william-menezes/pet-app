-- Migration: 0037_correcoes_gate_humano.sql
-- Spec 003-tag-qr, correcoes do gate humano (/security-review e /code-review). 0020 a 0036 ja estao no projeto hospedado:
-- nada daqui edita migration existente; tudo e CREATE OR REPLACE (assinaturas e grants mantidos) ou objeto novo.
--   S1  pets.photo_path: formato exato por lista de permissao (nada de `..`, `?`, `#`, `\`, pasta ou pet alheio).
--   C1  activate_tag: o bloqueio de PIN e relido DEPOIS do FOR UPDATE da tag (chamadas paralelas nao furam o limite).
--   C2  register_scan: o token de localizacao so sai para tag `assigned`; nos demais casos a resposta e a do codigo inexistente.
--   C3  request_tag_replacement: pedido aberto igual devolve o existente; `lost` converte um `damaged` aberto da mesma tag.
--   C5  gatilho AFTER DELETE em pets grava `pet_deleted` (sem nome nem dado pessoal).

-- ─────────────────────────────────────────
-- S1: photo_path = <tutor_id>/<id do pet>/<uuid>.(webp|jpg)   (o que core/pets/pet.service.ts grava)
-- ─────────────────────────────────────────
-- O valor vai crescer ate uma chamada ao Storage com a chave de servico (Edge Function resolve-tag): so o formato exato
-- e aceito. O UUID final e o de crypto.randomUUID() (minusculas). Antes de criar a regra, o que nao casar vira NULL
-- (a pagina de resgate mostra o focinho; o tutor reenvia a foto).
ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_photo_path_do_tutor;

UPDATE public.pets p
   SET photo_path = NULL
 WHERE p.photo_path IS NOT NULL
   AND p.photo_path !~ ('^' || p.tutor_id::text || '/' || p.id::text
                        || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$');

ALTER TABLE public.pets
  ADD CONSTRAINT pets_photo_path_formato CHECK (
    photo_path IS NULL
    OR photo_path ~ ('^' || tutor_id::text || '/' || id::text
                     || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$')
  );

COMMENT ON CONSTRAINT pets_photo_path_formato ON public.pets IS
  'Lista de permissao: <tutor_id>/<id do pet>/<uuid>.(webp|jpg). Impede que o caminho vire rota de outra chamada do Storage.';

-- ─────────────────────────────────────────
-- C5: remover um pet gera evento de auditoria
-- ─────────────────────────────────────────
-- Sem nome nem dado pessoal. Exclusao de conta em cascata: o usuario ja nao existe e o ator e nulo (papel system);
-- o gatilho so insere e nao pode falhar.
CREATE OR REPLACE FUNCTION public.pets_audit_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.audit('pet_deleted', 'pet', OLD.id::text,
    CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.tutor_id)
         THEN '{}'::jsonb ELSE jsonb_build_object('reason', 'account_deleted') END);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pets_audit_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pets_audit_delete
  AFTER DELETE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.pets_audit_delete();

-- ─────────────────────────────────────────
-- C1: activate_tag (mesmo corpo da 0035; o bloqueio e relido depois do lock da linha da tag)
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

  -- 5b. Rele o bloqueio JA com o lock: chamadas paralelas passam juntas pela checagem do passo 4 (feita antes do lock) e
  --     so aqui ficam em fila. Quem entra depois de uma que travou a conta ou a tag recebe locked, sem comparar o PIN.
  SELECT max(q.lk) INTO v_locked_until FROM (
    SELECT a.locked_until AS lk
      FROM public.tag_pin_attempts a
     WHERE a.tag_code = v_code::character(9) AND a.tutor_id = v_uid AND a.locked_until > now()
    UNION ALL
    SELECT t.pin_locked_until
      FROM public.tag_codes t
     WHERE t.code = v_code::character(9) AND t.pin_locked_until > now()
  ) q;
  IF v_locked_until IS NOT NULL THEN
    RETURN public.tag_err('locked', greatest(1, ceil(extract(epoch FROM (v_locked_until - now())))::integer));
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
-- C2: register_scan (mesmo corpo da 0030; token de localizacao so para tag assigned com vinculo ativo)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_scan(
  p_code       text,
  p_ip_hash    text,
  p_viewer     uuid DEFAULT NULL,
  p_geo_lat    double precision DEFAULT NULL,
  p_geo_lng    double precision DEFAULT NULL,
  p_geo_city   text DEFAULT NULL,
  p_geo_region text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_none      constant jsonb := jsonb_build_object('ok', true, 'owner', false, 'recorded', false);
  v_code      text;
  v_ip        text;
  v_status    text;
  v_asg_id    uuid;
  v_asg_tutor uuid;
  v_dup       record;
  v_id        uuid;
  v_token     text;
  v_geo       text;
  v_notify    jsonb;
  v_can_tok   boolean;
BEGIN
  v_code := public.tag_normalize(p_code);
  IF NOT public.tag_is_valid(v_code) OR p_ip_hash IS NULL OR btrim(p_ip_hash) = '' THEN
    RETURN c_none;
  END IF;
  v_ip := left(btrim(p_ip_hash), 128);

  SELECT t.status INTO v_status FROM public.tag_codes t WHERE t.code = v_code::character(9);
  IF NOT FOUND THEN
    RETURN c_none;
  END IF;

  SELECT a.id, a.tutor_id INTO v_asg_id, v_asg_tutor
    FROM public.tag_assignments a WHERE a.tag_code = v_code::character(9) AND a.ended_at IS NULL;

  -- Token de localizacao so para tag vinculada e ativa (a pagina de resgate dela e publica). Disponivel, bloqueada ou anulada:
  -- o scan e gravado para a fila do admin, mas nada de token, para a resposta do /api/scan ser igual a de codigo inexistente.
  v_can_tok := v_status = 'assigned' AND v_asg_id IS NOT NULL;

  -- O dono vendo a propria tag: nada e gravado e nenhum aviso sai.
  IF p_viewer IS NOT NULL AND v_asg_tutor IS NOT NULL AND p_viewer = v_asg_tutor THEN
    RETURN jsonb_build_object('ok', true, 'owner', true);
  END IF;

  -- Duas chamadas simultaneas do mesmo codigo e origem esperam uma pela outra (a segunda vira duplicada).
  PERFORM pg_advisory_xact_lock(hashtextextended(v_code || ':' || v_ip, 0));

  SELECT s.id, s.geo_method INTO v_dup
    FROM public.scan_events s
   WHERE s.tag_code = v_code::character(9)
     AND s.ip_hash = v_ip
     AND s.assignment_id IS NOT DISTINCT FROM v_asg_id
     AND s.last_seen_at > now() - interval '10 minutes'
   ORDER BY s.last_seen_at DESC
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.scan_events SET last_seen_at = now() WHERE id = v_dup.id;
    IF v_can_tok AND v_dup.geo_method <> 'gps' THEN
      v_token := encode(extensions.gen_random_bytes(32), 'hex');
      UPDATE public.scan_events
         SET location_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
             location_token_expires_at = now() + interval '30 minutes'
       WHERE id = v_dup.id;
    END IF;
    RETURN jsonb_strip_nulls(jsonb_build_object(
      'ok', true, 'owner', false, 'recorded', true, 'duplicate', true, 'scan_id', v_dup.id, 'scan_token', v_token));
  END IF;

  -- Scan novo.
  v_geo := CASE WHEN p_geo_lat BETWEEN -90 AND 90 AND p_geo_lng BETWEEN -180 AND 180 THEN 'ip' ELSE 'none' END;
  IF v_can_tok THEN
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;

  INSERT INTO public.scan_events (tag_code, assignment_id, status_at_scan, ip_hash, geo_method, lat, lng, accuracy_m,
                                  city, region, location_token_hash, location_token_expires_at)
  VALUES (v_code::character(9), v_asg_id, v_status, v_ip, v_geo,
          CASE WHEN v_geo = 'ip' THEN p_geo_lat END,
          CASE WHEN v_geo = 'ip' THEN p_geo_lng END,
          CASE WHEN v_geo = 'ip' THEN 3000 END,
          CASE WHEN v_geo = 'ip' THEN left(nullif(btrim(coalesce(p_geo_city, '')), ''), 80) END,
          CASE WHEN v_geo = 'ip' THEN left(nullif(btrim(coalesce(p_geo_region, '')), ''), 80) END,
          CASE WHEN v_can_tok THEN encode(extensions.digest(v_token, 'sha256'), 'hex') END,
          CASE WHEN v_can_tok THEN now() + interval '30 minutes' END)
  RETURNING id INTO v_id;

  v_notify := public.scan_notice_info(v_id);
  IF v_notify IS NOT NULL THEN
    UPDATE public.scan_events SET notify_attempts = 1 WHERE id = v_id;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'ok', true, 'owner', false, 'recorded', true, 'duplicate', false,
    'scan_id', v_id, 'scan_token', v_token, 'notify', v_notify));
END;
$$;

REVOKE ALL ON FUNCTION public.register_scan(text, text, uuid, double precision, double precision, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_scan(text, text, uuid, double precision, double precision, text, text)
  TO service_role;

-- ─────────────────────────────────────────
-- C3: request_tag_replacement (mesmo corpo da 0031 + deduplicacao do pedido aberto da mesma tag)
-- ─────────────────────────────────────────
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
  v_open  record;
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

  -- Pedido aberto da mesma tag (a tag esta travada acima: chamadas simultaneas ficam em fila). Igual: devolve o existente,
  -- sem inserir (a repeticao nao gasta o limite). 'lost' sobre um 'damaged' aberto: converte o pedido, nao cria outro.
  SELECT q.id, q.kind INTO v_open
    FROM public.tag_replacement_requests q
   WHERE q.tag_code = v_code::character(9) AND q.tutor_id = v_uid AND q.status = 'open'
   ORDER BY (q.kind = p_kind) DESC, q.created_at
   LIMIT 1;
  IF FOUND AND v_open.kind = p_kind THEN
    RETURN jsonb_build_object('ok', true, 'request_id', v_open.id);
  END IF;

  IF FOUND THEN
    -- Aberto 'damaged' + chegou 'lost': o mesmo pedido passa a 'lost'.
    UPDATE public.tag_replacement_requests SET kind = 'lost' WHERE id = v_open.id;
    v_req := v_open.id;
  ELSIF (SELECT count(*) FROM public.tag_replacement_requests q WHERE q.tutor_id = v_uid AND q.status = 'open') >= 3 THEN
    RETURN public.tag_err('replacement_limit');
  END IF;

  IF v_req IS NULL THEN
    INSERT INTO public.tag_replacement_requests (tag_code, pet_id, tutor_id, kind)
    VALUES (v_code::character(9), v_asg.pet_id, v_uid, p_kind)
    RETURNING id INTO v_req;
  END IF;

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
