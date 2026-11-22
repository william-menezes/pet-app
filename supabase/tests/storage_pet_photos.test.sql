-- pgTAP: storage_pet_photos.test.sql
-- Spec 003-tag-qr, T028 (feito quando: o tutor A nao le objeto do tutor B). Migration 0032: bucket privado `pet-photos`
-- e politicas de storage.objects limitadas ao prefixo `<auth.uid()>/`.
-- Os objetos de teste sao linhas de storage.objects (metadados) criadas como dono do banco e desfeitas no ROLLBACK final.

BEGIN;

SELECT plan(20);

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
CREATE OR REPLACE FUNCTION tests.mk_user(p_id uuid, p_email text, p_name text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data,
                          encrypted_password, created_at, updated_at, confirmation_token)
  VALUES (p_id, p_email, 'authenticated', 'authenticated',
          json_build_object('name', p_name, 'terms_version', '2026-11')::jsonb,
          '{"provider":"email","providers":["email"]}'::jsonb,
          extensions.crypt('SenhaDeTeste123', extensions.gen_salt('bf')), now(), now(), '');
$$;
-- true se o comando falha com 42501 (privilegio ou politica de linha), no papel atual.
CREATE OR REPLACE FUNCTION tests.denied(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END;
$$;

-- ── Cenario ─────────────────────────────────────────────────────────────
SELECT tests.mk_user('b6b6b6b6-0000-0000-0000-0000000000a1', 'foto.a@faro.test', 'Ana Foto');
SELECT tests.mk_user('b6b6b6b6-0000-0000-0000-0000000000b2', 'foto.b@faro.test', 'Beto Foto');
SELECT tests.mk_user('b6b6b6b6-0000-0000-0000-0000000000d4', 'foto.admin@faro.test', 'Admin Foto');
UPDATE public.perfis SET papel = 'admin' WHERE id = 'b6b6b6b6-0000-0000-0000-0000000000d4';
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('pet-photos', 'b6b6b6b6-0000-0000-0000-0000000000a1/pet1/foto.jpg'),
  ('pet-photos', 'b6b6b6b6-0000-0000-0000-0000000000b2/pet2/foto.jpg');

-- ═══════════════ Bucket e politicas (catalogo) ═══════════════

SELECT is((SELECT public FROM storage.buckets WHERE id = 'pet-photos'), false, 'o bucket pet-photos existe e e privado');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'pet_photos_%'), 4, 'quatro politicas de pet-photos (select, insert, update, delete)');
SELECT is_empty($$ SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'pet_photos_%'
                    AND roles <> ARRAY['authenticated']::name[] $$, 'nenhuma politica de pet-photos para anon nem PUBLIC: so authenticated');
SELECT is_empty($$ SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'pet_photos_%'
                    AND (lower(regexp_replace(coalesce(qual, ''), '[()\s]', '', 'g')) = 'true'
                         OR lower(regexp_replace(coalesce(with_check, ''), '[()\s]', '', 'g')) = 'true') $$, 'nenhuma politica de pet-photos e USING (true)');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass), true, 'storage.objects tem RLS habilitada');

-- DELETE direto em storage.objects e bloqueado pela propria versao do Storage (gatilho de instrucao: so pela API do Storage),
-- entao a politica de DELETE e conferida pelo catalogo e a exclusao real pelo script de CI (account-delete usa a API).
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'pet_photos_tutor_delete'
            AND cmd = 'DELETE' AND qual LIKE '%foldername%auth.uid()%'), 1, 'a politica de DELETE limita ao prefixo do proprio tutor');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'pet_photos_%'
            AND coalesce(qual, with_check) LIKE '%pet-photos%'), 4, 'as quatro politicas so valem para o bucket pet-photos');

-- ═══════════════ Tutor A ═══════════════

SELECT tests.set_auth_uid('b6b6b6b6-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'pet-photos' AND name LIKE 'b6b6b6b6-%'), 1, 'A le so o proprio objeto');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'pet-photos' AND name = 'b6b6b6b6-0000-0000-0000-0000000000b2/pet2/foto.jpg'), 0, 'A NAO le o objeto do tutor B');
SELECT lives_ok($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('pet-photos', 'b6b6b6b6-0000-0000-0000-0000000000a1/pet1/outra.jpg') $$, 'A grava na propria pasta');
SELECT is(tests.denied($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('pet-photos', 'b6b6b6b6-0000-0000-0000-0000000000b2/pet2/invasao.jpg') $$), true, 'A nao grava na pasta do tutor B');
SELECT is(tests.denied($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('pet-photos', 'solta.jpg') $$), true, 'A nao grava fora de uma pasta propria (caminho sem a pasta do tutor)');
SELECT is((WITH u AS (UPDATE storage.objects SET name = name WHERE bucket_id = 'pet-photos' AND name LIKE 'b6b6b6b6-0000-0000-0000-0000000000b2/%' RETURNING 1) SELECT count(*)::integer FROM u), 0, 'A nao altera objeto do tutor B');
SELECT is(tests.denied($$ UPDATE storage.objects SET name = 'b6b6b6b6-0000-0000-0000-0000000000b2/pet2/roubo.jpg' WHERE name = 'b6b6b6b6-0000-0000-0000-0000000000a1/pet1/foto.jpg' $$), true, 'A nao move o proprio objeto para a pasta do tutor B');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'pet-photos' AND name LIKE 'b6b6b6b6-0000-0000-0000-0000000000b2/%'), 1, 'o objeto do tutor B continua intacto');

-- ═══════════════ Tutor B, admin e anon ═══════════════

SELECT tests.set_auth_uid('b6b6b6b6-0000-0000-0000-0000000000b2');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'pet-photos' AND name LIKE 'b6b6b6b6-0000-0000-0000-0000000000a1/%'), 0, 'B NAO le objeto do tutor A');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'pet-photos' AND name LIKE 'b6b6b6b6-%'), 1, 'B le so o proprio objeto');
RESET ROLE;
SELECT tests.set_auth_uid('b6b6b6b6-0000-0000-0000-0000000000d4');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'pet-photos' AND name LIKE 'b6b6b6b6-%'), 0, 'o admin nao le fotos pelo Storage (a pagina publica usa URL assinada da role de servico)');
RESET ROLE;
SELECT tests.set_anon();
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'pet-photos'), 0, 'anon nao le nenhum objeto de pet-photos');
SELECT is(tests.denied($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('pet-photos', 'b6b6b6b6-0000-0000-0000-0000000000a1/pet1/anon.jpg') $$), true, 'anon nao grava em pet-photos');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
