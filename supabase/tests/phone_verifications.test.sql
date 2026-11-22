-- pgTAP: phone_verifications.test.sql
-- Spec 004-conta-tutor, T044 e T045. Cobre a tabela public.phone_verifications (0014) e as funcoes
-- de celular (0015): privilegios, begin, send_failed, active, confirm (maquina de estados), troca,
-- phone_is_confirmed, phone_verification_status e o guardiao de esquema.
-- Fonte: contracts/phone-verification.rpc.md e contracts/rls-expectations.md (item 5).
-- Tudo roda em BEGIN ... ROLLBACK; os usuarios sao criados aqui, como dono do banco.
-- Hashes de teste sao textos arbitrarios (a comparacao e entre HMACs calculados fora do banco).

BEGIN;

SELECT plan(116);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;

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

CREATE OR REPLACE FUNCTION tests.mk_user(p_id uuid, p_email text, p_meta jsonb)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data,
                          encrypted_password, created_at, updated_at, confirmation_token)
  VALUES (p_id, p_email, 'authenticated', 'authenticated', p_meta, '{"provider":"email","providers":["email"]}'::jsonb,
          crypt('SenhaDeTeste123', gen_salt('bf')), now(), now(), '');
$$;

-- Id da verificacao aberta da conta (nulo se nao houver).
CREATE OR REPLACE FUNCTION tests.open_id(p_uid uuid) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.phone_verifications
   WHERE user_id = p_uid AND consumed_at IS NULL AND invalidated_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
