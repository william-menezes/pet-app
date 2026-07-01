# Contract — Expectativas de RLS (feature 001-login)

**Princípio III (RLS-first, deny-by-default).** Toda tabela própria nasce com `ENABLE ROW LEVEL SECURITY` na **mesma migration** que a cria. A ausência de policy = negar. Cada ✅ é uma exceção controlada; cada ❌ é um **teste negativo obrigatório** (pgTAP) que, se virar ✅, **bloqueia o merge** (`docs/test-strategy.md` §3, §6.3).

## Matriz de acesso

| Tabela / Operação | `anon` | `authenticated` (próprio) | `authenticated` (outro) | `admin` (`is_admin()`) | Edge (`service_role`) |
|---|---|---|---|---|---|
| `perfis` SELECT | ❌ | ✅ `id = auth.uid()` | ❌ | ✅ todos | full |
| `perfis` UPDATE (exceto `papel`) | ❌ | ✅ próprio | ❌ | ✅ | full |
| `perfis` UPDATE `papel` | ❌ | ❌ (anti-escalada) | ❌ | ✅ | full |
| `perfis` INSERT | ❌ | ❌ (só trigger `handle_new_user`) | ❌ | ❌ | full (trigger DEFINER) |
| `auth_audit_log` SELECT | ❌ | ❌ | ❌ | ✅ | full |
| `auth_audit_log` INSERT | ❌ | ❌ | ❌ | ❌ | ✅ (via `log_auth_event`) |
| `auth_audit_log` UPDATE/DELETE | ❌ | ❌ | ❌ | ❌ | ❌ (append-only) |
| `auth_login_attempts` (todas) | ❌ | ❌ | ❌ | ❌ | ✅ (via `record_login_attempt`) |
| `auth.users` / `auth.identities` / `auth.sessions` | ❌ | (gerido pelo GoTrue) | ❌ | ❌ | (GoTrue) |

> **anon não aparece com ✅ em nenhuma linha.** Esta feature não expõe nada a anônimos — coerente com Rescue-First: o anônimo só tem acesso à projeção pública de resgate (outra feature), jamais a dados de auth.

## Policies-chave (esboço — canônico vai na migration `0006_rls_policies_auth.sql`)

```sql
-- perfis: o próprio usuário lê/edita seu perfil (sem trocar papel)
CREATE POLICY perfis_self_select ON perfis FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY perfis_self_update ON perfis FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND papel = (SELECT papel FROM perfis WHERE id = auth.uid()));
-- admin vê todos
CREATE POLICY perfis_admin_all ON perfis FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- auth_audit_log: SELECT só admin; INSERT só service_role (sem policy p/ authenticated/anon)
CREATE POLICY audit_admin_select ON auth_audit_log FOR SELECT TO authenticated
  USING (is_admin());
-- (service_role bypassa RLS; nenhuma policy para anon/authenticated INSERT = negado)

-- auth_login_attempts: nenhuma policy para anon/authenticated/admin = totalmente negado;
-- só service_role (bypass) acessa via record_login_attempt.
ALTER TABLE auth_login_attempts ENABLE ROW LEVEL SECURITY;  -- sem policies permissivas
```

## Testes obrigatórios (mapa para `docs/test-strategy.md` §7, feature 001)

- (S) **Isolamento A↔B**: tutor B não lê `perfis` de A; não obtém papel de A via `current_user_role()`.
- (S) **anon negado**: `SELECT` em `perfis`/`auth_audit_log`/`auth_login_attempts` → `42501`.
- (S) **Anti-escalada**: tutor não consegue `UPDATE perfis SET papel='admin'`.
- (S) **Auditoria protegida**: não-admin não lê `auth_audit_log`; só `service_role` insere.
- (S) **Admin via RLS, não via guard**: usuário sem papel admin, mesmo burlando o guard de UI, é negado nos dados de admin (`is_admin()`).
- (S) **Rescue-First (regressão)**: nenhuma alteração desta feature toca `perfil_resgate_publico` nem adiciona auth à rota `/{codigo}` (guardião arquitetural permanece verde; SC-008).
- (II) **Snapshot de minimização**: `auth_audit_log` não ganha coluna de PII crua sem revisão.
