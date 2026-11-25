-- Migration: 0015_funcoes_celular.sql
-- Spec 004-conta-tutor, T042 e T043 (contracts/phone-verification.rpc.md, data-model.md §5).
-- Todas SECURITY DEFINER com search_path fixo e sem SQL dinamico. Erros por RAISE EXCEPTION '<codigo>'.
-- Os caminhos que CONTAM tentativa (phone_verification_confirm) nao lancam: devolvem status em jsonb,
-- porque uma excecao desfaria a contagem. Nunca devolvem nem registram numero, codigo ou hash.

-- ─────────────────────────────────────────
-- phone_is_confirmed(p_user_id uuid) → boolean   (fato unico para a 003)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.phone_is_confirmed(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    WHEN coalesce(auth.role(), '') = 'authenticated'
         AND p_user_id IS DISTINCT FROM auth.uid()
         AND NOT public.is_admin() THEN false
    ELSE EXISTS (SELECT 1 FROM public.perfis
                  WHERE id = p_user_id AND celular IS NOT NULL AND celular_confirmado_em IS NOT NULL)
  END;
$$;

REVOKE ALL ON FUNCTION public.phone_is_confirmed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_is_confirmed(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────
-- phone_verification_status() → jsonb   (so a propria conta)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.phone_verification_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_perfil record;
  v_ver    record;
  v_resend timestamptz;
  v_active jsonb := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT celular, celular_confirmado_em, celular_pendente
    INTO v_perfil
    FROM public.perfis
   WHERE id = v_uid;

  SELECT expires_at, max_attempts, attempts
    INTO v_ver
    FROM public.phone_verifications
   WHERE user_id = v_uid
     AND consumed_at IS NULL AND invalidated_at IS NULL
     AND expires_at > now() AND attempts < max_attempts
   ORDER BY created_at DESC
   LIMIT 1;
  IF FOUND THEN
    v_active := jsonb_build_object(
      'expires_at',    v_ver.expires_at,
      'attempts_left', v_ver.max_attempts - v_ver.attempts
    );
  END IF;

  SELECT max(at) + interval '60 seconds'
    INTO v_resend
    FROM public.rate_limit_events
   WHERE bucket = 'sms:cooldown' AND key = v_uid::text;
  IF v_resend IS NOT NULL AND v_resend <= now() THEN
    v_resend := NULL;
  END IF;

  RETURN jsonb_build_object(
    'phone_confirmed',     (v_perfil.celular IS NOT NULL AND v_perfil.celular_confirmado_em IS NOT NULL),
    'phone',               v_perfil.celular,
    'pending_phone',       v_perfil.celular_pendente,
    'active',              v_active,
    'resend_available_at', v_resend
  );
END;
$$;

REVOKE ALL ON FUNCTION public.phone_verification_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_verification_status() TO authenticated, service_role;

-- ─────────────────────────────────────────
-- phone_verification_begin(...) → jsonb   (so service_role)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.phone_verification_begin(
  p_user_id      uuid,
  p_phone_e164   text,
  p_phone_hash   text,
  p_code_hash    text,
  p_ttl_seconds  integer DEFAULT 600,
  p_max_attempts integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_perfil public.perfis%ROWTYPE;
  v_id     uuid;
  v_exp    timestamptz;
BEGIN
  -- FOR UPDATE serializa duas chamadas simultaneas da mesma conta (o indice unico parcial seria o ultimo recurso).
  SELECT * INTO v_perfil FROM public.perfis WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
  IF v_perfil.termos_aceitos_em IS NULL THEN
    RAISE EXCEPTION 'terms_required';
  END IF;
  IF p_phone_e164 IS NULL OR p_phone_e164 !~ '^\+55[1-9][0-9]9[0-9]{8}$' THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;
  IF p_phone_e164 = v_perfil.celular THEN
    RAISE EXCEPTION 'same_number';
  END IF;

  -- 1. Numero pendente. O celular confirmado (se houver) permanece ate o acerto.
  UPDATE public.perfis SET celular_pendente = p_phone_e164 WHERE id = p_user_id;

  -- 2. Invalida as verificacoes abertas da conta.
  UPDATE public.phone_verifications
     SET invalidated_at = now()
   WHERE user_id = p_user_id AND consumed_at IS NULL AND invalidated_at IS NULL;

  -- 3. Limpeza: linhas da conta com mais de 24 horas.
  DELETE FROM public.phone_verifications
   WHERE user_id = p_user_id AND created_at < now() - interval '24 hours';

  -- 4. Nova verificacao.
  INSERT INTO public.phone_verifications (user_id, phone_hash, code_hash, max_attempts, expires_at)
  VALUES (p_user_id, p_phone_hash, p_code_hash, p_max_attempts, now() + make_interval(secs => p_ttl_seconds))
  RETURNING id, expires_at INTO v_id, v_exp;

  RETURN jsonb_build_object('verification_id', v_id, 'expires_at', v_exp);
END;
$$;

REVOKE ALL ON FUNCTION public.phone_verification_begin(uuid, text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_verification_begin(uuid, text, text, text, integer, integer)
  TO service_role;

-- ─────────────────────────────────────────
-- phone_verification_send_failed(p_verification_id uuid) → void   (so service_role)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.phone_verification_send_failed(p_verification_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.phone_verifications
     SET invalidated_at = now()
   WHERE id = p_verification_id AND consumed_at IS NULL AND invalidated_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.phone_verification_send_failed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_verification_send_failed(uuid) TO service_role;

-- ─────────────────────────────────────────
-- phone_verification_active(p_user_id uuid) → jsonb   (so service_role)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.phone_verification_active(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id      uuid;
  v_pending text;
BEGIN
  SELECT v.id, p.celular_pendente
    INTO v_id, v_pending
    FROM public.phone_verifications v
    JOIN public.perfis p ON p.id = v.user_id
   WHERE v.user_id = p_user_id
     AND v.consumed_at IS NULL AND v.invalidated_at IS NULL
   ORDER BY v.created_at DESC
   LIMIT 1;

  IF v_id IS NULL OR v_pending IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('verification_id', v_id, 'phone_e164', v_pending);
END;
$$;

REVOKE ALL ON FUNCTION public.phone_verification_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_verification_active(uuid) TO service_role;

-- ─────────────────────────────────────────
-- phone_verification_confirm(...) → jsonb   (so service_role; T043)
-- Confere e CONTA a tentativa na mesma chamada. Nenhum caminho de contagem lanca excecao.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.phone_verification_confirm(
  p_user_id         uuid,
  p_verification_id uuid,
  p_code_hash       text,
  p_ip_hash         text,
  p_user_agent      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row     public.phone_verifications%ROWTYPE;
  v_pending text;
  v_before  text;
  v_left    integer;
  v_ip      text := coalesce(p_ip_hash, '');
  v_ua      text := coalesce(p_user_agent, '');
BEGIN
  -- 1. Linha inexistente, de outra conta, ja usada ou invalidada: mesma resposta.
  SELECT * INTO v_row
    FROM public.phone_verifications
   WHERE id = p_verification_id
     AND user_id = p_user_id
     AND consumed_at IS NULL
     AND invalidated_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_active');
  END IF;

  -- 2. Vencida.
  IF v_row.expires_at <= now() THEN
    UPDATE public.phone_verifications SET invalidated_at = now() WHERE id = v_row.id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  -- 3. Tentativas esgotadas.
  IF v_row.attempts >= v_row.max_attempts THEN
    UPDATE public.phone_verifications SET invalidated_at = now() WHERE id = v_row.id;
    RETURN jsonb_build_object('status', 'locked', 'attempts_left', 0);
  END IF;

  -- 4. Codigo certo.
  IF v_row.code_hash = p_code_hash THEN
    SELECT celular_pendente, celular INTO v_pending, v_before
      FROM public.perfis WHERE id = p_user_id FOR UPDATE;
    IF v_pending IS NULL THEN
      RAISE EXCEPTION 'no_pending_phone';
    END IF;

    UPDATE public.phone_verifications SET consumed_at = now() WHERE id = v_row.id;
    UPDATE public.perfis
       SET celular = celular_pendente,
           celular_confirmado_em = now(),
           celular_pendente = NULL
     WHERE id = p_user_id;
    PERFORM public.log_auth_event('celular_confirmado', p_user_id, v_ip, v_ua,
                                  jsonb_build_object('troca', v_before IS NOT NULL));
    RETURN jsonb_build_object('status', 'confirmed');
  END IF;

  -- 5 e 6. Codigo errado: a contagem fica gravada (sem excecao).
  v_left := v_row.max_attempts - (v_row.attempts + 1);
  IF v_row.attempts + 1 >= v_row.max_attempts THEN
    UPDATE public.phone_verifications
       SET attempts = attempts + 1, invalidated_at = now()
     WHERE id = v_row.id;
    PERFORM public.log_auth_event('celular_bloqueado', p_user_id, v_ip, v_ua,
                                  jsonb_build_object('motivo', 'tentativas'));
    RETURN jsonb_build_object('status', 'locked', 'attempts_left', 0);
  END IF;

  UPDATE public.phone_verifications SET attempts = attempts + 1 WHERE id = v_row.id;
  PERFORM public.log_auth_event('celular_codigo_invalido', p_user_id, v_ip, v_ua,
                                jsonb_build_object('restantes', v_left));
  RETURN jsonb_build_object('status', 'invalid', 'attempts_left', v_left);
END;
$$;

REVOKE ALL ON FUNCTION public.phone_verification_confirm(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_verification_confirm(uuid, uuid, text, text, text)
  TO service_role;
