# Contrato: configuração do Supabase Auth, e-mails e segredos

> **Estado do `config.toml` desde 2026-11-21** (reparo da base da `001`, PR nº 1): o arquivo é
> válido para a CLI do Supabase **3.2.0**, fixada no CI. `[inbucket]` virou `[local_smtp]`; os
> limites se chamam `email_sent` e `token_refresh`; **`token_refresh` agora conta por 5 minutos e
> por IP**, não por hora; e `verify_jwt` é declarado **por função** (`[functions.<nome>]`), não
> mais num bloco global. Onde este contrato disser "padrão atual do arquivo" para `verify_jwt`,
> leia: declarar `[functions.<nome>] verify_jwt = true` para cada função nova.

Arquivos: `supabase/config.toml`, `supabase/templates/confirmation.html`,
`supabase/templates/recovery.html`, `supabase/.env.local.example`.

O cadastro, a confirmação de e-mail, o reenvio e a troca de senha são feitos **pelo Supabase Auth**,
chamado direto do navegador com a chave pública. Este arquivo define a configuração que sustenta os
requisitos da spec nesses pontos, e o que **não** é garantido por ela.

## `supabase/config.toml` — valores exigidos

```toml
[auth]
site_url = "http://localhost:4200"                 # produção: https://tagfaro.com.br
additional_redirect_urls = ["http://localhost:4200/auth/callback"]   # produção: https://tagfaro.com.br/auth/callback
jwt_expiry = 3600
enable_signup = true
minimum_password_length = 8                        # FR-003, imposto no servidor
password_requirements = ""                         # sem regra de composição

[auth.rate_limit]
email_sent = 30                # e-mails por hora (global). Produção: ajustar ao plano do provedor SMTP
sign_in_sign_ups = 30          # por 5 min, por IP
token_verifications = 30       # por 5 min, por IP (confirmação e recuperação)
token_refresh = 150            # por 5 min, por IP

[auth.email]
enable_signup = true
enable_confirmations = true    # FR-024 da 001; também ativa a resposta ofuscada para e-mail já cadastrado
double_confirm_changes = true
secure_password_change = true  # trava de servidor para troca de senha em sessão antiga
max_frequency = "60s"          # intervalo mínimo entre e-mails para o mesmo usuário (FR-011)
otp_expiry = 3600              # validade dos links: 1 hora (FR-012, FR-035)

[auth.email.template.confirmation]
subject = "Confirme seu e-mail no Faro"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Crie uma nova senha no Faro"
content_path = "./supabase/templates/recovery.html"

[auth.sms]
enable_signup = false          # o celular NÃO é forma de entrar (FR-028)
enable_confirmations = false
```

Regras:

- A linha `enable_confirmations = false    # dev: false …` que hoje está em `[auth]` deve ser
  **removida**: a chave válida é a de `[auth.email]`, e fica `true` em todos os ambientes
  (inclusive local, onde o coletor de e-mails recebe as mensagens).
- Os nomes das chaves de `[auth.rate_limit]` mudam entre versões da CLI. Conferir com
  `supabase --version` e a referência do `config.toml` dessa versão; se uma chave acima não
  existir, **parar e relatar** o nome equivalente em vez de inventar.
- **Não** habilitar nenhum provedor em `[auth.sms.*]` nem `[auth.hook.send_sms]`: o SMS desta spec
  não passa pelo Auth.
- `[auth.external.google]` continua como na `001`.
- `[functions]`: `verify_jwt = true` para as quatro funções novas (padrão atual do arquivo).
- No projeto hospedado, os mesmos valores e os dois modelos são aplicados pelo painel ou por
  `supabase config push`. Registrar a conferência no checklist de produção (`quickstart.md` §9).

## Modelos de e-mail

Regras comuns: PT-BR, sem emoji, HTML simples (uma coluna, até 600 px, texto `#33403D`, título
`#13201E`, botão lima `#84C32E` com texto `#13201E`), o link também em texto puro abaixo do botão,
nenhuma imagem remota obrigatória, nenhum dado além do endereço de destino.

### `confirmation.html`

- Assunto: "Confirme seu e-mail no Faro".
- Texto: "Falta pouco. Confirme seu e-mail para ativar sua conta no Faro."
- Botão "Confirmar meu e-mail" com o link **exato**:
  `{{ .SiteURL }}/auth/confirmar-email?token_hash={{ .TokenHash }}&type=email`
- Rodapé: "Este link vale por 1 hora. Se você não criou uma conta no Faro, ignore este e-mail."

### `recovery.html`

- Assunto: "Crie uma nova senha no Faro".
- Texto: "Recebemos um pedido para criar uma nova senha para sua conta."
- Botão "Criar nova senha" com o link **exato**:
  `{{ .SiteURL }}/auth/nova-senha?token_hash={{ .TokenHash }}&type=recovery`
