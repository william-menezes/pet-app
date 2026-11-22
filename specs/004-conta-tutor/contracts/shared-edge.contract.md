# Contrato: módulos compartilhados das Edge Functions (`supabase/functions/_shared/`)

Usados por `phone-verify-start`, `phone-verify-confirm`, `password-recovery` e `account-delete`.
A `003` também grava em `_shared/` (`tag-code.ts`); os nomes abaixo não colidem. **Não** refatorar
`login-guard/` para usar estes módulos, exceto o ajuste de CORS descrito no fim.

## Convenção de resposta (vale para as quatro funções)

- **Resultado de negócio sempre em HTTP 200**, com corpo JSON:
  - sucesso: `{ "ok": true, … }`
  - recusa: `{ "ok": false, "error": "<código>", … }`
- HTTP diferente de 200 só para problemas de transporte ou configuração:

| HTTP | `error` | Quando |
|---|---|---|
| 400 | `bad_request` | corpo que não é JSON ou não é objeto |
| 401 | `unauthorized` | função que exige conta e não há usuário válido no `Authorization` |
| 405 | `method_not_allowed` | método diferente de `POST`/`OPTIONS` |
| 500 | `misconfigured` | segredo obrigatório ausente ou inválido (**falha fechada**) |
| 500 | `internal` | erro inesperado (sem detalhe técnico no corpo) |

- Nunca devolver mensagem do banco, pilha de erro, código SMS, hash ou número de outra conta.
- Nunca escrever em log: código, senha, link, e-mail, telefone ou IP em claro.

## `http.ts`

```ts
export function corsHeaders(req: Request): HeadersInit;
export function handleOptions(req: Request): Response | null;   // 204 com CORS se OPTIONS; senão null
export function json(req: Request, body: unknown, status = 200): Response;  // sempre com CORS
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null>;
```

- `Access-Control-Allow-Origin`: a origem do pedido **se** estiver em `ALLOWED_ORIGINS`
  (lista separada por vírgula); senão, o cabeçalho não é enviado.
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`.
- `Access-Control-Allow-Methods: POST, OPTIONS`. `Vary: Origin`.

## `env.ts`

```ts
export interface FaroEnv {
  supabaseUrl: string; anonKey: string; serviceRoleKey: string;
  hashSalt: string;            // >= 16 caracteres
  otpPepper: string;           // >= 32 caracteres
  faroEnv: 'local' | 'test' | 'staging' | 'production';
  smsDriver: string;           // '' quando não configurado
  smsStubCode: string | null;  // só lido quando smsDriver === 'stub'
  smsDailyCap: number;         // padrão 500
  siteUrl: string;
}
export class MisconfiguredError extends Error {}
export function loadEnv(need: { pepper?: boolean }): FaroEnv;   // lança MisconfiguredError
```

Regras (testadas com `deno test`):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HASH_SALT` são sempre
  obrigatórios. `HASH_SALT` com menos de 16 caracteres ⇒ `MisconfiguredError`.
- `PHONE_OTP_PEPPER` obrigatório quando `need.pepper`; menos de 32 caracteres ⇒ erro.
- `FARO_ENV` ausente ou fora da lista ⇒ tratado como `'production'`.

| Variável | Obrigatória | Exemplo local | Observação |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | sim | do `supabase status` | injetadas pela plataforma em produção |
| `HASH_SALT` | sim | `local-dev-salt-0123456789` | já existe na `001` |
| `PHONE_OTP_PEPPER` | sim (funções de celular) | 32+ caracteres aleatórios | **nunca** no banco nem no cliente |
| `FARO_ENV` | sim | `local` | `local`, `test`, `staging`, `production` |
| `SMS_DRIVER` | não | `log` | `log`, `stub` ou o nome de um driver real |
| `SMS_STUB_CODE` | só com `stub` | `424242` | 6 dígitos |
| `SMS_DAILY_CAP` | não | `500` | teto global por 24 h |
| `ALLOWED_ORIGINS` | sim | `http://localhost:4200` | produção: `https://tagfaro.com.br` |
| `SITE_URL` | sim | `http://localhost:4200` | |

## `hash.ts`

```ts
export async function hmacSha256Hex(key: string, message: string): Promise<string>;
export async function sha256SaltedHex(value: string, salt: string): Promise<string>; // SHA-256(value + salt): mesmo esquema do login-guard
export function phoneHashInput(e164: string): string;                  // 'phone|' + e164
export function codeHashInput(userId: string, e164: string, code: string): string; // 'code|'+userId+'|'+e164+'|'+code
```

`ip_hash` e hash de identidade usam `sha256SaltedHex(valor, HASH_SALT)` (compatível com os
registros da `001`). `phone_hash` e `code_hash` usam `hmacSha256Hex(PHONE_OTP_PEPPER, …)`.

## `ip.ts`

`getTrustedIp(req): string` — mesma ordem do `login-guard` (`x-real-ip`, primeiro valor de
`x-forwarded-for`, `cf-connecting-ip`, `'unknown'`). **Nunca** lê IP do corpo.

## `phone.ts`

```ts
export const BR_MOBILE_E164 = /^\+55[1-9][0-9]9[0-9]{8}$/;
export function normalizeBrPhone(input: unknown): string | null;
```

Regras de `normalizeBrPhone` (iguais às de `src/app/core/account/phone.ts`; os dois arquivos têm a
mesma tabela de casos de teste):

1. Não é string ⇒ `null`. Remover tudo que não é dígito.
2. 13 dígitos começando com `55` ⇒ usar como está. 11 dígitos ⇒ prefixar `55`. Outro tamanho ⇒ `null`.
3. Montar `'+' + dígitos` e validar com `BR_MOBILE_E164`; falhou ⇒ `null`.

