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
    '{"name": "Tutor A Teste"}'::jsonb,
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

-- Nota: Em produção, o admin inicial é criado via operação manual controlada
-- (ex.: script seguro ou painel do Supabase), nunca via seed commutado.
-- Retenção deste seed: apenas para ambiente dev/staging (CLAUDE.md §8.2).
