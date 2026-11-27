-- pgTAP: account_tags.test.sql
-- Spec 003-tag-qr, T019A (contracts/integration-002-004.contract.md §4.4; rls-expectations.md, isolamento 4 e 5).
-- Cobre end_assignments_for_account e export_tutor_tag_data (migration 0027), so com TABELAS (as RPCs das fases
-- seguintes ainda nao existem; a verificacao com resolve_tag fica para T036).
--
-- Cenario (tudo criado aqui, como dono do banco, e desfeito no ROLLBACK final; nenhum PIN esta escrito no
-- arquivo: os PINs sao gerados por new_activation_pin() e vivem so na tabela temporaria t_pin):
--   tutor A: pet1 com T1 (assigned), pet2 com T2 (blocked, vinculo ativo), vinculo ENCERRADO antigo de T4 (released);
--   tutor B: pet3 com T3 (assigned); tutor C: conta vazia.
-- Os codigos sao os vetores sinteticos de contracts/tag-code.vectors.json (nenhum e codigo real).

BEGIN;

SELECT plan(61);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

CREATE OR REPLACE FUNCTION tests.set_auth_uid(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid, true),
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
CREATE OR REPLACE FUNCTION tests.mk_user(p_id uuid, p_email text, p_name text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data,
                          encrypted_password, created_at, updated_at, confirmation_token)
  VALUES (p_id, p_email, 'authenticated', 'authenticated',
          json_build_object('name', p_name, 'terms_version', '2026-11')::jsonb,
          '{"provider":"email","providers":["email"]}'::jsonb,
          extensions.crypt('SenhaDeTeste123', extensions.gen_salt('bf')), now(), now(), '');
$$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT tests.mk_user('dddddddd-0000-0000-0000-0000000000a1', 'tags.a@faro.test', 'Ana Tags');
SELECT tests.mk_user('dddddddd-0000-0000-0000-0000000000b2', 'tags.b@faro.test', 'Beto Tags');
SELECT tests.mk_user('dddddddd-0000-0000-0000-0000000000c3', 'tags.c@faro.test', 'Carla Vazia');

INSERT INTO public.pets (id, tutor_id, name, species) VALUES
  ('dddddddd-1111-0000-0000-000000000001', 'dddddddd-0000-0000-0000-0000000000a1', 'PetDaAnaUm', 'dog'),
  ('dddddddd-1111-0000-0000-000000000002', 'dddddddd-0000-0000-0000-0000000000a1', 'PetDaAnaDois', 'cat'),
  ('dddddddd-1111-0000-0000-000000000003', 'dddddddd-0000-0000-0000-0000000000b2', 'PetDoBeto', 'dog');

INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-901', 4);

-- PINs gerados em tempo de execucao (custo 12, como em producao); o texto puro so existe nesta tabela temporaria.
CREATE TEMP TABLE t_pin (code text PRIMARY KEY, pin text NOT NULL, hash text NOT NULL);
DO $$
DECLARE
  c text;
  p text;
BEGIN
  FOREACH c IN ARRAY ARRAY['ABCDEFGHV', '000000000', 'ZZZZZZZZ8', '0123456Z3'] LOOP
    p := public.new_activation_pin();
    INSERT INTO t_pin VALUES (c, p, extensions.crypt(p, extensions.gen_salt('bf', 12)));
  END LOOP;
END;
$$;

INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask, pin_fail_count_24h, pin_fail_window_start, pin_locked_until)
SELECT t.code, 'lote-901',
       CASE t.code WHEN 'ABCDEFGHV' THEN 'assigned' WHEN '000000000' THEN 'blocked' WHEN 'ZZZZZZZZ8' THEN 'assigned' ELSE 'available' END,
       t.hash, 0,
       CASE WHEN t.code IN ('ABCDEFGHV', 'ZZZZZZZZ8') THEN 3 ELSE 0 END,
       CASE WHEN t.code IN ('ABCDEFGHV', 'ZZZZZZZZ8') THEN now() END,
       CASE WHEN t.code IN ('ABCDEFGHV', 'ZZZZZZZZ8') THEN now() + interval '1 hour' END
  FROM t_pin t;

