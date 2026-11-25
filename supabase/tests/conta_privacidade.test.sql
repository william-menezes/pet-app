-- pgTAP: conta_privacidade.test.sql
-- Spec 004-conta-tutor, T075. Cobre export_my_data e delete_account_data (migration 0016).
-- Fontes: contracts/account-export.rpc.md (testes obrigatorios), contracts/account-delete.edge.md (Testes),
-- contracts/cross-spec-003.contract.md (C) e contracts/rls-expectations.md (itens 1, 2 e 9).
--
-- O arquivo passa COM ou SEM os objetos de verdade da spec 003: cada caso roda entre SAVEPOINT caso e
-- ROLLBACK TO caso e prepara o proprio cenario (DROP ... IF EXISTS e so entao a versao de mentira de
-- public.tag_assignments, end_assignments_for_account e export_tutor_tag_data). Nada sobrevive ao ROLLBACK final.
-- Os usuarios sao criados aqui, como dono do banco; nao ha dependencia do seed.

BEGIN;

SELECT plan(59);

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
-- So as claims (sem trocar o papel): permite guardar o resultado em tabela temporaria do dono.
CREATE OR REPLACE FUNCTION tests.claims_only(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true);
$$;

CREATE OR REPLACE FUNCTION tests.mk_user(p_id uuid, p_email text, p_meta jsonb)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data,
                          encrypted_password, created_at, updated_at, confirmation_token)
  VALUES (p_id, p_email, 'authenticated', 'authenticated', p_meta, '{"provider":"email","providers":["email"]}'::jsonb,
          crypt('SenhaDeTeste123', gen_salt('bf')), now(), now(), '');
$$;

-- Devolve o DETAIL do erro de export_my_data (ou NULL se nao houve erro).
CREATE OR REPLACE FUNCTION tests.export_detail() RETURNS text LANGUAGE plpgsql AS $$
DECLARE d text;
BEGIN
  PERFORM public.export_my_data();
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL;
  RETURN d;
END;
$$;

-- Guarda de resultados do dono.
CREATE TEMP TABLE t_exp (k text PRIMARY KEY, v jsonb);

-- Cenario: A (aceite, celular confirmado, identidade email) e B.
SELECT tests.mk_user('cccccccc-0000-0000-0000-0000000000a1', 'privacidade.a@faro.test',
  '{"name":"Ana Privacidade","terms_version":"2026-11"}'::jsonb);
SELECT tests.mk_user('cccccccc-0000-0000-0000-0000000000b2', 'privacidade.b@faro.test',
  '{"name":"Beto Privacidade","terms_version":"2026-11"}'::jsonb);
UPDATE public.perfis SET celular = '+5511900000011', celular_confirmado_em = now()
 WHERE id = 'cccccccc-0000-0000-0000-0000000000a1';
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('cccccccc-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000a1',
        '{"sub":"cccccccc-0000-0000-0000-0000000000a1","email":"privacidade.a@faro.test"}'::jsonb,
        'email', now(), now(), now());
-- Eventos extras: de A (com ip_hash e user_agent que NAO podem sair) e de B (marcador que nao pode aparecer em A).
INSERT INTO public.auth_audit_log (evento, ator, ip_hash, user_agent, detalhe, at) VALUES
  ('login_sucesso', 'cccccccc-0000-0000-0000-0000000000a1', 'ip-hash-secreto-a', 'agente-secreto-a', '{"metodo":"password"}', now()),
  ('logout',        'cccccccc-0000-0000-0000-0000000000a1', '', '', '{}', now() + interval '1 minute'),
  ('login_falha',   'cccccccc-0000-0000-0000-0000000000b2', 'ip-hash-secreto-b', 'agente-secreto-b', '{"marcador":"evento-de-b"}', now());

-- ═══════════════════════════ export_my_data ═══════════════════════════

-- E1. Privilegios.
SAVEPOINT caso;
SELECT is(has_function_privilege('anon', 'public.export_my_data()', 'EXECUTE'), false, 'anon nao executa export_my_data (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.export_my_data()', 'EXECUTE'), true, 'authenticated executa export_my_data (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.export_my_data()', 'EXECUTE'), false, 'service_role nao executa export_my_data (catalogo)');
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.export_my_data() $$, '42501', NULL, 'anon chamando export_my_data: 42501');
RESET ROLE;
ROLLBACK TO caso;
RELEASE caso;

