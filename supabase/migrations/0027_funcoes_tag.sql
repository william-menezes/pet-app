-- Migration: 0027_funcoes_tag.sql
-- Spec 003-tag-qr, T017 e T019A (data-model.md "Funcoes de apoio"; contracts/integration-002-004.contract.md §4).
-- Funcoes de apoio das tags e as duas operacoes que a spec 004 chama (exclusao e exportacao de conta). As
-- migrations 0028 a 0031 trazem as RPCs. Toda funcao security definer tem search_path fixo; EXECUTE so a quem
-- o contrato manda (depois da 0017, funcao nova nao e executavel por ninguem sem GRANT explicito).

-- ─────────────────────────────────────────
-- can_link_tag(p_tutor) -> boolean   (direito de criar um NOVO vinculo)
-- ─────────────────────────────────────────
-- TODO(BILLING_MODEL): assinatura vs. tag comprada. Hoje sempre permite. So barra NOVOS vinculos; nunca
-- desativa uma tag ja vinculada (Rescue-First). resolve_tag e register_scan nunca a chamam.
CREATE OR REPLACE FUNCTION public.can_link_tag(p_tutor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT true;
$$;

REVOKE ALL ON FUNCTION public.can_link_tag(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_link_tag(uuid) TO service_role;

-- ─────────────────────────────────────────
-- new_activation_pin() -> text   (6 caracteres Crockford, fonte criptografica)
-- ─────────────────────────────────────────
-- `byte & 31` e uniforme (256 e multiplo de 32). pgcrypto vive no schema `extensions`.
CREATE OR REPLACE FUNCTION public.new_activation_pin()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  c_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(6);
  v_pin   text := '';
  i       integer;
BEGIN
  FOR i IN 0..5 LOOP
    v_pin := v_pin || substr(c_alphabet, (get_byte(v_bytes, i) & 31) + 1, 1);
  END LOOP;
  RETURN v_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.new_activation_pin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.new_activation_pin() TO service_role;

-- ─────────────────────────────────────────
-- end_assignments_for_account(p_tutor) -> int   (usada pela exclusao de conta da 004)
-- ─────────────────────────────────────────
-- Encerra os vinculos ativos do tutor com `account_deleted`, devolve as tags a `available` MANTENDO o PIN vigente
-- (activation_pin_hash nao muda; decisao de 2026-11-21, constituicao v2.1.0), apaga a localizacao dos scans de
-- todos os vinculos do tutor, limpa ativacoes pendentes e tentativas e fecha pedidos de 2a via abertos.
-- Tag `blocked` continua `blocked` (so o vinculo acaba). Nunca altera `code` nem apaga `tag_codes`.
-- Idempotente (segunda chamada devolve 0), transacional, nao usa auth.uid().
CREATE OR REPLACE FUNCTION public.end_assignments_for_account(p_tutor uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
  v_row   record;
BEGIN
  IF p_tutor IS NULL THEN
    RETURN 0;
  END IF;

  -- 1. Vinculos ativos.
  FOR v_row IN
    SELECT a.id, a.tag_code
      FROM public.tag_assignments a
     WHERE a.tutor_id = p_tutor AND a.ended_at IS NULL
     ORDER BY a.id
       FOR UPDATE
  LOOP
    UPDATE public.tag_assignments
       SET ended_at = now(), end_reason = 'account_deleted'
     WHERE id = v_row.id;
    -- So `assigned` volta a `available`; `blocked` e `void` ficam como estao. Zera as tentativas em todos os casos.
    -- O hash do PIN nao e tocado: quem receber a tag com o cartao ativa sozinho.
    UPDATE public.tag_codes
       SET status = CASE WHEN status = 'assigned' THEN 'available' ELSE status END,
           pin_fail_count_24h = 0,
           pin_fail_window_start = NULL,
           pin_locked_until = NULL
     WHERE code = v_row.tag_code;
    v_count := v_count + 1;
  END LOOP;

  -- 2. Modo perdido desligado nos pets do tutor.
  UPDATE public.rescue_profiles rp
     SET lost_mode = false, lost_since = NULL
    FROM public.pets p
   WHERE rp.pet_id = p.id AND p.tutor_id = p_tutor AND rp.lost_mode;

  -- 3. Scans de TODOS os vinculos do tutor (ativos e encerrados): sem localizacao e sem o token de localizacao,
  --    mantendo a linha e a hora.
  UPDATE public.scan_events s
     SET lat = NULL, lng = NULL, accuracy_m = NULL, city = NULL, region = NULL, geo_method = 'none',
         location_token_hash = NULL, location_token_expires_at = NULL
    FROM public.tag_assignments a
   WHERE s.assignment_id = a.id AND a.tutor_id = p_tutor
     AND (s.geo_method <> 'none' OR s.lat IS NOT NULL OR s.city IS NOT NULL OR s.region IS NOT NULL
          OR s.location_token_hash IS NOT NULL);

  -- 4. Ativacao pendente e tentativas de PIN do tutor.
  DELETE FROM public.pending_activations WHERE tutor_id = p_tutor;
  DELETE FROM public.tag_pin_attempts WHERE tutor_id = p_tutor;

  -- 5. Pedidos de 2a via abertos.
  UPDATE public.tag_replacement_requests
     SET status = 'cancelled', resolved_at = now()
   WHERE tutor_id = p_tutor AND status = 'open';

  -- 6. Auditoria: so a contagem, ator nulo. So quando algo foi encerrado (a segunda chamada nao repete o evento).
  IF v_count > 0 THEN
    INSERT INTO public.audit_log (actor_id, actor_role, event, entity, entity_id, detail)
    VALUES (NULL, 'system', 'account_tags_released', NULL, NULL, jsonb_build_object('assignments_ended', v_count));
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.end_assignments_for_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_assignments_for_account(uuid) TO service_role;

COMMENT ON FUNCTION public.end_assignments_for_account(uuid) IS
  'Exclusao de conta (spec 004): encerra vinculos com account_deleted, mantem o PIN vigente, apaga localizacao dos scans. Idempotente.';

-- ─────────────────────────────────────────
-- export_tutor_tag_data(p_tutor) -> jsonb   (usada pela exportacao de dados da 004)
-- ─────────────────────────────────────────
-- So dados DA PROPRIA CONTA. Nunca: ip_hash, tokens, hash de PIN, identificador de outro tutor, auditoria.
-- Conta sem nada devolve as quatro listas vazias (nunca null).
CREATE OR REPLACE FUNCTION public.export_tutor_tag_data(p_tutor uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'pets', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'nome',         p.name,
               'especie',      p.species,
               'raca',         p.breed,
               'sexo',         p.sex,
               'porte',        p.size,
               'temperamento', array_to_string(p.temperament, ', '),
               'cuidados',     p.care_notes,
               'tem_foto',     p.photo_path IS NOT NULL,
               'criado_em',    p.created_at) ORDER BY p.created_at, p.id)
        FROM public.pets p
       WHERE p.tutor_id = p_tutor), '[]'::jsonb),
    'perfis_de_resgate', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'pet', p.name,
               'campos_visiveis', to_jsonb(array_remove(ARRAY[
                  CASE WHEN rp.show_temperament      THEN 'temperamento' END,
                  CASE WHEN rp.show_care             THEN 'cuidados' END,
                  CASE WHEN rp.show_tutor_first_name THEN 'primeiro_nome' END,
                  CASE WHEN rp.show_whatsapp         THEN 'whatsapp' END,
                  CASE WHEN rp.show_phone            THEN 'telefone' END], NULL)),
               'modo_perdido', rp.lost_mode) ORDER BY p.created_at, p.id)
        FROM public.rescue_profiles rp
        JOIN public.pets p ON p.id = rp.pet_id
       WHERE p.tutor_id = p_tutor), '[]'::jsonb),
    'vinculos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'codigo',     public.tag_format(a.tag_code),
               'pet',        p.name,
               'inicio',     a.started_at,
               'fim',        a.ended_at,
               'motivo_fim', a.end_reason) ORDER BY a.started_at, a.id)
        FROM public.tag_assignments a
        LEFT JOIN public.pets p ON p.id = a.pet_id
       WHERE a.tutor_id = p_tutor), '[]'::jsonb),
    'scans', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'codigo',     public.tag_format(s.tag_code),
               'quando',     s.occurred_at,
               'metodo',     s.geo_method,
               'cidade',     s.city,
               'regiao',     s.region,
               'lat',        s.lat,
               'lng',        s.lng,
               'precisao_m', s.accuracy_m) ORDER BY s.occurred_at, s.id)
        FROM public.scan_events s
        JOIN public.tag_assignments a ON a.id = s.assignment_id
       WHERE a.tutor_id = p_tutor), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.export_tutor_tag_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_tutor_tag_data(uuid) TO service_role;

COMMENT ON FUNCTION public.export_tutor_tag_data(uuid) IS
  'Exportacao de dados (spec 004): pets, perfis de resgate, vinculos e scans da propria conta. Sem ip_hash, token, hash de PIN ou dado de outro tutor.';
