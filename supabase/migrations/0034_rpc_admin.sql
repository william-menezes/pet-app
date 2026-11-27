-- Migration: 0034_rpc_admin.sql
-- Spec 003-tag-qr, T075 e T086 (contracts/admin.contract.md; security-hardening.contract.md secao 5).
-- Todas as RPCs `admin_*` conferem `is_admin()` DENTRO da funcao (o guard de rota do app e so conveniencia).
-- Formato de resposta (igual ao das RPCs do tutor, regra 13A): {"ok":true,...} ou {"ok":false,"error":"<codigo>"}; nada de
-- excecao para erro de negocio (uma excecao desfaria o contador do limite e o evento de auditoria do estouro).
-- Codigos: forbidden, invalid_code, invalid_status, invalid_reason, invalid_transition, not_found, tag_not_available,
-- no_active_assignment, too_many_requests, invalid_input, code_collision, batch_range_exhausted, package_already_downloaded.
-- O admin NUNCA ve activation_pin_hash; `new_pin` so aparece na resposta de admin_reissue_pin e admin_end_assignment, uma vez,
-- e nunca vai para auditoria nem log. EXECUTE: `authenticated` nas admin_*; `service_role` em admin_insert_batch e
-- admin_mark_package_downloaded. `anon` nao executa nada.

-- Nome curto para a lista do admin: primeiro nome + inicial do ultimo sobrenome ("Ana S."). Pura.
CREATE OR REPLACE FUNCTION public.tutor_short_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_name IS NULL OR btrim(p_name) = '' THEN NULL
    WHEN array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1) = 1 THEN btrim(p_name)
    ELSE (regexp_split_to_array(btrim(p_name), '\s+'))[1] || ' '
         || left((regexp_split_to_array(btrim(p_name), '\s+'))[array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1)], 1) || '.'
  END;
$$;

REVOKE ALL ON FUNCTION public.tutor_short_name(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_short_name(text) TO service_role;

-- ─────────────────────────────────────────
-- admin_list_batches() -> jsonb
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_batches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  RETURN jsonb_build_object('ok', true, 'batches', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', x.id,
             'quantity', x.quantity,
             'created_at', x.created_at,
             'notes', x.notes,
             'package_downloaded_at', x.package_downloaded_at,
             'counts', jsonb_build_object(
               'available', x.n_available,
               'assigned',  x.n_assigned,
               'blocked',   x.n_blocked,
               'void',      x.n_void)) ORDER BY x.id DESC)
      FROM (
        SELECT b.id, b.quantity, b.created_at, b.notes, b.package_downloaded_at,
               count(t.code) FILTER (WHERE t.status = 'available') AS n_available,
               count(t.code) FILTER (WHERE t.status = 'assigned')  AS n_assigned,
               count(t.code) FILTER (WHERE t.status = 'blocked')   AS n_blocked,
               count(t.code) FILTER (WHERE t.status = 'void')      AS n_void
          FROM public.tag_batches b
          LEFT JOIN public.tag_codes t ON t.batch_id = b.id
         GROUP BY b.id) x), '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────
-- admin_list_codes(p_search, p_status, p_batch, p_limit, p_offset) -> jsonb
-- ─────────────────────────────────────────
-- Busca: codigo (normalizado), nome do pet, nome ou e-mail do tutor (do vinculo ATUAL). Linhas: codigo, lote, situacao,
-- pet e tutor (primeiro nome + inicial), ultimo scan; mais o total. p_limit entre 1 e 100 (padrao 50).
CREATE OR REPLACE FUNCTION public.admin_list_codes(
  p_search text DEFAULT NULL, p_status text DEFAULT NULL, p_batch text DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_text   text := lower(btrim(coalesce(p_search, '')));
  v_norm   text := coalesce(public.tag_normalize(p_search), '');
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('available', 'assigned', 'blocked', 'void') THEN
    RETURN public.tag_err('invalid_status');
  END IF;

  -- `total` e o numero de linhas que casam com o filtro (antes da paginacao); com p_offset alem do fim volta 0.
  SELECT coalesce(max(x.total), 0), coalesce(jsonb_agg(x.j ORDER BY x.code), '[]'::jsonb) INTO v_total, v_rows FROM (
    SELECT t.code, count(*) OVER () AS total, jsonb_build_object(
             'code', public.tag_format(t.code),
             'batch_id', t.batch_id,
             'status', t.status,
             'pet_name', p.name,
             'tutor', public.tutor_short_name(pf.nome),
             'last_scan_at', (SELECT max(s.occurred_at) FROM public.scan_events s WHERE s.tag_code = t.code)) AS j
      FROM public.tag_codes t
      LEFT JOIN public.tag_assignments a ON a.tag_code = t.code AND a.ended_at IS NULL
      LEFT JOIN public.pets p ON p.id = a.pet_id
      LEFT JOIN public.perfis pf ON pf.id = a.tutor_id
     WHERE (p_status IS NULL OR t.status = p_status)
       AND (p_batch IS NULL OR t.batch_id = p_batch)
       AND (v_text = ''
            OR (v_norm <> '' AND strpos(t.code::text, v_norm) > 0)
            OR strpos(lower(coalesce(p.name, '')), v_text) > 0
            OR strpos(lower(coalesce(pf.nome, '')), v_text) > 0
            OR strpos(lower(coalesce(pf.email, '')), v_text) > 0)
     ORDER BY t.code
     LIMIT v_limit OFFSET v_offset) x;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'rows', v_rows);
