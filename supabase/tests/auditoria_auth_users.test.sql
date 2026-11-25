-- pgTAP: auditoria_auth_users.test.sql
-- Spec 004-conta-tutor, T018. Cobre o gatilho on_auth_user_updated (migration 0013).
-- Fonte: contracts/account.rpc.md (bloco auditoria_auth_users).

BEGIN;

SELECT plan(10);

-- Usuario de teste: e-mail ainda nao confirmado (o gatilho handle_new_user cria o perfil).
INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data,
                        encrypted_password, created_at, updated_at, confirmation_token)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'auditoria1@faro.test', 'authenticated', 'authenticated',
        '{"name":"Auditoria"}'::jsonb, '{"provider":"email"}'::jsonb,
        crypt('SenhaDeTeste123', gen_salt('bf')), now(), now(), '');

-- 1. email_confirmed_at: nulo -> preenchido => 1 evento email_confirmado.
UPDATE auth.users SET email_confirmed_at = now() WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001' AND evento = 'email_confirmado' AND detalhe = '{}'::jsonb),
  1, 'confirmar o e-mail gera 1 evento email_confirmado');

-- Atualizar email_confirmed_at de novo (ja preenchido) nao gera outro.
UPDATE auth.users SET email_confirmed_at = now() + interval '1 second' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001' AND evento = 'email_confirmado'),
  1, 'reescrever email_confirmed_at ja preenchido nao gera novo evento');

-- 2. encrypted_password diferente => 1 evento senha_alterada (apos_recuperacao = false).
UPDATE auth.users SET encrypted_password = crypt('OutraSenha456', gen_salt('bf'))
 WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001' AND evento = 'senha_alterada'
      AND detalhe = '{"apos_recuperacao":false}'::jsonb),
  1, 'trocar a senha gera 1 evento senha_alterada com apos_recuperacao = false');

-- 3. recovery_sent_at => 1 evento senha_recuperacao_solicitada com origem = envio.
UPDATE auth.users SET recovery_sent_at = now() WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001' AND evento = 'senha_recuperacao_solicitada'
      AND detalhe = '{"origem":"envio"}'::jsonb),
  1, 'enviar a recuperacao gera 1 evento senha_recuperacao_solicitada com origem = envio');

-- Trocar a senha logo depois da recuperacao marca apos_recuperacao = true.
UPDATE auth.users SET encrypted_password = crypt('TerceiraSenha789', gen_salt('bf'))
 WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001' AND evento = 'senha_alterada'
      AND detalhe = '{"apos_recuperacao":true}'::jsonb),
  1, 'trocar a senha na hora seguinte a recuperacao marca apos_recuperacao = true');

-- 4. last_sign_in_at => nenhum evento novo.
CREATE TEMP TABLE _antes AS
  SELECT count(*)::integer AS n FROM public.auth_audit_log WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE auth.users SET last_sign_in_at = now() WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001'),
  (SELECT n FROM _antes),
  'atualizar last_sign_in_at nao gera evento');

-- 5. Nenhum detalhe contem e-mail, telefone ou hash.
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001'
      AND (detalhe::text ~ '@' OR detalhe::text ~ '[0-9]{8,}' OR detalhe::text ~* 'hash' OR detalhe::text ~* 'crypt')),
  0, 'nenhum detalhe contem e-mail, 8+ digitos, hash ou valor de senha');
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000001' AND ip_hash = '' AND user_agent = ''
      AND evento IN ('email_confirmado', 'senha_alterada', 'senha_recuperacao_solicitada')),
  4, 'eventos de gatilho gravam ip_hash e user_agent vazios');

-- 6. Falha de auditoria nunca derruba a operacao: sem perfil, o FK da auditoria falha e o UPDATE segue.
INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data,
                        encrypted_password, created_at, updated_at, confirmation_token)
VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'auditoria2@faro.test', 'authenticated', 'authenticated',
        '{"name":"Sem perfil"}'::jsonb, '{"provider":"email"}'::jsonb,
        crypt('SenhaDeTeste123', gen_salt('bf')), now(), now(), '');
DELETE FROM public.perfis WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
SELECT lives_ok(
  $$ UPDATE auth.users SET email_confirmed_at = now() WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  'falha ao auditar nao derruba a atualizacao de auth.users');
SELECT ok(
  (SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'e a atualizacao foi mantida');

SELECT * FROM finish();
ROLLBACK;
