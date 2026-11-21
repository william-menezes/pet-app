# Contrato: funções SQL da confirmação de celular (migration 0015)

Todas `SECURITY DEFINER`, `SET search_path = public, pg_temp`, sem SQL dinâmico. Tabelas em
`data-model.md` §1 e §2. As funções marcadas "só `service_role`" são chamadas apenas pelas Edge
Functions `phone-verify-start` e `phone-verify-confirm`.

Erros são lançados com `RAISE EXCEPTION '<código>'` (o código vai em `MESSAGE`), como na `003`.

---

## `phone_is_confirmed(p_user_id uuid) returns boolean` — interface para a `003`

- `STABLE`. `EXECUTE`: `authenticated` e `service_role`. Negado a `anon`.
- Corpo: ver `data-model.md` §5.
- Regra: um tutor autenticado só recebe `true` para a **própria** conta (para outra conta recebe
  `false`, mesmo que ela tenha celular confirmado). Admin, `service_role` e código sem papel de
  requisição (gatilhos, `pg_cron`) recebem o valor real.
- É a **única** pergunta que outras features fazem sobre o celular.

## `phone_verification_status() returns jsonb`

- `STABLE`. `EXECUTE`: `authenticated`. Usa `auth.uid()`; sem sessão lança `not_authenticated`.

```json
{
  "phone_confirmed": true,
  "phone": "+5511987654421",
  "pending_phone": null,
  "active": { "expires_at": "2026-11-21T12:10:00Z", "attempts_left": 5 },
  "resend_available_at": "2026-11-21T12:01:00Z"
}
```

- `phone`: `perfis.celular`. `pending_phone`: `perfis.celular_pendente`.
- `active`: a verificação ativa (definição em `data-model.md` §2) ou `null`.
- `resend_available_at`: instante do último evento `sms:cooldown` da conta + 60 s, se ainda no
  futuro; senão `null`.
- Nunca devolve hash, id de verificação ou dado de outra conta.

## `phone_verification_begin(p_user_id uuid, p_phone_e164 text, p_phone_hash text, p_code_hash text, p_ttl_seconds integer DEFAULT 600, p_max_attempts integer DEFAULT 5) returns jsonb`

- Só `service_role`.
- Pré-condições (lança o código se falhar):

| Código | Condição |
|---|---|
| `profile_not_found` | não há linha em `perfis` |
| `terms_required` | `termos_aceitos_em IS NULL` |
| `invalid_phone` | `p_phone_e164` não casa com `^\+55[1-9][0-9]9[0-9]{8}$` |
| `same_number` | `p_phone_e164 = perfis.celular` |

- Efeitos, numa transação:
  1. `UPDATE perfis SET celular_pendente = p_phone_e164`.
  2. `UPDATE phone_verifications SET invalidated_at = now()` nas linhas da conta com
     `consumed_at IS NULL AND invalidated_at IS NULL`.
  3. `DELETE` das linhas da conta com `created_at < now() - interval '24 hours'`.
  4. `INSERT` da nova linha com `expires_at = now() + p_ttl_seconds`.
- Saída: `{ "verification_id": "<uuid>", "expires_at": "<timestamptz>" }`.
- **Não** confere limites (isso é feito antes, por `rate_limit_check`) e **não** audita (o envio
  ainda não aconteceu).

## `phone_verification_send_failed(p_verification_id uuid) returns void`

- Só `service_role`. Marca `invalidated_at = now()` se a linha ainda estiver aberta. Idempotente.
- `perfis.celular_pendente` é mantido (a pessoa pode tentar de novo sem redigitar).

## `phone_verification_active(p_user_id uuid) returns jsonb`

- Só `service_role`. Devolve a linha **aberta** mais recente da conta (`consumed_at IS NULL AND
  invalidated_at IS NULL`, mesmo vencida), ou `null`:

```json
{ "verification_id": "<uuid>", "phone_e164": "+5511987654421" }
```

