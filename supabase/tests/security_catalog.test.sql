-- pgTAP: security_catalog.test.sql
-- Spec 004-conta-tutor, T097. Portao de catalogo (contracts/security-hardening.contract.md, secao 6) e
-- prova da migration 0017. Este arquivo roda em TODA spec daqui em diante: se uma migration nova deixar uma
-- tabela sem RLS, der privilegio a `anon`, deixar `anon` executar funcao, criar security definer sem search_path
-- fixo ou criar politica USING (true) / WITH CHECK (true) para anon ou authenticated, ele falha.
--
-- As cinco condicoes do portao sao consultas definidas UMA vez (views em `tests`, so desta transacao). A mesma
-- consulta e usada para provar que o estado atual esta limpo (is_empty) e que ela acusa cada objeto ruim
-- (isnt_empty, dentro de um SAVEPOINT que desfaz o objeto). Nada sobrevive ao ROLLBACK final.
--
-- Sem `SELECT * FROM finish()`: o ROLLBACK TO de cada caso desfaz tambem a tabela de resultados do pgTAP e o
-- finish() lancaria "No tests run!". O pg_prove confere a linha do plano e cada "ok"/"not ok" da saida.

BEGIN;

SELECT plan(38);

CREATE SCHEMA IF NOT EXISTS tests;

-- Diagnostico para o log do CI (papel dono das migrations e schema do pgTAP).
SELECT diag('security_catalog: current_user=' || current_user
  || '; schema do pgTAP=' || coalesce((SELECT n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                       WHERE p.proname = 'throws_ok' LIMIT 1), '?'));

-- ─────────────────────────────────────────
-- As cinco condicoes do portao (objetos de extensao ficam de fora: nao sao do Faro)
-- ─────────────────────────────────────────

-- 1. Tabela de public sem RLS.
CREATE VIEW tests.gate_tabela_sem_rls AS
SELECT c.relname::text AS objeto
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
   AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e');

