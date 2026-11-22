# Contrato: Edge Function `phone-verify-start`

`POST /functions/v1/phone-verify-start` — `supabase/functions/phone-verify-start/index.ts`

Envia (ou reenvia) o código de 6 dígitos por SMS para o celular informado ou pendente. É o
**único** ponto do sistema que fala com o provedor de SMS. Serve ao cadastro, a "Número errado?
Corrigir", ao reenvio e à troca de celular em "Conta".

Convenção de resposta, módulos e variáveis: `shared-edge.contract.md`.

## Quem pode chamar

Conta autenticada (`Authorization: Bearer <access_token do usuário>`). Chave anônima ⇒ `401 unauthorized`.

## Entrada

```json
{ "phone": "(11) 98765-4421", "password": "…" }
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `phone` | não | Se ausente, usa `perfis.celular_pendente`. Normalizado por `normalizeBrPhone` |
| `password` | só na **troca** de um celular já confirmado, em conta com senha | conferida por `requireRecentAuth` |

## Saída de sucesso

```json
{
  "ok": true,
  "phone": "+5511987654421",
  "expires_at": "2026-11-21T12:10:00Z",
  "resend_available_at": "2026-11-21T12:01:00Z",
  "attempts_left": 5
}
```

`phone` é o número da própria conta. O código **nunca** aparece na resposta.

## Códigos de recusa (`{ "ok": false, "error": … }`, HTTP 200)

| `error` | Condição | Campos extras | Texto ao tutor |
|---|---|---|---|
| `email_not_confirmed` | e-mail da conta não confirmado | — | "Confirme seu e-mail antes de continuar." |
| `terms_required` | aceite não registrado | — | (leva para `/auth/termos`) |
| `invalid_phone` | `phone` inválido, ou ausente sem número pendente | — | "Confira o número. Use DDD + celular, como (11) 98765-4321." |
| `same_number` | número igual ao já confirmado | — | "Este já é o seu celular confirmado." |
| `reauth_required` | troca de celular sem prova recente | `method`: `"password"` ou `"google"` | "Para trocar o celular, confirme que é você." |
| `invalid_password` | senha atual errada | — | "Senha incorreta." |
| `cooldown` | menos de 60 s desde o último envio | `retry_after_seconds` | "Você poderá reenviar em {mm:ss}." |
| `rate_limited` | qualquer outro limite de envio, ou limite de prova de identidade | `retry_after_seconds` | "Muitos pedidos de código. Tente de novo em {tempo}." |
| `sms_unavailable` | sem provedor configurado, limitador indisponível ou teto global atingido | — | "Não conseguimos enviar o SMS agora. Tente de novo mais tarde." |
| `sms_send_failed` | o provedor recusou ou falhou | — | "Não conseguimos enviar o SMS agora. Tente de novo." |

O teto global (`sms:global:d`) responde `sms_unavailable`, não `rate_limited`, para não revelar o
volume do sistema.

## Passos (a ordem é parte do contrato)

1. `handleOptions`; só `POST`. `loadEnv({ pepper: true })` (falha ⇒ `500 misconfigured`).
2. `getCaller` ⇒ `401` se nulo. Ler o corpo (`400` se não for objeto JSON).
3. `facts = rpc('account_auth_facts', { p_user_id })`. `email_confirmed = false` ⇒ `email_not_confirmed`.
4. `terms_accepted = false` ⇒ `terms_required`.
5. Número alvo: `normalizeBrPhone(body.phone)` se `phone` veio; senão `facts.pending_phone`.
   Sem número válido ⇒ `invalid_phone`.
6. Alvo igual a `facts.phone` ⇒ `same_number`.
7. `sender = resolveSender(env)`. `null` ⇒ `sms_unavailable` (**antes** de consumir limites).
8. **Troca** (`facts.phone` não nulo): `requireRecentAuth({ action: 'trocar_celular', … })`.
   Falha ⇒ devolver o erro dele (`reauth_required` inclui `method`).
9. `phone_hash = hmacSha256Hex(pepper, phoneHashInput(alvo))`;
   `ip_hash = sha256SaltedHex(getTrustedIp(req), hashSalt)`.
10. `rate_limit_check` com os 6 limites `sms:*` (`data-model.md` §3), `p_record = true`.
    - Erro na chamada ⇒ `sms_unavailable` (falha fechada).
    - Negado ⇒ auditar `celular_bloqueado` `{ "motivo": "limite_envio", "bucket": <denied_bucket> }`
      e responder `cooldown` (se `sms:cooldown`), `sms_unavailable` (se `sms:global:d`) ou
      `rate_limited`, com `retry_after_seconds`.
11. `code = resolveCode(env)`; `code_hash = hmacSha256Hex(pepper, codeHashInput(userId, alvo, code))`.
12. `rpc('phone_verification_begin', …)`. Erros `terms_required`/`invalid_phone`/`same_number` são
    mapeados para os códigos acima; outro erro ⇒ `500 internal`.
13. `sender.send(alvo, buildOtpMessage(code))`. Falha ou exceção ⇒
    `rpc('phone_verification_send_failed')` e responder `sms_send_failed`. A cota consumida no
    passo 10 **não** é devolvida.
14. Remover o telefone dos metadados: `auth.admin.updateUserById(userId, { user_metadata: { phone: null } })`.
    Falha aqui só é registrada em log.
15. Auditar `celular_codigo_enviado` `{ "troca": <facts.phone não nulo> }`.
16. Responder sucesso. `resend_available_at = agora + 60 s`.

## Limites

Os 6 de `sms:*` (por conta, por número, por origem, global) + `reauth:account` na troca. Todos
impostos aqui, no servidor. Não existe outro caminho para enviar SMS.

## Eventos de auditoria

`celular_codigo_enviado`, `celular_bloqueado`, `reautenticacao_falha` (via `reauth.ts`).

## Segurança

- O código vive só na memória da função durante o pedido. Não é logado, salvo pelo driver `log`,
  que só existe em `FARO_ENV=local|test`.
- `PHONE_OTP_PEPPER` não é enviado ao banco em nenhuma chamada.
- A função não informa se um número pertence a outra conta (não consulta isso).

## Testes

- `deno test supabase/functions/phone-verify-start/` — lógica pura extraída para
  `phone-verify-start/logic.ts`: mapeamento de `denied_bucket` para `cooldown`/`rate_limited`/
  `sms_unavailable`; decisão "é troca?"; escolha do número alvo (5 casos).
- Integração (`supabase functions serve` + `curl`, descrita em `quickstart.md` §6): sem token ⇒ 401;
  2º envio em menos de 60 s ⇒ `cooldown`; 6º envio na hora (com `sms:cooldown` limpo entre eles) ⇒
  `rate_limited`; `SMS_DRIVER=stub` com `FARO_ENV=production` ⇒ `sms_unavailable`; sem
  `PHONE_OTP_PEPPER` ⇒ `500 misconfigured`.
- E2E: `e2e/signup-confirm-phone.spec.ts`.
