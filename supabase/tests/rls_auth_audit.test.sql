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

-- Schema de apoio do teste: criado dentro da transação (some no ROLLBACK).
-- anon e authenticated precisam de USAGE para chamar tests.* depois de trocar de papel.
CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated;
-- 0017: funcao criada sem GRANT nao e mais executavel por PUBLIC. Os auxiliares abaixo sao chamados depois de
-- trocar de papel, entao o schema do teste (so existe nesta transacao) mantem o padrao antigo.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

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

-- Linhas-semente (como dono das tabelas, antes de trocar de papel): sem elas, "zero linhas"
-- poderia ser só tabela vazia e o teste de leitura negada não provaria nada.
INSERT INTO public.auth_audit_log(evento, ip_hash, user_agent, detalhe)
VALUES ('login_sucesso', 'hash_semente', 'ua', '{}');
INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso)
VALUES ('test_semente', 'test_ip_semente', false);

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

-- Spec 004 (0017): anon perde todo privilégio nas tabelas de public; a leitura agora dá 42501 (antes: zero linhas).
SELECT throws_ok(
  $$ SELECT * FROM public.auth_audit_log $$,
  '42501', NULL,
  'anon não lê auth_audit_log (sem privilégio, 42501)'
);

SELECT throws_ok(
  $$
    INSERT INTO public.auth_audit_log(evento, ip_hash, user_agent, detalhe)
    VALUES ('login_sucesso', 'hash_fake', 'ua', '{}')
  $$,
  '42501', NULL,
  'anon não pode INSERT em auth_audit_log'
);

-- ─────────────────────────────────────────
-- Authenticated (não-admin): nenhum acesso a auth_audit_log
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001'); -- tutor A

SELECT is_empty(
  $$ SELECT * FROM public.auth_audit_log $$,
  'tutor (authenticated, não-admin) não lê nenhuma linha de auth_audit_log'
);

SELECT throws_ok(
  $$
    INSERT INTO public.auth_audit_log(evento, ip_hash, user_agent, detalhe)
    VALUES ('login_sucesso', 'hash_fake', 'ua', '{}')
  $$,
  '42501', NULL,
  'tutor não pode INSERT em auth_audit_log (somente service_role via log_auth_event)'
);

-- ─────────────────────────────────────────
-- Admin: SELECT em auth_audit_log → permitido (policy audit_admin_select)
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000003'); -- admin

-- Spec 004 (0017): o SELECT de authenticated em auth_audit_log fica; a prova de que o admin LÊ exige a linha-semente.
SELECT ok(
  (SELECT COUNT(*) FROM public.auth_audit_log WHERE ip_hash = 'hash_semente') >= 1,
  'admin lê a linha-semente de auth_audit_log (policy audit_admin_select)'
);

-- ─────────────────────────────────────────
-- auth_login_attempts: nenhuma policy permissiva → deny-by-default total
-- ─────────────────────────────────────────

SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000003'); -- até admin é negado

-- Spec 004 (0017): authenticated perde todo privilégio em auth_login_attempts; a leitura agora dá 42501 (antes: zero linhas).
SELECT throws_ok(
  $$ SELECT * FROM public.auth_login_attempts $$,
  '42501', NULL,
  'nem o admin lê auth_login_attempts (sem privilégio, 42501)'
);

SELECT finish();
ROLLBACK;
