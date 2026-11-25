-- Migration: 0012_funcoes_conta.sql
-- Spec 004-conta-tutor, T014 e T015 (contracts/account.rpc.md, data-model.md §5).
--   handle_new_user()   substitui a versao da 001 (gatilho on_auth_user_created continua o mesmo)
--   accept_terms(text), log_logout(), my_account(), account_auth_facts(uuid)
-- Todas SECURITY DEFINER, search_path fixo, sem SQL dinamico.
-- Proibido em auth_audit_log.detalhe: e-mail, telefone, codigo, link, senha, IP.

-- ─────────────────────────────────────────
-- handle_new_user() — gatilho AFTER INSERT ON auth.users
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meta     jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_provider text  := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');
  v_nome     text;
  v_phone    text := NULL;
  v_terms    text := NULL;
  v_inserted integer;
BEGIN
  -- Nome: name | full_name | parte local do e-mail; sem espacos nas pontas, cortado em 80 caracteres.
  v_nome := left(
    btrim(COALESCE(
      NULLIF(btrim(v_meta ->> 'name'), ''),
      NULLIF(btrim(v_meta ->> 'full_name'), ''),
      split_part(COALESCE(NEW.email, ''), '@', 1)
    )),
    80
  );

  -- Celular e aceite dos metadados valem SO para cadastro por e-mail; no Google (ou outro provedor)
  -- entram pelas telas do app. Formato invalido vira NULL e nunca impede o cadastro.
  IF v_provider = 'email' THEN
    IF (v_meta ->> 'phone') ~ '^\+55[1-9][0-9]9[0-9]{8}$' THEN
      v_phone := v_meta ->> 'phone';
    END IF;
    IF (v_meta ->> 'terms_version') ~ '^[0-9]{4}-[0-9]{2}$' THEN
      v_terms := v_meta ->> 'terms_version';
    END IF;
  END IF;

  -- Papel fixo 'tutor': nenhuma chave dos metadados (papel, role, is_admin, return_to...) e lida.
  -- O celular NUNCA vai para perfis.celular aqui (so celular_pendente).
  INSERT INTO public.perfis (id, email, nome, papel, celular_pendente, termos_aceitos_em, termos_versao)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_nome,
    'tutor',
    v_phone,
    CASE WHEN v_terms IS NOT NULL THEN now() ELSE NULL END,
    v_terms
  )
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Auditoria em bloco proprio: uma falha de auditoria nunca impede o cadastro.
  IF v_inserted = 1 THEN
    BEGIN
      INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe)
      VALUES (
        'conta_criada', NEW.id, '', '',
        jsonb_build_object('metodo', CASE WHEN v_provider = 'email' THEN 'email' ELSE 'google' END)
      );
      IF v_terms IS NOT NULL THEN
        INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe)
        VALUES ('termos_aceitos', NEW.id, '', '', jsonb_build_object('versao', v_terms));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: falha ao auditar (cadastro mantido)';
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Gatilho do cadastro (spec 004): cria perfis com papel tutor fixo; celular_pendente e termos so de cadastro '
  'por e-mail e so com formato valido; audita conta_criada e termos_aceitos sem impedir o cadastro.';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────
-- accept_terms(p_versao text) → void
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_terms(p_versao text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_versao IS NULL OR p_versao !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'invalid_version';
  END IF;

  -- Idempotente: mesma versao ja aceita nao faz nada nem gera novo evento.
  UPDATE public.perfis
     SET termos_aceitos_em = now(), termos_versao = p_versao
   WHERE id = v_uid AND termos_versao IS DISTINCT FROM p_versao;

  IF FOUND THEN
    INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe)
    VALUES ('termos_aceitos', v_uid, '', '', jsonb_build_object('versao', p_versao));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_terms(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_terms(text) TO authenticated;

-- ─────────────────────────────────────────
-- log_logout() → void   (nunca lanca erro: a saida nao pode falhar por causa da auditoria)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_logout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    v_res := public.rate_limit_check(
      jsonb_build_array(jsonb_build_object(
        'bucket', 'logout:account:h', 'key', v_uid::text, 'max', 20, 'window', 3600
      )),
      true
    );
    IF COALESCE((v_res ->> 'allowed')::boolean, false) THEN
      INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe)
      VALUES ('logout', v_uid, '', '', '{}'::jsonb);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_logout: falha ao auditar (saida mantida)';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.log_logout() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_logout() TO authenticated;

-- ─────────────────────────────────────────
-- my_account() → jsonb   (so a propria conta; nunca hash de senha)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_account()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT jsonb_build_object(
    'id',                    p.id,
    'nome',                  p.nome,
    'email',                 p.email,
    'papel',                 p.papel,
    'celular',               p.celular,
    'celular_confirmado_em', p.celular_confirmado_em,
    'celular_pendente',      p.celular_pendente,
    'termos_aceitos_em',     p.termos_aceitos_em,
    'termos_versao',         p.termos_versao,
    'tem_senha',             (COALESCE(u.encrypted_password, '') <> ''),
    'provedores',            COALESCE(
                               (SELECT jsonb_agg(i.provider ORDER BY i.provider)
                                  FROM (SELECT DISTINCT provider FROM auth.identities WHERE user_id = p.id) AS i),
                               '[]'::jsonb),
    'criado_em',             p.created_at
  )
  INTO v_res
  FROM public.perfis p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = v_uid;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.my_account() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_account() TO authenticated;

-- ─────────────────────────────────────────
-- account_auth_facts(p_user_id uuid) → jsonb   (so service_role; usada pelas Edge Functions)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.account_auth_facts(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'email',              u.email,
    'email_confirmed',    (u.email_confirmed_at IS NOT NULL),
    'has_password',       (COALESCE(u.encrypted_password, '') <> ''),
    'providers',          COALESCE(
                            (SELECT jsonb_agg(i.provider ORDER BY i.provider)
                               FROM (SELECT DISTINCT provider FROM auth.identities WHERE user_id = u.id) AS i),
                            '[]'::jsonb),
    'last_sign_in_at',    u.last_sign_in_at,
    'terms_accepted',     (p.termos_versao IS NOT NULL),
    'phone',              p.celular,
    'pending_phone',      p.celular_pendente
  )
  INTO v_res
  FROM auth.users u
  LEFT JOIN public.perfis p ON p.id = u.id
  WHERE u.id = p_user_id;

  IF v_res IS NULL THEN
    RAISE EXCEPTION 'account_not_found';
  END IF;
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.account_auth_facts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_auth_facts(uuid) TO service_role;