- Rodapé: "Este link vale por 1 hora e só funciona uma vez. Se não foi você, ignore este e-mail:
  sua senha continua a mesma."

**Proibido** nos dois: `{{ .ConfirmationURL }}` (aponta para `/auth/v1/verify`, que consome o
token só de abrir o link) e `{{ .Token }}` (código de 6 dígitos por e-mail, rejeitado em R2).

## Chamadas ao Supabase Auth feitas pelo frontend

| Ação | Chamada | Observação |
|---|---|---|
| Cadastro | `auth.signUp({ email, password, options: { data: { name, phone, terms_version, return_to, return_to_at } } })` | sem `emailRedirectTo` (o modelo usa `SiteURL`) |
| Reenviar confirmação | `auth.resend({ type: 'signup', email })` | já existe em `AuthService.resendConfirmation` |
| Confirmar e-mail | `auth.verifyOtp({ token_hash, type: 'email' })` | só no clique |
| Cadastro com o Google | `auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <origem>/auth/callback } })` | já existe em `AuthService.signInWithGoogle` |
| Nova senha (link) | `auth.verifyOtp({ token_hash, type: 'recovery' })` → `auth.updateUser({ password })` → `auth.signOut({ scope: 'global' })` | |
| Trocar senha | `AuthService.signInPassword` → `auth.updateUser({ password })` → `auth.signOut({ scope: 'others' })` | |
| Limpar destino dos metadados | `auth.updateUser({ data: { return_to: null, return_to_at: null } })` | depois de usar |

O cliente Supabase continua com o fluxo padrão (implícito). **Não** trocar para `flowType: 'pkce'`:
o verificador ficaria no navegador de origem e quebraria a confirmação em outro aparelho.

## O que o Auth garante e o que não garante

| Requisito | Garantia | Limite da garantia |
|---|---|---|
| Senha ≥ 8 (FR-003) | `minimum_password_length` | — |
| Mesma resposta para e-mail já cadastrado (FR-006) | com `enable_confirmations = true`, `signUp` devolve um usuário fictício sem erro e não altera a conta existente | o **tempo** de resposta pode diferir (envia ou não envia e-mail). A tela aplica um mínimo de 1,2 s; quem chama o Auth direto pode medir. `TODO(CAPTCHA)` |
| Intervalo de reenvio (FR-011) | `max_frequency = "60s"` por usuário | — |
| Link de 1 hora, uso único (FR-012, FR-035) | `otp_expiry` | — |
| Limite de pedidos de recuperação (FR-037) | Edge `password-recovery` para o app; Auth como rede de fundo | chamada direta a `/recover` ignora o limite do app |
| Trocar senha exige autenticação recente (FR-043) | `secure_password_change` (24 h) + senha atual pedida pela tela | a janela do servidor é de 24 h, não de minutos |
| Celular não é login (FR-028) | `[auth.sms] enable_signup = false` e nenhum provedor de SMS no Auth | — |

## Segredos

`supabase/.env.local.example` ganha (sem valores reais; os nomes e regras estão em
`shared-edge.contract.md`): `PHONE_OTP_PEPPER`, `FARO_ENV`, `SMS_DRIVER`, `SMS_STUB_CODE`,
`SMS_DAILY_CAP`, `ALLOWED_ORIGINS`, `SITE_URL`, `SUPABASE_ANON_KEY`.

- Em produção: `supabase secrets set …`. `FARO_ENV=production`. `SMS_DRIVER` = driver real
  (`TODO(SMS_PROVIDER)`); `SMS_STUB_CODE` **não** é definido.
- Nenhum desses valores aparece em `src/`, em `environment*.ts` nem no bundle. O frontend só
  conhece `supabaseUrl` e `supabaseAnonKey`.

## Conferência

```bash
supabase start && supabase db reset
# 1) senha curta é recusada pelo servidor
curl -s -X POST "http://localhost:54321/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"curta@faro.test","password":"1234567"}'          # esperado: erro de senha fraca
# 2) cadastro repetido não revela a conta
curl -s -X POST "http://localhost:54321/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"tutor.a@faro.test","password":"OutraSenha123"}'  # esperado: HTTP 200, sem erro, sem sessão
# 3) o e-mail de confirmação no coletor local (http://localhost:54324) contém /auth/confirmar-email?token_hash=
```

## `TODO`s

- `TODO(EMAIL_PROVIDER)`: SMTP de produção em `[auth.email.smtp]` (mesmo ponto em aberto da `003`).
- `TODO(CAPTCHA)`: `[auth.captcha]` (Turnstile) + `captchaToken` nas chamadas de cadastro, login,
  reenvio e recuperação.
- `TODO(SMS_PROVIDER)`: driver real em `supabase/functions/_shared/sms/`.
