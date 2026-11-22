-- pgTAP: conta_estado_inicial.test.sql
-- Spec 004-conta-tutor. Confere o estado que as migrations 0008 a 0013 e o seed deixam depois de
-- `supabase db reset` (verificacoes "Feito quando" de T007, T014 e T017 que nao dependem de HTTP).

BEGIN;

SELECT plan(15);

-- T007: 4 valores da 001 + 12 da 004.
SELECT is(
  (SELECT count(*)::integer FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'evento_auth_enum'),
  16, 'evento_auth_enum tem 16 valores (4 da 001 + 12 da 004)');
SELECT is(
  (SELECT array_agg(e.enumlabel::text ORDER BY e.enumlabel) FILTER (WHERE e.enumlabel::text = ANY (ARRAY[
     'conta_criada','email_confirmado','termos_aceitos','celular_codigo_enviado','celular_codigo_invalido',
     'celular_bloqueado','celular_confirmado','senha_recuperacao_solicitada','senha_alterada',
     'reautenticacao_falha','dados_exportados','conta_excluida']))
     FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'evento_auth_enum'),
  ARRAY['celular_bloqueado','celular_codigo_enviado','celular_codigo_invalido','celular_confirmado',
        'conta_criada','conta_excluida','dados_exportados','email_confirmado','reautenticacao_falha',
        'senha_alterada','senha_recuperacao_solicitada','termos_aceitos'],
  'os 12 valores novos existem');

-- T014: seed.
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE evento = 'conta_criada'
      AND ator IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003')),
  3, 'o seed gerou 3 eventos conta_criada (um por usuario do seed)');
SELECT ok(
  (SELECT termos_versao = '2026-11' AND termos_aceitos_em IS NOT NULL
          AND celular = '+5511900000001' AND celular_confirmado_em IS NOT NULL AND celular_pendente IS NULL
     FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000001'),
  'tutor A nasce pronto: aceite 2026-11 e celular confirmado');
SELECT ok(
  (SELECT termos_versao IS NULL AND termos_aceitos_em IS NULL AND celular IS NULL AND celular_pendente IS NULL
     FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000002'),
  'tutor B continua incompleto: sem aceite e sem celular');
SELECT ok(
  (SELECT papel = 'admin' AND termos_versao IS NULL AND celular IS NULL
     FROM public.perfis WHERE id = '00000000-0000-0000-0000-000000000003'),
  'admin do seed continua como estava (papel admin, sem aceite, sem celular)');
SELECT is(
  (SELECT count(*)::integer FROM public.auth_audit_log
    WHERE evento = 'termos_aceitos' AND ator = '00000000-0000-0000-0000-000000000001'),
  1, 'o aceite do tutor A foi auditado');

-- Colunas e gatilhos esperados.
SELECT has_column('public', 'perfis', 'celular', 'perfis.celular existe');
SELECT has_column('public', 'perfis', 'celular_pendente', 'perfis.celular_pendente existe');
SELECT has_trigger('public', 'perfis', 'perfis_set_updated_at', 'gatilho perfis_set_updated_at existe');
SELECT is(
  (SELECT count(*)::integer FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass
     AND tgname IN ('on_auth_user_created', 'on_auth_user_updated') AND NOT tgisinternal),
  2, 'os gatilhos on_auth_user_created e on_auth_user_updated existem em auth.users');

-- Toda funcao desta spec e SECURITY DEFINER com search_path fixo.
SELECT is(
  (SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('rate_limit_check', 'handle_new_user', 'accept_terms', 'log_logout', 'my_account',
                        'account_auth_facts', 'audit_auth_user_changes', 'perfis_set_updated_at')
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT ('search_path=public, pg_temp' = ANY (p.proconfig)))),
  0, 'as funcoes novas sao SECURITY DEFINER com search_path = public, pg_temp');

-- Nenhuma funcao desta spec executavel por anon.
SELECT is(
  (SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('rate_limit_check', 'handle_new_user', 'accept_terms', 'log_logout', 'my_account',
                        'account_auth_facts', 'audit_auth_user_changes', 'perfis_set_updated_at',
                        'log_auth_event', 'record_login_attempt', 'is_admin', 'current_user_role')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0, 'nenhuma funcao de conta ou de auth e executavel por anon');

-- Resgate primeiro: nenhuma migration desta spec mexe em objeto de tags. Desde a spec 003 as tabelas de tags
-- existem (migrations 0020 em diante), entao a prova passou a ser sobre o TEXTO das migrations da 001 e da 004
-- (0001 a 0017), lido do registro do Supabase CLI: nenhuma delas cria essas tabelas. A primeira conferencia
-- impede que a segunda passe vazia (se o registro nao guardar os comandos, o teste acusa).
SELECT ok(
  (SELECT count(*) >= 10 FROM supabase_migrations.schema_migrations m
    WHERE m.version >= '0008' AND m.version <= '0017' AND m.statements IS NOT NULL AND cardinality(m.statements) > 0),
  'o registro de migrations guarda os comandos das migrations 0008 a 0017');
SELECT is(
  (SELECT count(*)::integer FROM supabase_migrations.schema_migrations m
    WHERE m.version < '0020'
      AND array_to_string(m.statements, E'\n') ~* 'create\s+table\s+(if\s+not\s+exists\s+)?(public\.)?(tag_codes|tag_batches|tag_assignments|scan_events|pets)\M'),
  0, 'nenhuma migration da 001 ou da 004 (0001 a 0017) cria tabela de tags, pets ou scans');

SELECT * FROM finish();
ROLLBACK;