-- E2. Sem sessao.
SAVEPOINT caso;
SELECT tests.set_no_uid();
SELECT throws_ok($$ SELECT public.export_my_data() $$, 'P0001', 'not_authenticated', 'sem sessao: not_authenticated');
RESET ROLE;
ROLLBACK TO caso;
RELEASE caso;

-- E3. Tutor A: so os dados de A (papel authenticated de verdade na primeira chamada).
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.export_tutor_tag_data(uuid) CASCADE;
SELECT tests.set_auth_uid('cccccccc-0000-0000-0000-0000000000a1');
SELECT lives_ok($$ SELECT public.export_my_data() $$, 'authenticated (tutor A) executa export_my_data');
RESET ROLE;
ROLLBACK TO caso;
RELEASE caso;

SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.export_tutor_tag_data(uuid) CASCADE;
SELECT tests.claims_only('cccccccc-0000-0000-0000-0000000000a1');
INSERT INTO t_exp VALUES ('antes', to_jsonb((SELECT count(*) FROM public.auth_audit_log WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1')));
INSERT INTO t_exp VALUES ('a', public.export_my_data());
SELECT is((SELECT v #>> '{conta,id}' FROM t_exp WHERE k = 'a'), 'cccccccc-0000-0000-0000-0000000000a1', 'tutor A: conta.id e o de A');
SELECT is((SELECT v ->> 'formato' FROM t_exp WHERE k = 'a'), '1', 'formato 1');
SELECT is((SELECT v #>> '{conta,email}' FROM t_exp WHERE k = 'a'), 'privacidade.a@faro.test', 'conta.email e o de A');
SELECT is((SELECT v #>> '{conta,celular}' FROM t_exp WHERE k = 'a'), '+5511900000011', 'conta.celular e o confirmado de A');
SELECT is((SELECT v #> '{conta,metodos_de_login}' FROM t_exp WHERE k = 'a'), '["email"]'::jsonb, 'metodos_de_login = ["email"]');
SELECT is((SELECT v -> 'consentimentos' -> 0 ->> 'versao' FROM t_exp WHERE k = 'a'), '2026-11', 'consentimento com a versao dos termos');
SELECT is((SELECT jsonb_array_length(v -> 'consentimentos') FROM t_exp WHERE k = 'a'), 1, 'um consentimento');
SELECT is((SELECT position('privacidade.b@faro.test' IN v::text) + position('cccccccc-0000-0000-0000-0000000000b2' IN v::text)
                  + position('Beto' IN v::text) + position('evento-de-b' IN v::text) FROM t_exp WHERE k = 'a'),
  0, 'nenhum valor do JSON contem e-mail, id, nome ou evento do tutor B');
SELECT is((SELECT jsonb_array_length(v -> 'eventos') FROM t_exp WHERE k = 'a'), (SELECT (v #>> '{}')::integer FROM t_exp WHERE k = 'antes'),
  'eventos: so as linhas com ator = A (mesma contagem da tabela)');
SELECT is((SELECT v -> 'eventos' -> 0 ->> 'evento' FROM t_exp WHERE k = 'a'), 'logout', 'eventos: do mais recente para o mais antigo');
SELECT ok((SELECT v::text !~ '"ip_hash"' AND v::text !~ '"user_agent"' AND v::text !~ 'ip-hash-secreto'
                  AND v::text !~ 'agente-secreto' FROM t_exp WHERE k = 'a'),
  'nenhuma chave ip_hash ou user_agent (nem seus valores) em nenhum nivel');
SELECT ok((SELECT v::text !~* '(senha|password_hash|encrypted|token)' FROM t_exp WHERE k = 'a'),
  'nenhum hash de senha nem token no arquivo');
RESET ROLE;
ROLLBACK TO caso;
RELEASE caso;

-- E4. Sem a funcao da 003: tags_e_pets nulo e 1 observacao.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.export_tutor_tag_data(uuid) CASCADE;
SELECT tests.claims_only('cccccccc-0000-0000-0000-0000000000a1');
INSERT INTO t_exp VALUES ('semfn', public.export_my_data());
SELECT is((SELECT v -> 'tags_e_pets' FROM t_exp WHERE k = 'semfn'), 'null'::jsonb, 'sem export_tutor_tag_data: tags_e_pets = null');
SELECT is((SELECT jsonb_array_length(v -> 'observacoes') FROM t_exp WHERE k = 'semfn'), 1, 'sem export_tutor_tag_data: 1 observacao');
ROLLBACK TO caso;
RELEASE caso;

-- E5. Com uma funcao de teste.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.export_tutor_tag_data(uuid) CASCADE;
CREATE FUNCTION public.export_tutor_tag_data(p_tutor uuid) RETURNS jsonb LANGUAGE sql AS $teste$ SELECT '{"pets":[]}'::jsonb $teste$;
SELECT tests.claims_only('cccccccc-0000-0000-0000-0000000000a1');
INSERT INTO t_exp VALUES ('comfn', public.export_my_data());
SELECT is((SELECT v -> 'tags_e_pets' FROM t_exp WHERE k = 'comfn'), '{"pets":[]}'::jsonb, 'com export_tutor_tag_data: tags_e_pets = {"pets":[]}');
SELECT is((SELECT v -> 'observacoes' FROM t_exp WHERE k = 'comfn'), '[]'::jsonb, 'com export_tutor_tag_data: observacoes vazio');
ROLLBACK TO caso;
RELEASE caso;

-- E6. Limite de 3 em 24 h e auditoria por chamada bem-sucedida.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.export_tutor_tag_data(uuid) CASCADE;
SELECT tests.claims_only('cccccccc-0000-0000-0000-0000000000a1');
INSERT INTO t_exp VALUES ('e1', public.export_my_data());
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1' AND evento = 'dados_exportados'), 1,
  'a primeira exportacao grava 1 evento dados_exportados');
SELECT ok((SELECT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'eventos') e WHERE e ->> 'evento' = 'dados_exportados') FROM t_exp WHERE k = 'e1'),
  'o evento dados_exportados nao aparece na exportacao que o gerou');
INSERT INTO t_exp VALUES ('e2', public.export_my_data());
SELECT ok((SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'eventos') e WHERE e ->> 'evento' = 'dados_exportados') FROM t_exp WHERE k = 'e2'),
  'o evento dados_exportados aparece na exportacao seguinte');
SELECT lives_ok($$ SELECT public.export_my_data() $$, 'a terceira exportacao do dia passa');
SELECT throws_ok($$ SELECT public.export_my_data() $$, 'P0001', 'rate_limited', 'a 4a exportacao em 24 h: rate_limited');
SELECT ok(tests.export_detail()::integer BETWEEN 1 AND 86400, 'rate_limited traz em DETAIL os segundos ate poder de novo (1 a 86400)');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1' AND evento = 'dados_exportados'), 3,
  'tres exportacoes bem-sucedidas, tres eventos; a negada nao grava');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log
            WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1' AND evento = 'dados_exportados'
              AND ip_hash = '' AND user_agent = '' AND detalhe = '{}'::jsonb), 3,
  'dados_exportados grava ip_hash e user_agent vazios e detalhe {}');
-- O limite e por conta: B nao e afetado pelo de A.
SELECT tests.claims_only('cccccccc-0000-0000-0000-0000000000b2');
SELECT lives_ok($$ SELECT public.export_my_data() $$, 'o limite de A nao afeta B');
ROLLBACK TO caso;
RELEASE caso;

-- ═══════════════════════════ delete_account_data ═══════════════════════════

-- D1. Privilegios.
SAVEPOINT caso;
SELECT is(has_function_privilege('anon', 'public.delete_account_data(uuid,text,text)', 'EXECUTE'), false, 'anon nao executa delete_account_data (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.delete_account_data(uuid,text,text)', 'EXECUTE'), false, 'authenticated nao executa delete_account_data (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.delete_account_data(uuid,text,text)', 'EXECUTE'), true, 'service_role executa delete_account_data (catalogo)');
SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', '', '') $$, '42501', NULL, 'anon chamando delete_account_data: 42501');
RESET ROLE;
SELECT tests.set_auth_uid('cccccccc-0000-0000-0000-0000000000a1');
SELECT throws_ok($$ SELECT public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', '', '') $$, '42501', NULL, 'authenticated chamando delete_account_data: 42501');
RESET ROLE;
ROLLBACK TO caso;
RELEASE caso;

-- D2. Sem a funcao e sem a tabela da 003: hook = absent e apaga as verificacoes e os limites.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.end_assignments_for_account(uuid) CASCADE;
DROP TABLE IF EXISTS public.tag_assignments CASCADE;
INSERT INTO public.phone_verifications (user_id, phone_hash, code_hash, expires_at)
VALUES ('cccccccc-0000-0000-0000-0000000000a1', 'ph-teste', 'ch-teste', now() + interval '10 minutes'),
       ('cccccccc-0000-0000-0000-0000000000b2', 'ph-teste-b', 'ch-teste-b', now() + interval '10 minutes');
INSERT INTO public.rate_limit_events (bucket, key) VALUES
  ('reauth:account', 'cccccccc-0000-0000-0000-0000000000a1'),
  ('reauth:account', 'cccccccc-0000-0000-0000-0000000000b2');
SELECT tests.set_service();
SELECT is(public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', 'iph-d2', 'ua-d2'),
  '{"hook":"absent","assignments_ended":null}'::jsonb, 'sem a funcao e sem a tabela da 003: hook = absent');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.phone_verifications WHERE user_id = 'cccccccc-0000-0000-0000-0000000000a1'), 0,
  'as verificacoes de celular da conta foram apagadas');
SELECT is((SELECT count(*)::integer FROM public.rate_limit_events WHERE key = 'cccccccc-0000-0000-0000-0000000000a1'), 0,
  'os eventos de limite da conta foram apagados');
SELECT is((SELECT count(*)::integer FROM public.phone_verifications WHERE user_id = 'cccccccc-0000-0000-0000-0000000000b2')
        + (SELECT count(*)::integer FROM public.rate_limit_events WHERE key = 'cccccccc-0000-0000-0000-0000000000b2'), 2,
  'nada de outra conta foi apagado');
SELECT is((SELECT detalhe FROM public.auth_audit_log WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1' AND evento = 'conta_excluida'),
  '{"vinculos_encerrados":0}'::jsonb, 'evento conta_excluida com vinculos_encerrados = 0');
SELECT is((SELECT count(*)::integer FROM public.perfis WHERE id = 'cccccccc-0000-0000-0000-0000000000a1'), 1,
  'delete_account_data nao apaga o perfil (isso e o passo do usuario)');
ROLLBACK TO caso;
RELEASE caso;

-- D3. Tabela de vinculos presente e sem a funcao: falha fechada, nada e apagado.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.end_assignments_for_account(uuid) CASCADE;
DROP TABLE IF EXISTS public.tag_assignments CASCADE;
CREATE TABLE public.tag_assignments (id integer PRIMARY KEY);
INSERT INTO public.phone_verifications (user_id, phone_hash, code_hash, expires_at)
VALUES ('cccccccc-0000-0000-0000-0000000000a1', 'ph-teste', 'ch-teste', now() + interval '10 minutes');
SELECT tests.set_service();
SELECT throws_ok($$ SELECT public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', '', '') $$,
  'P0001', 'deletion_hook_missing', 'tabela de vinculos sem a operacao: deletion_hook_missing');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.phone_verifications WHERE user_id = 'cccccccc-0000-0000-0000-0000000000a1'), 1,
  'falha fechada: as verificacoes continuam la');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1' AND evento = 'conta_excluida'), 0,
  'falha fechada: nenhum evento conta_excluida');
