-- supabase/seed.sql
-- Seed de desenvolvimento/teste para a feature 001-login.
-- IMPORTANTE: Este arquivo NÃO deve conter credenciais reais nem service_role keys.
-- Cria usuários de teste via auth.users (GoTrue local) + perfis para validar:
--   - Roteamento por papel (Tutor → /app, Admin → /admin)
--   - Isolamento entre tutores (Tutor A não lê dados de B)
--   - Funções is_admin() e current_user_role()
--
-- Como usar (desenvolvimento local):
--   supabase start
--   supabase db reset      # aplica migrations + este seed
--
-- Para criar os usuários de fato no GoTrue local, use o Supabase Studio
-- (http://localhost:54323 → Authentication → Users → Add User) com os e-mails abaixo,
-- OU insira via SQL com as UUIDs fixas abaixo para os testes pgTAP funcionarem.
--
-- Referência: specs/001-login/tasks.md T012.

-- ─────────────────────────────────────────
-- Usuários de teste (apenas em dev — NUNCA em prod)
-- UUIDs fixas para reprodutibilidade dos testes pgTAP.
-- ─────────────────────────────────────────

-- Tutor de teste A
DO $$
DECLARE
  v_tutor_a_id uuid := '00000000-0000-0000-0000-000000000001';
  v_tutor_b_id uuid := '00000000-0000-0000-0000-000000000002';
  v_admin_id   uuid := '00000000-0000-0000-0000-000000000003';
BEGIN
  -- Insere em auth.users (somente se não existir — idempotente).
  -- Em GoTrue local, o `encrypted_password` abaixo usa bcrypt; ajuste conforme o helper local.
  -- Senha de teste para todos: "TesteSenha123!" (NUNCA usar em prod).
  INSERT INTO auth.users (
    id, email, email_confirmed_at, role,
    encrypted_password, created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data,
    aud, confirmation_token
  )
  VALUES
  (
    v_tutor_a_id,
    'tutor.a@faro.test',
    now(),   -- e-mail confirmado (seed = já confirmado para testes)
    'authenticated',
    -- bcrypt de "TesteSenha123!" gerado para dev local:
    crypt('TesteSenha123!', gen_salt('bf')),
    now(), now(),
    '{"name": "Tutor A Teste", "terms_version": "2026-11"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    ''
  ),
  (
    v_tutor_b_id,
    'tutor.b@faro.test',
    now(),
    'authenticated',
    crypt('TesteSenha123!', gen_salt('bf')),
    now(), now(),
    '{"name": "Tutor B Teste"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    ''
  ),
  (
    v_admin_id,
    'admin@faro.test',
    now(),
    'authenticated',
    crypt('TesteSenha123!', gen_salt('bf')),
    now(), now(),
    '{"name": "Admin Faro Teste"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- O trigger handle_new_user já cria os perfis com papel 'tutor'.
  -- Promover o admin manualmente (único caso legítimo de UPDATE de papel):
  UPDATE public.perfis
  SET papel = 'admin'
  WHERE id = v_admin_id;

  -- Garantir que tutor A e B tenham papel 'tutor' (redundante com default, mas explícito):
  UPDATE public.perfis
  SET papel = 'tutor'
  WHERE id IN (v_tutor_a_id, v_tutor_b_id);

END;
$$;

-- Spec 004 (extensao da T014, decisao do William): o GoTrue so enxerga usuarios com instance_id e com as
-- colunas de token em texto (nao NULL), e o login por senha precisa da linha em auth.identities. Mesmos ids,
-- e-mails e senha de teste.
UPDATE auth.users
   SET instance_id = '00000000-0000-0000-0000-000000000000',
       aud = 'authenticated',
       role = 'authenticated',
       raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
       confirmation_token = '',
       recovery_token = '',
       email_change_token_new = '',
       email_change = '',
       email_change_token_current = '',
       phone_change = '',
       phone_change_token = '',
       reauthentication_token = ''
 WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
  FROM auth.users u
 WHERE u.id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003')
   AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email');

-- Spec 004-conta-tutor (T014): o tutor A nasce pronto (aceite dos termos pelos metadados acima e celular
-- confirmado aqui); o tutor B continua incompleto (sem aceite e sem celular); o admin nao muda.
UPDATE public.perfis
   SET celular = '+5511900000001', celular_confirmado_em = now()
 WHERE id = '00000000-0000-0000-0000-000000000001';

-- Nota: Em produção, o admin inicial é criado via operação manual controlada
-- (ex.: script seguro ou painel do Supabase), nunca via seed commutado.
-- Retenção deste seed: apenas para ambiente dev/staging (CLAUDE.md §8.2).

-- >>> 003-tag-qr (gerado; não edite à mão)
-- Spec 003-tag-qr (T020). Gerado por supabase/scripts/make-seed.ts: nao edite a mao; rode o script.
-- Nao cria usuario nem mexe em perfis: a Ana e o tutor A (...0001), que a 001 e a 004 ja deixam pronto
-- (termos aceitos e celular confirmado). O tutor B (...0002) nao ganha pet nem tag.
-- Nenhum PIN esta escrito aqui: cada codigo recebe um PIN novo ao carregar o banco, guarda so o hash bcrypt de custo 12
-- e descarta o PIN. Para ativar um codigo available em teste, o admin reemite o PIN (admin_reissue_pin).
-- Os codigos sao de TESTE (vetores/derivados do modulo de codigo); nenhum e do lote-001. Seed nunca roda em producao.

INSERT INTO public.pets (id, tutor_id, name, species, breed, sex, size, neutered, temperament, care_notes)
VALUES
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-000000000001', 'Paçoca', 'dog', 'Vira-lata caramelo', 'male', 'medium', true,
   ARRAY['Dócil com pessoas', 'Medo de barulho'], 'Toma remédio para alergia de manhã. Não dar petisco sem perguntar.'),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-000000000001', 'Mel', 'cat', 'Sem raça definida', 'female', 'small', true,
   ARRAY['Arisca com estranhos'], NULL);

