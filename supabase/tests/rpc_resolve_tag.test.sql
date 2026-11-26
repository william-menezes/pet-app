-- pgTAP: rpc_resolve_tag.test.sql
-- Spec 003-tag-qr, T026 (feito quando: os quatro estados saem corretos) e T036 (anti-enumeracao, Rescue-First e o caso
-- pos-exclusao de conta de contracts/integration-002-004.contract.md secao 4.4). Migrations 0028 e dependencias.
--
-- Cenario (criado aqui, desfeito no ROLLBACK final; nenhum PIN no arquivo e nada do seed):
--   tutora A (celular confirmado, "Ana Resolve Silva") com o pet "Rex Teste" e a tag ABCDEFGHV; o pet "Mimi" com a tag
--   00000001Y BLOQUEADA (vinculo ativo); tutor B (celular NAO confirmado) com "Bidu" e a tag ZZZZZZZZ8;
--   JKMNPQRSR disponivel; TVWXYZ01S bloqueada; 10000000Z anulada; H8ZWE5XGH nao existe.
-- Codigos: vetores sinteticos de contracts/tag-code.vectors.json. Um `ip_hash` por caso (now() e fixo na transacao e a
-- janela do limite e fixa: o contador de uma origem nao vaza para a outra).

BEGIN;

SELECT plan(53);

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
-- true se o comando falha com 42501 (privilegio), no papel atual.
CREATE OR REPLACE FUNCTION tests.denied(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END;
$$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT tests.mk_user('c1c1c1c1-0000-0000-0000-0000000000a1', 'resolve.a@faro.test', 'Ana Resolve Silva');
SELECT tests.mk_user('c1c1c1c1-0000-0000-0000-0000000000b2', 'resolve.b@faro.test', 'Beto Resolve');
UPDATE public.perfis SET nome = 'Ana Resolve Silva', celular = '+5511987654421', celular_confirmado_em = now()
 WHERE id = 'c1c1c1c1-0000-0000-0000-0000000000a1';
UPDATE public.perfis SET nome = 'Beto Resolve' WHERE id = 'c1c1c1c1-0000-0000-0000-0000000000b2';

INSERT INTO public.pets (id, tutor_id, name, species, temperament, care_notes, photo_path) VALUES
  ('c1c1c1c1-1111-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-0000000000a1', 'Rex Teste', 'dog',
   ARRAY['Docil com pessoas', 'Medo de barulho'], 'Toma remedio de manha.',
   'c1c1c1c1-0000-0000-0000-0000000000a1/c1c1c1c1-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.jpg'),
  ('c1c1c1c1-1111-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-0000000000a1', 'Mimi', 'cat', '{}', NULL, NULL),
  ('c1c1c1c1-1111-0000-0000-000000000003', 'c1c1c1c1-0000-0000-0000-0000000000b2', 'Bidu', 'dog', ARRAY['Arisco'], 'Nao dar petisco.', NULL);

INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-903', 6);
CREATE TEMP TABLE t_hash AS
  SELECT extensions.crypt(public.new_activation_pin(), extensions.gen_salt('bf', 12)) AS hash;
INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
SELECT c.code, 'lote-903', c.status, h.hash, 0
  FROM t_hash h, (VALUES ('ABCDEFGHV', 'assigned'), ('ZZZZZZZZ8', 'assigned'), ('JKMNPQRSR', 'available'),
                         ('TVWXYZ01S', 'blocked'), ('10000000Z', 'void'), ('00000001Y', 'blocked')) AS c (code, status);

INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id, started_at) VALUES
  ('c1c1c1c1-2222-0000-0000-00000000000a', 'ABCDEFGHV', 'c1c1c1c1-1111-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-0000000000a1', now() - interval '5 days'),
  ('c1c1c1c1-2222-0000-0000-00000000000b', 'ZZZZZZZZ8', 'c1c1c1c1-1111-0000-0000-000000000003', 'c1c1c1c1-0000-0000-0000-0000000000b2', now() - interval '4 days'),
  ('c1c1c1c1-2222-0000-0000-00000000000c', '00000001Y', 'c1c1c1c1-1111-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-0000000000a1', now() - interval '3 days');

-- Rex Teste: nome, WhatsApp e telefone liberados; o resto no padrao (temperamento e cuidados ligados).
UPDATE public.rescue_profiles SET show_tutor_first_name = true, show_whatsapp = true, show_phone = true
 WHERE pet_id = 'c1c1c1c1-1111-0000-0000-000000000001';
