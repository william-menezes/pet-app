-- pgTAP: funcoes_conta.test.sql
-- Spec 004-conta-tutor, T016. Cobre handle_new_user, accept_terms, log_logout, my_account e
-- account_auth_facts (migration 0012). Fonte: contracts/account.rpc.md (bloco funcoes_conta).
-- Tudo roda em BEGIN ... ROLLBACK; os usuarios de teste sao criados aqui, como dono do banco.

BEGIN;

SELECT plan(46);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
-- 0017: funcao criada sem GRANT nao e mais executavel por PUBLIC. Os auxiliares abaixo sao chamados depois de
-- trocar de papel, entao o schema do teste (so existe nesta transacao) mantem o padrao antigo.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('role', 'authenticated', true);
$$;
CREATE OR REPLACE FUNCTION tests.set_no_uid() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"authenticated"}'::text, true),
         set_config('request.jwt.claim.sub', '', true),
         set_config('role', 'authenticated', true);
$$;
CREATE OR REPLACE FUNCTION tests.set_anon() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"anon"}'::text, true),
         set_config('request.jwt.claim.sub', '', true),
         set_config('role', 'anon', true);
$$;
CREATE OR REPLACE FUNCTION tests.set_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"service_role"}'::text, true),
         set_config('request.jwt.claim.sub', '', true),
         set_config('role', 'service_role', true);
$$;

-- Cria um usuario em auth.users (o gatilho handle_new_user dispara).
CREATE OR REPLACE FUNCTION tests.mk_user(p_id uuid, p_email text, p_meta jsonb, p_app jsonb)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data,
                          encrypted_password, created_at, updated_at, confirmation_token)
  VALUES (p_id, p_email, 'authenticated', 'authenticated', p_meta, p_app,
          crypt('SenhaDeTeste123', gen_salt('bf')), now(), now(), '');
$$;

-- ── handle_new_user ─────────────────────────────────────────────────────
-- 1. Cadastro por e-mail com nome, celular e aceite.
SELECT tests.mk_user('aaaaaaaa-0000-0000-0000-000000000001', 'novo1@faro.test',
  '{"name":"  Ana Souza  ","phone":"+5511987654421","terms_version":"2026-11"}'::jsonb,
  '{"provider":"email","providers":["email"]}'::jsonb);
SELECT ok(
  (SELECT nome = 'Ana Souza' AND celular_pendente = '+5511987654421' AND celular IS NULL
          AND celular_confirmado_em IS NULL AND termos_versao = '2026-11' AND termos_aceitos_em IS NOT NULL
          AND papel = 'tutor'
     FROM public.perfis WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'cadastro por e-mail: nome sem espacos, celular_pendente preenchido, celular nulo, aceite gravado, papel tutor');
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'aaaaaaaa-0000-0000-0000-000000000001' AND evento = 'conta_criada' AND detalhe = '{"metodo":"email"}'::jsonb),
  1, 'evento conta_criada com metodo email');
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'aaaaaaaa-0000-0000-0000-000000000001' AND evento = 'termos_aceitos' AND detalhe = '{"versao":"2026-11"}'::jsonb),
  1, 'evento termos_aceitos com a versao');

-- 2. Metadados tentando escalar papel.
SELECT tests.mk_user('aaaaaaaa-0000-0000-0000-000000000002', 'novo2@faro.test',
  '{"name":"Intruso","papel":"admin","role":"admin","is_admin":true}'::jsonb,
  '{"provider":"email"}'::jsonb);