ROLLBACK TO caso;
RELEASE caso;

-- D4. Funcao de teste que devolve 2: hook = called.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.end_assignments_for_account(uuid) CASCADE;
CREATE FUNCTION public.end_assignments_for_account(p_tutor uuid) RETURNS integer LANGUAGE sql AS $teste$ SELECT 2 $teste$;
SELECT tests.set_service();
SELECT is(public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', 'iph-d4', 'ua-d4'),
  '{"hook":"called","assignments_ended":2}'::jsonb, 'com a operacao da 003: hook = called e assignments_ended = 2');
RESET ROLE;
SELECT is((SELECT detalhe FROM public.auth_audit_log WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1' AND evento = 'conta_excluida'),
  '{"vinculos_encerrados":2}'::jsonb, 'evento conta_excluida com vinculos_encerrados = 2');
ROLLBACK TO caso;
RELEASE caso;

-- D5. Funcao de teste que lanca erro: a excecao sobe e nada e apagado.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.end_assignments_for_account(uuid) CASCADE;
CREATE FUNCTION public.end_assignments_for_account(p_tutor uuid) RETURNS integer LANGUAGE plpgsql AS $teste$
BEGIN RAISE EXCEPTION 'falha_de_teste'; END;
$teste$;
INSERT INTO public.phone_verifications (user_id, phone_hash, code_hash, expires_at)
VALUES ('cccccccc-0000-0000-0000-0000000000a1', 'ph-teste', 'ch-teste', now() + interval '10 minutes');
SELECT tests.set_service();
SELECT throws_ok($$ SELECT public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', '', '') $$,
  'P0001', 'falha_de_teste', 'a operacao da 003 lanca erro: a excecao sobe');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.phone_verifications WHERE user_id = 'cccccccc-0000-0000-0000-0000000000a1'), 1,
  'erro na operacao: as verificacoes continuam la');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1' AND evento = 'conta_excluida'), 0,
  'erro na operacao: nenhum evento conta_excluida');
