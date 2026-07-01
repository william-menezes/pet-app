# Contract — Auditoria de Autenticação (`auth_audit_log` + `log_auth_event`)

**Camada:** `supabase/migrations/0004_tabelas_auth_seguranca.sql` (tabela) + `0005_funcoes_auth.sql` (RPC). Sustenta FR-020 (auditoria) com FR-021 (minimização LGPD) e Princípio VII.

## Tabela `auth_audit_log` (append-only)

Ver schema completo em `../data-model.md` §5. Resumo: `id`, `evento` (`login_sucesso|login_falha|login_bloqueado|logout`), `ator` (uuid nullable), `ip_hash`, `user_agent`, `detalhe jsonb` mínimo, `at`.

**Invariantes:**
- **Sem** e-mail cru, **sem** senha, **sem** token, **sem** PII de terceiros. E-mail só como hash (em `auth_login_attempts`); aqui só `ator` (uuid) quando há conta.
- Append-only: nenhum `UPDATE`/`DELETE` por papéis de aplicação.

## Eventos registrados (FR-020, SC-006)

| Evento | Quando | `ator` |
|---|---|---|
| `login_sucesso` | signIn (senha ou Google) bem-sucedido | uuid do usuário |
| `login_falha` | credencial inválida / conta inexistente / e-mail não confirmado | uuid se conhecido, senão `null` |
| `login_bloqueado` | decisão `block` do rate-limit (FR-018) | `null` (identidade só por hash em attempts) |
| `logout` | signOut explícito (FR-010) | uuid do usuário |

## `log_auth_event(...)` (RPC `SECURITY DEFINER`, service_role-only)

```sql
CREATE FUNCTION log_auth_event(
  p_evento evento_auth_enum,
  p_ator uuid,          -- nullable
  p_ip_hash text,
  p_user_agent text,
  p_detalhe jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO auth_audit_log(evento, ator, ip_hash, user_agent, detalhe)
  VALUES (p_evento, p_ator, p_ip_hash, left(p_user_agent, 256), p_detalhe);
$$;
```

- Chamada **somente** pela Edge `login-guard` / camada servidor com `service_role`. Parâmetros tipados (FR-016).

## Expectativas de RLS (pgTAP)

- `INSERT` direto por `anon`/`authenticated`/`admin` → **negado** (só `service_role`).
- `SELECT` por `anon`/`authenticated` (não-admin) → **negado**; por **admin** (`is_admin()`) → permitido.
- Nenhuma policy de `UPDATE`/`DELETE` (append-only).
- **Snapshot de minimização:** teste que falha se a tabela ganhar coluna com PII crua (e-mail/senha/token) — guardião contra vazamento acidental.
