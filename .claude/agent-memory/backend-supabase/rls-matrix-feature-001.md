---
name: rls-matrix-feature-001
description: Matriz RLS completa das tabelas criadas pela feature 001-login — referência rápida para features futuras.
metadata:
  type: project
---

Tabelas criadas pela feature 001-login e suas políticas de RLS (fonte: `contracts/rls-expectations.md`).

| Tabela | anon | tutor (próprio) | tutor (outro) | admin (is_admin()) | service_role |
|---|---|---|---|---|---|
| `perfis` SELECT | NEGADO | próprio (`id=auth.uid()`) | NEGADO | todos | full |
| `perfis` UPDATE (exceto papel) | NEGADO | próprio | NEGADO | todos | full |
| `perfis` UPDATE papel | NEGADO | NEGADO (anti-escalada) | NEGADO | permitido | full |
| `perfis` INSERT | NEGADO | NEGADO | NEGADO | NEGADO | full (trigger DEFINER) |
| `auth_audit_log` SELECT | NEGADO | NEGADO | NEGADO | permitido | full |
| `auth_audit_log` INSERT | NEGADO | NEGADO | NEGADO | NEGADO | full (via `log_auth_event`) |
| `auth_audit_log` UPDATE/DELETE | NEGADO | NEGADO | NEGADO | NEGADO | NEGADO (append-only) |
| `auth_login_attempts` (todas ops) | NEGADO | NEGADO | NEGADO | NEGADO | full (via `record_login_attempt`) |

## Helpers de banco disponíveis

- `public.is_admin() → boolean` — STABLE SECURITY DEFINER; lê `perfis.papel='admin'`. Usado em policies.
- `public.current_user_role() → text` — STABLE SECURITY DEFINER; retorna papel do auth.uid() para roteamento frontend.
- `public.record_login_attempt(identity_hash, ip_hash, sucesso) → text` — SECURITY DEFINER; service_role-only; retorna 'allow'|'backoff'|'block'.
- `public.log_auth_event(evento, ator, ip_hash, user_agent, detalhe) → void` — SECURITY DEFINER; service_role-only; append-only em auth_audit_log.
- `public.handle_new_user()` — trigger SECURITY DEFINER; cria linha em perfis no signup.

## Convenções

- RLS habilitada na MESMA migration que cria a tabela (Princípio III invariante).
- Policies de INSERT ausentes em auth_audit_log = service_role bypassa RLS (intencional, documentado).
- Policies em `auth_login_attempts`: nenhuma (deny-by-default total para todos os roles de aplicação).

[[project-001-login-backend]]