| Entrada | Saída |
|---|---|
| `(11) 98765-4421` | `+5511987654421` |
| `11987654421` | `+5511987654421` |
| `+55 11 98765-4421` | `+5511987654421` |
| `5511987654421` | `+5511987654421` |
| `(11) 3765-4421` (fixo) | `null` |
| `(01) 98765-4421` (DDD inválido) | `null` |
| `+1 415 555 0100` | `null` |
| `987654421` | `null` |
| `''`, `null`, `123` | `null` |

## `otp.ts`

`generateCode(): string` — 6 dígitos, `crypto.getRandomValues`, amostragem por rejeição (descartar
valores ≥ 4.294.000.000 de um `Uint32` antes do módulo 1.000.000), com zeros à esquerda.

`resolveCode(env): string` — devolve `env.smsStubCode` **somente** se `env.smsDriver === 'stub'` e
`env.faroEnv` é `local` ou `test`; em qualquer outro caso, `generateCode()`.

## `sms/sender.ts`

```ts
export interface SmsSender { send(toE164: string, text: string): Promise<{ ok: boolean; providerId?: string }>; }
export function resolveSender(env: FaroEnv): SmsSender | null;
export function buildOtpMessage(code: string): string;
```

`resolveSender`:

| `SMS_DRIVER` | `FARO_ENV` | Resultado |
|---|---|---|
| `log` ou `stub` | `local` ou `test` | driver simulado |
| `log` ou `stub` | `staging`, `production`, ausente, outro | **`null`** (recusado) |
| vazio ou desconhecido | qualquer | `null` |
| nome de um driver real | qualquer | o driver (não existe ainda: `TODO(SMS_PROVIDER)`) |

- `log`: escreve no log da função `"[sms:log] para=<últimos 4 dígitos> texto=<texto>"` e devolve `ok`.
- `stub`: não escreve o código em lugar nenhum; devolve `ok`.
- `null` ⇒ a função que chamou responde `sms_unavailable`.

`buildOtpMessage('482913')` devolve exatamente (sem acentos, duas linhas, fim com `\n` entre elas):

```
Faro: seu codigo e 482913. Vale por 10 minutos. Nao compartilhe.
@tagfaro.com.br #482913
```

## `clients.ts`

```ts
export function serviceClient(env: FaroEnv): SupabaseClient;                 // service_role, persistSession: false
export async function getCaller(req: Request, env: FaroEnv): Promise<User | null>; // valida o JWT do Authorization com auth.getUser()
```

`getCaller` devolve `null` para a chave anônima ou token inválido.

## `audit.ts`

`logEvent(svc, evento, ator, ipHash, userAgent, detalhe)` → `rpc('log_auth_event', …)`. Falha de
auditoria é registrada com `console.error` (sem dados pessoais) e **não** derruba a operação,
exceto onde o contrato da função disser o contrário.

## `reauth.ts`

```ts
export type ReauthResult =
  | { ok: true }
  | { ok: false; error: 'reauth_required' | 'invalid_password' | 'rate_limited'; retry_after_seconds?: number };
export async function requireRecentAuth(args: {
  env: FaroEnv; svc: SupabaseClient; userId: string; email: string;
  facts: { has_password: boolean; last_sign_in_at: string | null };
  password: unknown; action: 'trocar_celular' | 'excluir_conta';
  ipHash: string; userAgent: string;
}): Promise<ReauthResult>;
```

Ordem:

1. `rate_limit_check([{ bucket: 'reauth:account', key: userId, max: 5, window: 900 }], false)`.
   Negado ⇒ `rate_limited`. Erro do limitador ⇒ `rate_limited` (falha fechada).
2. **Conta com senha** (`facts.has_password`):
   - `password` não é string de 1 a 72 caracteres ⇒ `reauth_required`.
   - Conferir com um cliente novo (`anonKey`, `persistSession: false`):
     `auth.signInWithPassword({ email, password })`.
   - Sucesso ⇒ revogar a sessão criada (`auth.admin.signOut(access_token, 'local')`) e `{ ok: true }`.
   - Falha ⇒ `rate_limit_check([...], true)` (registra), auditar `reautenticacao_falha`
     `{ acao }`, devolver `invalid_password`.
3. **Conta sem senha**: `last_sign_in_at` nos últimos 600 s ⇒ `{ ok: true }`; senão `reauth_required`.

## Ajuste em `login-guard` (única mudança permitida fora desta spec)

Hoje a função responde 405 a `OPTIONS` e não envia cabeçalhos CORS; chamada do navegador falha no
preflight e o `AuthService` segue em falha aberta. Corrigir usando `handleOptions`/`json` deste
contrato, **sem** mudar a lógica de decisão. Conferência:

```bash
curl -i -X OPTIONS http://localhost:54321/functions/v1/login-guard \
  -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type,apikey"
# esperado: HTTP 204 (ou 200) com Access-Control-Allow-Origin: http://localhost:4200
```

## Testes obrigatórios (`deno test supabase/functions/_shared/`)

- `phone.test.ts`: a tabela acima, linha por linha.
- `otp.test.ts`: 10.000 códigos têm 6 dígitos numéricos; `resolveCode` só devolve o código fixo com
  `stub` + `local`/`test`.
- `env.test.ts`: cada regra de `loadEnv`, incluindo pepper curto e `FARO_ENV` ausente ⇒ `production`.
- `sms/sender.test.ts`: as quatro linhas da tabela de `resolveSender`; texto exato de `buildOtpMessage`.
- `hash.test.ts`: HMAC conhecido (vetor de teste RFC 4231, caso 2) e entradas de hash.
