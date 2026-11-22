# Implementation Plan: Conta do tutor

**Branch**: `004-conta-tutor` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-conta-tutor/spec.md` (Status: Draft, sem `[NEEDS CLARIFICATION]`)

## Summary

Entregar tudo o que a conta do tutor precisa no MVP e que a `001-login` deixou de fora:
boas-vindas, cadastro (e-mail e senha ou Google), confirmação de e-mail, confirmação do celular
por SMS, recuperação de senha e a seção **Conta** (dados pessoais, celular, senha, aparência,
privacidade com exportar e excluir, sair).

Abordagem técnica:

- **Supabase Auth** continua sendo a fonte de identidade: cadastro, confirmação de e-mail, troca e
  recuperação de senha. Os e-mails apontam para rotas do app com `token_hash`, e a confirmação só
  acontece por ação da pessoa (funciona em outro aparelho e resiste a leitores que abrem links).
- **Confirmação do celular própria**: duas Edge Functions + tabela `phone_verifications` + funções
  SQL `security definer`. O código é guardado como HMAC com chave que só existe na função;
  conferência e contagem de tentativas na mesma chamada de servidor; limites por conta, por número,
  por origem e global. O telefone **não** vira credencial. Provedor atrás de uma porta
  (`TODO(SMS_PROVIDER)`).
- **`public.perfis` estendida** com celular, celular pendente e aceite dos termos, protegida por
  **privilégio de coluna**: o tutor só altera `nome`. `perfis.celular` só guarda número confirmado
  e é a coluna que a `003` lê.
- **Exportar** por RPC; **excluir** por Edge Function que chama a operação da `003`
  (`end_assignments_for_account`) antes de apagar o usuário, com **falha fechada**.
- **Auditoria** em `auth_audit_log` (reuso da `001`), com os eventos entre navegador e Auth
  capturados por **gatilhos** em `auth.users`, não por relato do cliente.
- **Frontend**: telas em `features/auth/`, `features/account/` e `features/legal/`, serviços em
  `core/auth/` e `core/account/`, sobre as cascas e componentes da `002`.

Decisões e alternativas: [research.md](./research.md). Modelo: [data-model.md](./data-model.md).
Contratos: [contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript estrito; Angular **21.2** (standalone, signals, zoneless);
SSR híbrido `@angular/ssr` 21.2. Edge Functions em **Deno** (runtime do Supabase). SQL do
Postgres 15 (PL/pgSQL).
**Primary Dependencies**: `@supabase/supabase-js` ^2.108; **ZardUI + Tailwind CSS v4** e Boxicons
via `@ng-icons/core` 34.x (entregues pela `002`); `@angular/forms` (Reactive Forms tipados);
`@angular/localize`. `pgcrypto` (já habilitada). **Nenhuma dependência nova de runtime.**
**Storage**: Supabase Postgres (região São Paulo). Estende `public.perfis`; cria
`public.phone_verifications` e `public.rate_limit_events`; reutiliza `public.auth_audit_log`.
Identidade no schema `auth` (nativo). Supabase Storage só é tocado na exclusão (bucket
`pet-photos` da `003`).
**Identity/Auth**: Supabase Auth, provedores e-mail (com confirmação) e Google. `[auth.sms]`
**desligado**.
**Testing**: **Vitest** (serviços, guards, telas); **pgTAP** (`supabase test db`: RLS, privilégios
de coluna e de função, máquina de estados, gatilhos); **`deno test`** (lógica pura das Edge
Functions e de `_shared/`); **Playwright** (cadastro → e-mail → celular com SMS simulado;
recuperação; conta), com axe.
**Target Platform**: web responsiva, três larguras (base, `md` 768, `xl` 1280). `/auth/**` e
`/app/**` em `RenderMode.Client`; `/legal/**` pré-renderizado. Vercel (SSR), domínio `tagfaro.com.br`.
**Project Type**: aplicação web única (frontend em `src/`, backend em `supabase/`).
**Performance Goals**: cadastro + e-mail + celular em ≤ 3 min (SC-001); SMS entregue em ≤ 30 s
(p95, depende do provedor); exportação em ≤ 10 s (SC-010); telas de `/auth` interativas em ≤ 3 s
em 4G.
**Constraints**: respostas indistinguíveis para e-mail com e sem conta (SC-004); limites
impositivos no servidor (FR-054); nenhum código, senha, link, telefone ou e-mail em claro em log
ou auditoria; segredos só em Edge Functions; **zero dependência nova na rota pública** (FR-058);
fluxos de `/auth` sempre claros; WCAG 2.1 AA.
**Scale/Scope**: 18 rotas (10 de fluxo, 6 de conta, 2 legais); 2 tabelas novas e 5 colunas; 15
funções SQL; 4 Edge Functions; 9 migrations (0008–0016) + 3 reservadas; dezenas de milhares de
contas no horizonte do MVP.

### Decisões de segurança concretas

| Tema | Decisão | Risco residual |
|---|---|---|
| Quem pode disparar SMS | Só conta autenticada, com e-mail confirmado e aceite registrado, pela função `phone-verify-start`. `[auth.sms]` desligado: não há outro endpoint de SMS. | Contas reais e confirmadas podem gastar até o teto diário global (500). |
| Guarda do código SMS | `HMAC-SHA256(PHONE_OTP_PEPPER, conta \| número \| código)`. A chave fica só no ambiente da função e nunca é enviada ao banco. Falha fechada se faltar. | Vazamento simultâneo do banco **e** do segredo da função durante os 10 min de validade. |
| Adivinhação do código | 5 tentativas por código, 10 códigos por 24 h por conta, conferência com a linha travada. | 1 em 20.000 por conta por dia. |
| Autoconfirmação | `perfis`: `UPDATE` só da coluna `nome` para `authenticated`. Celular, confirmação e aceite só por função `security definer`. | Um operador com acesso de banco pode alterar (fora do modelo de ameaça do app). |
| Telefone como credencial | Não é. Nenhum provedor de telefone no Auth. | — |
| Enumeração no cadastro | Resposta ofuscada do Auth (`enable_confirmations`) + tempo mínimo de 1,2 s na tela. | Quem chama o Auth direto pode medir o tempo. `TODO(CAPTCHA)`. |
| Enumeração na recuperação | Edge `password-recovery`: resposta fixa, piso de 600 ms, envio em segundo plano. | Idem acima para chamada direta a `/recover`. |
| Limite de pedidos de recuperação | 3/h por e-mail e 10/h por origem na Edge; no Auth, 60 s por usuário e teto global por hora. | Chamada direta ao Auth ignora o limite da Edge; pode esgotar o teto global de e-mails. `TODO(CAPTCHA)`. |
| Links de e-mail | `token_hash` para rota do app; consumo só no clique; 1 hora; uso único; sem PKCE. | Acesso à caixa de e-mail da pessoa. |
| Destino de retorno | Só caminho interno (`sanitizeReturnUrl`); nunca autoriza. | — |
| Ações sensíveis (trocar celular confirmado, excluir conta) | Nova prova de identidade no servidor: senha atual, ou login com o Google há ≤ 10 min. 5 erros / 15 min. | Sessão roubada **e** senha conhecida. |
| Troca de senha | Senha atual pela tela (com o limite do `login-guard`) + `secure_password_change` no Auth; encerra as outras sessões. | A trava de servidor é de 24 h. |
| Exclusão de conta | Vínculos e scans pela operação da `003` **antes** de apagar o usuário; falha fechada se a operação faltar; passos idempotentes. | Falha entre os passos deixa uma conta vazia até a pessoa repetir. |
| Auditoria | `log_auth_event` deixa de ser executável por `anon`/`authenticated` (0009). Eventos do Auth por gatilho. | `logout` continua sendo relato do cliente (só afeta a própria trilha). |
| SMS simulado | `stub`/`log` só com `FARO_ENV` explicitamente `local` ou `test`. | Erro de configuração que marque produção como `test`. Checklist de produção cobre. |
| Metadados do usuário | Graváveis pelo cliente: nunca autorizam; `papel` ignorado; telefone removido no primeiro envio de SMS. | — |

## Constitution Check

*GATE: passa por cada princípio da constituição **v2.0.0**. Reavaliado depois do desenho (Fase 1): mantém-se.*

### I. Segurança do Pet Acima de Tudo (Rescue-First) — NÃO-NEGOCIÁVEL — PASS

- Nada desta feature toca a rota `/:code`, `resolve_tag` ou `features/public`. Nenhum guard,
  sessão, SMS ou e-mail é exigido para ler uma tag (FR-058, SC-012).
- A fronteira de lint da `002` ganha `core/account` e `features/legal` na lista proibida para
  `features/public`.
- **Troca de celular nunca deixa o pet sem contato**: `perfis.celular` mantém o número antigo até
  o novo ser confirmado.
- Provedor de SMS ou de e-mail fora do ar só afeta cadastros novos; tags já ativas seguem
  funcionando.
- A exclusão de conta devolve as tags a "disponível" pela operação da `003`; a página delas
  continua resolvendo (como "tag não ativada").
- Nenhuma regra de cobrança ou de limite de uso entra aqui.

### II. Privacidade & LGPD por Design — NÃO-NEGOCIÁVEL — PASS

- **Minimização**: nome, e-mail e celular. Sem CPF, endereço ou nascimento (FR-002).
- **Telefone público só depois de confirmado**: garantido pelo invariante de `perfis.celular` e
  pelo fato único `phone_is_confirmed`.
- **Direitos do titular**: `export_my_data` (exportar) e `account-delete` (excluir) no MVP.
- **Consentimento auditável**: versão e data do aceite em `perfis` e evento `termos_aceitos`, nos
  dois caminhos de cadastro.
- **Hashes, não dados**: códigos e números em `phone_verifications` só como HMAC; IP e e-mail em
  limites e auditoria só como hash; `detalhe` sem dado pessoal.
- Telefone removido dos metadados do usuário depois de copiado para o perfil.
- Pendência herdada da constituição: janela de retenção da auditoria (`TODO(RETENCAO)`).

### III. Segurança em Profundidade & RLS-First — NÃO-NEGOCIÁVEL — PASS

- Tabelas novas com RLS na mesma migration, sem política permissiva; `anon` sem acesso a nada.
- Funções novas com `REVOKE … FROM PUBLIC, anon, authenticated` + `GRANT` exato; **corrige** as
  duas funções da `001` que estavam abertas (0009).
- Privilégio de coluna em `perfis` (0010); o tutor nunca altera `papel`, celular ou aceite.
- Segredos (`PHONE_OTP_PEPPER`, chave do provedor de SMS, `service_role`) só em Edge Functions.
- Não trata de códigos de tag nem de PIN (são da `003`); não enfraquece nenhum controle deles.
- Limites impostos no ponto que executa a ação; riscos residuais dos pontos que o Auth expõe estão
  declarados acima.

### IV. Spec-Driven Development — PASS

- `spec.md` sem stack → este `plan.md` → `tasks.md`. Decisões técnicas só aqui e em `research.md`.
- A implementação só começa depois da aprovação do dono (`CLAUDE.md`).

### V. Mobile-First, Performance & Acesso Universal — PASS

- Toda tela em três larguras, sobre as cascas da `002`.
- `/auth/**` sempre claro; "Conta" acompanha o tema do app; a tela de Aparência só chama o
  `ThemeService` da `002`.
- Nenhuma rota pública nova em SSR dinâmico; `/legal/**` é pré-renderizado. Sem service worker.
- WCAG 2.1 AA: axe no E2E, foco visível, alvos de 44 px, erros em `aria-live`, código por SMS com
  `autocomplete="one-time-code"`. Textos por `i18n`/`$localize`.

### VI. Simplicidade & Entrega Incremental — PASS (com dois desvios justificados)

- Seis histórias independentes (P1, P1, P2, P2, P2, P3).
- Nenhuma dependência nova de runtime. Nada de planos, cobrança, MFA, troca de e-mail.
- Dois desvios de simplicidade em Complexity Tracking: verificação de celular própria e Edge
  Function de recuperação.

### VII. Observabilidade, Auditoria & Confiabilidade — PASS

- 12 eventos novos + `logout` (fechando a lacuna da `001`), todos em `auth_audit_log`.
- Gatilhos de auditoria nunca derrubam operações do Auth.
- Todo erro tem mensagem amigável e próximo passo (FR-062); falha de SMS não tranca o app.
- "Acessos e exclusões de dados" (texto do princípio): `dados_exportados` e `conta_excluida`.

### VIII. O Que É Impresso É Para Sempre — NÃO-NEGOCIÁVEL — PASS

- Esta feature **não altera** domínio, URL, formato, normalização nem QR.
- **Excluir conta não apaga código**: `delete_account_data` não toca `tag_codes`; quem encerra
  vínculos é a operação da `003`, que por contrato não apaga nem altera códigos. Teste de
  integração confere que o código continua existindo com o mesmo valor (SC-009).
- Rotas novas ficam sob `/auth`, `/app` e `/legal` (dois segmentos): nenhuma compete com `/:code`.

**Resultado do GATE: APROVADO.** Sem violação de princípio. Dois desvios de simplicidade
registrados abaixo.

## Project Structure

### Documentation (this feature)

```text
specs/004-conta-tutor/
├── spec.md
├── plan.md                              # este arquivo
├── research.md                          # R1–R16 + pendências
├── data-model.md                        # colunas, restrições, funções, matriz de RLS
├── quickstart.md                        # rodar, validar, checklist de produção
├── checklists/requirements.md
├── contracts/
│   ├── shared-edge.contract.md          # _shared/: resposta, env, hash, telefone, código, SMS, reauth
│   ├── rate-limit.rpc.md                # rate_limit_check
│   ├── phone-verification.rpc.md        # funções SQL do celular + phone_is_confirmed
│   ├── phone-verify-start.edge.md
│   ├── phone-verify-confirm.edge.md
│   ├── account.rpc.md                   # handle_new_user, accept_terms, log_logout, my_account, account_auth_facts, gatilho de auditoria
│   ├── password-recovery.edge.md        # pedido + troca de senha
│   ├── account-export.rpc.md            # export_my_data
│   ├── account-delete.edge.md           # account-delete + delete_account_data
│   ├── auth-config.contract.md          # config.toml, modelos de e-mail, segredos
│   ├── frontend-services.contract.md    # rotas, guards, serviços, telas, textos, data-testid
│   ├── cross-spec-003.contract.md       # interface com a 003
│   └── rls-expectations.md              # matriz e lista do portão de segurança
└── tasks.md
```

### Source Code (repository root) — caminhos reais

```text
src/app/
├── app.routes.ts                        # ALTERAR: rotas de /auth (guards por rota), /app/conta, /legal
├── app.routes.server.ts                 # ALTERAR: auth/** Client, legal/* Prerender
├── core/
│   ├── auth/
│   │   ├── auth.guard.ts                # ALTERAR: boas-vindas x login
│   │   ├── auth.service.ts              # ALTERAR (mínimo): expor o que PostAuthNavigator precisa
│   │   ├── guards.spec.ts               # ALTERAR: casos novos
│   │   ├── return-url.ts                # NOVO (+ .spec.ts)
│   │   ├── returning-visitor.ts         # NOVO (+ .spec.ts)
│   │   ├── post-auth-navigation.ts      # NOVO (+ .spec.ts)
│   │   ├── terms.guard.ts               # NOVO (+ .spec.ts)
│   │   ├── registration.service.ts      # NOVO (+ .spec.ts)
│   │   └── password.service.ts          # NOVO (+ .spec.ts)
│   └── account/                         # NOVO
│       ├── terms.ts
│       ├── phone.ts                     # (+ .spec.ts)
│       ├── account.store.ts
│       ├── account.service.ts           # (+ .spec.ts)
│       ├── phone-verification.service.ts# (+ .spec.ts)
│       ├── privacy.service.ts           # (+ .spec.ts)
│       └── phone-confirmed.guard.ts     # (+ .spec.ts) — usado pela 003
├── features/
│   ├── auth/
│   │   ├── login/                       # ALTERAR: links reais, voltar, PostAuthNavigator
│   │   ├── callback/oauth-callback.ts   # ALTERAR: PostAuthNavigator
│   │   ├── welcome/                     # NOVO  welcome.ts, .html, .spec.ts
│   │   ├── signup/                      # NOVO
│   │   ├── confirm-email/               # NOVO
│   │   ├── accept-terms/                # NOVO
│   │   ├── phone-entry/                 # NOVO
│   │   ├── confirm-phone/               # NOVO
│   │   ├── forgot-password/             # NOVO
│   │   └── reset-password/              # NOVO
│   ├── account/                         # NOVO
│   │   ├── account.routes.ts
│   │   ├── account-home/
│   │   ├── personal-data/
│   │   ├── phone/
│   │   ├── password/
│   │   ├── appearance/
│   │   └── privacy/                     # privacy.ts + delete-account-dialog.ts
│   └── legal/                           # NOVO
│       ├── terms/
│       └── privacy-policy/
└── (shared/ e core/theme/ vêm da 002 — não editar)

supabase/
├── config.toml                          # ALTERAR (contracts/auth-config.contract.md)
├── .env.local.example                   # ALTERAR
├── templates/                           # NOVO
│   ├── confirmation.html
│   └── recovery.html
├── migrations/
│   ├── 0008_enum_eventos_conta.sql
│   ├── 0009_hardening_funcoes_auth.sql
│   ├── 0010_perfis_conta.sql
│   ├── 0011_rate_limit_events.sql
│   ├── 0012_funcoes_conta.sql
│   ├── 0013_auditoria_auth_users.sql
│   ├── 0014_phone_verifications.sql
│   ├── 0015_funcoes_celular.sql
│   └── 0016_conta_privacidade.sql       # 0017–0019 reservadas
├── functions/
│   ├── _shared/                         # NOVO: http.ts env.ts hash.ts ip.ts phone.ts otp.ts clients.ts audit.ts reauth.ts
│   │   └── sms/sender.ts                #       (+ *.test.ts)
│   ├── phone-verify-start/              # NOVO: index.ts logic.ts logic.test.ts
│   ├── phone-verify-confirm/            # NOVO
│   ├── password-recovery/               # NOVO
│   ├── account-delete/                  # NOVO
│   └── login-guard/index.ts             # ALTERAR: só CORS (shared-edge.contract.md)
└── tests/                               # NOVO: 7 arquivos pgTAP (contracts/rls-expectations.md)

e2e/
├── support/mailbox.ts                   # NOVO: lê o coletor de e-mails local
├── signup-confirm-phone.spec.ts         # NOVO
├── password-recovery.spec.ts            # NOVO
└── account.spec.ts                      # NOVO

eslint.config.js                         # ALTERAR: core/account e features/legal na fronteira de features/public
```

**Structure Decision**: mesma estrutura do repositório e do `CLAUDE.md`. Telas de entrada e
cadastro em `features/auth/`; a seção Conta em `features/account/`; acesso a dados só por serviços
de `core/`. `core/account/` é novo e separado de `core/auth/` porque a `003` consome dele
(`phoneConfirmedGuard`, `AccountStore.phoneConfirmed`) sem depender do fluxo de autenticação.
Edge Functions compartilham `_shared/` (a `003` também usa essa pasta, com outros arquivos).
Nomes de pasta e de código em inglês; textos em PT-BR; `data-testid="<feature>-<elemento>"`.

## Complexity Tracking

> Nenhuma violação de princípio. Dois desvios de simplicidade (Princípio VI) e uma exceção de
> regra interna, todos justificados.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **Verificação de celular própria** (2 Edge Functions, 1 tabela, 6 funções SQL) em vez do OTP por telefone do Supabase Auth | Limites por conta **e** por número, contador de tentativas por código, auditoria direta, nenhum endpoint de SMS fora do nosso limitador, e o telefone não virar credencial nem chave única | O Auth nativo, ao habilitar o provedor de telefone, abre envio de SMS e login por código a qualquer um com a chave pública, torna o número único por conta e não tem "5 tentativas por código". Ver `research.md` R3 |
| **Edge Function `password-recovery`** na frente do `resetPasswordForEmail` | Limite determinístico por e-mail e por origem, resposta e tempo uniformes, auditoria também de pedidos para e-mails sem conta | Chamar o Auth direto da tela deixaria o limite por origem a cargo de um teto global e o tempo de resposta dependente de a conta existir. A função não fecha o endpoint do Auth (risco residual declarado) |
| **`EXECUTE` de SQL constante** em `delete_account_data` e `export_my_data` (exceção à regra "sem SQL dinâmico") | As funções da `003` nascem em migrations posteriores (0020+); a chamada tem de ser resolvida em tempo de execução, com falha fechada | Criar funções vazias na `004` para a `003` substituir: se a `003` esquecesse, a exclusão passaria a não encerrar vínculos **em silêncio** |
| **Gatilho `AFTER UPDATE` em `auth.users`** para auditoria | Único jeito de registrar confirmação de e-mail e troca de senha sem confiar no cliente | Relato pelo cliente (como o `login-guard` faz com o resultado do login) é forjável e pode ser omitido |

> MFA e troca de e-mail fora do MVP **não** são desvios. O desenho não os impede: o Auth tem TOTP
> nativo, e `perfis.email` é só espelho.