SELECT is((SELECT papel::text FROM public.perfis WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'tutor',
  'metadados papel/role/is_admin sao ignorados: papel = tutor');

-- 3. Celular invalido ou fora do Brasil: celular_pendente nulo e o insert nao falha.
SELECT lives_ok(
  $$ SELECT tests.mk_user('aaaaaaaa-0000-0000-0000-000000000003', 'novo3@faro.test',
       '{"name":"Fora","phone":"+14155550100"}'::jsonb, '{"provider":"email"}'::jsonb) $$,
  'cadastro com celular estrangeiro nao falha');
SELECT lives_ok(
  $$ SELECT tests.mk_user('aaaaaaaa-0000-0000-0000-000000000004', 'novo4@faro.test',
       '{"name":"Lixo","phone":"abc","terms_version":"abc"}'::jsonb, '{"provider":"email"}'::jsonb) $$,
  'cadastro com celular e versao em lixo nao falha');
SELECT ok(
  (SELECT celular_pendente IS NULL FROM public.perfis WHERE id = 'aaaaaaaa-0000-0000-0000-000000000003')
  AND (SELECT celular_pendente IS NULL AND termos_versao IS NULL AND termos_aceitos_em IS NULL
         FROM public.perfis WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  'celular invalido e versao invalida viram NULL');

-- 4. Google: phone e terms_version dos metadados sao ignorados.
SELECT tests.mk_user('aaaaaaaa-0000-0000-0000-000000000005', 'novo5@faro.test',
  '{"name":"Via Google","phone":"+5511987654421","terms_version":"2026-11"}'::jsonb,
  '{"provider":"google","providers":["google"]}'::jsonb);
SELECT ok(
  (SELECT celular_pendente IS NULL AND termos_versao IS NULL AND termos_aceitos_em IS NULL
     FROM public.perfis WHERE id = 'aaaaaaaa-0000-0000-0000-000000000005'),
  'provedor google: phone e terms_version dos metadados sao ignorados');
SELECT is(
  (SELECT detalhe->>'metodo' FROM public.auth_audit_log
    WHERE ator = 'aaaaaaaa-0000-0000-0000-000000000005' AND evento = 'conta_criada'),
  'google', 'conta_criada registra metodo google');
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = 'aaaaaaaa-0000-0000-0000-000000000005' AND evento = 'termos_aceitos'),
  0, 'cadastro google nao gera termos_aceitos');

-- 5. Nome com 200 caracteres e gravado com 80; sem nome usa a parte local do e-mail.
SELECT tests.mk_user('aaaaaaaa-0000-0000-0000-000000000006', 'novo6@faro.test',
  jsonb_build_object('name', repeat('a', 200)), '{"provider":"email"}'::jsonb);
SELECT is((SELECT char_length(nome) FROM public.perfis WHERE id = 'aaaaaaaa-0000-0000-0000-000000000006'), 80,
  'nome com 200 caracteres e cortado em 80');
SELECT tests.mk_user('aaaaaaaa-0000-0000-0000-000000000007', 'sem.nome@faro.test', '{}'::jsonb, '{"provider":"email"}'::jsonb);
SELECT is((SELECT nome FROM public.perfis WHERE id = 'aaaaaaaa-0000-0000-0000-000000000007'), 'sem.nome',
  'sem nome nos metadados: parte local do e-mail');

-- ── Privilegios (catalogo) ──────────────────────────────────────────────
SELECT is(
  has_function_privilege('anon', 'public.accept_terms(text)', 'EXECUTE')
  OR has_function_privilege('anon', 'public.log_logout()', 'EXECUTE')
  OR has_function_privilege('anon', 'public.my_account()', 'EXECUTE')
  OR has_function_privilege('anon', 'public.account_auth_facts(uuid)', 'EXECUTE'),
  false, 'anon nao executa nenhuma das funcoes de conta (catalogo)');
SELECT is(
  has_function_privilege('authenticated', 'public.accept_terms(text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.log_logout()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.my_account()', 'EXECUTE'),
  true, 'authenticated executa accept_terms, log_logout e my_account (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.account_auth_facts(uuid)', 'EXECUTE'), false,
  'authenticated nao executa account_auth_facts (catalogo)');
SELECT is(
  has_function_privilege('service_role', 'public.account_auth_facts(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.accept_terms(text)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.log_logout()', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.my_account()', 'EXECUTE'),
  true, 'service_role executa so account_auth_facts (catalogo)');

-- ── accept_terms ────────────────────────────────────────────────────────
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000002');   -- tutor B (sem aceite)
SELECT lives_ok($$ SELECT public.accept_terms('2026-11') $$, 'accept_terms(2026-11) como tutor B');
SELECT lives_ok($$ SELECT public.accept_terms('2026-11') $$, 'accept_terms repetido nao falha');
SELECT throws_ok($$ SELECT public.accept_terms('abc') $$, 'P0001', 'invalid_version', 'accept_terms(abc) => invalid_version');
SELECT throws_ok($$ SELECT public.accept_terms(NULL) $$, 'P0001', 'invalid_version', 'accept_terms(NULL) => invalid_version');
RESET ROLE;
SELECT is((SELECT termos_versao FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000002'), '2026-11',
  'accept_terms gravou a versao');
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = '00000000-0000-0000-0000-000000000002' AND evento = 'termos_aceitos'),
  1, 'accept_terms audita uma unica vez (repetir nao cria segundo evento)');
SELECT tests.set_no_uid();
SELECT throws_ok($$ SELECT public.accept_terms('2026-11') $$, 'P0001', 'not_authenticated', 'accept_terms sem sessao => not_authenticated');
RESET ROLE;
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.accept_terms('2026-11') $$, '42501', NULL, 'anon chamando accept_terms recebe 42501');
RESET ROLE;

