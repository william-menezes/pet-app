# Quickstart — Conta do tutor (004-conta-tutor)

Como rodar e validar localmente. Pré-requisitos: Node 20+, npm 10+, Supabase CLI, Docker, Deno
(para `deno test`). A `002-ui-zardui` precisa estar implementada (cascas e componentes).

> Comandos em sintaxe POSIX (Git Bash). Rode na raiz do repositório.

## 1. Segredos locais

Copie `supabase/.env.local.example` para `supabase/.env.local` (nunca versionar) e preencha:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon key do "supabase status">
SUPABASE_SERVICE_ROLE_KEY=<service_role key do "supabase status">
HASH_SALT=local-dev-salt-0123456789
PHONE_OTP_PEPPER=local-dev-pepper-0123456789-abcdefghij   # 32+ caracteres
FARO_ENV=local
SMS_DRIVER=log            # log: mostra o SMS no log da função | stub: código fixo, para o E2E
SMS_STUB_CODE=424242      # só é lido com SMS_DRIVER=stub
SMS_DAILY_CAP=500
ALLOWED_ORIGINS=http://localhost:4200
SITE_URL=http://localhost:4200
```

## 2. Subir o backend

```bash
supabase start
supabase db reset                 # aplica 0001…0016 + seed
                                  # tutor.a: com aceite e celular confirmado | tutor.b: sem os dois | admin
supabase functions serve --env-file ./supabase/.env.local
```

- Coletor de e-mails local: `http://localhost:54324` (confirmação e recuperação chegam aqui).
- Studio: `http://localhost:54323`.

## 3. Subir o app

```bash
npm install
npm start                         # http://localhost:4200
```

Entrada: `http://localhost:4200/auth` (boas-vindas).

## 4. Caminho principal, à mão

1. `/auth` → "Criar conta". Preencha nome, e-mail novo, celular `(11) 98765-4421`, senha de 8+
   caracteres, marque o aceite → "Criar conta".
2. Tela "Confirme seu e-mail". Abra `http://localhost:54324`, abra a mensagem e siga o link
   (`/auth/confirmar-email?token_hash=…`).
3. "Confirmar meu e-mail" → a tela "Confirme seu celular" aparece e o SMS é "enviado".
4. Com `SMS_DRIVER=log`: o texto do SMS aparece no terminal do `supabase functions serve`
   (`[sms:log] …`). Digite o código → "Confirmar".
5. Você chega a `/app`. Em **Conta**, o celular aparece com o selo "Confirmado".

## 5. Validar as histórias

| História | Como validar | Esperado |
|---|---|---|
| US1 | Passos 1–3 acima. Tente entrar antes de confirmar o e-mail | recusa genérica + "reenviar"; depois de confirmar, autenticada como tutor |
| US1 | Cadastre de novo com o **mesmo** e-mail | mesma tela "Confirme seu e-mail"; nenhum e-mail novo; nada muda na conta |
| US1 | Abra o link de confirmação duas vezes | 2ª vez: "Este link não vale mais" + "Pedir novo link" |
| US1 | Abra o link numa janela anônima (outro "aparelho") | confirma e segue para o celular nessa janela |
| US2 | Código errado 5 vezes | 4 × "Código incorreto, restam n"; depois "Muitas tentativas. Peça um novo código." |
| US2 | "Reenviar" antes de 60 s | indisponível, com contagem |
| US2 | "Número errado? Corrigir" → outro número → código | o código antigo não vale mais |
| US2 | No Studio: `update perfis set celular_confirmado_em = now()` logado como o tutor (SQL com papel `authenticated`) | erro `42501` |
| US3 | "Continuar com o Google" (com o provedor configurado como na `001`) | conta criada; tela de aceite; depois tela de celular com "Agora não" |
| US4 | "Esqueci a senha" com e-mail existente e inexistente | mesma mensagem; só o existente recebe e-mail |
| US4 | Link → nova senha | volta ao login com "Senha alterada"; a senha antiga não entra |
| US5 | Conta → Privacidade → "Baixar meus dados" | arquivo `faro-meus-dados-AAAA-MM-DD.json` só com dados da conta |
| US5 | "Excluir minha conta" com senha errada e depois certa | errada: nada muda; certa: vai para `/auth?conta=excluida`; não entra mais |
| US6 | Conta → Celular → "Trocar celular" | pede a senha atual; o número antigo continua "Confirmado" até o novo código |
| US6 | Conta → Aparência → "Escura" | o app escurece; `/auth/login` (em outra aba) continua claro |
| Destino | Abra `/auth/criar-conta?returnUrl=/app/conta/privacidade` e conclua o fluxo | termina em `/app/conta/privacidade` |
| Destino | `…?returnUrl=https://evil.com` | termina em `/app` |
| Resgate | Abra a rota de uma tag sem sessão, antes e depois | carrega sem pedir login |

