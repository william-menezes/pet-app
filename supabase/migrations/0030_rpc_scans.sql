-- Migration: 0030_rpc_scans.sql
-- Spec 003-tag-qr, T050 (contracts/public-page.contract.md: register-scan; research.md secoes 6 e 7).
-- Registro de scan e aviso ao tutor. Todas as funcoes daqui sao `service_role` (a Edge Function `register-scan`,
-- chamada pelo servidor SSR com a chave); `anon` e `authenticated` nao executam nenhuma.
-- Principio I: `register_scan` NAO consulta nada de cobranca. Privacidade: IP so como `ip_hash` (recebido pronto);
-- o token de localizacao e aleatorio, so o hash dele e guardado, vale 30 minutos e e de uso unico.
--
-- Formas de resposta (jsonb):
--   register_scan  {"ok":true,"owner":true}                                    dono logado: nada e gravado
--                  {"ok":true,"owner":false,"recorded":false}                  codigo invalido ou inexistente
--                  {"ok":true,"owner":false,"recorded":true,"duplicate":bool,"scan_id":uuid,"scan_token":text?,
--                   "notify":{...}?}                                           `notify` so no scan novo de tag vinculada e ativa
--   set_scan_location  {"ok":true,"updated":false}                             token invalido, vencido ou dados invalidos
--                      {"ok":true,"updated":true,"notify":{...}?}
--   scan_notices_pending  {"ok":true,"items":[{...}]}   scan_notice_sent  {"ok":true}
-- `notify` = {scan_id, to, pet_name, tutor_first_name?, occurred_at, geo_method, city?, region?}: so o necessario para o
-- e-mail ao tutor; nada de quem escaneou (nem IP, nem hash).

-- ─────────────────────────────────────────
-- scan_notice_info(p_scan_id) -> jsonb   (interna)
-- ─────────────────────────────────────────
-- Dados do aviso de um scan, ou NULL quando ele NAO deve gerar e-mail: tag sem vinculo ativo, tag que nao esta
-- `assigned` (bloqueada ou anulada: o scan vai para a fila do admin, sem e-mail) ou scan que nao era de tag vinculada.
CREATE OR REPLACE FUNCTION public.scan_notice_info(p_scan_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'scan_id',          s.id,
           'to',               u.email,
           'pet_name',         p.name,
           'tutor_first_name', nullif(split_part(btrim(coalesce(f.nome, '')), ' ', 1), ''),
           'occurred_at',      to_char(s.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'geo_method',       s.geo_method,
           'city',             s.city,
           'region',           s.region))
    FROM public.scan_events s
    JOIN public.tag_assignments a ON a.id = s.assignment_id AND a.ended_at IS NULL
    JOIN public.tag_codes t       ON t.code = s.tag_code AND t.status = 'assigned'
    JOIN public.pets p            ON p.id = a.pet_id
    JOIN auth.users u             ON u.id = a.tutor_id
    LEFT JOIN public.perfis f     ON f.id = a.tutor_id
   WHERE s.id = p_scan_id AND s.status_at_scan = 'assigned' AND u.email IS NOT NULL AND u.email <> '';
$$;

