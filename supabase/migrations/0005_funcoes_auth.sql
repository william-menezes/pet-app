-- Migration: 0005_funcoes_auth.sql
-- Cria as funções/RPCs de autenticação:
--   is_admin()               — helper de autorização (RLS e cliente)
--   current_user_role()      — conveniência de roteamento para o frontend
--   record_login_attempt()   — rate-limit anti-bruteforce (FR-018)
--   log_auth_event()         — auditoria append-only (FR-020)
--
-- SEGURANÇA (FR-016 anti-injeção):
--   - Todas as funções são SECURITY DEFINER com SET search_path = public.
--   - Parâmetros tipados; zero SQL dinâmico montado de input.
--   - record_login_attempt e log_auth_event são service_role-only por RLS das tabelas
--     que escrevem (não há GRANT para anon/authenticated).
--
-- Fonte de verdade: contracts/is-admin.rpc.md, contracts/login-rate-limit.edge.md,
--                   contracts/auth-audit.contract.md.

-- ─────────────────────────────────────────
-- is_admin() → boolean
-- ─────────────────────────────────────────
-- Verifica se o usuário autenticado tem papel 'admin' em perfis.
-- Usado em policies de RLS (SELECT admin em auth_audit_log, ALL em perfis).
-- Decisão travada: MVP usa is_admin() (Opção B — sem custom claim).
-- Referência: contracts/is-admin.rpc.md + docs/backend-supabase.md §3.4/§4.4.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND papel = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Retorna true se auth.uid() tem papel=admin em perfis. '
  'SECURITY DEFINER + search_path fixo (anti-injeção FR-016). '
  'Usado em policies de RLS — não confiar em claim do cliente (FR-006). '
  'Decisão MVP: sem custom claim; lê a tabela a cada avaliação de policy.';

-- ─────────────────────────────────────────
-- current_user_role() → text
-- ─────────────────────────────────────────
-- Conveniência para o frontend rotear (não autorizar) após login.
-- Chamada via supabase.rpc('current_user_role') em auth.service.ts.
-- Retorna o papel do auth.uid() corrente; NULL se não autenticado.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel::text
  FROM public.perfis
  WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_user_role() IS
  'Retorna o papel (tutor|admin) do usuário autenticado. '
  'Usado SOMENTE para roteamento no cliente (FR-005); '
  'a autorização real é a RLS via is_admin() (FR-006). '
  'SECURITY DEFINER + search_path fixo.';

-- ─────────────────────────────────────────
-- record_login_attempt(p_identity_hash, p_ip_hash, p_sucesso) → text
-- ─────────────────────────────────────────
-- Registra uma tentativa de login e retorna a decisão de rate-limit.
-- Retorno: 'allow' | 'backoff' | 'block' (FR-018).
-- Chamada SOMENTE pela Edge login-guard com service_role.
-- Parâmetros: hashes (não valores crus) — minimização LGPD (FR-021).
-- Lógica: conta falhas na janela de 15 min por identity_hash E por ip_hash;
--          block em >= 5 falhas em qualquer eixo; backoff em >= 3 (FR-018).
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_identity_hash text,
  p_ip_hash       text,
  p_sucesso       boolean   -- NULL = apenas consultar sem gravar
)
RETURNS text   -- 'allow' | 'backoff' | 'block'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fail_identity integer;
  v_fail_ip       integer;
BEGIN
  -- Grava a tentativa somente quando p_sucesso não é NULL.
  -- Chamar com p_sucesso=NULL serve para consultar a decisão sem registrar (pré-checagem).
  IF p_sucesso IS NOT NULL THEN
    INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso)
    VALUES (p_identity_hash, p_ip_hash, p_sucesso);
  END IF;

  -- Conta falhas na janela de 15 minutos por identidade.
  SELECT COUNT(*) INTO v_fail_identity
  FROM public.auth_login_attempts
  WHERE identity_hash = p_identity_hash
    AND sucesso = false
    AND at > now() - INTERVAL '15 minutes';

  -- Conta falhas na janela de 15 minutos por IP.
  SELECT COUNT(*) INTO v_fail_ip
  FROM public.auth_login_attempts
  WHERE ip_hash = p_ip_hash
    AND sucesso = false
    AND at > now() - INTERVAL '15 minutes';

  -- Decisão: o pior dos dois eixos prevalece (FR-018).
  IF GREATEST(v_fail_identity, v_fail_ip) >= 5 THEN
    RETURN 'block';
  END IF;

  IF GREATEST(v_fail_identity, v_fail_ip) >= 3 THEN
    RETURN 'backoff';
  END IF;

  RETURN 'allow';
END;
$$;

COMMENT ON FUNCTION public.record_login_attempt(text, text, boolean) IS
  'Registra tentativa de login e retorna decisão de rate-limit (allow|backoff|block). '
  'Parâmetros são hashes (minimização LGPD FR-021). '
  'Chamável SOMENTE por service_role (Edge login-guard). '
  'p_sucesso=NULL = consultar sem gravar (pré-checagem). '
  'Janela: 15 min; limite: 5 falhas em identity OU ip (FR-018).';

-- ─────────────────────────────────────────
-- log_auth_event(p_evento, p_ator, p_ip_hash, p_user_agent, p_detalhe) → void
-- ─────────────────────────────────────────
-- Grava um evento de auditoria em auth_audit_log (append-only, FR-020).
-- Chamada SOMENTE pela Edge login-guard com service_role.
-- user_agent truncado a 256 chars (sem fingerprint excessivo).
-- detalhe deve ser mínimo e sem PII (FR-021).
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_evento      public.evento_auth_enum,
  p_ator        uuid,        -- nullable: NULL para eventos sem conta conhecida
  p_ip_hash     text,
  p_user_agent  text,
  p_detalhe     jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.auth_audit_log(evento, ator, ip_hash, user_agent, detalhe)
  VALUES (
    p_evento,
    p_ator,
    p_ip_hash,
    LEFT(p_user_agent, 256),   -- trunca user_agent (sem fingerprint excessivo)
    p_detalhe
  );
$$;

COMMENT ON FUNCTION public.log_auth_event(public.evento_auth_enum, uuid, text, text, jsonb) IS
  'Grava evento de auditoria em auth_audit_log (append-only, FR-020). '
  'user_agent truncado a 256 chars. detalhe deve ser mínimo e sem PII (FR-021). '
  'Chamável SOMENTE por service_role (Edge login-guard). '
  'SECURITY DEFINER + search_path fixo (anti-injeção FR-016).';
