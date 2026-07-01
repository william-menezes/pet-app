-- Migration: 0004_tabelas_auth_seguranca.sql
-- Cria auth_audit_log (auditoria append-only, FR-020) e auth_login_attempts (rate-limit, FR-018).
-- INVARIANTE: RLS habilitada + deny-by-default NA MESMA MIGRATION (Princípio III).
-- Minimização LGPD (FR-021): e-mail e IP armazenados APENAS como hash; nunca em claro.
-- Fonte de verdade: specs/001-login/data-model.md §5/§6 + contracts/auth-audit.contract.md.

-- ─────────────────────────────────────────
-- auth_audit_log — registro append-only de eventos de autenticação
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id          uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  evento      public.evento_auth_enum NOT NULL,
  -- ator: uuid do usuário autenticado quando conhecido; NULL para falhas sem conta existente.
  ator        uuid               REFERENCES public.perfis(id) ON DELETE SET NULL,
  -- ip_hash: hash(IP) — NUNCA IP cru (minimização LGPD FR-021).
  ip_hash     text               NOT NULL DEFAULT '',
  -- user_agent truncado a 256 chars; sem fingerprint excessivo.
  user_agent  text               NOT NULL DEFAULT '',
  -- detalhe jsonb mínimo: ex. {"metodo":"password"} — SEM PII, SEM senha, SEM token.
  detalhe     jsonb              NOT NULL DEFAULT '{}'::jsonb,
  at          timestamptz        NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auth_audit_log IS
  'Registro append-only de eventos de autenticação (FR-020). '
  'Minimização LGPD (FR-021): ip_hash é hash do IP; e-mail nunca armazenado aqui. '
  'Append-only: nenhum UPDATE/DELETE por roles de aplicação (imposto via RLS + ausência de policies permissivas).';

COMMENT ON COLUMN public.auth_audit_log.ator IS
  'UUID do usuário quando conhecido. NULL para eventos sem conta (ex.: login_bloqueado por IP desconhecido).';
COMMENT ON COLUMN public.auth_audit_log.ip_hash IS
  'SHA-256 do IP de origem (minimização LGPD). Nunca armazenar o IP em claro.';
COMMENT ON COLUMN public.auth_audit_log.detalhe IS
  'Payload mínimo. Proibido: e-mail cru, senha, token, PII de terceiros. '
  'Permitido: {"metodo":"password"}, {"provedor":"google"}.';

-- Índice para queries de auditoria por ator e por tempo.
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_ator_at
  ON public.auth_audit_log(ator, at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_evento_at
  ON public.auth_audit_log(evento, at DESC);

-- RLS DENY-BY-DEFAULT: policies em 0006_rls_policies_auth.sql.
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- auth_login_attempts — suporte ao rate-limit anti-bruteforce (FR-018)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- identity_hash: hash(lower(email)) — minimização; contagem por identidade.
  identity_hash  text        NOT NULL,
  -- ip_hash: hash(IP) — contagem por origem; minimização LGPD.
  ip_hash        text        NOT NULL,
  -- sucesso: false = falha (conta para bloqueio); true = sucesso (para diagnóstico).
  sucesso        boolean     NOT NULL,
  at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auth_login_attempts IS
  'Suporte ao rate-limit anti-bruteforce (FR-018). '
  'Minimização LGPD: identity_hash = hash(email), ip_hash = hash(IP). '
  'Acessível SOMENTE por service_role (Edge login-guard via record_login_attempt RPC). '
  'Limpeza de linhas antigas: spec 009-privacidade-lgpd definirá a janela de retenção.';

COMMENT ON COLUMN public.auth_login_attempts.identity_hash IS
  'hash(lower(email)) — identifica a conta alvo sem armazenar o e-mail.';
COMMENT ON COLUMN public.auth_login_attempts.ip_hash IS
  'hash(IP de origem) — identifica a origem sem armazenar o IP.';

-- Índices para a contagem eficiente na janela de 15 min (FR-018).
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_identity_at
  ON public.auth_login_attempts(identity_hash, at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_at
  ON public.auth_login_attempts(ip_hash, at DESC);

-- RLS DENY-BY-DEFAULT: sem policies permissivas = somente service_role (bypass de RLS) acessa.
ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
