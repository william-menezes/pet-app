-- Migration: 0008_enum_eventos_conta.sql
-- Spec 004-conta-tutor (data-model.md §4). SOMENTE novos valores de evento_auth_enum:
-- um valor de enum recem-criado nao pode ser usado na mesma transacao que o cria, por isso
-- nenhum outro comando entra neste arquivo.
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'conta_criada';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'email_confirmado';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'termos_aceitos';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'celular_codigo_enviado';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'celular_codigo_invalido';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'celular_bloqueado';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'celular_confirmado';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'senha_recuperacao_solicitada';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'senha_alterada';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'reautenticacao_falha';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'dados_exportados';
ALTER TYPE public.evento_auth_enum ADD VALUE IF NOT EXISTS 'conta_excluida';
