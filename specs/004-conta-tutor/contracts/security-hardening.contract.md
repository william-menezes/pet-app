# Contrato: endurecimento contra ataque e automação (004)

**Origem**: decisão do William em 2026-11-21 ("adotar rate limit e todas as técnicas de prevenção
contra ataque e automação"). Este contrato fecha `TODO(CAPTCHA)` e as lacunas que as próprias specs
declaravam. Ele **acrescenta**: onde endurece um número ou uma regra de outro contrato desta spec
ou da `001`, vale este. A parte específica da tag está em
`specs/003-tag-qr/contracts/security-hardening.contract.md`. O que só se resolve em painel
(Supabase, Vercel, Cloudflare, GitHub) está em `docs/seguranca-producao.md`.

## 0. Regras gerais

1. **Nada de desafio, CAPTCHA ou script de terceiro na página da tag** (`/<código>`). Princípio I:
   o resgate nunca pode depender de um serviço externo responder. Vale também para as telas "tag
   não ativada" e "tag não encontrada".
2. **Limite que protege dinheiro ou dado falha fechado** (SMS, exclusão, exportação, PIN). **Limite
   que protege disponibilidade pode falhar aberto**, desde que haja outro controle atrás (login: o
   desafio e os limites nativos do Auth). Cada limite abaixo diz qual é o caso.
3. Toda proteção tem um "Feito quando" que roda em máquina. O que depende de painel fica no
   checklist do William, e a produção não abre sem ele.
4. Nenhuma mensagem de limite ou de desafio revela se uma conta, um e-mail ou um número existe.

## 1. Desafio anti-robô: Cloudflare Turnstile

**Provedor**: Cloudflare Turnstile. O Supabase Auth aceita hCaptcha e Turnstile (conferido na
documentação do Supabase em 2026-11-21); o Turnstile não cobra por uso e quase nunca pede
interação. Exige uma conta Cloudflare do William (checklist).

**Onde o Auth confere o desafio** (documentado): cadastro, entrada com senha e recuperação de
senha. Com o desafio ligado no Auth, **toda** chamada dessas sem token é recusada, inclusive as
feitas pelo nosso servidor. Por isso:

| Chamada ao Auth | Quem faz | De onde vem o token |
|---|---|---|
| `signUp` | `RegistrationService` | widget em "Criar conta" → `options.captchaToken` |
| `signInWithPassword` | `AuthService.signInPassword` (`001`) | widget em "Entrar" |
| `resend` (confirmação) | `RegistrationService` | widget em "Confirme seu e-mail" |
| `resetPasswordForEmail` | Edge `password-recovery`, passo 7 | widget em "Esqueci a senha" → corpo `captcha_token` → `options.captchaToken` |
| `signInWithPassword` da nova prova de identidade | `_shared/reauth.ts` | widget em "Trocar celular", no diálogo de exclusão e em "Senha" → corpo `captcha_token` |

- O token vale **uma vez**. Depois de cada envio (com sucesso ou erro) a tela chama `reset()` do
  widget e espera o token novo antes de reabilitar o botão.
- `captcha_token` deixa de ser ignorado em `password-recovery` e passa a existir no corpo de
  `phone-verify-start` (só na troca de número confirmado) e de `account-delete`. Limite: 2.048
  caracteres; fora disso, `400`. A função **não** valida o token: repassa ao Auth, que valida.
- Erro de desafio do Auth vira o código `captcha_failed`, com o texto "Não foi possível confirmar
  que você não é um robô. Tente de novo." Não conta como senha errada.
- Se `resend` não aceitar o token na versão instalada do `supabase-js`: **PARE e relate**.

**Componente**: `src/app/shared/components/faro/turnstile/turnstile.ts` (`app-turnstile`).
Carrega `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` **sob demanda**
(só quando a tela que o usa aparece; nunca no pacote inicial nem no pacote público), desenha o
widget em modo "managed", expõe `token: Signal<string | null>` e `reset()`. Sem chave configurada
(`environment.turnstileSiteKey === ''`) não desenha nada e `token()` devolve `null`: as chamadas
seguem sem token. Não é overlay. O widget fica acima do botão principal; tema claro nas telas de
`/auth`, e o tema do app em `/app/conta`.

**Configuração**:
- `environment.ts` / `environment.prod.ts`: `turnstileSiteKey`. Em produção, vazio reprova
  `npm run check:prod-config`.
- `supabase/config.toml`: seção `[auth.captcha]` com `enabled = true`, `provider = "turnstile"` e
  `secret = "env(SUPABASE_AUTH_CAPTCHA_SECRET)"`. **Se a CLI recusar a seção ou as chaves, PARE e
  relate** (a página de configuração da CLI não as documenta; no projeto hospedado liga-se pelo
  painel).
- Desenvolvimento e E2E usam as **chaves de teste** do Turnstile (as que sempre aprovam). Copie-as
  da documentação da Cloudflare ("Testing"); não as escreva de memória. Nunca em produção.
- Testes que entram direto pela API (seed, `service_role`) não passam pelo desafio.

**CSP**: o Turnstile precisa de `https://challenges.cloudflare.com` em `script-src` e em
`frame-src`. Ver §3: entra na política das rotas do app e de `/auth`, **nunca** na da página da tag.

## 2. Limites de taxa que faltavam

Usam o limitador desta spec (`rate_limit_check`, `contracts/rate-limit.rpc.md`). Somam-se aos
existentes; nenhum existente muda.

| Escopo | O que conta | Chave | Limite | No estouro | Falha |
|---|---|---|---|---|---|
| `guard:ip:m` | toda chamada à Edge `login-guard` | `ip_hash` | 60 em 60 s | responde `{ decision: 'backoff', retry_after_seconds }` **sem** gravar tentativa nem auditoria | aberta |
| `otp:confirm:h` | toda chamada a `phone-verify-confirm` (inclusive `invalid_format` e `no_active`) | `user_id` | 30 em 3600 s | `rate_limited` | fechada |
| `acct:delete:h` | toda chamada a `account-delete`, **antes** do passo 3 | `user_id` | 10 em 3600 s | `rate_limited` | fechada |
| `recover:calls:ip` | toda chamada a `password-recovery` | `ip_hash` | 30 em 3600 s | `{ ok: true }` como sempre; **não** grava auditoria nem envia e-mail | fechada |

**`login-guard`** (código da `001`, alterado aqui):
- `detail` vindo do cliente é descartado, exceto as chaves `metodo` e `motivo`, cada uma com até
  40 caracteres de `[a-z_]`.
- `user_id` do corpo é ignorado. O ator da auditoria é o usuário do JWT, quando o pedido traz um
  JWT de usuário válido; senão, nulo.
- Corpo acima de 2 KB: `413`. Sem `HASH_SALT` (ou com menos de 16 caracteres): `500` e nenhum
  registro, em vez de usar sal vazio.
- A decisão continua sendo aplicada no navegador. Quem chama o Auth direto agora esbarra no
  desafio (§1) e nos limites nativos do Auth; é isso que fecha a lacuna declarada em
  `research.md` R13.3.

**Limites nativos do Auth**: os valores de `contracts/auth-config.contract.md` valem também no
projeto hospedado (checklist), não só no `config.toml`.

## 3. Cabeçalhos de segurança

**Fonte única**: `src/security-headers.ts` exporta `securityHeaders(kind: 'tag' | 'app')`.
`src/server.ts` usa a função; o `vercel.json` repete os mesmos valores, e
`npm run check:headers` (`scripts/security/check-headers.mjs`) reprova se os dois divergirem.
No `server.ts`, o middleware de cabeçalhos vem **antes** de `express.static` (hoje vem depois, e
os arquivos estáticos saem sem cabeçalho).

Duas políticas, por tipo de documento:

| Cabeçalho | `tag` (`/<código>` e as telas públicas da tag) | `app` (todo o resto) |
|---|---|---|
| `Content-Security-Policy` | a atual, mais `upgrade-insecure-requests`. Sem nenhum host de terceiro em `script-src` e sem `frame-src` | a atual, mais `upgrade-insecure-requests`, `https://challenges.cloudflare.com` em `script-src` e `frame-src https://challenges.cloudflare.com` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | igual |
| `Referrer-Policy` | `no-referrer` (o código da tag não vaza para o WhatsApp nem para o mapa) | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(self), camera=(), microphone=(), payment=(), usb=()` | `geolocation=(self), camera=(self), microphone=(), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` | `same-origin-allow-popups` |
| `Cross-Origin-Resource-Policy` | `same-origin` | `same-origin` |
| `X-Content-Type-Options`, `X-Frame-Options` | como hoje | como hoje |

- `camera=(self)` na política `app` corrige um conflito: hoje a câmera é negada para todo o site, e
  a `003` lê o QR pela câmera em "Vincular tag".
- **HSTS sem `preload`**: entrar na lista de pré-carregamento é, na prática, irreversível, e o
  domínio das tags não pode ter surpresa. Fica como decisão do William.
- **Navegação entre os dois mundos é sempre navegação completa.** A política vale para o documento
  carregado; uma troca de rota dentro do Angular não troca a política. Todo link da página da tag
  para o app (ativar, entrar) é `<a href>` comum, sem `routerLink`. As rotas públicas da tag não
  compartilham casca com o app.
- No `vercel.json`, as duas regras têm `source` **mutuamente exclusivos**. Antes de escrever,
  confira na documentação da Vercel como regras de cabeçalho sobrepostas se combinam; o teste de
  cabeçalhos no preview (T037A da `003`) é o que vale.
- `style-src 'unsafe-inline'` continua (decisão da `002`, R19).
- `upgrade-insecure-requests` e o HSTS só são emitidos quando o pedido chegou por HTTPS (produção
  e preview). Em `localhost` eles quebrariam a conversa com o Supabase local, que é HTTP.

## 4. Configuração do Supabase Auth

Acrescentar a `contracts/auth-config.contract.md`:

- Rotação de refresh token ligada, com intervalo de reuso de 10 s
  (`enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10`).
- Entrada anônima e vínculo manual de identidades desligados
  (`enable_anonymous_sign_ins = false`, `enable_manual_linking = false`).
- **Proteção contra senha vazada**: existe só no plano Pro do Supabase (conferido em 2026-11-21).
  Vai para o checklist; não bloqueia o desenvolvimento.
- **Sem tempo máximo de sessão nem saída por inatividade.** O tutor pode ficar meses sem abrir o
  app e voltar no dia em que o pet some; pedir login de novo nesse momento é o pior atrito
  possível. A troca de senha já encerra as outras sessões.
- Se a CLI recusar alguma chave acima: PARE e relate, como já manda o contrato de configuração.

## 5. Edge Functions

Valem para as quatro funções desta spec e para `login-guard`:

- `readJsonObject(req, maxBytes = 4096)`: confere `Content-Length` e também o tamanho lido; acima
  do limite, `413`. Corpo que não é objeto JSON: `400`.
- Chave desconhecida no corpo: `400` (`unknown_field`). Nada de repassar o corpo inteiro adiante.
- Só `POST` e `OPTIONS`. Qualquer outro método: `405` com os cabeçalhos de CORS do contrato.
- `verify_jwt` declarado **por função** no `config.toml`, não só no bloco global. `false` só em `login-guard` e
  `password-recovery` (pré-sessão); o que compensa o portão aberto é o próprio código: limite por IP (`guard:ip:m`, falha
  aberta por contrato no login-guard) e por conta, CORS por lista de origens, só `POST`/`OPTIONS`, corpo limitado e com
  chaves conhecidas, resposta única e piso de tempo na recuperação.
- Dependências fixadas: `supabase/functions/deno.json` com mapa de importação em **versão exata**,
  e `supabase/functions/deno.lock` versionado. Nenhum `https://esm.sh/...@2` flutuante.
- Resposta de erro nunca traz mensagem interna, pilha ou nome de tabela.

## 6. Banco: migration `0017_endurecimento_base.sql`

1. Privilégios padrão. São **dois** comandos, porque o `EXECUTE` de `PUBLIC` é um padrão global
   e só sai com um comando sem `IN SCHEMA`:
   `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;` e
   `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM
   anon, authenticated;`. O equivalente para tabelas e sequências: `REVOKE ALL … FROM anon`. A
   partir daqui, função nova só é chamável por quem recebe `GRANT` explícito. O teste do §9
   ("função criada sem `GRANT`") é o que comprova; se ele falhar, o papel dono das migrations não
   é `postgres`: descubra qual é e repita os comandos para ele.
2. `search_path` das funções `security definer` da `001` passa a `public, pg_temp`.
2A. **Tabelas que já existem.** O CI mostrou (2026-11-21) que `anon` e `authenticated` ainda têm
   `GRANT` de leitura e escrita em `perfis`, `auth_audit_log` e `auth_login_attempts`: hoje só a
   RLS os barra, e uma leitura devolve zero linhas em vez de erro. Acrescentar:
   `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;`,
   `REVOKE ALL ON public.auth_login_attempts FROM authenticated;` (só funções `security definer`
   tocam essa tabela) e
   `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.auth_audit_log FROM authenticated;`.
   **Em `auth_audit_log` o `SELECT` de `authenticated` fica**: a política da migration 0006 deixa o
   admin ler a auditoria, e tirar o privilégio quebraria a tela de auditoria. Em `perfis`,
   `authenticated` fica com o que a migration 0010 concede. Depois disso, nos testes da `001`:
   toda leitura de `anon` e a leitura de `auth_login_attempts` por `authenticated` voltam a exigir
   **erro `42501`** com `throws_ok`; a leitura de `auth_audit_log` por um tutor comum continua
   provando **zero linhas** (com a linha-semente), e a do admin continua provando que ele lê.
3. `ALTER ROLE anon SET statement_timeout = '3s';` e `ALTER ROLE authenticated SET
   statement_timeout = '8s';`.
4. `DROP EXTENSION IF EXISTS pg_graphql;`. No `config.toml`, `[api] schemas = ["public"]`. Nada no
   Faro usa GraphQL. **`max_rows` continua em 1000**: o limite vale também para `service_role` e
   cortaria em silêncio a geração de etiquetas e a exportação de um lote (até 540 códigos).

**Portão de catálogo**: `supabase/tests/security_catalog.test.sql` (pgTAP), que roda em toda spec
daqui em diante e falha se:
- alguma tabela de `public` estiver sem RLS;
- `anon` tiver qualquer privilégio em tabela de `public`;
- `anon` puder executar alguma função de `public` fora da lista permitida (hoje: vazia);
- alguma função `security definer` de `public` não tiver `search_path` fixo;
- existir política com `USING (true)` ou `WITH CHECK (true)` para `anon` ou `authenticated`.

## 7. Repositório, dependências e CI

O repositório do GitHub é **público**. Isso muda o peso de cada item abaixo.

- **`npm run check:secrets`** (`scripts/security/check-secrets.mjs`): varre os arquivos
  rastreados pelo git e, se existir, `dist/`. Reprova: JWT cujo conteúdo declara
  `"role":"service_role"`; chaves `sb_secret_…`; atribuição com valor a `FARO_SSR_KEY`,
  `IP_HASH_SECRET`, `PHONE_OTP_PEPPER`, `HASH_SALT`, `SUPABASE_AUTH_CAPTCHA_SECRET`; arquivo
  chamado `lote*.csv` ou `pins.csv`; CSV com a coluna `activation_pin`.
- **Gancho de pre-commit**: `.githooks/pre-commit` roda a mesma varredura só nos arquivos
  preparados; `npm run prepare` executa `git config core.hooksPath .githooks`.
- **`npm run check:audit`**: `npm audit --omit=dev --audit-level=high`. O spike da `002` encontrou
  57 vulnerabilidades na árvore inteira (3 críticas, 19 altas): a tarefa faz a triagem, atualiza o
  que sai sem quebrar e **registra** o que fica. Nada de `npm audit fix --force`.
- **`npm run check:templates`**: reprova `[innerHTML]`, `[outerHTML]` e `bypassSecurityTrust` em
  `src/app/` (o comentário do `eslint.config.js` promete essa regra, mas ela não existe).
- **`npm run check:prod-config`**: reprova build de produção com `turnstileSiteKey` vazio, com
  URL do Supabase apontando para `localhost`, ou com qualquer `*_STUB_*` no ambiente.
- **CI** (o arquivo base, com os dois jobs, é criado **antes** desta spec começar, porque todo
  "Feito quando" de banco depende dele; aqui ele ganha os `check:*` novos):
  `.github/workflows/ci.yml`, em todo PR e em push para `develop`, `homolog` e `master`:
  `npm ci`, `lint`, `test`, `build` e todos os `check:*`. Um segundo job sobe o Supabase local
  (`supabase/setup-cli` + `supabase start`) e roda `supabase test db` e `deno test`. **Esse job é
  o único lugar em que os testes de banco rodam enquanto a máquina de desenvolvimento não tiver
  Docker.** Ações fixadas por hash de commit; `permissions: contents: read`.
- **`.github/dependabot.yml`**: `npm` e `github-actions`, semanal.

## 8. O que este contrato não cobre

- **Segundo fator para o admin.** Uma conta de admin gera lotes e reemite PINs: é o alvo mais
  valioso do sistema. Exigir TOTP para o papel admin é a proteção certa, mas é funcionalidade
  nova (telas de cadastro e de desafio do segundo fator). **Recomendado antes de abrir; depende de
  decisão do William.**
- HSTS com `preload`, e tornar o repositório privado: decisões do William.
- Provedores de e-mail e de SMS (`TODO(EMAIL_PROVIDER)`, `TODO(SMS_PROVIDER)`).

## 9. Testes obrigatórios

- Unitário: `app-turnstile` sem chave não carrega script nenhum; com chave, carrega uma vez e
  `reset()` zera o token.
- `deno test`: cada linha da tabela do §2 (o estouro devolve o que a tabela diz e não grava o que
  ela proíbe); corpo de 5 KB ⇒ `413`; chave desconhecida ⇒ `400`; `login-guard` ignora `user_id` e
  `detail` fora da lista.
- pgTAP: `security_catalog.test.sql` verde; uma função criada sem `GRANT` não é executável por
  `authenticated`.
- E2E (`e2e/security/headers.spec.ts`): cada cabeçalho do §3 em `/`, em `/auth/login` e num
  arquivo estático; nenhum pedido a host de terceiro em `/` além dos permitidos.
- E2E (`e2e/security/captcha.spec.ts`), com as chaves de teste: entrar, criar conta, recuperar
  senha e reenviar confirmação funcionam; com a chave de teste que **sempre reprova**, cada um
  mostra `captcha_failed` e nenhum conta como tentativa de senha errada.
- `check:secrets` reprova um arquivo de exemplo com um JWT `service_role` falso e um `pins.csv`
  falso (criados e apagados pelo próprio teste).
