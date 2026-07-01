-- Migration: 0003_tabela_perfis.sql
-- Cria a tabela public.perfis (espelho 1:1 de auth.users + papel).
-- INVARIANTE: RLS habilitada + deny-by-default NA MESMA MIGRATION que cria a tabela (Princípio III).
-- Fonte de verdade: specs/001-login/data-model.md §1b + contracts/rls-expectations.md.

CREATE TABLE IF NOT EXISTS public.perfis (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text        NOT NULL DEFAULT '',
  email       text        NOT NULL DEFAULT '',
  papel       public.papel_enum NOT NULL DEFAULT 'tutor',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.perfis IS
  'Espelho 1:1 de auth.users com papel (tutor|admin). '
  'Preenchida automaticamente pelo trigger handle_new_user no signup. '
  'Fonte de autorização de papel — usado por is_admin() e current_user_role().';

COMMENT ON COLUMN public.perfis.id IS
  '= auth.users.id. FK com CASCADE DELETE: excluir conta remove o perfil.';
COMMENT ON COLUMN public.perfis.papel IS
  'Papel global. "tutor" é o default. Promover a "admin" é operação manual/controlada. '
  'RLS impede que o próprio usuário altere seu papel (anti-escalada de privilégio).';
COMMENT ON COLUMN public.perfis.email IS
  'Espelho de auth.users.email por conveniência. Auth é a fonte de verdade de identidade.';

-- RLS DENY-BY-DEFAULT (Princípio III — nenhuma policy permissiva = negar).
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Sem policies aqui: as policies vivem em 0006_rls_policies_auth.sql para separar
-- criação de schema de definição de acesso (facilita review de segurança).
-- O efeito imediato é deny-by-default: nenhum role acessa nada até as policies serem criadas.
