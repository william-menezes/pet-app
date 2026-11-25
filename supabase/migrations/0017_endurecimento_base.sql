-- Migration: 0017_endurecimento_base.sql
-- Spec 004-conta-tutor, T097 (contracts/security-hardening.contract.md, secao 6).
-- Endurecimento de base do banco. Nao cria tabela nem funcao; so ajusta privilegios, search_path e
-- configuracao de papeis. As migrations 0001 a 0016 nao foram editadas: tudo entra aqui, por ALTER/REVOKE.

-- 1. Privilegios padrao. Sao DOIS comandos: o EXECUTE de PUBLIC e um padrao global, e so sai com um comando
--    sem IN SCHEMA. A partir daqui, funcao nova em `public` so e chamavel por quem recebe GRANT explicito.
--    (O teste security_catalog.test.sql cria uma funcao sem GRANT e prova que `authenticated` nao a executa.)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
-- Tabelas e sequencias novas em `public` nascem sem acesso de `anon`.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
-- O schema `extensions` guarda funcoes de extensao (pgcrypto, pgTAP, ...) que o proprio Supabase espera ver
-- executaveis por qualquer papel. Para ele, o padrao antigo continua valendo.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

-- 2. search_path das funcoes security definer da 001: `public, pg_temp` (pg_temp por ultimo e implicito;
--    declarado para o portao de catalogo e para quem ler). ALTER FUNCTION preserva os GRANTs da 0009.
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_user_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.record_login_attempt(text, text, boolean) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_auth_event(public.evento_auth_enum, uuid, text, text, jsonb) SET search_path = public, pg_temp;

-- 2A. Tabelas que ja existem. `anon` e `authenticated` ainda tinham GRANT de leitura e escrita em `perfis`,
--     `auth_audit_log` e `auth_login_attempts`: so a RLS os barrava e uma leitura devolvia zero linhas em vez de erro.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
-- So funcoes security definer tocam auth_login_attempts.
REVOKE ALL ON public.auth_login_attempts FROM authenticated;
-- Em auth_audit_log o SELECT de `authenticated` fica: a politica da 0006 deixa o admin ler a auditoria.
-- Um tutor comum continua lendo zero linhas (a politica nao o inclui). Sai so a escrita.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.auth_audit_log FROM authenticated;
-- Em `perfis`, `authenticated` fica com o que a 0010 concede (SELECT e UPDATE (nome)).

-- 3. Tempo maximo de uma consulta, por papel de API.
ALTER ROLE anon SET statement_timeout = '3s';
ALTER ROLE authenticated SET statement_timeout = '8s';

-- 4. Nada no Faro usa GraphQL. (`[api] schemas` no config.toml tambem deixa de listar graphql_public.)
DROP EXTENSION IF EXISTS pg_graphql;