-- 2. `anon` com qualquer privilegio (de tabela ou de coluna; vale o herdado de PUBLIC) em tabela, visao ou similar.
CREATE VIEW tests.gate_anon_privilegio_tabela AS
SELECT c.relname::text AS objeto
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
   AND (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
   AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e');

-- 3. `anon` executa funcao de public fora da lista permitida (hoje: vazia). A lista e de assinaturas
--    (regprocedure::text), por exemplo 'public.resolve_tag(text)'.
CREATE VIEW tests.gate_anon_executa_funcao AS
SELECT p.oid::regprocedure::text AS objeto
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND has_function_privilege('anon', p.oid, 'EXECUTE')
   AND p.oid::regprocedure::text <> ALL (ARRAY[]::text[])
   AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e');

-- 4. Funcao security definer de public sem search_path fixo.
CREATE VIEW tests.gate_secdef_sem_search_path AS
SELECT p.oid::regprocedure::text AS objeto
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prosecdef
   AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%')
   AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e');

-- 5. Politica USING (true) ou WITH CHECK (true) para anon, authenticated ou PUBLIC (que os inclui).
CREATE VIEW tests.gate_politica_true AS
SELECT (schemaname || '.' || tablename || '.' || policyname)::text AS objeto
  FROM pg_policies
 WHERE schemaname = 'public'
   AND roles && ARRAY['anon', 'authenticated', 'public']::name[]
   AND (lower(regexp_replace(coalesce(qual, ''), '[()\s]', '', 'g')) = 'true'
        OR lower(regexp_replace(coalesce(with_check, ''), '[()\s]', '', 'g')) = 'true');

-- ─────────────────────────────────────────
-- A. O estado atual passa nas cinco condicoes
-- ─────────────────────────────────────────

SELECT is_empty($$ SELECT * FROM tests.gate_tabela_sem_rls $$, 'portao 1: toda tabela de public tem RLS');
SELECT is_empty($$ SELECT * FROM tests.gate_anon_privilegio_tabela $$, 'portao 2: anon sem privilegio em nenhuma tabela de public');
SELECT is_empty($$ SELECT * FROM tests.gate_anon_executa_funcao $$, 'portao 3: anon nao executa nenhuma funcao de public');
SELECT is_empty($$ SELECT * FROM tests.gate_secdef_sem_search_path $$, 'portao 4: toda security definer de public tem search_path fixo');
SELECT is_empty($$ SELECT * FROM tests.gate_politica_true $$, 'portao 5: nenhuma politica USING/WITH CHECK (true) para anon ou authenticated');

-- ─────────────────────────────────────────
-- B. Cada condicao reprova o objeto ruim (o objeto e criado num SAVEPOINT e desfeito)
-- ─────────────────────────────────────────

-- B1. Tabela sem RLS.
SAVEPOINT caso;
CREATE TABLE public.zz_gate_sem_rls (id integer);
SELECT isnt_empty($$ SELECT * FROM tests.gate_tabela_sem_rls WHERE objeto = 'zz_gate_sem_rls' $$,
  'negativo 1: tabela sem RLS e acusada');
ROLLBACK TO caso;
RELEASE caso;

-- B2. anon com privilegio de tabela e de coluna (a tabela tem RLS, para isolar a condicao).
SAVEPOINT caso;
CREATE TABLE public.zz_gate_anon (id integer);
ALTER TABLE public.zz_gate_anon ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.zz_gate_anon TO anon;
SELECT isnt_empty($$ SELECT * FROM tests.gate_anon_privilegio_tabela WHERE objeto = 'zz_gate_anon' $$,
  'negativo 2a: privilegio de tabela para anon e acusado');
ROLLBACK TO caso;
RELEASE caso;

SAVEPOINT caso;
CREATE TABLE public.zz_gate_anon (id integer);
ALTER TABLE public.zz_gate_anon ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id) ON public.zz_gate_anon TO anon;
SELECT isnt_empty($$ SELECT * FROM tests.gate_anon_privilegio_tabela WHERE objeto = 'zz_gate_anon' $$,
  'negativo 2b: privilegio de coluna para anon e acusado');
ROLLBACK TO caso;
RELEASE caso;

-- B3. anon executa funcao: por GRANT direto e herdado de PUBLIC.
SAVEPOINT caso;
CREATE FUNCTION public.zz_gate_fn() RETURNS integer LANGUAGE sql AS $f$ SELECT 1 $f$;
GRANT EXECUTE ON FUNCTION public.zz_gate_fn() TO anon;
SELECT isnt_empty($$ SELECT * FROM tests.gate_anon_executa_funcao WHERE objeto LIKE '%zz_gate_fn%' $$,
  'negativo 3a: GRANT EXECUTE a anon e acusado');
ROLLBACK TO caso;
RELEASE caso;

SAVEPOINT caso;
CREATE FUNCTION public.zz_gate_fn() RETURNS integer LANGUAGE sql AS $f$ SELECT 1 $f$;
GRANT EXECUTE ON FUNCTION public.zz_gate_fn() TO PUBLIC;
SELECT isnt_empty($$ SELECT * FROM tests.gate_anon_executa_funcao WHERE objeto LIKE '%zz_gate_fn%' $$,
  'negativo 3b: EXECUTE herdado de PUBLIC e acusado');
ROLLBACK TO caso;
RELEASE caso;

-- B4. security definer sem search_path (e o controle: com search_path nao e acusada).
SAVEPOINT caso;
CREATE FUNCTION public.zz_gate_def() RETURNS integer LANGUAGE sql SECURITY DEFINER AS $f$ SELECT 1 $f$;
SELECT isnt_empty($$ SELECT * FROM tests.gate_secdef_sem_search_path WHERE objeto LIKE '%zz_gate_def%' $$,
  'negativo 4a: security definer sem search_path e acusada');
