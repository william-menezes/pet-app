-- Migration: 0006_rls_policies_auth.sql
-- Define as políticas de RLS para as tabelas criadas nesta feature.
-- As tabelas já nasceram com ENABLE ROW LEVEL SECURITY nas migrations anteriores.
-- Aqui apenas adicionamos as políticas permissivas controladas.
--
-- PRINCÍPIO: deny-by-default. Cada policy aqui é uma EXCEÇÃO CONTROLADA.
--            Cada ausência de policy = negar. Isso é confirmado por pgTAP (T019/T020).
--
-- Fonte de verdade: specs/001-login/contracts/rls-expectations.md.

-- ─────────────────────────────────────────
-- Tabela: public.perfis
-- ─────────────────────────────────────────
-- Matriz (rls-expectations.md):
--   anon                        → nenhum acesso (sem policy)
--   authenticated (próprio)     → SELECT ✅ | UPDATE (exceto papel) ✅ | INSERT ❌ | DELETE ❌
--   authenticated (outro)       → nenhum acesso
--   admin (is_admin())          → SELECT ALL ✅ | ALL ✅
--   service_role                → bypassa RLS (full)
--
-- INSERT: somente via trigger handle_new_user (SECURITY DEFINER) com service_role — sem policy de INSERT.

-- Próprio usuário lê seu perfil.
CREATE POLICY perfis_self_select
  ON public.perfis
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Próprio usuário atualiza seu perfil, MAS não pode mudar o papel (anti-escalada FR-006).
-- WITH CHECK garante que mesmo uma UPDATE que inclua papel preserva o valor atual.
CREATE POLICY perfis_self_update
  ON public.perfis
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- papel deve permanecer igual ao valor atual (impede escalada de privilégio).
    AND papel = (SELECT p.papel FROM public.perfis p WHERE p.id = auth.uid())
  );

-- Admin enxerga e gerencia todos os perfis (backoffice — promoção de papel, suporte).
CREATE POLICY perfis_admin_all
  ON public.perfis
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────
-- Tabela: public.auth_audit_log
-- ─────────────────────────────────────────
-- Matriz (rls-expectations.md):
--   anon                        → nenhum acesso (sem policy)
--   authenticated (não-admin)   → nenhum acesso (sem policy)
--   admin (is_admin())          → SELECT ✅
--   service_role                → INSERT ✅ (via log_auth_event) — bypassa RLS
--   UPDATE/DELETE               → nenhuma policy = negado para TODOS (append-only)
--
-- service_role bypassa RLS, então não precisa de policy para INSERT.
-- Nenhuma policy de UPDATE/DELETE = append-only garantido por omissão.

-- Admin visualiza o log de auditoria (backoffice).
CREATE POLICY audit_admin_select
  ON public.auth_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ─────────────────────────────────────────
-- Tabela: public.auth_login_attempts
-- ─────────────────────────────────────────
-- Matriz (rls-expectations.md):
--   TODOS os roles (anon/authenticated/admin) → nenhum acesso (sem policy)
--   service_role                              → bypassa RLS (via record_login_attempt)
--
-- Propositalmente sem nenhuma policy permissiva.
-- Qualquer tentativa de acesso direto por roles de aplicação é negada pela RLS.
-- (A tabela já tem ENABLE ROW LEVEL SECURITY de 0004; a ausência de policy é a defesa.)
--
-- Documentação explícita da intenção (para revisores de segurança):
COMMENT ON TABLE public.auth_login_attempts IS
  'Acessível SOMENTE por service_role (Edge login-guard via record_login_attempt). '
  'Nenhuma policy permissiva para anon/authenticated/admin — deny-by-default total. '
  'Minimização LGPD: identity_hash=hash(email), ip_hash=hash(IP).';