$$;
-- begin com hash de codigo informado (numero e hash do numero sao derivados do teste).
CREATE OR REPLACE FUNCTION tests.begin_for(p_uid uuid, p_phone text, p_code_hash text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.phone_verification_begin(p_uid, p_phone, 'phone-hash-de-teste', p_code_hash, 600, 5);
$$;
-- begin sem devolver linha (nao polui a saida TAP).
CREATE OR REPLACE FUNCTION tests.do_begin(p_uid uuid, p_phone text, p_code_hash text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.phone_verification_begin(p_uid, p_phone, 'phone-hash-de-teste', p_code_hash, 600, 5);
END;
$$;
-- confirm sobre a ultima verificacao da conta, aberta ou nao.
CREATE OR REPLACE FUNCTION tests.confirm_last(p_uid uuid, p_code_hash text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.phone_verification_confirm(
    p_uid,
    (SELECT id FROM public.phone_verifications WHERE user_id = p_uid ORDER BY created_at DESC, id LIMIT 1),
    p_code_hash, 'ip-de-teste', 'ua-de-teste');
$$;
-- confirm sobre a verificacao aberta da propria conta.
CREATE OR REPLACE FUNCTION tests.confirm_for(p_uid uuid, p_code_hash text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.phone_verification_confirm(p_uid, tests.open_id(p_uid), p_code_hash, 'ip-de-teste', 'ua-de-teste');
$$;

-- Usuarios: U1 com aceite e sem celular; U2 com aceite e celular confirmado; U3 sem aceite;
-- U4 e U6 a U9 com aceite e sem celular; U5 admin.
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000001', 'pv1@faro.test', '{"name":"PV Um","terms_version":"2026-11"}'::jsonb);
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000002', 'pv2@faro.test', '{"name":"PV Dois","terms_version":"2026-11"}'::jsonb);
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000003', 'pv3@faro.test', '{"name":"PV Tres"}'::jsonb);
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000004', 'pv4@faro.test', '{"name":"PV Quatro","terms_version":"2026-11"}'::jsonb);
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000005', 'pv5@faro.test', '{"name":"PV Cinco","terms_version":"2026-11"}'::jsonb);
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000006', 'pv6@faro.test', '{"name":"PV Seis","terms_version":"2026-11"}'::jsonb);
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000007', 'pv7@faro.test', '{"name":"PV Sete","terms_version":"2026-11"}'::jsonb);
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000008', 'pv8@faro.test', '{"name":"PV Oito","terms_version":"2026-11"}'::jsonb);
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-000000000009', 'pv9@faro.test', '{"name":"PV Nove","terms_version":"2026-11"}'::jsonb);

UPDATE public.perfis SET celular = '+5511900000002', celular_confirmado_em = now()
 WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
UPDATE public.perfis SET papel = 'admin' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000005';

-- ── 1. Guardiao de esquema, RLS e privilegios da tabela ────────────────
SELECT is((SELECT count(*)::integer FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'phone_verifications'), 10,
  'phone_verifications tem exatamente 10 colunas');
SELECT is((SELECT array_agg(column_name::text ORDER BY column_name::text COLLATE "C")
             FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'phone_verifications'),
  ARRAY['attempts','code_hash','consumed_at','created_at','expires_at','id','invalidated_at',
        'max_attempts','phone_hash','user_id']::text[],
  'guardiao de esquema: so hashes, sem coluna de codigo nem de telefone em claro');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.phone_verifications'::regclass), true,
  'phone_verifications tem RLS habilitada');
SELECT is((SELECT count(*)::integer FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'phone_verifications'), 0,
  'phone_verifications nao tem nenhuma politica');
SELECT is(has_table_privilege('anon', 'public.phone_verifications', 'SELECT')
       OR has_table_privilege('anon', 'public.phone_verifications', 'INSERT')
       OR has_table_privilege('anon', 'public.phone_verifications', 'UPDATE')
       OR has_table_privilege('anon', 'public.phone_verifications', 'DELETE')
       OR has_table_privilege('authenticated', 'public.phone_verifications', 'SELECT')
       OR has_table_privilege('authenticated', 'public.phone_verifications', 'INSERT')
       OR has_table_privilege('authenticated', 'public.phone_verifications', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.phone_verifications', 'DELETE'), false,
  'anon e authenticated nao tem nenhum privilegio de tabela em phone_verifications (catalogo)');
SELECT is((SELECT count(*)::integer FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'phone_verifications'
              AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(user_id)%'
              AND indexdef ILIKE '%consumed_at IS NULL%' AND indexdef ILIKE '%invalidated_at IS NULL%'), 1,
  'existe o indice unico parcial de uma verificacao aberta por conta');

SELECT tests.set_anon();
SELECT throws_ok($$ SELECT * FROM public.phone_verifications $$, '42501', NULL, 'anon lendo phone_verifications recebe 42501');
RESET ROLE;
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000001');
SELECT throws_ok($$ SELECT * FROM public.phone_verifications $$, '42501', NULL, 'authenticated lendo phone_verifications recebe 42501');
SELECT throws_ok($$ INSERT INTO public.phone_verifications (user_id, phone_hash, code_hash, expires_at)
                    VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'x', 'y', now()) $$,
  '42501', NULL, 'authenticated inserindo em phone_verifications recebe 42501');
SELECT throws_ok($$ UPDATE public.phone_verifications SET attempts = 0 $$,
  '42501', NULL, 'authenticated alterando phone_verifications recebe 42501');
SELECT throws_ok($$ DELETE FROM public.phone_verifications $$,
  '42501', NULL, 'authenticated apagando de phone_verifications recebe 42501');
RESET ROLE;

-- ── 2. Privilegios das funcoes (catalogo e chamada real) ────────────────
SELECT is(has_function_privilege('anon', 'public.phone_verification_begin(uuid,text,text,text,integer,integer)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.phone_verification_begin(uuid,text,text,text,integer,integer)', 'EXECUTE'), false,
  'anon e authenticated nao executam phone_verification_begin (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.phone_verification_begin(uuid,text,text,text,integer,integer)', 'EXECUTE'), true,
  'service_role executa phone_verification_begin (catalogo)');
SELECT is(has_function_privilege('anon', 'public.phone_verification_send_failed(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.phone_verification_send_failed(uuid)', 'EXECUTE'), false,
  'anon e authenticated nao executam phone_verification_send_failed (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.phone_verification_send_failed(uuid)', 'EXECUTE'), true,
  'service_role executa phone_verification_send_failed (catalogo)');
SELECT is(has_function_privilege('anon', 'public.phone_verification_active(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.phone_verification_active(uuid)', 'EXECUTE'), false,
  'anon e authenticated nao executam phone_verification_active (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.phone_verification_active(uuid)', 'EXECUTE'), true,
  'service_role executa phone_verification_active (catalogo)');
SELECT is(has_function_privilege('anon', 'public.phone_verification_confirm(uuid,uuid,text,text,text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.phone_verification_confirm(uuid,uuid,text,text,text)', 'EXECUTE'), false,
  'anon e authenticated nao executam phone_verification_confirm (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.phone_verification_confirm(uuid,uuid,text,text,text)', 'EXECUTE'), true,
  'service_role executa phone_verification_confirm (catalogo)');
