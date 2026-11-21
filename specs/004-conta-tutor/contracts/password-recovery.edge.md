# Contrato: Edge Function `password-recovery` e troca de senha

`POST /functions/v1/password-recovery` — `supabase/functions/password-recovery/index.ts`

Recebe o pedido "Esqueci a senha". Responde **sempre igual**, exista ou não uma conta, depois de um
tempo mínimo fixo; aplica o limite por e-mail e por origem; audita; e dispara o e-mail de
recuperação do Supabase Auth em segundo plano.

Convenção de resposta, módulos e variáveis: `shared-edge.contract.md`.

## Quem pode chamar

Qualquer visitante (chave anônima no `Authorization`, como o `functions.invoke` já envia).

## Entrada

```json
{ "email": "ana@email.com", "captcha_token": null }
```

`captcha_token` é opcional e hoje é ignorado (`TODO(CAPTCHA)`).

## Saída

Para **qualquer** corpo que seja um objeto JSON: HTTP 200 `{ "ok": true }`.

Não existe resposta de "e-mail não encontrado", "limite atingido" ou "e-mail inválido". A validação
de formato é feita na tela; aqui, formato inválido só significa que nada é enviado.

## Passos

1. `handleOptions`; só `POST`. `inicio = Date.now()`. `loadEnv({})`.
2. Ler o corpo (`400 bad_request` se não for objeto JSON: único caso que não é 200).
3. `email = String(body.email ?? '').trim().toLowerCase()`.
   `valido = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)`.
4. `ip_hash = sha256SaltedHex(getTrustedIp(req), hashSalt)`;
   `identity_hash = sha256SaltedHex(email, hashSalt)`.
5. Se `valido`: `rate_limit_check([recovery:identity:h (3/3600), recovery:ip:h (10/3600)], true)`.
   `permitido = allowed === true`. Erro na chamada ⇒ `permitido = false` (falha fechada).
   Se não `valido`: `permitido = false`.
6. Auditar `senha_recuperacao_solicitada` com `ator = null` e
   `{ "origem": "pedido", "permitido": <permitido> }`. Sem e-mail no `detalhe`.
7. Se `permitido`: `EdgeRuntime.waitUntil(clienteAnonimo.auth.resetPasswordForEmail(email))`.
   Erros dessa chamada vão só para o log (sem o e-mail).
8. Esperar até `inicio + 600 ms` e responder `{ "ok": true }`.

O passo 7 não é aguardado: o tempo de resposta não depende de a conta existir.

## Limites

| Limite | Onde | Impositivo? |
|---|---|---|
| 3 por hora por e-mail, 10 por hora por origem | passo 5 | Sim, para pedidos feitos por esta função |
| 1 e-mail a cada 60 s por usuário | Supabase Auth (`max_frequency`) | Sim, no Auth |
| Teto global de e-mails por hora | Supabase Auth (`[auth.rate_limit] email_sent`) | Sim, no Auth |

**Risco residual declarado**: o endpoint `/auth/v1/recover` do Supabase Auth continua acessível com
a chave pública. Quem o chama direto ignora o limite do passo 5 e fica restrito só aos dois
limites do Auth. Ver `research.md` R8 e `TODO(CAPTCHA)`.

## Eventos de auditoria

- `senha_recuperacao_solicitada` `{ origem: "pedido" }` — aqui, um por pedido.
- `senha_recuperacao_solicitada` `{ origem: "envio" }` — pelo gatilho em `auth.users`, quando o Auth
  realmente envia (só para conta existente; tem `ator`).
- `senha_alterada` — pelo gatilho, quando a senha muda.

---

## Troca de senha pelo link (frontend + Supabase Auth)

E-mail: modelo `supabase/templates/recovery.html` com o link
`{{ .SiteURL }}/auth/nova-senha?token_hash={{ .TokenHash }}&type=recovery`.

`PasswordService.resetPassword(tokenHash, newPassword)`:

1. `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`. **Só é chamado quando a pessoa
   envia o formulário**, nunca ao carregar a página.
   - erro ⇒ `{ ok: false, reason: 'invalid_link' }` (vencido, usado ou adulterado: mesma mensagem).
2. `supabase.auth.updateUser({ password: newPassword })`.
   - erro de senha fraca ⇒ `{ ok: false, reason: 'weak_password' }`; outro ⇒ `'network'`.
3. `supabase.auth.signOut({ scope: 'global' })` e limpar os stores.
4. `{ ok: true }` ⇒ a tela navega para `/auth/login?senha=alterada`.

Se o passo 1 der certo e o 2 falhar, o link já foi consumido: a tela mantém o formulário e permite
tentar de novo **sem** repetir o passo 1 (a sessão de recuperação está ativa).

Validade do link: `otp_expiry = 3600`. Uso único.

## Troca de senha em "Conta" (frontend + Supabase Auth)

`PasswordService.changePassword(current, next)`:

1. `AccountStore.hasPassword()` falso ⇒ `{ ok: false, reason: 'no_password' }` (a tela não mostra o formulário).
2. `AuthService.signInPassword(email, current)` — o método da `001`, que passa pelo `login-guard`
   (5 falhas em 15 min) e renova a sessão.
   - `rate_limited` ⇒ `{ ok: false, reason: 'rate_limited' }`; outra falha ⇒ `'invalid_current'`.
3. `supabase.auth.updateUser({ password: next })` ⇒ erro: `'weak_password'` ou `'network'`.
4. `supabase.auth.signOut({ scope: 'others' })`.
5. `{ ok: true }`.

Trava de servidor: `secure_password_change = true` no `config.toml` faz o Auth recusar
`updateUser({ password })` em sessão com mais de 24 h sem nova autenticação. O passo 2 garante a
autenticação recente para o uso legítimo.

## Mensagens

| `reason` | Texto |
|---|---|
| (pedido enviado, sempre) | "Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora." |
| `invalid_link` | "Este link não vale mais. Peça um novo." |
| `weak_password` | "Use uma senha com pelo menos 8 caracteres." |
| `invalid_current` | "Senha atual incorreta." |
| `rate_limited` | "Muitas tentativas. Aguarde alguns minutos." |
| `no_password` | "Sua conta usa o login do Google. Para criar uma senha, use 'Esqueci a senha' na tela de entrada." |
| `network` | "Não conseguimos conectar. Verifique sua conexão e tente de novo." |

## Testes

- `deno test supabase/functions/password-recovery/` — `logic.ts`: validação de e-mail (8 casos),
  cálculo da espera até o piso (nunca negativa).
- Integração (`quickstart.md` §6): e-mail existente e inexistente ⇒ corpo idêntico, ambos ≥ 600 ms;
  4º pedido na hora para o mesmo e-mail ⇒ `{ ok: true }` e **nenhum** e-mail novo no coletor local;
  evento `pedido` com `permitido = false`.
- Vitest: `password.service.spec.ts` (cada `reason`; `verifyOtp` não é chamado antes do envio do
  formulário).
- E2E: `e2e/password-recovery.spec.ts`.
