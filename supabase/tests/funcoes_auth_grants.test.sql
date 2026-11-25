-- pgTAP: funcoes_auth_grants.test.sql
-- Spec 004-conta-tutor, T009. Cobre a migration 0009 (funcoes da 001).
-- Fonte: specs/004-conta-tutor/contracts/account.rpc.md (bloco funcoes_auth_grants).

BEGIN;

SELECT plan(14);

-- Catalogo
SELECT is(has_function_privilege('anon', 'public.log_auth_event(public.evento_auth_enum,uuid,text,text,jsonb)', 'EXECUTE'), false,
  'anon nao tem EXECUTE em log_auth_event (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.log_auth_event(public.evento_auth_enum,uuid,text,text,jsonb)', 'EXECUTE'), false,
  'authenticated nao tem EXECUTE em log_auth_event (catalogo)');
SELECT is(has_function_privilege('anon', 'public.record_login_attempt(text,text,boolean)', 'EXECUTE'), false,
  'anon nao tem EXECUTE em record_login_attempt (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.record_login_attempt(text,text,boolean)', 'EXECUTE'), false,
  'authenticated nao tem EXECUTE em record_login_attempt (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.log_auth_event(public.evento_auth_enum,uuid,text,text,jsonb)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.record_login_attempt(text,text,boolean)', 'EXECUTE'), true,
  'service_role tem EXECUTE nas duas (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.current_user_role()', 'EXECUTE'), true,
  'authenticated continua executando is_admin e current_user_role (catalogo)');
SELECT is(has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')
      OR has_function_privilege('anon', 'public.current_user_role()', 'EXECUTE'), false,
  'anon nao executa is_admin nem current_user_role (catalogo)');

-- Chamada real como anon
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.log_auth_event('login_sucesso'::public.evento_auth_enum, NULL, 'h', 'ua', '{}'::jsonb) $$,
  '42501', NULL, 'anon chamando log_auth_event recebe 42501');
SELECT throws_ok($$ SELECT public.record_login_attempt('x', 'y', NULL) $$,
  '42501', NULL, 'anon chamando record_login_attempt recebe 42501');
SELECT throws_ok($$ SELECT public.is_admin() $$,
  '42501', NULL, 'anon chamando is_admin recebe 42501');
RESET ROLE;

-- Chamada real como authenticated
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.log_auth_event('login_sucesso'::public.evento_auth_enum, NULL, 'h', 'ua', '{}'::jsonb) $$,
  '42501', NULL, 'authenticated chamando log_auth_event recebe 42501');
SELECT throws_ok($$ SELECT public.record_login_attempt('x', 'y', NULL) $$,
  '42501', NULL, 'authenticated chamando record_login_attempt recebe 42501');
SELECT lives_ok($$ SELECT public.is_admin(), public.current_user_role() $$,
  'authenticated executa is_admin e current_user_role');
RESET ROLE;

-- Chamada real como service_role
SET LOCAL ROLE service_role;
SELECT lives_ok($$ SELECT public.log_auth_event('login_sucesso'::public.evento_auth_enum, NULL, 'h', 'ua', '{}'::jsonb),
                         public.record_login_attempt('test_grants_x', 'test_grants_y', NULL) $$,
  'service_role executa log_auth_event e record_login_attempt');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