ROLLBACK TO caso;
RELEASE caso;

SAVEPOINT caso;
CREATE FUNCTION public.zz_gate_def() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $f$ SELECT 1 $f$;
SELECT is_empty($$ SELECT * FROM tests.gate_secdef_sem_search_path WHERE objeto LIKE '%zz_gate_def%' $$,
  'controle 4b: security definer COM search_path fixo nao e acusada');
ROLLBACK TO caso;
RELEASE caso;

SAVEPOINT caso;
CREATE FUNCTION public.zz_gate_inv() RETURNS integer LANGUAGE sql SECURITY INVOKER AS $f$ SELECT 1 $f$;
SELECT is_empty($$ SELECT * FROM tests.gate_secdef_sem_search_path WHERE objeto LIKE '%zz_gate_inv%' $$,
  'controle 4c: funcao security invoker sem search_path nao e acusada');
ROLLBACK TO caso;
RELEASE caso;

-- B5. Politica true: USING (true) para authenticated, WITH CHECK (true) para PUBLIC (padrao), e o controle.
SAVEPOINT caso;
CREATE TABLE public.zz_gate_pol (id integer);
ALTER TABLE public.zz_gate_pol ENABLE ROW LEVEL SECURITY;
CREATE POLICY zz_gate_using ON public.zz_gate_pol FOR SELECT TO authenticated USING (true);
SELECT isnt_empty($$ SELECT * FROM tests.gate_politica_true WHERE objeto LIKE '%zz_gate_pol%' $$,
  'negativo 5a: USING (true) para authenticated e acusado');
ROLLBACK TO caso;
RELEASE caso;

SAVEPOINT caso;
CREATE TABLE public.zz_gate_pol (id integer);
ALTER TABLE public.zz_gate_pol ENABLE ROW LEVEL SECURITY;
CREATE POLICY zz_gate_check ON public.zz_gate_pol FOR INSERT WITH CHECK (true);
SELECT isnt_empty($$ SELECT * FROM tests.gate_politica_true WHERE objeto LIKE '%zz_gate_pol%' $$,
  'negativo 5b: WITH CHECK (true) para PUBLIC (anon e authenticated incluidos) e acusado');
ROLLBACK TO caso;
RELEASE caso;

SAVEPOINT caso;
CREATE TABLE public.zz_gate_pol (id uuid);
ALTER TABLE public.zz_gate_pol ENABLE ROW LEVEL SECURITY;
CREATE POLICY zz_gate_ok ON public.zz_gate_pol FOR SELECT TO authenticated USING (id = auth.uid());
SELECT is_empty($$ SELECT * FROM tests.gate_politica_true WHERE objeto LIKE '%zz_gate_pol%' $$,
  'controle 5c: politica por dono (id = auth.uid()) nao e acusada');
ROLLBACK TO caso;
RELEASE caso;

-- ─────────────────────────────────────────
-- C. Privilegios padrao: o que nasce sem GRANT nao e acessivel
-- ─────────────────────────────────────────

SAVEPOINT caso;
CREATE FUNCTION public.zz_probe_sem_grant() RETURNS integer LANGUAGE sql AS $f$ SELECT 1 $f$;
SELECT is(has_function_privilege('authenticated', 'public.zz_probe_sem_grant()', 'EXECUTE'), false,
  'funcao criada sem GRANT: authenticated nao tem EXECUTE (catalogo)');
SELECT is(has_function_privilege('anon', 'public.zz_probe_sem_grant()', 'EXECUTE'), false,
  'funcao criada sem GRANT: anon nao tem EXECUTE (catalogo)');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.zz_probe_sem_grant() $$, '42501', NULL,
  'funcao criada sem GRANT: authenticated chamando recebe 42501');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.zz_probe_sem_grant() $$, '42501', NULL,
  'funcao criada sem GRANT: anon chamando recebe 42501');
RESET ROLE;
ROLLBACK TO caso;
RELEASE caso;