-- Copia dos hashes para provar que nao mudam.
CREATE TEMP TABLE t_hash AS SELECT code, activation_pin_hash AS hash FROM public.tag_codes;

INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id, started_at, ended_at, end_reason) VALUES
  ('dddddddd-2222-0000-0000-000000000001', 'ABCDEFGHV', 'dddddddd-1111-0000-0000-000000000001', 'dddddddd-0000-0000-0000-0000000000a1', now() - interval '5 days', NULL, NULL),
  ('dddddddd-2222-0000-0000-000000000002', '000000000', 'dddddddd-1111-0000-0000-000000000002', 'dddddddd-0000-0000-0000-0000000000a1', now() - interval '4 days', NULL, NULL),
  ('dddddddd-2222-0000-0000-000000000003', 'ZZZZZZZZ8', 'dddddddd-1111-0000-0000-000000000003', 'dddddddd-0000-0000-0000-0000000000b2', now() - interval '3 days', NULL, NULL),
  ('dddddddd-2222-0000-0000-000000000004', '0123456Z3', 'dddddddd-1111-0000-0000-000000000001', 'dddddddd-0000-0000-0000-0000000000a1', now() - interval '20 days', now() - interval '10 days', 'released');

INSERT INTO public.scan_events (id, tag_code, assignment_id, status_at_scan, ip_hash, geo_method, lat, lng, accuracy_m, city, region,
                                location_token_hash, location_token_expires_at) VALUES
  ('dddddddd-3333-0000-0000-000000000001', 'ABCDEFGHV', 'dddddddd-2222-0000-0000-000000000001', 'assigned', 'marcador-ip-a1', 'ip', -23.55, -46.63, 3000, 'Sao Paulo', 'SP', 'marcador-token-a1', now() + interval '1 hour'),
  ('dddddddd-3333-0000-0000-000000000002', '0123456Z3', 'dddddddd-2222-0000-0000-000000000004', 'assigned', 'marcador-ip-a4', 'gps', -22.90, -43.20, 15, NULL, NULL, 'marcador-token-a4', now() + interval '1 hour'),
  ('dddddddd-3333-0000-0000-000000000003', '000000000', 'dddddddd-2222-0000-0000-000000000002', 'blocked', 'marcador-ip-a2', 'ip', -19.92, -43.94, 3000, 'Belo Horizonte', 'MG', NULL, NULL),
  ('dddddddd-3333-0000-0000-000000000004', 'ZZZZZZZZ8', 'dddddddd-2222-0000-0000-000000000003', 'assigned', 'marcador-ip-b', 'ip', -25.43, -49.27, 3000, 'Curitiba', 'PR', 'marcador-token-b', now() + interval '1 hour'),
  ('dddddddd-3333-0000-0000-000000000005', '0123456Z3', NULL, 'available', 'marcador-ip-sem-vinculo', 'ip', -30.03, -51.23, 3000, 'Porto Alegre', 'RS', NULL, NULL);

INSERT INTO public.pending_activations (tutor_id, tag_code) VALUES
  ('dddddddd-0000-0000-0000-0000000000a1', '0123456Z3'),
  ('dddddddd-0000-0000-0000-0000000000b2', '0123456Z3');
INSERT INTO public.tag_pin_attempts (tag_code, tutor_id, fail_count, window_start) VALUES
  ('0123456Z3', 'dddddddd-0000-0000-0000-0000000000a1', 2, now()),
  ('0123456Z3', 'dddddddd-0000-0000-0000-0000000000b2', 1, now());
INSERT INTO public.tag_replacement_requests (id, tag_code, pet_id, tutor_id, kind) VALUES
  ('dddddddd-4444-0000-0000-000000000001', 'ABCDEFGHV', 'dddddddd-1111-0000-0000-000000000001', 'dddddddd-0000-0000-0000-0000000000a1', 'damaged'),
  ('dddddddd-4444-0000-0000-000000000002', 'ZZZZZZZZ8', 'dddddddd-1111-0000-0000-000000000003', 'dddddddd-0000-0000-0000-0000000000b2', 'damaged');
