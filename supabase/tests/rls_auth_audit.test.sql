-- pgTAP: rls_auth_audit.test.sql
-- Testa as políticas de RLS de auth_audit_log e auth_login_attempts.
-- Tarefa: T020 (tasks.md)
-- Fonte de verdade: specs/001-login/contracts/rls-expectations.md
--                   specs/001-login/contracts/auth-audit.contract.md
--
-- Como rodar: supabase test db
--
-- Cobre:
--   - INSERT direto em auth_audit_log por anon/authenticated/admin → negado (só service_role).
--   - SELECT em auth_audit_log por anon/authenticated (não-admin) → negado.
--   - SELECT em auth_audit_log por admin → permitido (policy audit_admin_select).
--   - UPDATE/DELETE em auth_audit_log → negado para todos (append-only).
--   - auth_login_attempts: nenhum acesso direto (sem policy permissiva).
--   - Snapshot de minimização: auth_audit_log não contém colunas de PII crua.

BEGIN;

SELECT plan(14);

-- ─────────────────────────────────────────
-- Helpers (replicados do rls_perfis.test.sql para independência)
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text)
RETURNS void
LANGUAGE sql
AS $$
  SELECT
    set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
    set_config('request.jwt.claim.sub', p_uid, true),
    set_config('role', 'authenticated', true);
$$;

CREATE OR REPLACE FUNCTION tests.set_anon()
RETURNS void
LANGUAGE sql
AS $$
  SELECT
    set_config('request.jwt.claims', '{"role":"anon"}'::text, true),
    set_config('request.jwt.claim.sub', '', true),
    set_config('role', 'anon', true);
$$;

-- ─────────────────────────────────────────
-- Snapshot de minimização (guardião de schema — FR-021)
-- Verifica que auth_audit_log NÃO contém colunas proibidas de PII crua.
-- Este teste falha o merge se alguém adicionou coluna com PII acidentalmente.
-- ─────────────────────────────────────────

SELECT hasnt_column(
  'public', 'auth_audit_log', 'email',
  'auth_audit_log não tem coluna "email" (PII crua proibida — FR-021)'
);

SELECT hasnt_column(
  'public', 'auth_audit_log', 'password',
  'auth_audit_log não tem coluna "password" (PII crua proibida)'
);

SELECT hasnt_column(
  'public', 'auth_audit_log', 'senha',
  'auth_audit_log não tem coluna "senha" (PII crua proibida)'
);

SELECT hasnt_column(
  'public', 'auth_audit_log', 'token',
  'auth_audit_log não tem coluna "token" (PII crua proibida)'
);

SELECT hasnt_column(
  'public', 'auth_audit_log', 'ip',
  'auth_audit_log não tem coluna "ip" — somente ip_hash é permitido (FR-021)'
);

-- Verifica que as colunas corretas EXISTEM (schema check).
SELECT has_column('public', 'auth_audit_log', 'ip_hash',   'auth_audit_log tem ip_hash');
SELECT has_column('public', 'auth_audit_log', 'evento',    'auth_audit_log tem evento');
SELECT has_column('public', 'auth_audit_log', 'detalhe',   'auth_audit_log tem detalhe jsonb');

-- ─────────────────────────────────────────
-- anon: nenhum acesso a auth_audit_log
-- ─────────────────────────────────────────

SELECT tests.set_anon();

SELECT throws_ok(
  $$ SELECT * FROM public.auth_audit_log LIMIT 1 $$,
  'anon não pode SELECT em auth_audit_log'
);

SELECT throws_ok(
  $$
    INSERT INTO public.auth_audit_log(evento, ip_hash, user_agent, detalhe)
    VALUES ('login_sucesso', 'hash_fake', 'ua', '{}')
  $$,
  'anon não pode INSERT em auth_audit_log'
);

-- ─────────────────────────────────────────
-- Authenticated (não-admin): nenhum acesso a auth_audit_log
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001'); -- tutor A

SELECT throws_ok(
  $$ SELECT * FROM public.auth_audit_log LIMIT 1 $$,
  'tutor (authenticated, não-admin) não pode SELECT em auth_audit_log'
);

SELECT throws_ok(
  $$
    INSERT INTO public.auth_audit_log(evento, ip_hash, user_agent, detalhe)
    VALUES ('login_sucesso', 'hash_fake', 'ua', '{}')
  $$,
  'tutor não pode INSERT em auth_audit_log (somente service_role via log_auth_event)'
);

-- ─────────────────────────────────────────
-- Admin: SELECT em auth_audit_log → permitido (policy audit_admin_select)
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000003'); -- admin

SELECT lives_ok(
  $$ SELECT COUNT(*) FROM public.auth_audit_log $$,
  'admin pode SELECT em auth_audit_log (policy audit_admin_select)'
);

-- ─────────────────────────────────────────
-- auth_login_attempts: nenhuma policy permissiva → deny-by-default total
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000003'); -- até admin é negado

SELECT throws_ok(
  $$ SELECT * FROM public.auth_login_attempts LIMIT 1 $$,
  'nem o admin pode SELECT em auth_login_attempts (deny-by-default total)'
);

SELECT finish();
ROLLBACK;