END;
$$;

-- ─────────────────────────────────────────
-- admin_code_detail(p_code) -> jsonb
-- ─────────────────────────────────────────
-- Lote, datas, situacao, vinculo atual, historico de vinculos, ate 100 scans (sem ip_hash nem token), estado do PIN
-- { used, used_at, fail_count_24h, locked_until } e pedidos de 2a via. Nunca o hash do PIN.
-- `used` = ha vinculo ativo (o PIN do cartao foi consumido pela ativacao vigente).
CREATE OR REPLACE FUNCTION public.admin_code_detail(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code  text := public.tag_normalize(p_code);
  v_tag   record;
  v_act   record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;
  SELECT t.code, t.batch_id, t.status, t.created_at, t.updated_at, t.qr_version, t.qr_mask, t.notes,
         t.pin_fail_count_24h, t.pin_fail_window_start, t.pin_locked_until
    INTO v_tag FROM public.tag_codes t WHERE t.code = v_code::character(9);
  IF NOT FOUND THEN
    RETURN public.tag_err('not_found');
  END IF;
  SELECT a.id, a.started_at INTO v_act
    FROM public.tag_assignments a WHERE a.tag_code = v_tag.code AND a.ended_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'code', public.tag_format(v_tag.code),
    'batch_id', v_tag.batch_id,
    'status', v_tag.status,
    'created_at', v_tag.created_at,
    'updated_at', v_tag.updated_at,
    'qr_version', v_tag.qr_version,
    'qr_mask', v_tag.qr_mask,
    'notes', v_tag.notes,
    'assignment', (SELECT jsonb_build_object('id', a.id, 'started_at', a.started_at, 'pet_name', p.name,
                                              'tutor', public.tutor_short_name(pf.nome))
                     FROM public.tag_assignments a
                     LEFT JOIN public.pets p ON p.id = a.pet_id
                     LEFT JOIN public.perfis pf ON pf.id = a.tutor_id
                    WHERE a.tag_code = v_tag.code AND a.ended_at IS NULL),
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'started_at', a.started_at, 'ended_at', a.ended_at,
                                                             'end_reason', a.end_reason, 'pet_name', p.name,
                                                             'tutor', public.tutor_short_name(pf.nome))
                                          ORDER BY a.started_at DESC, a.id)
                           FROM public.tag_assignments a
                           LEFT JOIN public.pets p ON p.id = a.pet_id
                           LEFT JOIN public.perfis pf ON pf.id = a.tutor_id
                          WHERE a.tag_code = v_tag.code), '[]'::jsonb),
    'scans', coalesce((SELECT jsonb_agg(x.j ORDER BY x.at DESC, x.id) FROM (
                         SELECT s.id, s.occurred_at AS at, jsonb_build_object(
                                  'id', s.id, 'occurred_at', s.occurred_at, 'status_at_scan', s.status_at_scan,
                                  'geo_method', s.geo_method, 'lat', s.lat, 'lng', s.lng, 'accuracy_m', s.accuracy_m,
                                  'city', s.city, 'region', s.region, 'assignment_id', s.assignment_id) AS j
                           FROM public.scan_events s WHERE s.tag_code = v_tag.code
                          ORDER BY s.occurred_at DESC, s.id LIMIT 100) x), '[]'::jsonb),
    'pin', jsonb_build_object(
      'used', v_act.id IS NOT NULL,
      'used_at', v_act.started_at,
      'fail_count_24h', CASE WHEN v_tag.pin_fail_window_start IS NOT NULL
                              AND v_tag.pin_fail_window_start > now() - interval '24 hours'
                             THEN v_tag.pin_fail_count_24h ELSE 0 END,
      'locked_until', CASE WHEN v_tag.pin_locked_until > now() THEN v_tag.pin_locked_until ELSE NULL END),
    'replacement_requests', coalesce((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'status', q.status,
                                                                          'created_at', q.created_at, 'resolved_at', q.resolved_at)
                                                       ORDER BY q.created_at DESC)
                                        FROM public.tag_replacement_requests q WHERE q.tag_code = v_tag.code), '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────