UPDATE public.rescue_profiles SET lost_mode = true, lost_since = now() - interval '1 day'
 WHERE pet_id IN ('dddddddd-1111-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000003');

CREATE TEMP TABLE t_res (k text PRIMARY KEY, v jsonb);

-- ── Privilegios ─────────────────────────────────────────────────────────
SELECT is(has_function_privilege('anon', 'public.end_assignments_for_account(uuid)', 'EXECUTE'), false, 'anon nao executa end_assignments_for_account (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.end_assignments_for_account(uuid)', 'EXECUTE'), false, 'authenticated nao executa end_assignments_for_account (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.end_assignments_for_account(uuid)', 'EXECUTE'), true, 'service_role executa end_assignments_for_account (catalogo)');
SELECT is(has_function_privilege('anon', 'public.export_tutor_tag_data(uuid)', 'EXECUTE'), false, 'anon nao executa export_tutor_tag_data (catalogo)');
SELECT is(has_function_privilege('authenticated', 'public.export_tutor_tag_data(uuid)', 'EXECUTE'), false, 'authenticated nao executa export_tutor_tag_data (catalogo)');
SELECT is(has_function_privilege('service_role', 'public.export_tutor_tag_data(uuid)', 'EXECUTE'), true, 'service_role executa export_tutor_tag_data (catalogo)');

SELECT tests.set_anon();
SELECT throws_ok($$ SELECT public.end_assignments_for_account('dddddddd-0000-0000-0000-0000000000a1') $$, '42501', NULL, 'anon chamando end_assignments_for_account: 42501');
SELECT throws_ok($$ SELECT public.export_tutor_tag_data('dddddddd-0000-0000-0000-0000000000a1') $$, '42501', NULL, 'anon chamando export_tutor_tag_data: 42501');
RESET ROLE;
-- O proprio tutor, autenticado, tambem nao: as duas sao so do servidor.
SELECT tests.set_auth_uid('dddddddd-0000-0000-0000-0000000000a1');
SELECT throws_ok($$ SELECT public.end_assignments_for_account('dddddddd-0000-0000-0000-0000000000a1') $$, '42501', NULL, 'authenticated chamando end_assignments_for_account: 42501');
SELECT throws_ok($$ SELECT public.export_tutor_tag_data('dddddddd-0000-0000-0000-0000000000a1') $$, '42501', NULL, 'authenticated chamando export_tutor_tag_data: 42501');
RESET ROLE;

-- ── export_tutor_tag_data ANTES de encerrar ─────────────────────────────
INSERT INTO t_res VALUES ('exp_a_antes', public.export_tutor_tag_data('dddddddd-0000-0000-0000-0000000000a1'));
INSERT INTO t_res VALUES ('exp_c', public.export_tutor_tag_data('dddddddd-0000-0000-0000-0000000000c3'));

SELECT ok((SELECT v ?& ARRAY['pets', 'perfis_de_resgate', 'vinculos', 'scans'] FROM t_res WHERE k = 'exp_a_antes'), 'exportacao: as quatro chaves existem');
SELECT is((SELECT jsonb_array_length(v -> 'pets') FROM t_res WHERE k = 'exp_a_antes'), 2, 'exportacao de A: 2 pets');
SELECT is((SELECT jsonb_array_length(v -> 'perfis_de_resgate') FROM t_res WHERE k = 'exp_a_antes'), 2, 'exportacao de A: 2 perfis de resgate');
SELECT is((SELECT jsonb_array_length(v -> 'vinculos') FROM t_res WHERE k = 'exp_a_antes'), 3, 'exportacao de A: 3 vinculos (2 ativos e 1 encerrado)');
SELECT is((SELECT jsonb_array_length(v -> 'scans') FROM t_res WHERE k = 'exp_a_antes'), 3, 'exportacao de A: 3 scans dos vinculos dele (nao o scan sem vinculo)');
SELECT is((SELECT count(*)::integer FROM t_res, jsonb_array_elements(v -> 'vinculos') e
            WHERE k = 'exp_a_antes' AND e ->> 'codigo' = 'ABCD-EFGH-V' AND e ->> 'pet' = 'PetDaAnaUm' AND e -> 'fim' = 'null'::jsonb), 1,
  'exportacao: o vinculo ativo de T1 traz o codigo no formato de exibicao, o pet e fim nulo');
