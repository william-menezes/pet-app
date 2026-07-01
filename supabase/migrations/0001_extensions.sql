-- Migration: 0001_extensions.sql
-- Habilita as extensões necessárias para o backend do Faro.
-- pgcrypto: fornece gen_random_uuid(), gen_random_bytes() e digest() para hash de e-mail/IP (FR-021).
-- pg_cron: reservado para specs futuras (lembretes/limpeza de janela); não usado nesta feature.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Nota: pg_cron não é habilitado agora (YAGNI — spec 007/009 decidirão).
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
