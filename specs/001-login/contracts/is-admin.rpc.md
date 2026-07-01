# Contract — Papel e roteamento (is_admin / current_user_role)

**Camada:** `supabase/migrations/0005_funcoes_auth.sql`. Sustenta FR-005/FR-006 sem confiar em claim do cliente.

## `is_admin() → boolean`

Decisão travada no `docs/README.md` (papel admin = `is_admin()`, sem custom claim no MVP). Já especificada em `docs/backend-supabase.md` §3.4 — esta feature a **cria** (primeira a precisar dela).

```sql
CREATE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis WHERE id = auth.uid() AND papel = 'admin'
  );
$$;
```

- **Uso:** policies de admin (`*_admin_*`) em `perfis`, `auth_audit_log` (SELECT admin).
- **Segurança:** `SECURITY DEFINER` + `search_path` fixo (anti-injeção, FR-016). Lê a fonte de verdade (`perfis.papel`), não um claim manipulável.

## `current_user_role() → text`

Conveniência para o cliente **rotear** (não autorizar).

```sql
CREATE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel FROM perfis WHERE id = auth.uid();
$$;
```

- Chamada via `supabase.rpc('current_user_role')` após login. Alternativa equivalente: `SELECT papel FROM perfis WHERE id = auth.uid()` sob a RLS própria de `perfis` (ambos retornam só o do usuário logado).
- O resultado alimenta `roleRedirect()` no frontend: `'admin' → /admin`, caso contrário `→ /app` (FR-005/006).

## Expectativas de teste (pgTAP)

- `is_admin()` retorna `true` para um perfil admin autenticado, `false` para tutor, `false`/seguro para `anon`.
- `current_user_role()` retorna o papel **só** do `auth.uid()` corrente (tutor A não obtém o papel de B).
- Tutor **não** consegue `UPDATE perfis SET papel='admin'` no próprio registro (escalada de privilégio negada).