-- admin_set_status(p_code, p_status, p_note) -> jsonb
-- ─────────────────────────────────────────
-- p_status em available | blocked | void. Transicoes (data-model.md):
--   blocked: de available ou assigned (o vinculo continua; a pagina publica passa a "tag nao encontrada");
--   available: so de blocked (desbloqueio; o resultado e `assigned` se ha vinculo ativo, `available` se nao ha);
--   void: de qualquer situacao que nao seja void; encerra o vinculo ativo com `admin`; irreversivel.
-- Qualquer outra: invalid_transition. `assigned -> available` so por release_tag / admin_end_assignment.
CREATE OR REPLACE FUNCTION public.admin_set_status(p_code text, p_status text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code   text := public.tag_normalize(p_code);
  v_cur    text;
  v_new    text;
  v_has    boolean;
  v_pet    uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('available', 'blocked', 'void') THEN
    RETURN public.tag_err('invalid_status');
  END IF;
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;
  SELECT t.status INTO v_cur FROM public.tag_codes t WHERE t.code = v_code::character(9) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.tag_err('not_found');
  END IF;
  SELECT a.pet_id, true INTO v_pet, v_has
    FROM public.tag_assignments a WHERE a.tag_code = v_code::character(9) AND a.ended_at IS NULL FOR UPDATE;
  v_has := coalesce(v_has, false);

  IF p_status = 'blocked' AND v_cur IN ('available', 'assigned') THEN
    v_new := 'blocked';
  ELSIF p_status = 'available' AND v_cur = 'blocked' THEN
    v_new := CASE WHEN v_has THEN 'assigned' ELSE 'available' END;
  ELSIF p_status = 'void' AND v_cur <> 'void' THEN
    v_new := 'void';
    IF v_has THEN
      UPDATE public.tag_assignments SET ended_at = now(), end_reason = 'admin'
       WHERE tag_code = v_code::character(9) AND ended_at IS NULL;
      IF v_pet IS NOT NULL THEN
        UPDATE public.rescue_profiles SET lost_mode = false, lost_since = NULL WHERE pet_id = v_pet AND lost_mode;
      END IF;
    END IF;
  ELSE
    RETURN public.tag_err('invalid_transition');
  END IF;

  UPDATE public.tag_codes SET status = v_new WHERE code = v_code::character(9);
  PERFORM public.audit('tag_status_changed', 'tag', v_code,
    jsonb_strip_nulls(jsonb_build_object('from', v_cur, 'to', v_new, 'note', left(p_note, 200))));
  RETURN jsonb_build_object('ok', true, 'code', public.tag_format(v_code::character(9)), 'status', v_new);
END;
$$;

-- ─────────────────────────────────────────
-- admin_reissue_pin(p_code) -> jsonb     (limite: 60 por hora por admin)
-- ─────────────────────────────────────────
-- So tag `available` (qualquer outra: tag_not_available). Gera PIN novo, zera contadores e devolve {code,new_pin} UMA vez.
CREATE OR REPLACE FUNCTION public.admin_reissue_pin(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := public.tag_normalize(p_code);
  v_cur  text;
  v_pin  text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  IF public.rate_hit_audited('admin_reissue_hour', auth.uid()::text, 60, 3600, 'admin_rate_limited', auth.uid(), 'admin') THEN
    RETURN public.tag_err('too_many_requests', public.rate_retry_after(3600));
  END IF;
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;
  SELECT t.status INTO v_cur FROM public.tag_codes t WHERE t.code = v_code::character(9) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.tag_err('not_found');
  END IF;
  IF v_cur <> 'available' THEN
    RETURN public.tag_err('tag_not_available');
  END IF;

  v_pin := public.new_activation_pin();
  UPDATE public.tag_codes
     SET activation_pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf', 12)),
         pin_fail_count_24h = 0, pin_fail_window_start = NULL, pin_locked_until = NULL
   WHERE code = v_code::character(9);
  DELETE FROM public.tag_pin_attempts WHERE tag_code = v_code::character(9);
  PERFORM public.audit('pin_reissued', 'tag', v_code, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'code', public.tag_format(v_code::character(9)), 'new_pin', v_pin);
END;
$$;

-- ─────────────────────────────────────────
-- admin_end_assignment(p_code, p_reason) -> jsonb     (limite: 60 por hora por admin)
-- ─────────────────────────────────────────
-- p_reason em admin | damaged | lost. Encerra o vinculo ativo, a tag volta a `available` (se estava `assigned`; `blocked`
-- continua `blocked`) com PIN NOVO, devolvido uma vez. Desliga o modo perdido do pet.
CREATE OR REPLACE FUNCTION public.admin_end_assignment(p_code text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := public.tag_normalize(p_code);
  v_asg  record;
  v_pin  text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('admin', 'damaged', 'lost') THEN
    RETURN public.tag_err('invalid_reason');
  END IF;
  IF public.rate_hit_audited('admin_end_hour', auth.uid()::text, 60, 3600, 'admin_rate_limited', auth.uid(), 'admin') THEN
    RETURN public.tag_err('too_many_requests', public.rate_retry_after(3600));
  END IF;
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN public.tag_err('invalid_code');
  END IF;
  PERFORM 1 FROM public.tag_codes t WHERE t.code = v_code::character(9) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.tag_err('not_found');
  END IF;
  SELECT a.id, a.pet_id INTO v_asg
    FROM public.tag_assignments a WHERE a.tag_code = v_code::character(9) AND a.ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.tag_err('no_active_assignment');
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
  PERFORM public.audit('assignment_ended_by_admin', 'tag', v_code, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('ok', true, 'code', public.tag_format(v_code::character(9)), 'new_pin', v_pin);
END;
$$;

-- ─────────────────────────────────────────
-- admin_resolve_replacement(p_request, p_status) -> jsonb
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_resolve_replacement(p_request uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cur  text;
  v_code character(9);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('done', 'cancelled') THEN
    RETURN public.tag_err('invalid_status');
  END IF;
  SELECT q.status, q.tag_code INTO v_cur, v_code FROM public.tag_replacement_requests q WHERE q.id = p_request FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.tag_err('not_found');
  END IF;
  IF v_cur <> 'open' THEN
    RETURN public.tag_err('invalid_transition');
  END IF;
  UPDATE public.tag_replacement_requests
     SET status = p_status, resolved_at = now(), resolved_by = auth.uid()
   WHERE id = p_request;
  PERFORM public.audit('replacement_resolved', 'tag', v_code::text, jsonb_build_object('request_id', p_request, 'status', p_status));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─────────────────────────────────────────
-- admin_scan_queue(p_limit, p_offset) -> jsonb
-- ─────────────────────────────────────────
-- Scans de tags nao vinculadas (status_at_scan em blocked, void, available; sem ip_hash, sem coordenadas), pedidos de
-- 2a via abertos e tags travadas por tentativas de PIN.
CREATE OR REPLACE FUNCTION public.admin_scan_queue(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'scans', coalesce((SELECT jsonb_agg(x.j ORDER BY x.at DESC, x.id) FROM (
                         SELECT s.id, s.occurred_at AS at, jsonb_build_object(
                                  'id', s.id, 'code', public.tag_format(s.tag_code), 'status_at_scan', s.status_at_scan,
                                  'occurred_at', s.occurred_at, 'geo_method', s.geo_method, 'city', s.city, 'region', s.region) AS j
                           FROM public.scan_events s
                          WHERE s.status_at_scan IN ('blocked', 'void', 'available')
                          ORDER BY s.occurred_at DESC, s.id LIMIT v_limit OFFSET v_offset) x), '[]'::jsonb),
    'replacements', coalesce((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'code', public.tag_format(q.tag_code),
                                                                  'kind', q.kind, 'created_at', q.created_at)
                                               ORDER BY q.created_at)
                                FROM public.tag_replacement_requests q WHERE q.status = 'open'), '[]'::jsonb),
    'locked_tags', coalesce((SELECT jsonb_agg(jsonb_build_object('code', public.tag_format(t.code),
                                                                 'locked_until', t.pin_locked_until)
                                              ORDER BY t.pin_locked_until DESC)
                               FROM public.tag_codes t WHERE t.pin_locked_until > now()), '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────
-- admin_audit(p_event, p_entity_id, p_limit, p_offset) -> jsonb
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_audit(
  p_event text DEFAULT NULL, p_entity_id text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_entity text := p_entity_id;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  -- Filtro por codigo: aceita a forma de exibicao.
  IF v_entity IS NOT NULL AND public.tag_is_valid(public.tag_normalize(v_entity)) THEN
    v_entity := public.tag_normalize(v_entity);
  END IF;
  RETURN jsonb_build_object('ok', true, 'rows', coalesce((SELECT jsonb_agg(x.j ORDER BY x.at DESC, x.id DESC) FROM (
    SELECT l.id, l.at, jsonb_build_object('id', l.id, 'at', l.at, 'actor_id', l.actor_id, 'actor_role', l.actor_role,
                                          'event', l.event, 'entity', l.entity, 'entity_id', l.entity_id, 'detail', l.detail) AS j
      FROM public.audit_log l
     WHERE (p_event IS NULL OR l.event = p_event) AND (v_entity IS NULL OR l.entity_id = v_entity)
     ORDER BY l.at DESC, l.id DESC LIMIT v_limit OFFSET v_offset) x), '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────
-- admin_dashboard_counters() -> jsonb
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_dashboard_counters()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  RETURN (SELECT jsonb_build_object('ok', true,
            'generated', count(*),
            'available', count(*) FILTER (WHERE status = 'available'),
            'active',    count(*) FILTER (WHERE status = 'assigned'),
            'blocked',   count(*) FILTER (WHERE status = 'blocked'),
            'void',      count(*) FILTER (WHERE status = 'void'))
            FROM public.tag_codes);
END;
$$;

-- ─────────────────────────────────────────
-- admin_export_codes(p_batch) -> jsonb   (T086)
-- ─────────────────────────────────────────
-- Enquanto a etiqueta no servidor (T084) nao existe: CSV so com codigos (formato de exibicao) mais versao e mascara do QR
-- (necessarias para o script local reproduzir a etiqueta); NUNCA PINs. Grava `codes_exported`.
CREATE OR REPLACE FUNCTION public.admin_export_codes(p_batch text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_csv text;
  v_n   integer;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN public.tag_err('forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tag_batches b WHERE b.id = p_batch) THEN
    RETURN public.tag_err('not_found');
  END IF;
  SELECT 'code,qr_version,qr_mask' || E'\n' || coalesce(string_agg(
           public.tag_format(t.code) || ',' || t.qr_version || ',' || t.qr_mask, E'\n' ORDER BY t.code), ''),
         count(*)
    INTO v_csv, v_n
    FROM public.tag_codes t WHERE t.batch_id = p_batch;
  PERFORM public.audit('codes_exported', 'batch', p_batch, jsonb_build_object('count', v_n));
  RETURN jsonb_build_object('ok', true, 'batch_id', p_batch, 'count', v_n, 'csv', v_csv);
END;
$$;

-- ─────────────────────────────────────────
-- admin_insert_batch(p_admin, p_quantity, p_notes, p_items) -> jsonb    (so service_role; via admin-create-batch)
-- ─────────────────────────────────────────
-- p_items: [{ "code": "XXXXXXXXX", "pin": "XXXXXX", "qr_mask": 0..7 }, ...] (quantidade = p_quantity, 1 a 500).
-- Os PINs chegam em claro SO aqui, viram `crypt(pin, gen_salt('bf', 12))` e nao sao gravados nem auditados em claro.
-- Colisao de codigo (ja existe ou repetido nos itens): {"ok":false,"error":"code_collision","codes":[...]} sem gravar nada;
-- a Edge Function gera outros e tenta de novo. Uma transacao.
-- Id do lote: `lote-NNN` pelo maior numero existente DENTRO DA FAIXA DE PRODUCAO (1 a 899), minimo 2: o lote-001 e o lote
-- impresso, importado de arquivo (docs/importar-lote-001.md), nunca gerado aqui; ids de 900 a 999 sao reservados ao seed e a
-- testes e nao contam. Sem lote de producao alem do 001, o proximo e lote-002. Acima de 899: batch_range_exhausted.
CREATE OR REPLACE FUNCTION public.admin_insert_batch(p_admin uuid, p_quantity integer, p_notes text, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next    integer;
  v_id      text;
  v_dups    jsonb;
BEGIN
  IF p_admin IS NULL OR p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 500
     OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) <> p_quantity
     OR (p_notes IS NOT NULL AND char_length(p_notes) > 200) THEN
    RETURN public.tag_err('invalid_input');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
     WHERE jsonb_typeof(e) <> 'object'
        OR jsonb_typeof(e -> 'code') IS DISTINCT FROM 'string' OR jsonb_typeof(e -> 'pin') IS DISTINCT FROM 'string'
        OR jsonb_typeof(e -> 'qr_mask') IS DISTINCT FROM 'number'
        OR NOT public.tag_is_valid(e ->> 'code') OR (e ->> 'code') <> public.tag_normalize(e ->> 'code')
        OR (e ->> 'pin') !~ '^[0-9A-HJKMNP-TV-Z]{6}$'
        OR (e ->> 'qr_mask') !~ '^[0-7]$'
  ) THEN
    RETURN public.tag_err('invalid_input');
  END IF;

  -- Colisoes, antes do custo do bcrypt.
  SELECT coalesce(jsonb_agg(DISTINCT c.code), '[]'::jsonb) INTO v_dups FROM (
    SELECT e ->> 'code' AS code FROM jsonb_array_elements(p_items) e
     WHERE EXISTS (SELECT 1 FROM public.tag_codes t WHERE t.code = (e ->> 'code')::character(9))
    UNION ALL
    SELECT e ->> 'code' FROM jsonb_array_elements(p_items) e GROUP BY e ->> 'code' HAVING count(*) > 1
  ) c;
  IF jsonb_array_length(v_dups) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_collision', 'codes', v_dups);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('faro_tag_batch_id'));
  SELECT greatest(2, coalesce(max(substr(b.id, 6)::integer) FILTER (WHERE substr(b.id, 6)::integer < 900), 0) + 1)
    INTO v_next FROM public.tag_batches b;
  IF v_next > 899 THEN
    RETURN public.tag_err('batch_range_exhausted');
  END IF;
  v_id := 'lote-' || lpad(v_next::text, 3, '0');

  INSERT INTO public.tag_batches (id, quantity, created_by, notes) VALUES (v_id, p_quantity, p_admin, p_notes);
  INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_version, qr_mask)
  SELECT (e ->> 'code')::character(9), v_id, 'available',
         extensions.crypt(e ->> 'pin', extensions.gen_salt('bf', 12)), 3, (e ->> 'qr_mask')::smallint
    FROM jsonb_array_elements(p_items) e;

  INSERT INTO public.audit_log (actor_id, actor_role, event, entity, entity_id, detail)
  VALUES (p_admin, 'admin', 'batch_created', 'batch', v_id, jsonb_build_object('quantity', p_quantity));

  RETURN jsonb_build_object('ok', true, 'batch_id', v_id);
END;
$$;

-- ─────────────────────────────────────────
-- admin_mark_package_downloaded(p_batch, p_admin) -> jsonb    (so service_role)
-- ─────────────────────────────────────────
-- O pacote (com os PINs) sai uma vez so: o segundo pedido e recusado. Grava package_downloaded_at e o evento
-- `batch_package_downloaded`.
CREATE OR REPLACE FUNCTION public.admin_mark_package_downloaded(p_batch text, p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.tag_batches SET package_downloaded_at = now()
   WHERE id = p_batch AND package_downloaded_at IS NULL;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.tag_batches b WHERE b.id = p_batch) THEN
      RETURN public.tag_err('package_already_downloaded');
    END IF;
    RETURN public.tag_err('not_found');
  END IF;
  INSERT INTO public.audit_log (actor_id, actor_role, event, entity, entity_id, detail)
  VALUES (p_admin, 'admin', 'batch_package_downloaded', 'batch', p_batch, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─────────────────────────────────────────
-- Privilegios: nada para PUBLIC e anon; authenticated so nas admin_* (a checagem real e is_admin() dentro)
-- ─────────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_list_batches() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_codes(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_code_detail(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_status(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reissue_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_end_assignment(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_replacement(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_scan_queue(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_audit(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard_counters() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_export_codes(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_insert_batch(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_mark_package_downloaded(text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_batches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_codes(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_code_detail(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reissue_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_end_assignment(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_replacement(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_scan_queue(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_counters() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_export_codes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_insert_batch(uuid, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mark_package_downloaded(text, uuid) TO service_role;

COMMENT ON FUNCTION public.admin_insert_batch(uuid, integer, text, jsonb) IS
  'Cria o lote e os codigos numa transacao (so service_role). Os PINs chegam em claro e viram bcrypt custo 12; nunca sao gravados em claro nem auditados.';