SELECT is(has_function_privilege('anon', 'public.phone_is_confirmed(uuid)', 'EXECUTE'), false,
  'anon nao executa phone_is_confirmed (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.phone_is_confirmed(uuid)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.phone_is_confirmed(uuid)', 'EXECUTE'), true,
  'authenticated e service_role executam phone_is_confirmed (catalogo)');
SELECT is(has_function_privilege('anon', 'public.phone_verification_status()', 'EXECUTE'), false,
  'anon nao executa phone_verification_status (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.phone_verification_status()', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.phone_verification_status()', 'EXECUTE'), true,
  'authenticated e service_role executam phone_verification_status (catalogo)');

SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.phone_verification_begin('bbbbbbbb-0000-0000-0000-000000000001', '+5511987654421', 'a', 'b', 600, 5) $$,
  '42501', NULL, 'anon chamando phone_verification_begin recebe 42501');
SELECT throws_ok($$ SELECT public.phone_verification_send_failed(gen_random_uuid()) $$,
  '42501', NULL, 'anon chamando phone_verification_send_failed recebe 42501');
SELECT throws_ok($$ SELECT public.phone_verification_active('bbbbbbbb-0000-0000-0000-000000000001') $$,
  '42501', NULL, 'anon chamando phone_verification_active recebe 42501');
SELECT throws_ok($$ SELECT public.phone_verification_confirm('bbbbbbbb-0000-0000-0000-000000000001', gen_random_uuid(), 'a', 'b', 'c') $$,
  '42501', NULL, 'anon chamando phone_verification_confirm recebe 42501');
SELECT throws_ok($$ SELECT public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000002') $$,
  '42501', NULL, 'anon chamando phone_is_confirmed recebe 42501');
SELECT throws_ok($$ SELECT public.phone_verification_status() $$,
  '42501', NULL, 'anon chamando phone_verification_status recebe 42501');
RESET ROLE;

SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000001');
SELECT throws_ok($$ SELECT public.phone_verification_begin('bbbbbbbb-0000-0000-0000-000000000001', '+5511987654421', 'a', 'b', 600, 5) $$,
  '42501', NULL, 'authenticated chamando phone_verification_begin recebe 42501');
SELECT throws_ok($$ SELECT public.phone_verification_send_failed(gen_random_uuid()) $$,
  '42501', NULL, 'authenticated chamando phone_verification_send_failed recebe 42501');
SELECT throws_ok($$ SELECT public.phone_verification_active('bbbbbbbb-0000-0000-0000-000000000001') $$,
  '42501', NULL, 'authenticated chamando phone_verification_active recebe 42501');
SELECT throws_ok($$ SELECT public.phone_verification_confirm('bbbbbbbb-0000-0000-0000-000000000001', gen_random_uuid(), 'a', 'b', 'c') $$,
  '42501', NULL, 'authenticated chamando phone_verification_confirm recebe 42501');
RESET ROLE;

-- ── 3. begin ────────────────────────────────────────────────────────────
SELECT throws_ok($$ SELECT tests.begin_for('bbbbbbbb-0000-0000-0000-000000000003', '+5511987654421', 'c1') $$,
  'P0001', 'terms_required', 'begin com termos nao aceitos lanca terms_required');
SELECT throws_ok($$ SELECT tests.begin_for('bbbbbbbb-0000-0000-0000-000000000001', '+551137654421', 'c1') $$,
  'P0001', 'invalid_phone', 'begin com numero fixo lanca invalid_phone');
SELECT throws_ok($$ SELECT tests.begin_for('bbbbbbbb-0000-0000-0000-000000000001', NULL, 'c1') $$,
  'P0001', 'invalid_phone', 'begin com numero nulo lanca invalid_phone');
SELECT throws_ok($$ SELECT tests.begin_for('bbbbbbbb-0000-0000-0000-000000000002', '+5511900000002', 'c1') $$,
  'P0001', 'same_number', 'begin com o numero ja confirmado lanca same_number');
SELECT throws_ok($$ SELECT tests.begin_for('bbbbbbbb-0000-0000-0000-0000000000ff', '+5511987654421', 'c1') $$,
  'P0001', 'profile_not_found', 'begin de conta sem perfil lanca profile_not_found');