## 6. Conferências de integração das Edge Functions (curl)

```bash
ANON=<anon key>; BASE=http://localhost:54321
# token do tutor B (seed: sem aceite e sem celular; o tutor A já nasce com os dois)
TOKEN=$(curl -s -X POST "$BASE/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
  -H "Content-Type: application/json" -d '{"email":"tutor.b@faro.test","password":"TesteSenha123!"}' \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
fn() { curl -s -X POST "$BASE/functions/v1/$1" -H "apikey: $ANON" -H "Authorization: Bearer ${3:-$TOKEN}" \
       -H "Content-Type: application/json" -d "$2"; echo; }

fn phone-verify-start '{"phone":"(11) 98765-4421"}'            # {"ok":false,"error":"terms_required"}

# aceite dos termos do tutor B
curl -s -X POST "$BASE/rest/v1/rpc/accept_terms" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"p_versao":"2026-11"}'

fn phone-verify-start '{"phone":"(11) 98765-4421"}'            # {"ok":true,"phone":"+5511987654421",…}
fn phone-verify-start '{"phone":"(11) 98765-4421"}'            # {"ok":false,"error":"cooldown","retry_after_seconds":…}
fn phone-verify-start '{"phone":"(11) 3765-4421"}'             # {"ok":false,"error":"invalid_phone"}
fn phone-verify-start '{"phone":"(11) 98765-4421"}' "$ANON"    # HTTP 401 unauthorized
fn phone-verify-confirm '{"code":"12"}'                        # invalid_format (não conta tentativa)
for i in 1 2 3 4 5; do fn phone-verify-confirm '{"code":"000000"}'; done   # 4 × invalid_code, depois locked
fn phone-verify-confirm '{"code":"<código certo do log>"}'     # no_active

# recuperação: mesma resposta, mesmo tempo
time fn password-recovery '{"email":"tutor.a@faro.test"}' "$ANON"      # {"ok":true}  ≥ 0,6 s
time fn password-recovery '{"email":"ninguem@faro.test"}' "$ANON"      # {"ok":true}  ≥ 0,6 s
for i in 1 2 3; do fn password-recovery '{"email":"admin@faro.test"}' "$ANON"; done   # 3 × {"ok":true}
fn password-recovery '{"email":"admin@faro.test"}' "$ANON"             # {"ok":true}, e NENHUM e-mail novo no coletor
```

O 4º pedido para o mesmo e-mail é barrado pelo nosso limite. A prova está na auditoria (o Auth,
por conta própria, já espaça os e-mails do mesmo usuário em 60 s):

```sql
select detalhe from auth_audit_log
 where evento = 'senha_recuperacao_solicitada' and detalhe->>'origem' = 'pedido'
 order by at desc limit 1;                     -- {"origem":"pedido","permitido":false}
```

Os valores esperados pressupõem um banco recém-criado (`supabase db reset`) e que os comandos
rodem nesta ordem.

Falha fechada (rode o `functions serve` com o ambiente alterado e repita o primeiro `phone-verify-start`,
depois de limpar o intervalo: `delete from rate_limit_events where bucket = 'sms:cooldown';`):

| Alteração no `.env.local` | Esperado |
|---|---|
| remover `PHONE_OTP_PEPPER` | HTTP 500 `misconfigured` |
| `PHONE_OTP_PEPPER=curto` | HTTP 500 `misconfigured` |
| `FARO_ENV=production` com `SMS_DRIVER=stub` | `{"ok":false,"error":"sms_unavailable"}` |
| remover `FARO_ENV` com `SMS_DRIVER=log` | `{"ok":false,"error":"sms_unavailable"}` |
| remover `SMS_DRIVER` | `{"ok":false,"error":"sms_unavailable"}` |

CORS (também vale para o `login-guard`, ver `contracts/shared-edge.contract.md`):

```bash
for f in login-guard phone-verify-start phone-verify-confirm password-recovery account-delete; do
  curl -s -o /dev/null -w "$f %{http_code}\n" -X OPTIONS "$BASE/functions/v1/$f" \
    -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: authorization,content-type,apikey"
done        # todas 204 ou 200
```

