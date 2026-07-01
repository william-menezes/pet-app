-- pgTAP: rate_limit.test.sql
-- Testes de integração da RPC record_login_attempt() (rate-limit anti-bruteforce).
-- Tarefa: T024 (tasks.md)
-- Fonte de verdade: specs/001-login/contracts/login-rate-limit.edge.md §Expectativas
--
-- Como rodar: supabase test db (usa service_role para inserir tentativas diretamente)
--
-- Cobre:
--   - 5 falhas em 15 min por identity_hash → retorna 'block' (SC-005).
--   - 5 falhas em 15 min por ip_hash → retorna 'block' (eixo de IP prevalece).
--   - Falhas distribuídas: 5 por IP com identidades diferentes → 'block' por IP.
--   - Após janela de 15 min expirada (via manipulação de timestamps) → 'allow'.
--   - Sucesso (p_sucesso=true) não conta para o bloqueio.
--   - 3 falhas → 'backoff'; 4 falhas → 'backoff'; 5 → 'block'.
--
-- Nota: os testes usam service_role implicitamente (pgTAP roda como superuser no stack local).
-- Em produção, record_login_attempt é chamado SOMENTE pela Edge login-guard.

BEGIN;

SELECT plan(10);

-- ─────────────────────────────────────────
-- Limpeza prévia para isolamento dos testes
-- ─────────────────────────────────────────

DELETE FROM public.auth_login_attempts WHERE identity_hash LIKE 'test_%';

-- ─────────────────────────────────────────
-- 1. Estado inicial: sem falhas → 'allow'
-- ─────────────────────────────────────────

SELECT is(
  (SELECT public.record_login_attempt('test_identity_clean', 'test_ip_clean', null)),
  'allow',
  'sem falhas prévias → allow'
);

-- ─────────────────────────────────────────
-- 2. 3 falhas por identity → 'backoff'
-- ─────────────────────────────────────────

-- Inserir 3 falhas diretamente na tabela (simula 3 tentativas via Edge).
INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso, at)
VALUES
  ('test_identity_backoff', 'test_ip_x', false, now()),
  ('test_identity_backoff', 'test_ip_x', false, now()),
  ('test_identity_backoff', 'test_ip_x', false, now());

SELECT is(
  (SELECT public.record_login_attempt('test_identity_backoff', 'test_ip_x', null)),
  'backoff',
  '3 falhas por identity na janela → backoff'
);

-- ─────────────────────────────────────────
-- 3. 5 falhas por identity_hash → 'block' (SC-005)
-- ─────────────────────────────────────────

INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso, at)
VALUES
  ('test_identity_block', 'test_ip_y', false, now()),
  ('test_identity_block', 'test_ip_y', false, now()),
  ('test_identity_block', 'test_ip_y', false, now()),
  ('test_identity_block', 'test_ip_y', false, now()),
  ('test_identity_block', 'test_ip_y', false, now());

SELECT is(
  (SELECT public.record_login_attempt('test_identity_block', 'test_ip_y', null)),
  'block',
  '5 falhas por identity na janela → block'
);

-- ─────────────────────────────────────────
-- 4. 5 falhas por ip_hash (identidades diferentes) → 'block' por IP (SC-005)
-- ─────────────────────────────────────────

INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso, at)
VALUES
  ('test_id_ip1', 'test_ip_shared', false, now()),
  ('test_id_ip2', 'test_ip_shared', false, now()),
  ('test_id_ip3', 'test_ip_shared', false, now()),
  ('test_id_ip4', 'test_ip_shared', false, now()),
  ('test_id_ip5', 'test_ip_shared', false, now());

-- Consulta com nova identidade que não tem falhas próprias, mas IP já tem 5.
SELECT is(
  (SELECT public.record_login_attempt('test_id_ip_nova', 'test_ip_shared', null)),
  'block',
  '5 falhas por ip com identidades diferentes → block por IP (eixo de IP prevalece)'
);

-- ─────────────────────────────────────────
-- 5. Sucesso (p_sucesso=true) não conta para bloqueio
-- ─────────────────────────────────────────

