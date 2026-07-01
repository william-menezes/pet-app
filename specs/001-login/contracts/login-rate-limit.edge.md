# Contract — Edge Function `login-guard` + `record_login_attempt` (FR-018)

**Camada:** `supabase/functions/login-guard/` (Deno, `service_role`) + `supabase/migrations/0005_funcoes_auth.sql` (RPC). Anti-força-bruta determinístico e auditável (SC-005). Segredos só no servidor.

## Parâmetros (clarify 2026-06-29)

- Janela: **15 minutos**. Limite: **5 falhas**. Eixos: **por identidade (hash do e-mail) E por origem (hash do IP)**. **Backoff progressivo**; **block** ao atingir 5 em qualquer eixo na janela.

## Edge Function `login-guard`

`POST /functions/v1/login-guard`

**Request (do frontend, antes do signIn):**
```json
{ "email": "user@example.com", "phase": "pre_attempt" }
```
**Response:**
```json
{ "decision": "allow" | "backoff" | "block", "retry_after_seconds": 0 }
```

Comportamento:
1. Deriva `identity_hash = hash(lower(email))` e `ip_hash = hash(<ip de origem confiável>)` — o IP vem do header confiável do runtime (não do corpo; anti-spoofing).
2. Chama `record_login_attempt(identity_hash, ip_hash, p_sucesso => null)` em modo **consulta** OU consulta a contagem na janela; retorna `decision`.
3. `block`/`backoff` → o frontend **não** tenta o signIn e mostra mensagem genérica (`rate_limited`). Registra `login_bloqueado` em `auth_audit_log`.
4. Após a tentativa real de senha, o resultado (sucesso/falha) é gravado via `record_login_attempt(..., p_sucesso => true|false)` e auditado (`login_sucesso`/`login_falha`).

> **Por que Edge e não chamada direta do cliente:** o IP confiável e o `service_role` vivem no servidor; permitir contagem pelo cliente abriria spoofing de IP. A lógica de decisão é **pura e testável** em `rate-limit.ts` (deno test).

## `record_login_attempt(...)` (RPC, `SECURITY DEFINER`, service_role-only)

```sql
CREATE FUNCTION record_login_attempt(
  p_identity_hash text,
  p_ip_hash text,
  p_sucesso boolean
) RETURNS text                  -- 'allow' | 'backoff' | 'block'
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fail_identity int;
  v_fail_ip int;
BEGIN
  IF p_sucesso IS NOT NULL THEN
    INSERT INTO auth_login_attempts(identity_hash, ip_hash, sucesso)
      VALUES (p_identity_hash, p_ip_hash, p_sucesso);
  END IF;
  SELECT count(*) INTO v_fail_identity FROM auth_login_attempts
    WHERE identity_hash = p_identity_hash AND sucesso = false
      AND at > now() - interval '15 minutes';
  SELECT count(*) INTO v_fail_ip FROM auth_login_attempts
    WHERE ip_hash = p_ip_hash AND sucesso = false
      AND at > now() - interval '15 minutes';
  IF greatest(v_fail_identity, v_fail_ip) >= 5 THEN RETURN 'block'; END IF;
  IF greatest(v_fail_identity, v_fail_ip) >= 3 THEN RETURN 'backoff'; END IF;
  RETURN 'allow';
END;
$$;
```

- Parâmetros tipados, sem SQL dinâmico (FR-016). `service_role`-only (RLS de `auth_login_attempts` nega todos os outros).
- Hashes (não valores crus) → minimização LGPD (FR-021).

## `log_auth_event(...)` (RPC ou insert pela Edge)

Grava `auth_audit_log` (ver `auth-audit.contract.md`).

## Lógica pura testável — `functions/login-guard/rate-limit.ts`

```ts
export function decide(failIdentity: number, failIp: number): 'allow'|'backoff'|'block' {
  const n = Math.max(failIdentity, failIp);
  if (n >= 5) return 'block';
  if (n >= 3) return 'backoff';
  return 'allow';
}
```

## Expectativas de teste

- **deno test** (`rate-limit.ts`): tabela de casos cobre 0..6 falhas em cada eixo → decisão correta.
- **pgTAP/integração**: 5 falhas em 15 min (por identidade) → `block`; falhas distribuídas no IP com identidades diferentes → também bloqueia por IP; após a janela expirar → `allow` de novo (SC-005).
- **Anti-spoofing**: IP vem do runtime, não do corpo (não testável só por unidade — revisão + teste de integração da Edge).