-- Bidu: o celular do tutor B nao esta confirmado; a regra do gatilho impede ligar, entao o teste a contorna (como dono)
-- para provar que o resolve_tag nao confia so na flag.
ALTER TABLE public.rescue_profiles DISABLE TRIGGER rescue_profiles_check_phone;
UPDATE public.rescue_profiles SET show_tutor_first_name = true, show_whatsapp = true, show_phone = true
 WHERE pet_id = 'c1c1c1c1-1111-0000-0000-000000000003';
ALTER TABLE public.rescue_profiles ENABLE TRIGGER rescue_profiles_check_phone;

-- ═══════════════ Quatro estados, com o perfil completo ═══════════════

SELECT tests.set_service();

SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r01') ->> 'state', 'assigned', 'tag vinculada: state assigned');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r02') -> 'profile' ->> 'code', 'ABCD-EFGH-V', 'perfil: codigo no formato XXXX-XXXX-X');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r03') -> 'profile' -> 'pet' ->> 'name', 'Rex Teste', 'perfil: nome do pet');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r04') -> 'profile' -> 'pet' ->> 'photo_path',
  'c1c1c1c1-0000-0000-0000-0000000000a1/c1c1c1c1-1111-0000-0000-000000000001/aaaaaaaa-1111-4222-8333-444444444444.jpg', 'perfil: photo_path para a funcao assinar');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r05') -> 'profile' -> 'temperament', '["Docil com pessoas", "Medo de barulho"]'::jsonb, 'perfil: temperamento ligado aparece');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r06') -> 'profile' ->> 'care_notes', 'Toma remedio de manha.', 'perfil: cuidados ligados aparecem');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r07') -> 'profile' ->> 'tutor_first_name', 'Ana', 'perfil: so o primeiro nome da tutora');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r08') -> 'profile' ->> 'whatsapp_url',
  'https://wa.me/5511987654421?text=Oi%21%20Encontrei%20o%20Rex%20Teste%20pela%20tag%20do%20Faro.', 'perfil: link wa.me com a mensagem codificada');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r09') -> 'profile' ->> 'phone_display', '(11) 98765-4421', 'perfil: telefone formatado (confirmado e com opt-in)');
SELECT ok(NOT (public.resolve_tag('ABCDEFGHV', 'ip-r10') -> 'profile' ? 'lost'), 'perfil: sem o bloco lost fora do modo perdido');

SELECT is(public.resolve_tag('JKMNPQRSR', 'ip-r11'), '{"state":"available","code":"JKMN-PQRS-R"}'::jsonb, 'tag disponivel: state available e o codigo formatado');
SELECT is(public.resolve_tag('H8ZWE5XGH', 'ip-r12'), '{"state":"not_found"}'::jsonb, 'codigo valido e inexistente: not_found');
-- O photo_path carrega <tutor_id>/<pet_id>/ por contrato (a Edge Function o troca por URL assinada); o resto nao pode ter id.
SELECT is((public.resolve_tag('ABCDEFGHV', 'ip-r12b') #- '{profile,pet,photo_path}')::text !~ '(c1c1c1c1|ip_hash|activation_pin|lote-903|status)', true,
  'nenhum identificador interno, ip_hash, hash de PIN, lote ou status na resposta de resgate (fora o photo_path)');

-- Normalizacao: minusculas, hifen e espacos; e o valor sem NADA do dono.
SELECT is(public.resolve_tag('abcd-efgh-v', 'ip-r13') ->> 'state', 'assigned', 'normaliza minusculas e hifens');
SELECT is(public.resolve_tag('ABCD EFGH V', 'ip-r14') ->> 'state', 'assigned', 'normaliza espacos');

-- ═══════════════ Campo desligado nao aparece ═══════════════

RESET ROLE;
UPDATE public.rescue_profiles SET show_temperament = false, show_care = false, show_tutor_first_name = false,
       show_whatsapp = false, show_phone = false
 WHERE pet_id = 'c1c1c1c1-1111-0000-0000-000000000001';
SELECT tests.set_service();

SELECT is((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(public.resolve_tag('ABCDEFGHV', 'ip-r15') -> 'profile') AS k),
  ARRAY['code', 'pet']::text[], 'tudo desligado: o perfil so tem codigo e pet (sem null, sem chave)');
SELECT is(position('11987654421' IN public.resolve_tag('ABCDEFGHV', 'ip-r16')::text), 0, 'show_phone e show_whatsapp desligados: o numero nao aparece em campo nenhum');
SELECT is(position('Ana' IN public.resolve_tag('ABCDEFGHV', 'ip-r17')::text), 0, 'primeiro nome desligado: nao aparece');
SELECT is(position('null' IN public.resolve_tag('ABCDEFGHV', 'ip-r18')::text), 0, 'nenhum null no JSON (campo desligado some)');

-- Telefone e WhatsApp: celular do tutor nao confirmado nao aparece mesmo com a flag ligada.
SELECT is((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(public.resolve_tag('ZZZZZZZZ8', 'ip-r19') -> 'profile') AS k),
  ARRAY['care_notes', 'code', 'pet', 'temperament', 'tutor_first_name']::text[],
  'celular nao confirmado: sem whatsapp_url e sem phone_display, mesmo com show_whatsapp e show_phone ligados');

-- Modo perdido: so os campos liberados.
RESET ROLE;
UPDATE public.rescue_profiles SET lost_mode = true, lost_since = '2026-11-19 12:00:00+00', lost_message = 'Ele se assusta.',
       lost_show_since = true, lost_show_reward = true, lost_show_message = true
 WHERE pet_id = 'c1c1c1c1-1111-0000-0000-000000000001';
SELECT tests.set_service();
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r20') -> 'profile' -> 'lost',
  '{"since":"2026-11-19T12:00:00Z","reward":true,"message":"Ele se assusta."}'::jsonb, 'modo perdido: since, reward e message liberados aparecem');