SELECT is((SELECT (v -> 'perfis_de_resgate' -> 0 ->> 'modo_perdido') FROM t_res WHERE k = 'exp_a_antes'), 'true', 'exportacao: modo perdido ligado aparece (ordem por criacao do pet)');
SELECT ok((SELECT v::text !~ 'PetDoBeto' AND v::text !~ 'ZZZZ-ZZZZ-8' AND v::text !~ 'Curitiba' AND v::text !~ 'Beto'
                  AND v::text !~ 'dddddddd-0000-0000-0000-0000000000b2' FROM t_res WHERE k = 'exp_a_antes'),
  'exportacao de A: nenhum dado do tutor B (pet, codigo, cidade, id)');
SELECT ok((SELECT v::text !~ 'ip_hash' AND v::text !~ 'marcador-ip' AND v::text !~ 'token' AND v::text !~ 'marcador-token'
                  AND v::text !~ 'pin' AND v::text !~ '\$2[abxy]\$' AND v::text !~ 'audit' FROM t_res WHERE k = 'exp_a_antes'),
  'exportacao: nenhum ip_hash, token, hash de PIN nem auditoria');
SELECT is((SELECT v FROM t_res WHERE k = 'exp_c'), '{"pets":[],"perfis_de_resgate":[],"vinculos":[],"scans":[]}'::jsonb,
  'conta sem nada: as quatro listas vazias (nunca null)');
SELECT is(public.export_tutor_tag_data(NULL), '{"pets":[],"perfis_de_resgate":[],"vinculos":[],"scans":[]}'::jsonb,
  'tutor nulo: as quatro listas vazias');

-- ── end_assignments_for_account: primeira chamada (papel service_role de verdade) ──
SELECT tests.set_service();
SELECT is(public.end_assignments_for_account('dddddddd-0000-0000-0000-0000000000a1'), 2, 'primeira chamada: encerra 2 vinculos ativos de A');
SELECT is(public.end_assignments_for_account('dddddddd-0000-0000-0000-0000000000a1'), 0, 'segunda chamada: devolve 0');
SELECT is(public.end_assignments_for_account('dddddddd-0000-0000-0000-0000000000c3'), 0, 'conta sem vinculo: devolve 0');
SELECT is(public.end_assignments_for_account(NULL), 0, 'tutor nulo: devolve 0 sem erro');
RESET ROLE;

-- ── Efeito nas tabelas ──────────────────────────────────────────────────
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE batch_id = 'lote-901'), 4, 'nenhum codigo foi apagado');
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'ABCDEFGHV'), 'available', 'T1 (assigned) voltou a available');
SELECT is((SELECT status FROM public.tag_codes WHERE code = '000000000'), 'blocked', 'T2 (blocked) continua blocked');
SELECT is((SELECT status FROM public.tag_codes WHERE code = '0123456Z3'), 'available', 'T4 (ja disponivel) continua available');
SELECT is((SELECT status FROM public.tag_codes WHERE code = 'ZZZZZZZZ8'), 'assigned', 'T3 (de B) continua assigned');
SELECT is((SELECT count(*)::integer FROM public.tag_codes c JOIN t_hash h USING (code) WHERE c.activation_pin_hash <> h.hash), 0,
  'activation_pin_hash de TODAS as tags e o mesmo de antes (o PIN vigente e mantido)');
