-- Migration: 0002_enums_e_dominios.sql
-- Cria os tipos enum do domínio de autenticação (feature 001-login).
-- Fonte de verdade: specs/001-login/data-model.md §Enums.

-- Papel global do usuário no sistema (FR-005/006).
-- Co-tutoria NÃO é papel global — é associação por pet (pet_cotutor, spec futura).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'papel_enum') THEN
    CREATE TYPE public.papel_enum AS ENUM ('tutor', 'admin');
  END IF;
END;
$$;

-- Eventos auditáveis de autenticação (FR-020).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evento_auth_enum') THEN
    CREATE TYPE public.evento_auth_enum AS ENUM (
      'login_sucesso',
      'login_falha',
      'login_bloqueado',
      'logout'
    );
  END IF;
END;
$$;