- `phone_e164` vem de `perfis.celular_pendente`. Se `celular_pendente` for nulo, devolve `null`.

## `phone_verification_confirm(p_user_id uuid, p_verification_id uuid, p_code_hash text, p_ip_hash text, p_user_agent text) returns jsonb`

- Só `service_role`. **Confere o código e conta a tentativa na mesma chamada**, com
  `SELECT … FOR UPDATE` na linha.

Ordem (a primeira condição verdadeira encerra):

| # | Condição | Efeito | Saída |
|---|---|---|---|
| 1 | linha não existe, não é da conta, já usada ou invalidada | — | `{"status":"no_active"}` |
| 2 | `expires_at <= now()` | `invalidated_at = now()` | `{"status":"expired"}` |
| 3 | `attempts >= max_attempts` | `invalidated_at = now()` | `{"status":"locked","attempts_left":0}` |
| 4 | `code_hash = p_code_hash` | `consumed_at = now()`; em `perfis`: `celular = celular_pendente`, `celular_confirmado_em = now()`, `celular_pendente = NULL`; audita `celular_confirmado` com `{"troca": <havia celular antes>}` | `{"status":"confirmed"}` |
| 5 | código errado e `attempts + 1 >= max_attempts` | `attempts += 1`, `invalidated_at = now()`; audita `celular_bloqueado` `{"motivo":"tentativas"}` | `{"status":"locked","attempts_left":0}` |
| 6 | código errado | `attempts += 1`; audita `celular_codigo_invalido` `{"restantes": n}` | `{"status":"invalid","attempts_left": n}` |

- Na linha 4, se `perfis.celular_pendente` for nulo, lança `no_pending_phone` e nada muda.
- Auditoria por `log_auth_event(evento, p_user_id, p_ip_hash, p_user_agent, detalhe)`, dentro da
  mesma transação.
- Nunca devolve nem registra o número ou qualquer hash.

## Testes obrigatórios (pgTAP, `supabase/tests/phone_verifications.test.sql`)

Privilégios:
- `anon` e `authenticated` não executam `phone_verification_begin`, `_send_failed`, `_active`,
  `_confirm` (`42501`) e não leem nem escrevem `phone_verifications`.
- `anon` não executa `phone_is_confirmed` nem `phone_verification_status`.

Comportamento:
- `begin` com termos não aceitos ⇒ `terms_required`; número inválido ⇒ `invalid_phone`; número
  igual ao confirmado ⇒ `same_number`.
- `begin` duas vezes ⇒ a primeira linha fica `invalidated_at` preenchido; só existe uma aberta.
- `confirm` com hash certo ⇒ `confirmed`; `perfis.celular` = número, `celular_pendente` nulo,
  `celular_confirmado_em` preenchido; evento `celular_confirmado` gravado.
- `confirm` com hash errado 4 vezes ⇒ `invalid` com `attempts_left` 4, 3, 2, 1; a 5ª ⇒ `locked`;
  a 6ª, **com o hash certo**, ⇒ `no_active`.
- `confirm` com `expires_at` no passado e hash certo ⇒ `expired`; `perfis.celular` não muda.
- `confirm` com `p_verification_id` de outra conta ⇒ `no_active`.
- **Troca**: conta com `celular = A` confirmado; `begin` com B ⇒ `celular` continua A e
  `phone_is_confirmed` continua `true`; `confirm` certo ⇒ `celular = B`. Com `confirm` errado,
  vencido ou sem `confirm`, `celular` continua A.
- `phone_is_confirmed`: tutor A sobre A com celular ⇒ `true`; tutor A sobre B (que tem celular) ⇒
  `false`; `service_role` sobre B ⇒ `true`; conta sem celular ⇒ `false`; `NULL` ⇒ `false`.
- `phone_verification_status` devolve só dados de `auth.uid()` e nenhuma chave contendo `hash`.
- Nenhuma linha de `auth_audit_log` gravada nestes testes contém dígitos do telefone no `detalhe`.