## 7. Rodar os testes

```bash
npm run lint
npm test -- --watch=false                 # Vitest
npm run build                             # produção, com SSR
supabase test db                          # pgTAP: os 3 arquivos da 001 + os 7 desta spec
deno test supabase/functions/             # _shared/ e a lógica das 4 funções (e a da login-guard)
# E2E: precisa de "supabase start", "supabase functions serve" com SMS_DRIVER=stub e FARO_ENV=test
npm run e2e -- e2e/signup-confirm-phone.spec.ts e2e/password-recovery.spec.ts e2e/account.spec.ts
```

Como o E2E obtém o que precisa:

- **Link de confirmação e de recuperação**: `e2e/support/mailbox.ts` consulta o coletor de e-mails
  local na porta 54324. Tenta primeiro a API do Mailpit (`GET /api/v1/search?query=to:<e-mail>`,
  depois `GET /api/v1/message/<id>`) e, se não existir, a do Inbucket
  (`GET /api/v1/mailbox/<parte-local>`, depois `GET /api/v1/mailbox/<parte-local>/<id>`). Extrai do
  corpo a URL que contém `token_hash=`.
- **Código do SMS**: `SMS_DRIVER=stub` + `FARO_ENV=test` + `SMS_STUB_CODE=424242`. O teste digita `424242`.
- Cada teste usa um e-mail único (`e2e+<timestamp>@faro.test`) e um celular único.

## 8. Integração com a `003-tag-qr` (quando as duas estiverem implementadas)

1. Com um tutor com uma tag ativa (dados de exemplo da `003`), abra a página da tag: resgate.
2. Conta → Privacidade → Excluir (com a senha).
3. Confira no banco:
   ```sql
   select code, status from tag_codes where code = '<código>';            -- existe, status available
   select ended_at, end_reason from tag_assignments where tag_code = '<código>' order by started_at desc limit 1;
                                                                          -- encerrado, account_deleted
   select count(*) from perfis where id = '<uid>';                         -- 0
   select count(*) from auth_audit_log where evento = 'conta_excluida' and ator is null;   -- ≥ 1
   ```
4. Abra a página da tag de novo: "tag não ativada", sem nenhum dado do antigo tutor.
5. Fluxo de destino: sem sessão, abra `/ativar/<código>` → o guard da `003` manda para
   `/auth/criar-conta?returnUrl=/ativar/<código>` → conclua cadastro, e-mail e celular → você volta
   para `/ativar/<código>`.

## 9. Checklist de produção (antes de abrir ao público)

- [ ] `TODO(SMS_PROVIDER)` decidido; driver real em `_shared/sms/`; `SMS_DRIVER` = driver real.
- [ ] `FARO_ENV=production`; `SMS_STUB_CODE` **não** definido; `PHONE_OTP_PEPPER` e `HASH_SALT`
      fortes e diferentes dos locais (`supabase secrets list` para conferir os nomes).
- [ ] `ALLOWED_ORIGINS=https://tagfaro.com.br`; `SITE_URL=https://tagfaro.com.br`.
- [ ] `site_url` e `additional_redirect_urls` do Auth apontam para `https://tagfaro.com.br`.
- [ ] Modelos de e-mail aplicados no projeto hospedado; um cadastro real recebe o link com
      `/auth/confirmar-email?token_hash=`.
- [ ] `TODO(EMAIL_PROVIDER)`: SMTP próprio configurado; teto `email_sent` ajustado.
- [ ] `enable_confirmations`, `secure_password_change`, `minimum_password_length = 8`,
      `max_frequency = 60s`, `otp_expiry = 3600` conferidos no painel.
- [ ] Provedor de telefone do Auth **desligado**.
- [ ] `TODO(LEGAL_TEXTS)`: textos finais em `/legal/termos` e `/legal/privacidade`.
- [ ] `TODO(CAPTCHA)`: decisão tomada (recomendado ligar).
- [ ] Um SMS real chega em Vivo, Claro e TIM em menos de 30 s.
- [ ] `/security-review` e `/code-review` feitos pelo dono.

## 10. Auditoria (conferência)

```sql
select evento, ator, detalhe, at from auth_audit_log order by at desc limit 30;
```

Depois do caminho principal devem aparecer: `conta_criada`, `termos_aceitos`, `email_confirmado`,
`celular_codigo_enviado`, `celular_confirmado`. Nenhum `detalhe` com e-mail, telefone ou código.