REVOKE ALL ON FUNCTION public.scan_notice_info(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_notice_info(uuid) TO service_role;

-- ─────────────────────────────────────────
-- register_scan(...) -> jsonb
-- ─────────────────────────────────────────
-- Regras:
--  * codigo invalido ou inexistente: nao grava nada;
--  * `p_viewer` (id do usuario cujo JWT a Edge Function VALIDOU) e o tutor do vinculo ativo: nao grava nada, devolve owner;
--  * deduplicacao: mesmo tag_code + ip_hash + mesmo vinculo com last_seen_at nos ultimos 10 minutos: atualiza
--    last_seen_at, nao gera aviso e devolve um token NOVO (so o hash fica guardado) enquanto nao houver localizacao precisa;
--  * senao grava o scan com `status_at_scan` e o vinculo vigente (se houver); geo `ip` (margem de 3000 m) quando vierem
--    coordenadas validas, senao `none`; token de localizacao de 30 minutos;
--  * tag vinculada e ativa: devolve `notify` e conta a primeira tentativa de aviso; disponivel, bloqueada ou anulada:
--    grava para a fila do admin, sem aviso.
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
    IF v_dup.geo_method <> 'gps' THEN
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
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.scan_events (tag_code, assignment_id, status_at_scan, ip_hash, geo_method, lat, lng, accuracy_m,
                                  city, region, location_token_hash, location_token_expires_at)
  VALUES (v_code::character(9), v_asg_id, v_status, v_ip, v_geo,
          CASE WHEN v_geo = 'ip' THEN p_geo_lat END,
          CASE WHEN v_geo = 'ip' THEN p_geo_lng END,
          CASE WHEN v_geo = 'ip' THEN 3000 END,
          CASE WHEN v_geo = 'ip' THEN left(nullif(btrim(coalesce(p_geo_city, '')), ''), 80) END,
          CASE WHEN v_geo = 'ip' THEN left(nullif(btrim(coalesce(p_geo_region, '')), ''), 80) END,
          encode(extensions.digest(v_token, 'sha256'), 'hex'),
          now() + interval '30 minutes')
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
-- set_scan_location(p_token, p_lat, p_lng, p_accuracy_m) -> jsonb
-- ─────────────────────────────────────────
-- Atualiza o scan do token para `gps` (coordenadas e margem), invalida o token (uso unico) e devolve `notify`
-- para o aviso "quem achou enviou a localizacao". Token invalido, vencido ou dados fora de faixa: sem efeito.
CREATE OR REPLACE FUNCTION public.set_scan_location(
  p_token      text,
  p_lat        double precision,
  p_lng        double precision,
  p_accuracy_m integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_none constant jsonb := jsonb_build_object('ok', true, 'updated', false);
  v_id   uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 OR length(p_token) > 128
     OR p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180
     OR p_accuracy_m IS NULL OR p_accuracy_m NOT BETWEEN 0 AND 100000 THEN
    RETURN c_none;
  END IF;

  SELECT s.id INTO v_id
    FROM public.scan_events s
   WHERE s.location_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     AND s.location_token_expires_at > now()
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN c_none;
  END IF;

  UPDATE public.scan_events
     SET geo_method = 'gps', lat = p_lat, lng = p_lng, accuracy_m = p_accuracy_m,
         location_token_hash = NULL, location_token_expires_at = NULL
   WHERE id = v_id;

  RETURN jsonb_strip_nulls(jsonb_build_object('ok', true, 'updated', true, 'notify', public.scan_notice_info(v_id)));
END;
$$;

REVOKE ALL ON FUNCTION public.set_scan_location(text, double precision, double precision, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_scan_location(text, double precision, double precision, integer) TO service_role;

-- ─────────────────────────────────────────
-- Reenvio do aviso: scan_notices_pending / scan_notice_sent
-- ─────────────────────────────────────────
-- `scan_notices_pending` RESERVA os scans (soma 1 em notify_attempts na mesma instrucao) para duas execucoes do job
-- nao enviarem o mesmo aviso. Elegiveis: sem aviso, ate 3 tentativas, das ultimas 24 h, com mais de 2 minutos (o
-- primeiro envio, feito por `register-scan`, ja teve tempo de terminar), tag ainda vinculada e ativa.
CREATE OR REPLACE FUNCTION public.scan_notices_pending(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_items jsonb;
BEGIN
  WITH claimed AS (
    UPDATE public.scan_events s
       SET notify_attempts = s.notify_attempts + 1
     WHERE s.id IN (
             SELECT e.id
               FROM public.scan_events e
              WHERE e.notified_at IS NULL
                AND e.notify_attempts < 3
                AND e.status_at_scan = 'assigned'
                AND e.assignment_id IS NOT NULL
                AND e.occurred_at > now() - interval '24 hours'
                AND e.occurred_at <= now() - interval '2 minutes'
              ORDER BY e.occurred_at
              LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
                FOR UPDATE SKIP LOCKED)
    RETURNING s.id
  )
  SELECT coalesce(jsonb_agg(q.info), '[]'::jsonb) INTO v_items
    FROM (SELECT public.scan_notice_info(c.id) AS info FROM claimed c) q
   WHERE q.info IS NOT NULL;
  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- Marca o aviso como enviado. Falha de envio: nada a fazer (notified_at fica nulo e o job tenta de novo).
CREATE OR REPLACE FUNCTION public.scan_notice_sent(p_scan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.scan_events SET notified_at = now() WHERE id = p_scan_id AND notified_at IS NULL;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.scan_notices_pending(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scan_notice_sent(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_notices_pending(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.scan_notice_sent(uuid) TO service_role;

COMMENT ON FUNCTION public.register_scan(text, text, uuid, double precision, double precision, text, text) IS
  'Registro de scan (spec 003): dono nao grava; deduplica em 10 min; token de localizacao de uso unico (so o hash fica). So service_role.';