-- ── my_account ──────────────────────────────────────────────────────────
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');   -- tutor A
SELECT is((SELECT public.my_account()->>'id'), '00000000-0000-0000-0000-000000000001', 'my_account devolve a propria conta');
SELECT is((SELECT public.my_account()->>'celular'), '+5511900000001', 'my_account devolve o celular confirmado de A');
SELECT is((SELECT (public.my_account()->>'tem_senha')::boolean), true, 'my_account: tem_senha verdadeiro');
SELECT is((SELECT jsonb_typeof(public.my_account()->'provedores')), 'array', 'my_account: provedores e uma lista');
SELECT is(
  (SELECT count(*)::integer FROM jsonb_object_keys(public.my_account()) AS k WHERE k ~* 'encrypted|hash|password|senha_hash'),
  0, 'my_account nao tem chave com encrypted, hash ou password');
RESET ROLE;
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000002');   -- B nao enxerga A
SELECT is((SELECT public.my_account()->>'id'), '00000000-0000-0000-0000-000000000002', 'my_account de B devolve so B');
RESET ROLE;
SELECT tests.set_no_uid();
SELECT throws_ok($$ SELECT public.my_account() $$, 'P0001', 'not_authenticated', 'my_account sem sessao => not_authenticated');
RESET ROLE;
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.my_account() $$, '42501', NULL, 'anon chamando my_account recebe 42501');
RESET ROLE;

-- ── account_auth_facts ──────────────────────────────────────────────────
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');
SELECT throws_ok($$ SELECT public.account_auth_facts('00000000-0000-0000-0000-000000000001') $$, '42501', NULL,
  'authenticated chamando account_auth_facts recebe 42501');
RESET ROLE;
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.account_auth_facts('00000000-0000-0000-0000-000000000001') $$, '42501', NULL,
  'anon chamando account_auth_facts recebe 42501');
RESET ROLE;
SELECT tests.set_service();
SELECT is((SELECT public.account_auth_facts('00000000-0000-0000-0000-000000000001')->>'email_confirmed'), 'true',
  'service_role: account_auth_facts devolve email_confirmed');
SELECT is((SELECT public.account_auth_facts('00000000-0000-0000-0000-000000000001')->>'phone'), '+5511900000001',
  'service_role: account_auth_facts devolve o celular confirmado');
SELECT is((SELECT public.account_auth_facts('00000000-0000-0000-0000-000000000002')->>'terms_accepted'), 'true',
  'service_role: terms_accepted verdadeiro apos o aceite de B');
SELECT is(
  (SELECT count(*)::integer FROM jsonb_object_keys(public.account_auth_facts('00000000-0000-0000-0000-000000000001')) AS k
    WHERE k ~* 'encrypted|hash' OR k = 'password'),
  0, 'account_auth_facts nunca devolve hash da senha (so has_password)');
SELECT throws_ok($$ SELECT public.account_auth_facts('99999999-9999-9999-9999-999999999999') $$,
  'P0001', 'account_not_found', 'conta inexistente => account_not_found');
RESET ROLE;

-- ── log_logout ──────────────────────────────────────────────────────────
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');
SELECT lives_ok($$ SELECT public.log_logout() $$, 'log_logout como tutor A');
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = '00000000-0000-0000-0000-000000000001' AND evento = 'logout' AND detalhe = '{}'::jsonb),
  1, 'log_logout grava logout para o chamador com detalhe vazio');
SELECT tests.set_auth_uid('00000000-0000-0000-0000-000000000001');
SELECT lives_ok($$ SELECT public.log_logout() FROM generate_series(1, 24) $$, 'chamadas alem do limite nao lancam erro');
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator = '00000000-0000-0000-0000-000000000001' AND evento = 'logout'),
  20, 'a 21a chamada em 1 hora nao grava (limite de 20)');
SELECT tests.set_no_uid();
SELECT lives_ok($$ SELECT public.log_logout() $$, 'log_logout sem sessao nao faz nada e nao lanca erro');
RESET ROLE;
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.log_logout() $$, '42501', NULL, 'anon chamando log_logout recebe 42501');
RESET ROLE;

-- ── Minimizacao: nenhum detalhe criado aqui tem e-mail, telefone ou a palavra hash ──
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE ator::text LIKE 'aaaaaaaa-%' AND (detalhe::text ~ '@' OR detalhe::text ~ '[0-9]{8,}' OR detalhe::text ~* 'hash')),
  0, 'nenhum detalhe de auditoria contem e-mail, 8+ digitos ou a palavra hash');

SELECT * FROM finish();
ROLLBACK;