ROLLBACK TO caso;
RELEASE caso;

-- D6. Chamar duas vezes: um unico evento conta_excluida.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.end_assignments_for_account(uuid) CASCADE;
DROP TABLE IF EXISTS public.tag_assignments CASCADE;
SELECT tests.set_service();
SELECT lives_ok($$ SELECT public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', 'iph-d6', 'ua-d6') $$, 'primeira chamada');
SELECT lives_ok($$ SELECT public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', 'iph-d6', 'ua-d6') $$, 'segunda chamada (idempotente)');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log WHERE ator = 'cccccccc-0000-0000-0000-0000000000a1' AND evento = 'conta_excluida'), 1,
  'duas chamadas: um unico evento conta_excluida');
ROLLBACK TO caso;
RELEASE caso;

-- D7. Depois de apagar o usuario (simula o passo 8): perfil some; eventos ficam com ator nulo.
SAVEPOINT caso;
DROP FUNCTION IF EXISTS public.end_assignments_for_account(uuid) CASCADE;
DROP TABLE IF EXISTS public.tag_assignments CASCADE;
INSERT INTO public.phone_verifications (user_id, phone_hash, code_hash, expires_at)
VALUES ('cccccccc-0000-0000-0000-0000000000a1', 'ph-teste', 'ch-teste', now() + interval '10 minutes');
SELECT tests.set_service();
SELECT lives_ok($$ SELECT public.delete_account_data('cccccccc-0000-0000-0000-0000000000a1', 'iph-d7', 'ua-d7') $$, 'etapa de dados');
RESET ROLE;
DELETE FROM auth.users WHERE id = 'cccccccc-0000-0000-0000-0000000000a1';
SELECT is((SELECT count(*)::integer FROM public.perfis WHERE id = 'cccccccc-0000-0000-0000-0000000000a1'), 0, 'o perfil sumiu com o usuario');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log WHERE evento = 'conta_excluida' AND ip_hash = 'iph-d7' AND ator IS NULL), 1,
  'o evento conta_excluida continua, com ator nulo');