SAVEPOINT caso;
CREATE TABLE public.zz_probe_tab (id integer);
SELECT is(has_table_privilege('anon', 'public.zz_probe_tab', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), false,
  'tabela criada sem GRANT: anon nao tem nenhum privilegio');
ROLLBACK TO caso;
RELEASE caso;

-- ─────────────────────────────────────────
-- D. O que a 0017 muda nas tabelas e funcoes que ja existiam
-- ─────────────────────────────────────────

SELECT is((SELECT count(*)::integer FROM tests.gate_anon_privilegio_tabela
            WHERE objeto IN ('perfis', 'auth_audit_log', 'auth_login_attempts')), 0,
  'anon sem privilegio em perfis, auth_audit_log e auth_login_attempts');
SELECT is((SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'S'
              AND CASE WHEN c.relkind = 'S' THEN has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE') ELSE false END), 0,
  'anon sem privilegio em nenhuma sequencia de public');

SELECT is(has_table_privilege('authenticated', 'public.auth_login_attempts', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege('authenticated', 'public.auth_login_attempts', 'SELECT,INSERT,UPDATE,REFERENCES'), false,
  'authenticated sem privilegio nenhum em auth_login_attempts');
SELECT is(has_table_privilege('authenticated', 'public.auth_audit_log', 'SELECT'), true,
  'authenticated mantem SELECT em auth_audit_log (a politica da 0006 deixa o admin ler)');
SELECT is(has_table_privilege('authenticated', 'public.auth_audit_log', 'INSERT,UPDATE,DELETE,TRUNCATE'), false,
  'authenticated sem escrita em auth_audit_log');

SELECT is(has_table_privilege('authenticated', 'public.perfis', 'SELECT'), true,
  'authenticated mantem SELECT em perfis (0010)');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'nome', 'UPDATE'), true,
  'authenticated mantem UPDATE (nome) em perfis (0010)');
SELECT is(has_table_privilege('authenticated', 'public.perfis', 'UPDATE'), false,
  'authenticated segue sem UPDATE de tabela inteira em perfis');
SELECT is(has_column_privilege('authenticated', 'public.perfis', 'papel', 'UPDATE'), false,
  'authenticated segue sem UPDATE (papel) em perfis');
SELECT is(has_table_privilege('service_role', 'public.perfis', 'SELECT')
          AND has_table_privilege('service_role', 'public.auth_audit_log', 'SELECT,INSERT')
          AND has_table_privilege('service_role', 'public.auth_login_attempts', 'SELECT,INSERT'), true,
  'service_role mantem o acesso as tabelas da 001');

SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.is_admin()'::regprocedure),
  ARRAY['search_path=public, pg_temp'], 'is_admin: search_path = public, pg_temp');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.current_user_role()'::regprocedure),
  ARRAY['search_path=public, pg_temp'], 'current_user_role: search_path = public, pg_temp');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.record_login_attempt(text,text,boolean)'::regprocedure),
  ARRAY['search_path=public, pg_temp'], 'record_login_attempt: search_path = public, pg_temp');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.log_auth_event(public.evento_auth_enum,uuid,text,text,jsonb)'::regprocedure),
  ARRAY['search_path=public, pg_temp'], 'log_auth_event: search_path = public, pg_temp');

-- statement_timeout por papel: lido do catalogo (um SHOW depois de SET ROLE nao reflete o ajuste do papel).
SELECT ok(EXISTS (SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
                   WHERE r.rolname = 'anon' AND 'statement_timeout=3s' = ANY (s.setconfig)),
  'anon: statement_timeout = 3s');
SELECT ok(EXISTS (SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
                   WHERE r.rolname = 'authenticated' AND 'statement_timeout=8s' = ANY (s.setconfig)),
  'authenticated: statement_timeout = 8s');

SELECT hasnt_extension('pg_graphql', 'pg_graphql foi removida');

ROLLBACK;