SELECT ok((SELECT extensions.crypt(p.pin, c.activation_pin_hash) = c.activation_pin_hash
             FROM public.tag_codes c JOIN t_pin p USING (code) WHERE c.code = 'ABCDEFGHV'),
  'o PIN original de T1 continua valendo (o cartao serve a quem receber a tag)');
SELECT ok((SELECT extensions.crypt(p.pin, c.activation_pin_hash) = c.activation_pin_hash
             FROM public.tag_codes c JOIN t_pin p USING (code) WHERE c.code = '000000000'),
  'o PIN original de T2 (bloqueada) continua valendo');
SELECT is((SELECT pin_fail_count_24h::text || coalesce(pin_fail_window_start::text, '-') || coalesce(pin_locked_until::text, '-')
             FROM public.tag_codes WHERE code = 'ABCDEFGHV'), '0--', 'contadores de PIN de T1 zerados');
SELECT is((SELECT pin_fail_count_24h FROM public.tag_codes WHERE code = 'ZZZZZZZZ8'), 3, 'contadores de PIN de T3 (de B) intactos');

SELECT is((SELECT count(*)::integer FROM public.tag_assignments
            WHERE tutor_id = 'dddddddd-0000-0000-0000-0000000000a1' AND ended_at IS NULL), 0, 'A nao tem mais vinculo ativo');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments
            WHERE tutor_id = 'dddddddd-0000-0000-0000-0000000000a1' AND end_reason = 'account_deleted' AND ended_at IS NOT NULL), 2,
  'os dois vinculos ativos de A terminaram com account_deleted');
SELECT is((SELECT end_reason FROM public.tag_assignments WHERE id = 'dddddddd-2222-0000-0000-000000000004'), 'released',
  'o vinculo antigo ja encerrado manteve o motivo released');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tutor_id = 'dddddddd-0000-0000-0000-0000000000b2' AND ended_at IS NULL), 1,
  'o vinculo ativo de B continua ativo');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments WHERE tag_code IN (SELECT code FROM t_pin)), 4, 'nenhum vinculo foi apagado (historico preservado)');

SELECT is((SELECT count(*)::integer FROM public.scan_events
            WHERE assignment_id IN ('dddddddd-2222-0000-0000-000000000001', 'dddddddd-2222-0000-0000-000000000002', 'dddddddd-2222-0000-0000-000000000004')), 3,
  'os 3 scans dos vinculos de A continuam (so a localizacao saiu)');
SELECT is((SELECT count(*)::integer FROM public.scan_events
            WHERE assignment_id IN ('dddddddd-2222-0000-0000-000000000001', 'dddddddd-2222-0000-0000-000000000002', 'dddddddd-2222-0000-0000-000000000004')
              AND (lat IS NOT NULL OR lng IS NOT NULL OR accuracy_m IS NOT NULL OR city IS NOT NULL OR region IS NOT NULL
                   OR geo_method <> 'none' OR location_token_hash IS NOT NULL OR location_token_expires_at IS NOT NULL)), 0,
  'scans dos vinculos de A (ativos e encerrado): sem coordenada, cidade, regiao nem token; geo_method none');
SELECT is((SELECT city FROM public.scan_events WHERE id = 'dddddddd-3333-0000-0000-000000000004'), 'Curitiba', 'scan do vinculo de B intacto (cidade)');
SELECT is((SELECT lat FROM public.scan_events WHERE id = 'dddddddd-3333-0000-0000-000000000004'), -25.43::double precision, 'scan do vinculo de B intacto (coordenada)');
SELECT is((SELECT city FROM public.scan_events WHERE id = 'dddddddd-3333-0000-0000-000000000005'), 'Porto Alegre', 'scan sem vinculo (fila do admin) intacto');