-- 4 falhas + 1 sucesso = ainda 4 falhas (backoff, não block).
INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso, at)
VALUES
  ('test_identity_mixed', 'test_ip_z', false, now()),
  ('test_identity_mixed', 'test_ip_z', false, now()),
  ('test_identity_mixed', 'test_ip_z', false, now()),
  ('test_identity_mixed', 'test_ip_z', false, now()),
  ('test_identity_mixed', 'test_ip_z', true,  now()); -- 1 sucesso não conta

SELECT is(
  (SELECT public.record_login_attempt('test_identity_mixed', 'test_ip_z', null)),
  'backoff',
  '4 falhas + 1 sucesso = 4 falhas → backoff (sucesso não conta para bloqueio)'
);

-- ─────────────────────────────────────────
-- 6. Após expirar a janela de 15 min → 'allow'
-- ─────────────────────────────────────────

-- Inserir 5 falhas com timestamp fora da janela (> 15 min atrás).
INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso, at)
VALUES
  ('test_identity_expired', 'test_ip_exp', false, now() - INTERVAL '16 minutes'),
  ('test_identity_expired', 'test_ip_exp', false, now() - INTERVAL '16 minutes'),
  ('test_identity_expired', 'test_ip_exp', false, now() - INTERVAL '16 minutes'),
  ('test_identity_expired', 'test_ip_exp', false, now() - INTERVAL '16 minutes'),
  ('test_identity_expired', 'test_ip_exp', false, now() - INTERVAL '16 minutes');

SELECT is(
  (SELECT public.record_login_attempt('test_identity_expired', 'test_ip_exp', null)),
  'allow',
  '5 falhas fora da janela de 15 min → allow (janela expirou)'
);

-- ─────────────────────────────────────────
-- 7. p_sucesso=false + gravar: conta no retorno
-- ─────────────────────────────────────────

-- 4 falhas já existentes; 5ª falha via record_login_attempt → deve retornar 'block'.
INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso, at)
VALUES
  ('test_identity_5th', 'test_ip_5th', false, now()),
  ('test_identity_5th', 'test_ip_5th', false, now()),
  ('test_identity_5th', 'test_ip_5th', false, now()),
  ('test_identity_5th', 'test_ip_5th', false, now());

-- Gravar a 5ª falha via RPC (p_sucesso=false) e conferir retorno.
SELECT is(
  (SELECT public.record_login_attempt('test_identity_5th', 'test_ip_5th', false)),
  'block',
  'gravando a 5ª falha via RPC (p_sucesso=false) → block imediato'
);

-- ─────────────────────────────────────────
-- 8. p_sucesso=null: não grava, só consulta
-- ─────────────────────────────────────────

DECLARE
  v_count_before integer;
  v_count_after  integer;
BEGIN
  SELECT COUNT(*) INTO v_count_before FROM public.auth_login_attempts WHERE identity_hash = 'test_identity_nowrite';
  PERFORM public.record_login_attempt('test_identity_nowrite', 'test_ip_nowrite', null);
  SELECT COUNT(*) INTO v_count_after  FROM public.auth_login_attempts WHERE identity_hash = 'test_identity_nowrite';

  PERFORM is(v_count_before, v_count_after, 'p_sucesso=null não insere registro (somente consulta)');
END;

-- ─────────────────────────────────────────
-- 9. RLS: authenticated direto em auth_login_attempts → negado
-- ─────────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT throws_ok(
  $$ SELECT * FROM public.auth_login_attempts LIMIT 1 $$,
  'authenticated não pode SELECT em auth_login_attempts diretamente'
);

RESET ROLE;

-- ─────────────────────────────────────────
-- 10. 4 falhas → 'backoff' (limiar intermediário)
-- ─────────────────────────────────────────

INSERT INTO public.auth_login_attempts(identity_hash, ip_hash, sucesso, at)
VALUES
  ('test_identity_4fail', 'test_ip_4f', false, now()),
  ('test_identity_4fail', 'test_ip_4f', false, now()),
  ('test_identity_4fail', 'test_ip_4f', false, now()),
  ('test_identity_4fail', 'test_ip_4f', false, now());

SELECT is(
  (SELECT public.record_login_attempt('test_identity_4fail', 'test_ip_4f', null)),
  'backoff',
  '4 falhas na janela → backoff (limiar intermediário)'
);

SELECT finish();
ROLLBACK;