RESET ROLE;
UPDATE public.rescue_profiles SET lost_show_since = false, lost_show_reward = false, lost_show_message = false
 WHERE pet_id = 'c1c1c1c1-1111-0000-0000-000000000001';
SELECT tests.set_service();
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-r21') -> 'profile' -> 'lost', '{}'::jsonb, 'modo perdido com tudo desligado: bloco lost vazio (sem since, reward ou message)');
RESET ROLE;
UPDATE public.rescue_profiles SET lost_mode = false, lost_since = NULL WHERE pet_id = 'c1c1c1c1-1111-0000-0000-000000000001';
SELECT tests.set_service();

-- ═══════════════ Anti-enumeracao (rls-expectations.md) ═══════════════

SELECT is(public.resolve_tag('TVWXYZ01S', 'ip-e01'), '{"state":"not_found"}'::jsonb, 'bloqueada: not_found');
SELECT is(public.resolve_tag('10000000Z', 'ip-e02'), '{"state":"not_found"}'::jsonb, 'anulada: not_found');
SELECT is(public.resolve_tag('00000001Y', 'ip-e03'), '{"state":"not_found"}'::jsonb, 'bloqueada COM vinculo ativo: not_found (o scan vai para a fila do admin)');
SELECT is(
  public.resolve_tag('H8ZWE5XGH', 'ip-e04')::text = public.resolve_tag('TVWXYZ01S', 'ip-e05')::text
  AND public.resolve_tag('TVWXYZ01S', 'ip-e06')::text = public.resolve_tag('10000000Z', 'ip-e07')::text, true,
  'inexistente, bloqueada e anulada: saida identica (texto)');

-- Digito verificador invalido: nao toca o banco (o contador de limite fica intacto).
SELECT is(public.resolve_tag('7K3MQ9XAD', 'ip-inv'), '{"state":"not_found"}'::jsonb, 'digito verificador invalido: not_found');
SELECT is(public.resolve_tag('ABC', 'ip-inv'), '{"state":"not_found"}'::jsonb, 'codigo curto: not_found');
SELECT is(public.resolve_tag(NULL, 'ip-inv'), '{"state":"not_found"}'::jsonb, 'codigo nulo: not_found');
SELECT is((SELECT count(*)::integer FROM public.rate_limits WHERE key = 'ip-inv'), 0, 'digito invalido: nenhum contador de limite foi tocado (nao leu nem contou)');

-- ═══════════════ Limite por ip_hash: 30 por minuto e 300 por hora ═══════════════

CREATE TEMP TABLE t_flood (i integer PRIMARY KEY, state text NOT NULL);
GRANT ALL ON t_flood TO service_role;
INSERT INTO t_flood SELECT i, public.resolve_tag('ABCDEFGHV', 'ip-flood') ->> 'state' FROM generate_series(1, 32) AS i;
SELECT is((SELECT count(*)::integer FROM t_flood WHERE i <= 30 AND state = 'assigned'), 30, 'as 30 primeiras chamadas do mesmo ip_hash passam');
SELECT is((SELECT state FROM t_flood WHERE i = 31), 'rate_limited', 'a 31a chamada em um minuto devolve rate_limited');
SELECT is((SELECT state FROM t_flood WHERE i = 32), 'rate_limited', 'a 32a continua rate_limited');
SELECT is(public.resolve_tag('H8ZWE5XGH', 'ip-flood'), '{"state":"rate_limited"}'::jsonb, 'estourado: a resposta nao depende de o codigo existir');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-outra') ->> 'state', 'assigned', 'outro ip_hash tem o proprio contador');
RESET ROLE;
INSERT INTO public.rate_limits (scope, key, window_start, count)
VALUES ('resolve_ip_hour', 'ip-hora', to_timestamp(floor(extract(epoch FROM now()) / 3600) * 3600), 300);
SELECT tests.set_service();
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-hora'), '{"state":"rate_limited"}'::jsonb, 'a 301a chamada na hora devolve rate_limited');
SELECT is(public.resolve_tag('ABCDEFGHV', NULL) ->> 'state', 'assigned', 'ip_hash nulo: usa a chave "unknown" e atende');