SELECT ok((SELECT count(*) >= 3 FROM public.auth_audit_log WHERE ator IS NULL AND evento IN ('conta_criada', 'termos_aceitos', 'login_sucesso')
             AND (detalhe ->> 'metodo' IN ('email', 'password') OR detalhe ->> 'versao' = '2026-11')),
  'os demais eventos da conta continuam, sem identificacao (ator nulo)');
SELECT is((SELECT count(*)::integer FROM public.phone_verifications WHERE user_id = 'cccccccc-0000-0000-0000-0000000000a1'), 0,
  'nenhuma verificacao de celular da conta restou');
ROLLBACK TO caso;
RELEASE caso;

-- D8. Entrada invalida.
SAVEPOINT caso;
SELECT tests.set_service();
SELECT throws_ok($$ SELECT public.delete_account_data(NULL, '', '') $$, 'P0001', 'invalid_user', 'id nulo: invalid_user');
RESET ROLE;
ROLLBACK TO caso;
RELEASE caso;

-- Sem `SELECT * FROM finish()`: o ROLLBACK TO de cada caso desfaz tambem a tabela de resultados do pgTAP e o
-- finish() lancaria "No tests run!". O pg_prove confere a linha do plano (1..59) e cada "ok"/"not ok" da saida.
ROLLBACK;