SELECT is((SELECT count(*)::integer FROM public.pending_activations WHERE tutor_id = 'dddddddd-0000-0000-0000-0000000000a1'), 0, 'ativacao pendente de A apagada');
SELECT is((SELECT count(*)::integer FROM public.pending_activations WHERE tutor_id = 'dddddddd-0000-0000-0000-0000000000b2'), 1, 'ativacao pendente de B intacta');
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tutor_id = 'dddddddd-0000-0000-0000-0000000000a1'), 0, 'tentativas de PIN de A apagadas');
SELECT is((SELECT count(*)::integer FROM public.tag_pin_attempts WHERE tutor_id = 'dddddddd-0000-0000-0000-0000000000b2'), 1, 'tentativas de PIN de B intactas');
SELECT is((SELECT status || '/' || (resolved_at IS NOT NULL)::text FROM public.tag_replacement_requests WHERE id = 'dddddddd-4444-0000-0000-000000000001'),
  'cancelled/true', 'pedido de 2a via aberto de A fechado como cancelled, com data');
SELECT is((SELECT status FROM public.tag_replacement_requests WHERE id = 'dddddddd-4444-0000-0000-000000000002'), 'open', 'pedido de B continua aberto');
SELECT is((SELECT lost_mode::text || coalesce(lost_since::text, '-') FROM public.rescue_profiles WHERE pet_id = 'dddddddd-1111-0000-0000-000000000001'),
  'false-', 'modo perdido do pet de A desligado');
SELECT is((SELECT lost_mode FROM public.rescue_profiles WHERE pet_id = 'dddddddd-1111-0000-0000-000000000003'), true, 'modo perdido do pet de B intacto');

-- ── Auditoria: um evento, so a contagem, sem ator ──────────────────────
SELECT is((SELECT count(*)::integer FROM public.audit_log WHERE event = 'account_tags_released'), 1,
  'um unico evento account_tags_released (a segunda chamada nao repete)');
SELECT is((SELECT detail FROM public.audit_log WHERE event = 'account_tags_released'), '{"assignments_ended":2}'::jsonb,
  'o detalhe tem so a contagem');
SELECT ok((SELECT actor_id IS NULL AND entity_id IS NULL FROM public.audit_log WHERE event = 'account_tags_released'),
  'o evento nao tem ator nem identificador de entidade');

-- ── export_tutor_tag_data DEPOIS: A segue exportavel e sem localizacao; B continua isolado ──
INSERT INTO t_res VALUES ('exp_a_depois', public.export_tutor_tag_data('dddddddd-0000-0000-0000-0000000000a1'));
INSERT INTO t_res VALUES ('exp_b', public.export_tutor_tag_data('dddddddd-0000-0000-0000-0000000000b2'));
SELECT is((SELECT count(*)::integer FROM t_res, jsonb_array_elements(v -> 'vinculos') e
            WHERE k = 'exp_a_depois' AND e ->> 'motivo_fim' = 'account_deleted'), 2, 'exportacao depois: 2 vinculos terminados por account_deleted');
SELECT is((SELECT count(*)::integer FROM t_res, jsonb_array_elements(v -> 'scans') e
            WHERE k = 'exp_a_depois' AND (e -> 'lat' <> 'null'::jsonb OR e -> 'cidade' <> 'null'::jsonb OR e ->> 'metodo' <> 'none')), 0,
  'exportacao depois: scans sem coordenada, cidade e com metodo none');
SELECT ok((SELECT v::text !~ 'PetDaAna' AND v::text !~ 'Sao Paulo' AND v::text !~ 'ip_hash' AND v::text !~ 'token' FROM t_res WHERE k = 'exp_b'),
  'exportacao de B: nada do tutor A nem chaves proibidas');
SELECT is((SELECT jsonb_array_length(v -> 'scans') FROM t_res WHERE k = 'exp_b'), 1, 'exportacao de B: 1 scan (o dele)');

-- Nenhuma operacao apaga ou altera codigo.
SELECT is((SELECT string_agg(code, ',' ORDER BY code) FROM public.tag_codes WHERE batch_id = 'lote-901'), '000000000,0123456Z3,ABCDEFGHV,ZZZZZZZZ8',
  'os quatro codigos continuam, inalterados');

SELECT * FROM finish();
ROLLBACK;