SELECT is((SELECT count(*)::integer FROM public.phone_verifications
            WHERE user_id IN ('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000003')), 0,
  'begin recusado nao grava verificacao');

SELECT lives_ok($$ SELECT tests.begin_for('bbbbbbbb-0000-0000-0000-000000000001', '+5511987654421', 'code-u1-primeiro') $$,
  'begin valido executa');
SELECT is((SELECT celular_pendente FROM public.perfis WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'), '+5511987654421',
  'begin grava o numero pendente');
SELECT ok((SELECT expires_at > now() + interval '9 minutes' AND expires_at < now() + interval '11 minutes'
             FROM public.phone_verifications WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000001')),
  'begin define a validade em 10 minutos');
SELECT is((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(
              tests.begin_for('bbbbbbbb-0000-0000-0000-000000000004', '+5511987654421', 'code-u4')) AS k),
  ARRAY['expires_at','verification_id']::text[],
  'begin devolve so verification_id e expires_at');
SELECT lives_ok($$ SELECT tests.begin_for('bbbbbbbb-0000-0000-0000-000000000004', '+5511987654421', 'code-u4b') $$,
  'begin repetido executa');
SELECT is((SELECT count(*)::integer FROM public.phone_verifications
            WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000004' AND consumed_at IS NULL AND invalidated_at IS NULL), 1,
  'begin repetido deixa uma unica verificacao aberta');
SELECT is((SELECT count(*)::integer FROM public.phone_verifications
            WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000004' AND invalidated_at IS NOT NULL), 1,
  'begin repetido invalida a verificacao anterior');

-- limpeza de linhas com mais de 24 horas
INSERT INTO public.phone_verifications (user_id, phone_hash, code_hash, expires_at, invalidated_at, created_at)
VALUES ('bbbbbbbb-0000-0000-0000-000000000004', 'ph', 'velho', now() - interval '25 hours', now() - interval '25 hours', now() - interval '25 hours');
SELECT lives_ok($$ SELECT tests.begin_for('bbbbbbbb-0000-0000-0000-000000000004', '+5511987654421', 'code-u4c') $$,
  'begin apos linha antiga executa');
SELECT is((SELECT count(*)::integer FROM public.phone_verifications
            WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000004' AND code_hash = 'velho'), 0,
  'begin apaga as linhas da conta com mais de 24 horas');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log
            WHERE ator IN ('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000004')
              AND evento::text LIKE 'celular_%'), 0,
  'begin nao grava auditoria (o envio ainda nao aconteceu)');

-- ── 4. phone_is_confirmed (5 casos + admin) ─────────────────────────────
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000002');
SELECT is(public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000002'), true,
  'tutor sobre a propria conta com celular confirmado: true');
RESET ROLE;
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000001');
SELECT is(public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000002'), false,
  'tutor sobre outra conta que tem celular: false');
SELECT is(public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000001'), false,
  'tutor sobre a propria conta sem celular: false');
RESET ROLE;
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000005');
SELECT is(public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000002'), true,
  'admin sobre outra conta com celular: valor real (true)');
RESET ROLE;
SELECT tests.set_service();
SELECT is(public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000002'), true,
  'service_role sobre outra conta com celular: true');
SELECT is(public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000001'), false,
  'service_role sobre conta sem celular: false');
SELECT is(public.phone_is_confirmed(NULL), false, 'NULL: false');
RESET ROLE;

-- ── 5. phone_verification_status ────────────────────────────────────────
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000001');
SELECT is((public.phone_verification_status() ->> 'phone_confirmed'), 'false', 'status de U1: celular nao confirmado');
SELECT is((public.phone_verification_status() ->> 'pending_phone'), '+5511987654421', 'status de U1: numero pendente da propria conta');
SELECT is(((public.phone_verification_status() -> 'active' ->> 'attempts_left')::integer), 5, 'status de U1: active com 5 tentativas');
SELECT is((SELECT count(*)::integer
             FROM jsonb_object_keys(public.phone_verification_status()) AS k WHERE k ILIKE '%hash%')
        + (SELECT count(*)::integer
             FROM jsonb_object_keys(public.phone_verification_status() -> 'active') AS k WHERE k ILIKE '%hash%' OR k ILIKE '%id'), 0,
  'status nao devolve chave com hash nem id de verificacao');
SELECT ok((public.phone_verification_status() -> 'phone') = 'null'::jsonb, 'status de U1 nao traz o celular de outra conta');
SELECT ok((public.phone_verification_status() -> 'resend_available_at') = 'null'::jsonb,
  'sem envio recente, resend_available_at e nulo');
RESET ROLE;
INSERT INTO public.rate_limit_events (bucket, key) VALUES ('sms:cooldown', 'bbbbbbbb-0000-0000-0000-000000000001');
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000001');
SELECT ok((public.phone_verification_status() ->> 'resend_available_at')::timestamptz > now() + interval '50 seconds',
  'depois do envio, resend_available_at fica cerca de 60 s adiante');
RESET ROLE;
UPDATE public.rate_limit_events SET at = now() - interval '2 minutes'
 WHERE bucket = 'sms:cooldown' AND key = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000001');
SELECT ok((public.phone_verification_status() -> 'resend_available_at') = 'null'::jsonb,
  'cooldown vencido: resend_available_at volta a nulo');
RESET ROLE;
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000002');
SELECT is((public.phone_verification_status() ->> 'phone'), '+5511900000002', 'status de U2: celular proprio');
SELECT is((public.phone_verification_status() ->> 'phone_confirmed'), 'true', 'status de U2: confirmado');
SELECT ok((public.phone_verification_status() -> 'pending_phone') = 'null'::jsonb
      AND (public.phone_verification_status() -> 'active') = 'null'::jsonb, 'status de U2: sem pendente e sem verificacao ativa');
RESET ROLE;
UPDATE public.phone_verifications SET expires_at = now() - interval '1 minute'
 WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000001');
SELECT tests.set_auth_uid('bbbbbbbb-0000-0000-0000-000000000001');
SELECT ok((public.phone_verification_status() -> 'active') = 'null'::jsonb, 'verificacao vencida nao e "ativa" no status');
RESET ROLE;
SELECT tests.set_no_uid();
SELECT throws_ok($$ SELECT public.phone_verification_status() $$, 'P0001', 'not_authenticated',
  'status sem sessao lanca not_authenticated');
RESET ROLE;

-- ── 6. phone_verification_active e send_failed ──────────────────────────
SELECT is((public.phone_verification_active('bbbbbbbb-0000-0000-0000-000000000001') ->> 'phone_e164'), '+5511987654421',
  'active devolve a verificacao aberta, mesmo vencida, com o numero pendente');
SELECT is(public.phone_verification_active('bbbbbbbb-0000-0000-0000-000000000006'), NULL::jsonb,
  'active devolve nulo quando nao ha verificacao aberta');
SELECT lives_ok($$ SELECT public.phone_verification_send_failed(tests.open_id('bbbbbbbb-0000-0000-0000-000000000001')) $$,
  'send_failed executa');
SELECT is(tests.open_id('bbbbbbbb-0000-0000-0000-000000000001'), NULL::uuid, 'send_failed invalida a verificacao aberta');
SELECT is((SELECT celular_pendente FROM public.perfis WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'), '+5511987654421',
  'send_failed mantem o numero pendente');
SELECT lives_ok($$ SELECT public.phone_verification_send_failed((SELECT id FROM public.phone_verifications
                    WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000001' ORDER BY created_at DESC LIMIT 1)) $$,
  'send_failed e idempotente');
SELECT is(public.phone_verification_active('bbbbbbbb-0000-0000-0000-000000000001'), NULL::jsonb,
  'active devolve nulo depois de send_failed');

-- ── 7. confirm: erros contam e a contagem fica gravada ──────────────────
SELECT tests.do_begin('bbbbbbbb-0000-0000-0000-000000000006', '+5511911111111', 'code-u6-certo');
SELECT is((SELECT (r ->> 'status') || ':' || (r ->> 'attempts_left')
             FROM (SELECT tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000006', 'errado') AS r) q), 'invalid:4',
  'confirm com hash errado: invalid com attempts_left 4');
SELECT is((SELECT attempts FROM public.phone_verifications WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000006'))::integer, 1,
  'o contador subiu para 1 e ficou gravado (sem excecao que desfaca)');
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000006', 'errado') -> 'attempts_left')::text, '3', 'segundo erro: attempts_left 3');
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000006', 'errado') -> 'attempts_left')::text, '2', 'terceiro erro: attempts_left 2');
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000006', 'errado') -> 'attempts_left')::text, '1', 'quarto erro: attempts_left 1');
SELECT is((SELECT attempts FROM public.phone_verifications WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000006'))::integer, 4,
  'depois de 4 erros o contador gravado e 4');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log
            WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000006' AND evento::text = 'celular_codigo_invalido'), 4,
  'cada erro grava celular_codigo_invalido');
SELECT is((SELECT array_agg(detalhe ->> 'restantes' ORDER BY detalhe ->> 'restantes') FROM public.auth_audit_log
            WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000006' AND evento::text = 'celular_codigo_invalido'),
  ARRAY['1','2','3','4']::text[], 'os erros registram restantes 4, 3, 2 e 1');
SELECT is((SELECT (r ->> 'status') || ':' || (r ->> 'attempts_left')
             FROM (SELECT tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000006', 'errado') AS r) q), 'locked:0',
  'o 5o erro bloqueia: locked com attempts_left 0');
SELECT is((tests.confirm_last('bbbbbbbb-0000-0000-0000-000000000006', 'code-u6-certo') ->> 'status'), 'no_active',
  'o 6o, com o hash certo, e no_active');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log
            WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000006' AND evento::text = 'celular_bloqueado'
              AND detalhe ->> 'motivo' = 'tentativas'), 1, 'o 5o erro grava celular_bloqueado (tentativas)');
SELECT is((SELECT celular FROM public.perfis WHERE id = 'bbbbbbbb-0000-0000-0000-000000000006'), NULL::text,
  'apos o bloqueio o celular continua sem confirmacao');
SELECT is((SELECT attempts FROM public.phone_verifications
            WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000006' AND invalidated_at IS NOT NULL)::integer, 5,
  'a linha bloqueada guarda 5 tentativas e fica invalidada');

-- ── 8. confirm: acerto ──────────────────────────────────────────────────
SELECT tests.do_begin('bbbbbbbb-0000-0000-0000-000000000007', '+5511922222222', 'code-u7-certo');
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000007', 'code-u7-certo') ->> 'status'), 'confirmed',
  'confirm com o hash certo: confirmed');
SELECT ok((SELECT celular = '+5511922222222' AND celular_pendente IS NULL AND celular_confirmado_em IS NOT NULL
             FROM public.perfis WHERE id = 'bbbbbbbb-0000-0000-0000-000000000007'),
  'perfis: celular = numero, pendente nulo, celular_confirmado_em preenchido');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log
            WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000007' AND evento::text = 'celular_confirmado'
              AND detalhe = '{"troca": false}'::jsonb), 1, 'evento celular_confirmado gravado com troca = false');
SELECT is((SELECT consumed_at IS NOT NULL FROM public.phone_verifications WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000007'), true,
  'a verificacao fica consumida');
SELECT is((public.phone_verification_confirm('bbbbbbbb-0000-0000-0000-000000000007',
            (SELECT id FROM public.phone_verifications WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000007'),
            'code-u7-certo', 'ip', 'ua') ->> 'status'), 'no_active', 'o codigo vale uma vez: segunda conferencia da no_active');
SELECT tests.set_service();
SELECT is(public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000007'), true, 'phone_is_confirmed vira true depois do acerto');
RESET ROLE;

-- ── 9. confirm: vencido, esgotado, outra conta, sem pendente ────────────
SELECT tests.do_begin('bbbbbbbb-0000-0000-0000-000000000008', '+5511933333333', 'code-u8-certo');
UPDATE public.phone_verifications SET expires_at = now() - interval '1 second'
 WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000008');
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000008', 'code-u8-certo') ->> 'status'), 'expired',
  'confirm vencido com hash certo: expired');
SELECT ok((SELECT celular IS NULL AND celular_pendente = '+5511933333333' FROM public.perfis
            WHERE id = 'bbbbbbbb-0000-0000-0000-000000000008'), 'vencido: perfis.celular nao muda');
SELECT is(tests.open_id('bbbbbbbb-0000-0000-0000-000000000008'), NULL::uuid, 'vencido: a verificacao e invalidada');

SELECT tests.do_begin('bbbbbbbb-0000-0000-0000-000000000009', '+5511944444444', 'code-u9-certo');
UPDATE public.phone_verifications SET attempts = max_attempts WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000009');
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000009', 'code-u9-certo') ->> 'status'), 'locked',
  'tentativas esgotadas, mesmo com hash certo: locked');
SELECT is(tests.open_id('bbbbbbbb-0000-0000-0000-000000000009'), NULL::uuid, 'esgotado: a verificacao e invalidada');

SELECT tests.do_begin('bbbbbbbb-0000-0000-0000-000000000001', '+5511955555555', 'code-u1-novo');
SELECT is((public.phone_verification_confirm('bbbbbbbb-0000-0000-0000-000000000004',
            tests.open_id('bbbbbbbb-0000-0000-0000-000000000001'), 'code-u1-novo', 'ip', 'ua') ->> 'status'), 'no_active',
  'verificacao de outra conta: no_active');
SELECT is((SELECT attempts FROM public.phone_verifications WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000001'))::integer, 0,
  'verificacao de outra conta nao conta tentativa na dona');
SELECT is((public.phone_verification_confirm('bbbbbbbb-0000-0000-0000-000000000001', gen_random_uuid(), 'x', 'ip', 'ua') ->> 'status'),
  'no_active', 'id inexistente: no_active');

UPDATE public.perfis SET celular_pendente = NULL WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT throws_ok($$ SELECT tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000001', 'code-u1-novo') $$,
  'P0001', 'no_pending_phone', 'acerto sem numero pendente lanca no_pending_phone');
SELECT is((SELECT consumed_at IS NULL FROM public.phone_verifications WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000001')), true,
  'no_pending_phone nao consome a verificacao');
SELECT is(public.phone_verification_active('bbbbbbbb-0000-0000-0000-000000000001'), NULL::jsonb,
  'active devolve nulo quando celular_pendente e nulo');

-- ── 10. Troca de numero ─────────────────────────────────────────────────
SELECT tests.do_begin('bbbbbbbb-0000-0000-0000-000000000002', '+5511966666666', 'code-u2-b');
SELECT ok((SELECT celular = '+5511900000002' AND celular_pendente = '+5511966666666' FROM public.perfis
            WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'troca: begin mantem o celular antigo e guarda o novo como pendente');
SELECT tests.set_service();
SELECT is(public.phone_is_confirmed('bbbbbbbb-0000-0000-0000-000000000002'), true,
  'troca: phone_is_confirmed continua true durante a troca');
RESET ROLE;
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000002', 'errado') ->> 'status'), 'invalid', 'troca: codigo errado e invalid');
SELECT is((SELECT celular FROM public.perfis WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'), '+5511900000002',
  'troca: com confirm errado, o celular continua o antigo');
UPDATE public.phone_verifications SET expires_at = now() - interval '1 second'
 WHERE id = tests.open_id('bbbbbbbb-0000-0000-0000-000000000002');
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000002', 'code-u2-b') ->> 'status'), 'expired', 'troca: vencido e expired');
SELECT is((SELECT celular FROM public.perfis WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'), '+5511900000002',
  'troca: vencido, o celular continua o antigo');
SELECT tests.do_begin('bbbbbbbb-0000-0000-0000-000000000002', '+5511966666666', 'code-u2-b2');
SELECT is((tests.confirm_for('bbbbbbbb-0000-0000-0000-000000000002', 'code-u2-b2') ->> 'status'), 'confirmed', 'troca: acerto confirma');
SELECT ok((SELECT celular = '+5511966666666' AND celular_pendente IS NULL FROM public.perfis
            WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'troca: depois do acerto o celular e o novo');
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log
            WHERE ator = 'bbbbbbbb-0000-0000-0000-000000000002' AND evento::text = 'celular_confirmado'
              AND detalhe = '{"troca": true}'::jsonb), 1, 'troca: celular_confirmado grava troca = true');

-- ── 11. Minimizacao da auditoria ────────────────────────────────────────
SELECT is((SELECT count(*)::integer FROM public.auth_audit_log
            WHERE ator::text LIKE 'bbbbbbbb-0000-0000-0000-00000000000%'
              AND (detalhe::text ~ '[0-9]{8,}' OR detalhe::text LIKE '%@%' OR detalhe::text ILIKE '%hash%'
                   OR detalhe::text LIKE '%+55%')), 0,
  'nenhum detalhe de auditoria contem digitos de telefone, e-mail ou a palavra hash');

SELECT * FROM finish();
ROLLBACK;
