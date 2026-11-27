-- 0036: DEF-003-01. O bcrypt custo 12 de um lote inteiro rodava num unico statement de `admin_insert_batch`
-- (~0,15 a 0,2 s por codigo); 54 codigos passavam dos 8 s do `statement_timeout` do PostgREST e voltavam 500. Contrato: 1 a 500.
--
-- Desenho: o custo do bcrypt sai da gravacao, sem persistir nada no meio.
--   1. `admin_hash_pins(p_pins)`: so service_role; calcula os hashes de uma fatia pequena (<= 10), em ordem; nao grava,
--      nao audita, nao loga.
--   2. `admin_insert_batch` passa a receber `{code, pin_hash, qr_mask}`; grava lote + codigos + UM evento de auditoria numa
--      transacao so (tudo ou nada). PIN em claro e recusado.
-- O custo do bcrypt continua 12. Nenhum `statement_timeout` e alterado.
--
-- Tambem (OBS-2 do QA): escrita em `my_scans` voltava 500 ("cannot insert into view") em vez de negacao de permissao.

-- ─────────────────────────────────────────
-- admin_hash_pins(p_pins text[]) -> text[]   (so service_role; via admin-create-batch)
-- ─────────────────────────────────────────
-- Entrada invalida: excecao 22023 SEM o valor na mensagem (PIN nunca em mensagem de erro).
CREATE OR REPLACE FUNCTION public.admin_hash_pins(p_pins text[])
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out text[] := ARRAY[]::text[];
  v_pin text;
BEGIN
  IF p_pins IS NULL OR cardinality(p_pins) < 1 OR cardinality(p_pins) > 10 OR array_ndims(p_pins) <> 1 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  FOREACH v_pin IN ARRAY p_pins LOOP
    IF v_pin IS NULL OR v_pin !~ '^[0-9A-HJKMNP-TV-Z]{6}$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || extensions.crypt(v_pin, extensions.gen_salt('bf', 12));
  END LOOP;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hash_pins(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hash_pins(text[]) TO service_role;
COMMENT ON FUNCTION public.admin_hash_pins(text[]) IS
  'Hash bcrypt custo 12 de ate 10 PINs, na mesma ordem (so service_role). Nao grava, nao audita, nao loga.';

-- ─────────────────────────────────────────
-- admin_insert_batch(p_admin, p_quantity, p_notes, p_items) -> jsonb    (so service_role; via admin-create-batch)
-- ─────────────────────────────────────────
-- p_items: [{ "code": "XXXXXXXXX", "pin_hash": "$2a$12$...", "qr_mask": 0..7 }, ...] (quantidade = p_quantity, 1 a 500).
-- Os hashes vem de `admin_hash_pins`. Item com `pin` (em claro) ou com hash que nao seja bcrypt custo 12: invalid_input.
-- Demais regras (colisao, id do lote, faixa 1-899, auditoria) iguais as da 0034.
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
        OR e ? 'pin'
        OR jsonb_typeof(e -> 'code') IS DISTINCT FROM 'string' OR jsonb_typeof(e -> 'pin_hash') IS DISTINCT FROM 'string'
        OR jsonb_typeof(e -> 'qr_mask') IS DISTINCT FROM 'number'
        OR NOT public.tag_is_valid(e ->> 'code') OR (e ->> 'code') <> public.tag_normalize(e ->> 'code')
        OR (e ->> 'pin_hash') !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$'
        OR (e ->> 'qr_mask') !~ '^[0-7]$'
  ) THEN
    RETURN public.tag_err('invalid_input');
  END IF;

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
  SELECT (e ->> 'code')::character(9), v_id, 'available', e ->> 'pin_hash', 3, (e ->> 'qr_mask')::smallint
    FROM jsonb_array_elements(p_items) e;

  INSERT INTO public.audit_log (actor_id, actor_role, event, entity, entity_id, detail)
  VALUES (p_admin, 'admin', 'batch_created', 'batch', v_id, jsonb_build_object('quantity', p_quantity));

  RETURN jsonb_build_object('ok', true, 'batch_id', v_id);
END;
$$;

COMMENT ON FUNCTION public.admin_insert_batch(uuid, integer, text, jsonb) IS
  'Cria o lote e os codigos numa transacao (so service_role). Os itens trazem pin_hash (bcrypt custo 12, de admin_hash_pins); PIN em claro e recusado e nunca e gravado nem auditado.';

-- ─────────────────────────────────────────
-- my_scans somente leitura (OBS-2)
-- ─────────────────────────────────────────
-- `my_scans` junta duas tabelas: o Postgres recusa INSERT/UPDATE/DELETE no REWRITE ("cannot insert into view"), antes da
-- checagem de privilegio, e o PostgREST responde 500. Com gatilhos INSTEAD OF que negam, o rewrite passa e a checagem de
-- privilegio responde 42501 (anon e authenticated nao tem escrita) ou o proprio gatilho nega (42501): sempre permissao negada.
CREATE OR REPLACE FUNCTION public.my_scans_read_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'permission denied for view my_scans' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.my_scans_read_only() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER my_scans_no_insert INSTEAD OF INSERT ON public.my_scans FOR EACH ROW EXECUTE FUNCTION public.my_scans_read_only();
CREATE TRIGGER my_scans_no_update INSTEAD OF UPDATE ON public.my_scans FOR EACH ROW EXECUTE FUNCTION public.my_scans_read_only();
CREATE TRIGGER my_scans_no_delete INSTEAD OF DELETE ON public.my_scans FOR EACH ROW EXECUTE FUNCTION public.my_scans_read_only();

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.my_scans FROM service_role;