-- ═══════════════ Rescue-First (Principio I) ═══════════════

-- can_link_tag negando NAO afeta uma tag ja vinculada. (Sem SAVEPOINT: o ROLLBACK TO desfaria o registro do pgTAP.)
RESET ROLE;
CREATE OR REPLACE FUNCTION public.can_link_tag(p_tutor uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $f$ SELECT false; $f$;
SELECT is(public.can_link_tag('c1c1c1c1-0000-0000-0000-0000000000a1'), false, 'preparo: can_link_tag simulado devolve false');
SELECT tests.set_service();
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-rf1') ->> 'state', 'assigned', 'can_link_tag falso: a tag ja vinculada continua respondendo o resgate');
SELECT is(public.resolve_tag('JKMNPQRSR', 'ip-rf2') ->> 'state', 'available', 'can_link_tag falso: a tag disponivel continua respondendo "disponivel" (so novos vinculos sao barrados)');
RESET ROLE;
CREATE OR REPLACE FUNCTION public.can_link_tag(p_tutor uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $f$ SELECT true; $f$;
SELECT is(public.can_link_tag('c1c1c1c1-0000-0000-0000-0000000000a1'), true, 'can_link_tag restaurada (TODO(BILLING_MODEL): sempre permite)');

SELECT is((SELECT prosrc !~* '(plan|subscription|assinatura|entitlement|can_link_tag)' FROM pg_proc WHERE oid = 'public.resolve_tag(character,text)'::regprocedure), true,
  'estrutural: resolve_tag nao referencia nenhum objeto de cobranca nem can_link_tag');

-- ═══════════════ Privilegios ═══════════════

SELECT tests.set_anon();
SELECT is(tests.denied($$ SELECT public.resolve_tag('ABCDEFGHV', 'ip-x') $$), true, 'anon nao executa resolve_tag');
RESET ROLE;
SELECT tests.set_auth_uid('c1c1c1c1-0000-0000-0000-0000000000a1');
SELECT is(tests.denied($$ SELECT public.resolve_tag('ABCDEFGHV', 'ip-x') $$), true, 'authenticated (nem o dono) nao executa resolve_tag');
RESET ROLE;
SELECT is(has_function_privilege('service_role', 'public.resolve_tag(character,text)', 'EXECUTE'), true, 'service_role executa resolve_tag');
SELECT is(has_function_privilege('anon', 'public.url_encode_utf8(text)', 'EXECUTE'), false, 'anon nao executa url_encode_utf8');
SELECT is(has_function_privilege('authenticated', 'public.url_encode_utf8(text)', 'EXECUTE'), false, 'authenticated nao executa url_encode_utf8');
SELECT is(public.url_encode_utf8('Oi! Ação & você'), 'Oi%21%20A%C3%A7%C3%A3o%20%26%20voc%C3%AA', 'url_encode_utf8: percent-encoding dos bytes UTF-8');
SELECT is((SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid = 'public.resolve_tag(character,text)'::regprocedure), true,
  'resolve_tag e security definer com search_path fixo');

-- ═══════════════ Depois da exclusao da conta (integration-002-004, secao 4.4) ═══════════════

SELECT tests.set_service();
SELECT is(public.end_assignments_for_account('c1c1c1c1-0000-0000-0000-0000000000a1'), 2, 'preparo: a exclusao da conta da Ana encerra os 2 vinculos');
SELECT is(public.resolve_tag('ABCDEFGHV', 'ip-pos1'), '{"state":"available","code":"ABCD-EFGH-V"}'::jsonb,
  'depois de end_assignments_for_account: a tag responde "nao ativada" (available)');
SELECT is(public.resolve_tag('00000001Y', 'ip-pos2'), '{"state":"not_found"}'::jsonb, 'a tag que estava bloqueada continua not_found depois da exclusao');
RESET ROLE;
SELECT is((SELECT activation_pin_hash FROM public.tag_codes WHERE code = 'ABCDEFGHV'), (SELECT hash FROM t_hash), 'o PIN da tag liberada pela exclusao da conta e o mesmo de antes');

SELECT * FROM finish();
ROLLBACK;
