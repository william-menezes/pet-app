# Contrato: Edge Function `phone-verify-confirm`

`POST /functions/v1/phone-verify-confirm` — `supabase/functions/phone-verify-confirm/index.ts`

Confere o código de 6 dígitos e, se estiver certo, promove o número pendente a celular confirmado.
A conferência e a contagem de tentativas acontecem **no servidor, na mesma chamada**
(`phone_verification_confirm`). O cliente nunca informa "deu certo".

Convenção de resposta, módulos e variáveis: `shared-edge.contract.md`.

## Quem pode chamar

Conta autenticada. Chave anônima ⇒ `401 unauthorized`.

## Entrada

```json
{ "code": "482913" }
```

`code`: string com exatamente 6 dígitos (`^[0-9]{6}$`).

## Saídas (HTTP 200)

| Corpo | Quando | Texto ao tutor |
|---|---|---|
| `{ "ok": true, "phone": "+5511987654421" }` | código certo | (segue o fluxo) |
| `{ "ok": false, "error": "invalid_format" }` | `code` não tem 6 dígitos. **Não conta tentativa** | "Digite os 6 dígitos do código." |
| `{ "ok": false, "error": "invalid_code", "attempts_left": 3 }` | código errado | "Código incorreto. Você tem mais {n} tentativa(s)." |
| `{ "ok": false, "error": "locked", "attempts_left": 0 }` | 5º erro, ou código já esgotado | "Muitas tentativas. Peça um novo código." |
| `{ "ok": false, "error": "expired" }` | passou de 10 minutos | "Este código venceu. Peça um novo." |
| `{ "ok": false, "error": "no_active" }` | não há código aberto | "Peça um código para continuar." |

## Passos

1. `handleOptions`; só `POST`. `loadEnv({ pepper: true })`.
2. `getCaller` ⇒ `401` se nulo. Corpo ⇒ `400` se não for objeto JSON.
3. `code` fora do formato ⇒ `invalid_format`.
4. `open = rpc('phone_verification_active', { p_user_id })`. `null` ⇒ `no_active`.
5. `code_hash = hmacSha256Hex(pepper, codeHashInput(userId, open.phone_e164, code))`.
6. `r = rpc('phone_verification_confirm', { p_user_id, p_verification_id: open.verification_id,
   p_code_hash, p_ip_hash, p_user_agent })`. Erro ⇒ `500 internal`.
7. Mapear `r.status`: `confirmed` ⇒ sucesso; `invalid` ⇒ `invalid_code`; `locked`, `expired`,
   `no_active` ⇒ iguais.
8. Em `confirmed`: remover o telefone dos metadados
   (`auth.admin.updateUserById(userId, { user_metadata: { phone: null } })`, falha só em log).

## Limites

5 tentativas por código (em `phone_verification_confirm`). Como só há um código ativo por conta e
os envios são limitados (10 por 24 h), o teto é de 50 palpites por conta por dia.

## Eventos de auditoria

Gravados dentro de `phone_verification_confirm`: `celular_confirmado`, `celular_codigo_invalido`,
`celular_bloqueado`.

## Segurança

- A resposta não distingue "código de outra conta" de "sem código": ambos são `no_active`.
- Nenhum hash, id de verificação ou pepper sai na resposta ou em log.
- A comparação é feita no banco entre dois HMACs; o valor comparado não é controlável byte a byte
  por quem ataca.

## Testes

- `deno test supabase/functions/phone-verify-confirm/` — `logic.ts`: validação de formato (6 casos)
  e mapeamento de `status` para a resposta.
- pgTAP cobre a máquina de estados (`phone-verification.rpc.md`).
- Integração (`quickstart.md` §6): sem token ⇒ 401; código errado 5 vezes ⇒ 4 × `invalid_code` e
  `locked`; depois, código certo ⇒ `no_active`.
- E2E: `e2e/signup-confirm-phone.spec.ts`.