-- Paçoca mostra o primeiro nome da Ana e o WhatsApp (ela tem celular confirmado); o resto vem dos padroes.
UPDATE public.rescue_profiles
   SET show_tutor_first_name = true, show_whatsapp = true
 WHERE pet_id = '00000000-0000-0000-0000-0000000a0001';

INSERT INTO public.tag_batches (id, quantity, notes)
VALUES ('lote-900', 6, 'Lote de teste do seed (so desenvolvimento)');

DO $seed$
DECLARE
  r record;
  v_pin text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('7K3MQ9XAC', 'assigned', 0),
    ('5P8NMRXYW', 'available', 1),
    ('N473QHBHE', 'available', 2),
    ('7C6G5NHR8', 'available', 3),
    ('5QQWQ2MM4', 'blocked', 4),
    ('NKCBJV2HM', 'void', 5)
  ) AS t (code, status, qr_mask)
  LOOP
    v_pin := public.new_activation_pin();
    INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
    VALUES (r.code, 'lote-900', r.status,
            extensions.crypt(v_pin, extensions.gen_salt('bf', 12)), r.qr_mask);
  END LOOP;
END;
$seed$;

-- Paçoca com a tag ativa desde 02 nov, e tres scans: um com GPS, um aproximado por IP e um sem localizacao.
INSERT INTO public.tag_assignments (id, tag_code, pet_id, tutor_id, started_at)
VALUES ('00000000-0000-0000-0000-0000000b0001', '7K3MQ9XAC', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-000000000001', '2026-11-02 14:00:00-03');

INSERT INTO public.scan_events (tag_code, assignment_id, status_at_scan, occurred_at, last_seen_at, ip_hash, geo_method,
                                lat, lng, accuracy_m, city, region, notified_at)
VALUES
  ('7K3MQ9XAC', '00000000-0000-0000-0000-0000000b0001', 'assigned', now() - interval '2 days', now() - interval '2 days',
   'seed-ip-hash-1', 'gps', -23.5614, -46.6559, 12, NULL, NULL, now() - interval '2 days'),
  ('7K3MQ9XAC', '00000000-0000-0000-0000-0000000b0001', 'assigned', now() - interval '9 days', now() - interval '9 days',
   'seed-ip-hash-2', 'ip', -23.5505, -46.6333, 3000, 'São Paulo', 'SP', now() - interval '9 days'),
  ('7K3MQ9XAC', '00000000-0000-0000-0000-0000000b0001', 'assigned', now() - interval '20 days', now() - interval '20 days',
   'seed-ip-hash-3', 'none', NULL, NULL, NULL, NULL, NULL, now() - interval '20 days');
-- <<< 003-tag-qr
