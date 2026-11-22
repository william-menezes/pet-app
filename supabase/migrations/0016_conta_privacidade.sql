-- Migration: 0016_conta_privacidade.sql
-- Spec 004-conta-tutor, T073 e T074 (contracts/account-export.rpc.md, contracts/account-delete.edge.md).
--   export_my_data()                       exporta os dados da propria conta (LGPD); authenticated
--   delete_account_data(uuid, text, text)  etapa de dados da exclusao de conta; so service_role
-- Ambas SECURITY DEFINER com search_path fixo. O unico SQL dinamico desta spec esta aqui: EXECUTE de TEXTO
-- CONSTANTE, com o unico valor externo em USING, porque as funcoes da spec 003 (export_tutor_tag_data,
-- end_assignments_for_account) nascem em migrations posteriores (0020+) e sao resolvidas em tempo de execucao.
-- Nada aqui cria, le ou escreve tabela de tags. Codigo de tag nunca e apagado.
-- Proibido em auth_audit_log.detalhe: e-mail, telefone, codigo, link, senha, IP.

-- ─────────────────────────────────────────
-- export_my_data() → jsonb
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_limit   jsonb;
  v_conta   jsonb;
  v_consent jsonb;
  v_eventos jsonb;
  v_tags    jsonb := NULL;
  v_obs     jsonb := '[]'::jsonb;
BEGIN
  -- 1. Sem sessao.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- 2. Limite de 3 exportacoes por 24 h (tudo ou nada; falha do limitador = negado, falha fechada).
  BEGIN
    v_limit := public.rate_limit_check(
      jsonb_build_array(jsonb_build_object(
        'bucket', 'export:account:d', 'key', v_uid::text, 'max', 3, 'window', 86400
      )),
      true
    );
  EXCEPTION WHEN OTHERS THEN
    v_limit := jsonb_build_object('allowed', false, 'retry_after_seconds', 86400);
  END;
  IF COALESCE((v_limit ->> 'allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'rate_limited'
      USING DETAIL = COALESCE(v_limit ->> 'retry_after_seconds', '86400');
  END IF;

  -- 3. Monta o documento. So a propria conta; nunca hash de senha, hash de codigo ou de telefone, token,
  --    ip_hash ou user_agent.
  SELECT jsonb_build_object(
           'id',                    p.id,
           'nome',                  p.nome,
           'email',                 p.email,
           'papel',                 p.papel,
           'celular',               p.celular,
           'celular_confirmado_em', p.celular_confirmado_em,
           'celular_pendente',      p.celular_pendente,
           'metodos_de_login',      COALESCE(
                                      (SELECT jsonb_agg(i.provider ORDER BY i.provider)
                                         FROM (SELECT DISTINCT provider FROM auth.identities WHERE user_id = p.id) AS i),
                                      '[]'::jsonb),
           'criada_em',             p.created_at,
           'atualizada_em',         p.updated_at
         ),
         CASE WHEN p.termos_versao IS NULL THEN '[]'::jsonb
              ELSE jsonb_build_array(jsonb_build_object(
                     'tipo', 'termos_e_privacidade',
                     'versao', p.termos_versao,
                     'aceito_em', p.termos_aceitos_em))
         END
    INTO v_conta, v_consent
    FROM public.perfis p
   WHERE p.id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('evento', e.evento, 'em', e.at, 'detalhe', e.detalhe)
                            ORDER BY e.at DESC), '[]'::jsonb)
    INTO v_eventos
    FROM (SELECT l.evento, l.at, l.detalhe
            FROM public.auth_audit_log l
           WHERE l.ator = v_uid
           ORDER BY l.at DESC
           LIMIT 1000) AS e;

  -- Dados de pets, tags e scans: so se a spec 003 ja entregou a funcao. EXECUTE de texto constante.
  IF to_regprocedure('public.export_tutor_tag_data(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.export_tutor_tag_data($1)' INTO v_tags USING v_uid;
  ELSE
    v_obs := jsonb_build_array('Dados de pets, tags e scans ainda não estão disponíveis nesta exportação.');
  END IF;

  -- 4. Auditoria (aparece na exportacao SEGUINTE, nao nesta).
  INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe)
  VALUES ('dados_exportados', v_uid, '', '', '{}'::jsonb);

  -- 5. Devolve.
  RETURN jsonb_build_object(
    'formato',        1,
    'gerado_em',      now(),
    'conta',          v_conta,
    'consentimentos', COALESCE(v_consent, '[]'::jsonb),
    'eventos',        v_eventos,
    'tags_e_pets',    v_tags,
    'observacoes',    v_obs
  );
END;
$$;

COMMENT ON FUNCTION public.export_my_data() IS
  'Exportacao dos dados do titular (spec 004). Usa so auth.uid(); limite de 3 por 24 h (rate_limited, DETAIL = '
  'segundos); audita dados_exportados. tags_e_pets vem de export_tutor_tag_data (spec 003) quando existir.';

REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

-- ─────────────────────────────────────────
-- delete_account_data(p_user_id, p_ip_hash, p_user_agent) → jsonb   (so service_role)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_account_data(p_user_id uuid, p_ip_hash text, p_user_agent text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ended integer := NULL;
  v_hook  text    := 'absent';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user';
  END IF;

  -- Vinculos de tag: operacao da spec 003. Falha fechada se existe a tabela e nao existe a operacao.
  IF to_regprocedure('public.end_assignments_for_account(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.end_assignments_for_account($1)' INTO v_ended USING p_user_id;
    v_hook := 'called';
  ELSIF to_regclass('public.tag_assignments') IS NOT NULL THEN
    RAISE EXCEPTION 'deletion_hook_missing';
  END IF;

  DELETE FROM public.phone_verifications WHERE user_id = p_user_id;
  DELETE FROM public.rate_limit_events WHERE key = p_user_id::text;

  -- Evento unico (idempotente). O ator vira NULL quando o usuario for apagado (ON DELETE SET NULL da 001).
  IF NOT EXISTS (SELECT 1 FROM public.auth_audit_log
                  WHERE ator = p_user_id AND evento = 'conta_excluida') THEN
    PERFORM public.log_auth_event(
      'conta_excluida', p_user_id, COALESCE(p_ip_hash, ''), COALESCE(p_user_agent, ''),
      jsonb_build_object('vinculos_encerrados', COALESCE(v_ended, 0))
    );
  END IF;

  RETURN jsonb_build_object('hook', v_hook, 'assignments_ended', v_ended);
END;
$$;

COMMENT ON FUNCTION public.delete_account_data(uuid, text, text) IS
  'Etapa de dados da exclusao de conta (spec 004): encerra vinculos pela operacao da 003 (falha fechada: '
  'deletion_hook_missing), apaga verificacoes e limites da conta e audita conta_excluida uma vez. Nao apaga '
  'perfis nem auth.users (passo da Edge) e nunca toca em tag_codes.';

REVOKE ALL ON FUNCTION public.delete_account_data(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_data(uuid, text, text) TO service_role;
