-- Migration: 0028_rpc_resolve_tag.sql
-- Spec 003-tag-qr, T026 (contracts/public-page.contract.md, "RPC resolve_tag"; rls-expectations.md).
-- A pagina publica da tag chama a Edge Function `resolve-tag` (chave do servidor SSR), que chama esta RPC com a
-- role de servico. `anon` nao executa nada. Principio I (Rescue-First): esta funcao NAO consulta nada de
-- cobranca; o resgate funciona independente do estado de qualquer cobranca.
--
-- Saida (jsonb), um de quatro formatos:
--   {"state":"not_found"}        codigo invalido, inexistente, bloqueado, anulado (ou "assigned" sem vinculo/pet):
--                                a MESMA resposta para todos (anti-enumeracao)
--   {"state":"rate_limited"}     limite por ip_hash estourado (30 por minuto, 300 por hora)
--   {"state":"available","code":"XXXX-XXXX-X"}
--   {"state":"assigned","profile":{...}}  so os campos que o tutor liberou; campo desligado NAO aparece (sem null).
--       `pet.photo_path` vai para a Edge Function assinar a URL; nenhum outro identificador interno e devolvido.

-- ─────────────────────────────────────────
-- url_encode_utf8(text) -> text   (percent-encoding RFC 3986 sobre os bytes UTF-8)
-- ─────────────────────────────────────────
-- Usada para a mensagem pre-definida do link wa.me. Mantem A-Z a-z 0-9 - . _ ~ e codifica o resto.
CREATE OR REPLACE FUNCTION public.url_encode_utf8(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bytes bytea := convert_to(p_text, 'UTF8');
  v_out   text  := '';
  v_b     integer;
  i       integer;
BEGIN
  FOR i IN 0..length(v_bytes) - 1 LOOP
    v_b := get_byte(v_bytes, i);
    IF (v_b BETWEEN 48 AND 57) OR (v_b BETWEEN 65 AND 90) OR (v_b BETWEEN 97 AND 122) OR v_b IN (45, 46, 95, 126) THEN
      v_out := v_out || chr(v_b);
    ELSE
      v_out := v_out || '%' || upper(lpad(to_hex(v_b), 2, '0'));
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.url_encode_utf8(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.url_encode_utf8(text) TO service_role;

-- ─────────────────────────────────────────
-- resolve_tag(p_code, p_ip_hash) -> jsonb
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_tag(p_code character, p_ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_not_found constant jsonb := jsonb_build_object('state', 'not_found');
  v_code      text;
  v_key       text;
  v_over_min  boolean;
  v_over_hour boolean;
  v_status    text;
  v_asg       record;
  v_pet       record;
  v_rp        record;
  v_perfil    record;
  v_profile   jsonb;
  v_lost      jsonb;
  v_first     text;
  v_phone_ok  boolean;
BEGIN
  -- 1. Normaliza e confere o digito verificador ANTES de qualquer leitura de tabela: codigo invalido nao toca
  --    o banco nem o contador de limite.
  v_code := public.tag_normalize(p_code::text);
  IF NOT public.tag_is_valid(v_code) THEN
    RETURN c_not_found;
  END IF;

  -- 2. Limite por ip_hash (janela fixa). As duas janelas contam sempre; estouro de qualquer uma devolve rate_limited.
  v_key := coalesce(nullif(left(p_ip_hash, 128), ''), 'unknown');
  v_over_min  := public.rate_limit_hit('resolve_ip_min', v_key, 30, 60);
  v_over_hour := public.rate_limit_hit('resolve_ip_hour', v_key, 300, 3600);
  IF v_over_min OR v_over_hour THEN
    RETURN jsonb_build_object('state', 'rate_limited');
  END IF;

  -- 3. Situacao da tag. Inexistente, bloqueada e anulada: a mesma resposta.
  SELECT t.status INTO v_status FROM public.tag_codes t WHERE t.code = v_code::character(9);
  IF NOT FOUND THEN
    RETURN c_not_found;
  END IF;
  IF v_status = 'available' THEN
    RETURN jsonb_build_object('state', 'available', 'code', public.tag_format(v_code::character(9)));
  END IF;
  IF v_status <> 'assigned' THEN
    RETURN c_not_found;
  END IF;

  -- 4. Vinculo ativo, pet, perfil de resgate e tutor. Sem vinculo ou sem pet (nao deveria acontecer): not_found.
  SELECT a.pet_id, a.tutor_id INTO v_asg
    FROM public.tag_assignments a
   WHERE a.tag_code = v_code::character(9) AND a.ended_at IS NULL;
  IF NOT FOUND OR v_asg.pet_id IS NULL OR v_asg.tutor_id IS NULL THEN
    RETURN c_not_found;
  END IF;

  SELECT p.name, p.temperament, p.care_notes, p.photo_path INTO v_pet FROM public.pets p WHERE p.id = v_asg.pet_id;
  IF NOT FOUND THEN
    RETURN c_not_found;
  END IF;
  SELECT r.show_temperament, r.show_care, r.show_tutor_first_name, r.show_whatsapp, r.show_phone,
         r.lost_mode, r.lost_since, r.lost_message, r.lost_show_since, r.lost_show_reward, r.lost_show_message
    INTO v_rp FROM public.rescue_profiles r WHERE r.pet_id = v_asg.pet_id;
  IF NOT FOUND THEN
    RETURN c_not_found;
  END IF;
  SELECT f.nome, f.celular, f.celular_confirmado_em INTO v_perfil FROM public.perfis f WHERE f.id = v_asg.tutor_id;

  -- 5. Projecao: so o que o tutor liberou. Campo desligado (ou vazio) nao aparece.
  v_profile := jsonb_build_object('code', public.tag_format(v_code::character(9)));
  v_profile := v_profile || jsonb_build_object(
    'pet', jsonb_strip_nulls(jsonb_build_object('name', v_pet.name, 'photo_path', v_pet.photo_path)));

  IF v_rp.show_temperament AND coalesce(cardinality(v_pet.temperament), 0) > 0 THEN
    v_profile := v_profile || jsonb_build_object('temperament', to_jsonb(v_pet.temperament));
  END IF;
  IF v_rp.show_care AND nullif(btrim(coalesce(v_pet.care_notes, '')), '') IS NOT NULL THEN
    v_profile := v_profile || jsonb_build_object('care_notes', v_pet.care_notes);
  END IF;

  v_first := split_part(btrim(coalesce(v_perfil.nome, '')), ' ', 1);
  IF v_rp.show_tutor_first_name AND v_first <> '' THEN
    v_profile := v_profile || jsonb_build_object('tutor_first_name', v_first);
  END IF;

  -- Telefone e WhatsApp: so com o celular CONFIRMADO (perfis.celular so guarda numero confirmado) e com opt-in.
  v_phone_ok := v_perfil.celular IS NOT NULL AND v_perfil.celular_confirmado_em IS NOT NULL;
  IF v_rp.show_whatsapp AND v_phone_ok THEN
    v_profile := v_profile || jsonb_build_object('whatsapp_url',
      'https://wa.me/' || ltrim(v_perfil.celular, '+') || '?text='
      || public.url_encode_utf8('Oi! Encontrei o ' || v_pet.name || ' pela tag do Faro.'));
  END IF;
  IF v_rp.show_phone AND v_phone_ok THEN
    -- perfis.celular e E.164 brasileiro (+55 DD 9XXXX-XXXX), garantido por CHECK.
    v_profile := v_profile || jsonb_build_object('phone_display',
      '(' || substr(v_perfil.celular, 4, 2) || ') ' || substr(v_perfil.celular, 6, 5) || '-' || substr(v_perfil.celular, 11, 4));
  END IF;

  IF v_rp.lost_mode THEN
    v_lost := '{}'::jsonb;
    IF v_rp.lost_show_since AND v_rp.lost_since IS NOT NULL THEN
      v_lost := v_lost || jsonb_build_object('since',
        to_char(v_rp.lost_since AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
    END IF;
    IF v_rp.lost_show_reward THEN
      v_lost := v_lost || jsonb_build_object('reward', true);
    END IF;
    IF v_rp.lost_show_message AND nullif(btrim(coalesce(v_rp.lost_message, '')), '') IS NOT NULL THEN
      v_lost := v_lost || jsonb_build_object('message', v_rp.lost_message);
    END IF;
    v_profile := v_profile || jsonb_build_object('lost', v_lost);
  END IF;

  RETURN jsonb_build_object('state', 'assigned', 'profile', v_profile);
END;
$$;

-- So a role de servico (a Edge Function resolve-tag). Nem anon nem authenticated.
REVOKE ALL ON FUNCTION public.resolve_tag(character, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_tag(character, text) TO service_role;

COMMENT ON FUNCTION public.resolve_tag(character, text) IS
  'Pagina publica (spec 003): estado da tag e projecao so do que o tutor liberou. Digito verificador antes do banco; limite por ip_hash; so service_role.';
