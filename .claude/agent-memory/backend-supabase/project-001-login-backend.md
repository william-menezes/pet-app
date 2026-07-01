---
name: project-001-login-backend
description: Estado do backend implementado para a feature 001-login — migrações, RLS, Edge Function e testes pgTAP criados.
metadata:
  type: project
---

A feature **001-login** teve o backend completo implementado em 2026-06-29. Todos os arquivos vivem em `supabase/` (primeira feature a criar o diretório).

**Why:** Feature de login que exige RLS, funções de autorização, rate-limit anti-bruteforce (FR-018) e auditoria minimizada LGPD (FR-020/021).

**How to apply:** Ao trabalhar em features futuras que referenciem `perfis`, `is_admin()`, `current_user_role()`, ou `auth_audit_log` — essas entidades já existem e foram testadas por pgTAP. Não recriar; apenas referenciar.

## Migrations criadas (em ordem)

| Arquivo | O que cria |
|---|---|
| `0001_extensions.sql` | `pgcrypto` (hash de e-mail/IP) |
| `0002_enums_e_dominios.sql` | `papel_enum('tutor','admin')`, `evento_auth_enum(...)` |
| `0003_tabela_perfis.sql` | `public.perfis` (id FK→auth.users, nome, email, papel, timestamps) + RLS habilitada |
| `0004_tabelas_auth_seguranca.sql` | `public.auth_audit_log` (append-only) + `public.auth_login_attempts` (rate-limit) + RLS habilitada em ambas + índices |
| `0005_funcoes_auth.sql` | `is_admin()`, `current_user_role()`, `record_login_attempt()`, `log_auth_event()` — todas SECURITY DEFINER |
| `0006_rls_policies_auth.sql` | Policies: `perfis_self_select`, `perfis_self_update` (sem mudar papel), `perfis_admin_all`, `audit_admin_select` |
| `0007_trigger_handle_new_user.sql` | `handle_new_user()` + trigger `on_auth_user_created` em `auth.users` |

## Seed

`supabase/seed.sql`: UUIDs fixas para dev/testes pgTAP:
- `00000000-0000-0000-0000-000000000001` → tutor A (papel: tutor)
- `00000000-0000-0000-0000-000000000002` → tutor B (papel: tutor)
- `00000000-0000-0000-0000-000000000003` → admin (papel: admin)

Senha de dev: `TesteSenha123!` — apenas para ambiente local.

## Edge Function

`supabase/functions/login-guard/` — duas fases:
- `pre_attempt`: consulta rate-limit antes do signIn; registra `login_bloqueado` se block.
- `post_result`: grava resultado (sucesso/falha) e audita (`login_sucesso`/`login_falha`).

IP extraído do runtime (não do corpo — anti-spoofing). Hashes de e-mail/IP via `HASH_SALT` (env do servidor).

## Testes

- `supabase/tests/rls_perfis.test.sql` — pgTAP: isolamento A↔B, anon negado, anti-escalada, is_admin(), current_user_role(), admin vê todos.
- `supabase/tests/rls_auth_audit.test.sql` — pgTAP: snapshot de minimização (sem coluna PII crua), anon/tutor negado, admin SELECT, auth_login_attempts inacessível a todos.
- `supabase/tests/rate_limit.test.sql` — pgTAP: 5 falhas/identity → block, 5 falhas/ip → block, janela expirada → allow, p_sucesso=null não grava.
- `supabase/functions/login-guard/rate-limit.test.ts` — deno test: tabela completa 0..6 falhas, retryAfterSeconds.

## Decisões travadas

- `is_admin()` lê `perfis.papel` (Opção B, sem custom claim no JWT no MVP).
- `record_login_attempt(p_sucesso=null)` = consultar sem gravar (pré-checagem).
- Janela rate-limit: 15 min, limite: 5 falhas, backoff em 3, por identity_hash E ip_hash.

[[rls-matrix-feature-001]]
