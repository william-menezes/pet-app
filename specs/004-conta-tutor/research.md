# Research — Conta do tutor (004-conta-tutor)

**Fase 0 do plano.** Decisões de stack que materializam a spec, com as alternativas consideradas e
o risco residual de cada uma. Preferência permanente do dono: **explicitar o trade-off de
segurança e tender ao endurecimento**, não ao padrão conveniente.

Lido antes de decidir: constituição v2.0.0, `CLAUDE.md`, `docs/decisoes-pivo.md`, `DESIGN.md`,
`specs/001-login/*`, `supabase/migrations/0001…0007`, `supabase/functions/login-guard/`,
`src/app/core/auth/*`, `specs/003-tag-qr/{spec,plan,data-model,research}.md` e seus contratos.

---

## R1. Ordem do fluxo: e-mail primeiro, celular depois

**Decisão**: Criar conta → "Confirme seu e-mail" → (link) → Confirmar celular → destino de retorno.

**Por quê**: a `001-login` exige e-mail confirmado para entrar (FR-024), e o Supabase Auth com
`enable_confirmations = true` **não devolve sessão** no cadastro. Sem sessão não há identidade
confiável para pedir um SMS. O discriminador de segurança é: *um chamador não verificado consegue
disparar SMS?* A resposta endurecida é **não**. Só uma conta autenticada, com e-mail confirmado e
termos aceitos, chega ao envio.

**Alternativas rejeitadas**:
- *Celular antes do e-mail* (ordem da tela aprovada): exigiria um endpoint de SMS aberto a
  anônimos, porta para "SMS pumping" (disparo em massa pago por nós) e para assédio a números de
  terceiros.
- *Sessão antes de confirmar o e-mail* (desligar `enable_confirmations` e impor a regra por conta
  própria): contradiz o que a `001` já implementa e testa.

**Consequência para o design**: a tela aprovada "Criar conta" leva a "Confirmar celular"; passa a
existir uma etapa entre as duas, sem tela aprovada. Registrado em Clarifications da spec.

## R2. Confirmação de e-mail e recuperação: link com `token_hash`, consumido só por ação da pessoa

**Decisão**: os modelos de e-mail do Supabase Auth apontam para **rotas do app**, não para
`/auth/v1/verify`:

- confirmação: `{{ .SiteURL }}/auth/confirmar-email?token_hash={{ .TokenHash }}&type=email`
- recuperação: `{{ .SiteURL }}/auth/nova-senha?token_hash={{ .TokenHash }}&type=recovery`

A página chama `supabase.auth.verifyOtp({ token_hash, type })` **só quando a pessoa aciona o
botão** ("Confirmar meu e-mail" / "Salvar nova senha").

**Por quê**:
- Funciona em **outro aparelho ou navegador**. O fluxo PKCE guardaria um verificador no navegador
  de origem e quebraria exatamente o caso que a `003` exige (research §8 dela).
- **Leitores de e-mail e antivírus abrem links sozinhos.** Com o link padrão (`/verify`), a
  simples abertura consome o token de uso único. Aqui, abrir o endereço não consome nada.
- Nenhum token de sessão trafega no fragmento da URL.

**Validade**: `otp_expiry = 3600` (1 hora). A chave é **única** para todos os e-mails do Auth; não
dá para ter 24 h na confirmação e 1 h na recuperação. Escolhido o valor mais curto.

**Alternativas rejeitadas**:
- *Código de 6 dígitos por e-mail digitado no app*: mantém a pessoa na mesma aba, mas abre uma
  superfície de adivinhação (1 em 10⁶ por tentativa, limitada só por IP no Auth). Rejeitado no MVP.
- *Verificar ao carregar a página*: um clique a menos, mas vulnerável a pré-carregadores que
  executam JavaScript.

**Risco residual**: quem tem acesso à caixa de e-mail da pessoa confirma a conta ou troca a senha.
Inerente a qualquer fluxo por e-mail.

## R3. Confirmação do celular: Edge Functions próprias + `phone_verifications`

**Decisão**: implementação **própria**. Duas Edge Functions (`phone-verify-start`,
`phone-verify-confirm`), tabela `phone_verifications` e funções SQL `security definer` chamadas só
com `service_role`. O número confirmado mora em `public.perfis`.

**Opções testadas contra as restrições**:

| Restrição | Supabase Auth (`updateUser({phone})` + `verifyOtp phone_change`) | Edge Function própria |
|---|---|---|
| Limite por conta **e** por número, contador de tentativas por código | Só intervalo por usuário e teto global `sms_sent`; sem "5 tentativas por código" | Sim, determinístico e testável (pgTAP) |
| Nenhum endpoint de SMS fora do nosso limitador | **Não**: habilitar o provedor de telefone abre `/otp` e `/signup` por telefone a qualquer um com a chave pública | Sim: só a nossa função conhece a chave do provedor |
| Telefone não vira credencial | **Não**: o telefone confirmado passa a aceitar login por código de 6 dígitos (troca de chip = tomada de conta sem senha) | Sim: o telefone é só um dado de contato |
| Mesmo número em mais de uma conta | **Não**: `auth.users.phone` é único (e isso vira oráculo de "número já cadastrado") | Sim |
| Auditoria em `auth_audit_log` | Indireta | Direta |
| Liberdade de provedor (`TODO(SMS_PROVIDER)`) | Sim, via Send SMS Hook | Sim, por uma porta `SmsSender` |
| Quantidade de código nosso | Pouca | Mais (2 funções, 1 tabela, ~6 funções SQL) |

O Auth nativo perde em três das quatro restrições de segurança. O custo é mais código, registrado
em Complexity Tracking.

**Detalhes de segurança da solução própria**:

- **Código**: 6 dígitos gerados com `crypto.getRandomValues` e amostragem por rejeição (sem viés).
- **Armazenamento**: `code_hash = HMAC-SHA256(PHONE_OTP_PEPPER, user_id | phone_e164 | code)`.
  Um hash simples de 6 dígitos é reversível em milissegundos; a proteção vem da **chave**, que
  fica só no ambiente da função e nunca vai ao banco (nem como parâmetro de RPC). Se a chave
  faltar ou tiver menos de 32 caracteres, a função **falha fechada** (`500 misconfigured`).
- **Conferência e contagem na mesma chamada de servidor**, com a linha travada (`FOR UPDATE`).
  Não se repete o desenho do `login-guard` (resultado relatado pelo cliente, falha aberta).
- **Validade** 10 min, **5 tentativas** por código, **um** código ativo por conta.
- **Só +55**, só celular (`^\+55[1-9][0-9]9[0-9]{8}$`), validado na função e por `CHECK` no banco.
- **Limites** (função SQL `rate_limit_check`, com `pg_advisory_xact_lock`): intervalo de 60 s;
  5/h e 10/24 h por conta; 5/24 h por número (HMAC do número); 30/h por origem (hash do IP);
  teto global diário `SMS_DAILY_CAP` (padrão 500).
- **Falha fechada**: erro ao consultar o limitador ⇒ não envia.
- **Texto do SMS** sem acentos, para caber num segmento GSM-7, com a linha de vínculo de origem
  para preenchimento automático: `Faro: seu codigo e 482913. Vale por 10 minutos. Nao compartilhe.`
  seguido de `@tagfaro.com.br #482913`.
- **Provedor simulado**: `SMS_DRIVER=stub|log` só é aceito quando `FARO_ENV` é **explicitamente**
  `local` ou `test`. Qualquer outro valor, ou ausência, recusa esses drivers. Sem provedor real
  configurado, a função responde `sms_unavailable` (não envia, não finge).

**Adivinhação do código**: no máximo 10 códigos por 24 h × 5 tentativas = 50 palpites em 10⁶ ⇒
1 em 20.000 por dia por conta (a meta SC-006 é 1 em 4.000).

**Risco residual**: interceptação de SMS (troca de chip, SS7) permite confirmar um número que não
é do atacante **na conta do atacante**, o que não dá acesso à conta de ninguém. Um atacante com
várias contas confirmadas consegue gastar até o teto diário de SMS; o teto limita o prejuízo.

### `TODO(SMS_PROVIDER)`

> **Decisão do William em 2026-11-21**: o SMS será contratado numa **conta Google**, que ainda
> **não está ativada**. O produto exato fica a confirmar. **Atenção ao encaixe**: a verificação de
> telefone do Google (Firebase Authentication / Identity Platform) costuma gerar e conferir o
> código do lado dela, enquanto esta spec gera, guarda o hash e confere o código na nossa função,
> atrás da porta `SmsSender`. Se o produto escolhido não permitir enviar um texto nosso, o driver
> real deixa de ser um "enviador" e passa a ser um "verificador", e `phone-verify-start` /
> `confirm_phone` precisam de um ajuste de contrato. **Conferir na documentação do Google antes de
> escrever o driver; nada disso muda o desenvolvimento, que usa os drivers `log` e `stub`.**
> Enquanto não houver provedor: desenvolvimento e homologação usam `SMS_DRIVER=stub` com
> `FARO_ENV=test`; **produção não abre**, porque ativar tag exige celular confirmado.

O provedor fica atrás da porta `SmsSender` (`supabase/functions/_shared/sms/`). Critérios:

1. **Custo por SMS** entregue no Brasil (rota transacional, não promocional).
2. **Entrega**: taxa e tempo (p95 < 30 s) nas operadoras Vivo, Claro, TIM e Oi/Algar; relatório
   de entrega (DLR).
3. **LGPD**: contrato de operador, local de processamento, retenção do conteúdo da mensagem
   (ideal: sem guardar o corpo), sub-operadores.
4. **Remetente**: número curto ou remetente identificado; conformidade com as regras das
   operadoras para código de verificação.
5. **Operação**: API HTTP simples, chave por ambiente, limite de gasto configurável.

Candidatos a avaliar (sem preferência registrada): Zenvia, Twilio, Infobip, AWS SNS (sa-east-1),
Comtele. Enquanto não houver escolha, **produção não envia SMS** e a ativação de tags fica
bloqueada para contas novas. Esse é o item que precisa ser fechado antes do lançamento.

## R4. Onde mora o celular: estender `public.perfis`, protegido por privilégio de coluna

**Decisão**: novas colunas em `perfis`: `celular`, `celular_confirmado_em`, `celular_pendente`,
`termos_aceitos_em`, `termos_versao`. Invariante por `CHECK`: `celular` e `celular_confirmado_em`
são nulos juntos ou preenchidos juntos. **`perfis.celular` só contém número confirmado.**

**Achado**: a política `perfis_self_update` (0006) só fixa `papel`. Com as colunas novas, um tutor
poderia fazer `update perfis set celular = …, celular_confirmado_em = now()` e burlar o SMS,
falsificando o fato que a `003` consome. O espelho `email` tem o mesmo furo hoje.

**Correção (0010)**: `REVOKE UPDATE … FROM authenticated` e `GRANT UPDATE (nome)`. Privilégio de
coluna é verificado antes da RLS; a política continua valendo para as linhas. `INSERT`, `DELETE` e
`TRUNCATE` são revogados de `anon` e `authenticated`. Só as funções `security definer` do caminho
de verificação escrevem celular, confirmação e aceite. Teste pgTAP negativo obrigatório: "tutor
não consegue marcar o próprio celular como confirmado".

**Efeito colateral aceito**: um admin deixa de poder alterar `papel` pelo cliente. Promoção a admin
já era operação manual por SQL; a `003` não depende disso.

**Alternativa rejeitada**: tabela `tutor_phones` paralela. Mais uma junção para a `003` ler na
página pública, sem ganho.

## R5. Como nome, celular e aceite chegam ao perfil no cadastro

**Decisão**: `supabase.auth.signUp({ email, password, options: { data } })` com
`data = { name, phone, terms_version, return_to, return_to_at }`. O gatilho `handle_new_user`
(substituído em 0012) copia para `perfis`: `nome`, `celular_pendente` (só se o formato for
válido; formato inválido vira `NULL`, nunca derruba o cadastro), `termos_aceitos_em = now()` e
`termos_versao`. O gatilho **continua fixando** `papel = 'tutor'`.

**Minimização**: `raw_user_meta_data` vai dentro do JWT. Para não manter o telefone ali, a função
`phone-verify-start` remove a chave `phone` dos metadados (API de admin) no primeiro envio, e a
`phone-verify-confirm` repete a remoção. `return_to` é removido pelo app depois de usado.

**Alternativa rejeitada**: uma Edge Function de cadastro que recebe a senha e cria o usuário pela
API de admin. Daria controle total, mas obriga a enviar o e-mail de confirmação por conta própria
(sem `TODO(EMAIL_PROVIDER)` fechado) e põe a senha em trânsito por mais um serviço.

**Contas criadas pelo Google** não trazem `terms_version` nem `phone`: o perfil nasce sem aceite e
sem celular, e o app conduz às telas de aceite e de celular (R7).

## R6. Destino de retorno

**Decisão**: `ReturnUrlService` em `core/auth/`:

1. Toda tela de `/auth/*` aceita `?returnUrl=`; o serviço **sanitiza** e guarda em
   `sessionStorage` (`faro.returnUrl`).
2. No cadastro por e-mail, o destino também vai nos metadados do usuário (`return_to`,
   `return_to_at`), como a `003` espera. É a parte que sobrevive à confirmação em outro aparelho.
3. Ao fim do fluxo, o navegador de pós-autenticação usa, nesta ordem: `sessionStorage` →
   metadados (se com menos de 7 dias) → destino do papel. O valor usado é apagado dos dois lugares.

**Sanitização** (função pura, testada): aceita só caminho interno. Começa com `/`; não começa com
`//` nem `/\`; sem `://`, sem `\`, sem caracteres de controle; até 200 caracteres; não aponta para
`/auth`. Fora disso ⇒ `null`.

**Segurança**: o destino é dado **gravável pelo cliente** (query string e metadados). Nunca
autoriza nada: os guards e a RLS do destino continuam valendo.

**Google**: o retorno do OAuth acontece na mesma aba; `sessionStorage` basta.

## R7. Etapas depois de autenticar e guards

**Decisão**: uma função pura `nextStep()` (`core/auth/post-auth-navigation.ts`) decide para onde
ir depois de qualquer autenticação (entrar, retorno do Google, confirmação de e-mail, aceite):

```
admin                       → returnUrl (se começa com /admin) ou /admin
tutor sem aceite            → /auth/termos
tutor sem celular confirmado e sem "pular" → /auth/celular
caso contrário              → returnUrl ou /app
```

- `termsGuard` em `/app`: tutor sem aceite vai para `/auth/termos`. É o único bloqueio duro.
- `phoneConfirmedGuard` (exportado de `core/account/`): para as rotas da `003` que exigem celular.
  Redireciona para `/auth/celular?returnUrl=<rota tentada>`.
- A confirmação do celular **não** bloqueia `/app`: bloquear tudo impediria o titular de chegar a
  "Conta" para exportar ou excluir seus dados sem antes confirmar um telefone.

**Achado**: hoje `anonGuard` cobre **todo** `/auth/*` e expulsa qualquer sessão para `/app`. As
telas de aceite, de celular e de nova senha precisam de sessão ou convivem com ela. O guard passa
a ser aplicado rota a rota (ver `contracts/frontend-services.contract.md`).

**Boas-vindas x Entrar**: `authGuard` hoje manda todo mundo para `/auth/login?reason=session_expired`,
inclusive quem nunca teve conta. Passa a mandar para `/auth` (boas-vindas) quando o aparelho não
tem a marca "já entrou aqui" (`faro.returning`, não sensível, gravada em `core/`), e para o login
quando tem. Preserva o FR-012 da `001`.

## R8. Recuperação de senha: pedido por Edge Function, troca pelo Auth

**Decisão**: o pedido passa pela Edge Function `password-recovery`, que aplica o limite próprio
(3/h por identidade, 10/h por origem), audita, responde **sempre** `{ ok: true }` depois de um
piso de tempo fixo (600 ms) e dispara `resetPasswordForEmail` em segundo plano
(`EdgeRuntime.waitUntil`). A troca da senha é feita pelo Supabase Auth
(`verifyOtp` + `updateUser`), seguida de `signOut({ scope: 'global' })`.

**O que realmente impõe o limite** (registro honesto, como no plano da `003`):

| Ação | Ponto que impõe | Risco residual |
|---|---|---|
| Envio de SMS | Só a nossa função tem a chave do provedor. **Impositivo.** | Ver R3. |
| Conferir código | Função SQL com a linha travada. **Impositivo.** | — |
| Pedido de recuperação | A função `password-recovery` limita o caminho do app. O endpoint `/recover` do Auth continua acessível com a chave pública. | Quem chama o Auth direto fica limitado só pelo Auth: 1 e-mail a cada 60 s por usuário (`max_frequency`) e o teto global de e-mails por hora. Um atacante pode esgotar o teto global e atrasar e-mails legítimos. Mitigação: `TODO(CAPTCHA)`. |
| Cadastro | Auth: limite por IP (`sign_in_sign_ups`) e resposta ofuscada para e-mail existente. | A diferença de tempo entre e-mail novo (envia) e existente (não envia) pode ser medida por quem chama o Auth direto. Mitigação: `TODO(CAPTCHA)`. A tela aplica um tempo mínimo de resposta. |
| Reenvio de confirmação | Auth: 60 s por usuário. | Igual ao pedido de recuperação. |
| Nova prova de identidade | Função SQL `rate_limit_check` dentro das Edge Functions. **Impositivo.** | — |

O portão "os limites valem" testa os pontos **impositivos** (SMS, código, prova de identidade) e,
para o Auth, confere a configuração (`config.toml`) e o comportamento observável.

### `TODO(CAPTCHA)`

O Supabase Auth aceita Cloudflare Turnstile ou hCaptcha em cadastro, login, recuperação e reenvio.
É a única medida que fecha os riscos residuais das linhas "Auth" acima. Não entra nesta spec
porque altera a tela de entrada (`001`/`002`), acrescenta um terceiro ao CSP e pede decisão do
dono. `RegistrationService` e `PasswordService` já aceitam um `captchaToken` opcional para a
mudança ser pequena. **Decisão do William em 2026-11-21: adotar.** O desenho e as tarefas ficam no
contrato de endurecimento desta spec.

## R9. Senha

- `minimum_password_length = 8` no `config.toml` (imposto pelo servidor); máximo 72 (limite do
  bcrypt) validado no cliente. Sem regras de composição (orientação NIST).
- `secure_password_change = true`: o Auth recusa a troca em sessão com mais de 24 h sem nova
  autenticação. É a trava de servidor contra sessão roubada.
- Troca dentro de "Conta": a tela pede a senha atual; o serviço passa pelo `login-guard`
  (limite da `001`), faz `signInWithPassword` (renova a sessão) e então `updateUser({ password })`
  e `signOut({ scope: 'others' })`.
- Depois da **recuperação**: `signOut({ scope: 'global' })` e volta para o login.
- Proteção contra senha vazada (Have I Been Pwned) existe no Auth em planos pagos: ligar quando o
  projeto estiver nesse plano. Não é pré-requisito.

## R10. Nova prova de identidade (trocar celular confirmado, excluir conta)

**Decisão**: helper `_shared/reauth.ts` usado pelas Edge Functions:

- **Conta com senha** (`auth.users.encrypted_password` preenchida, lida pela função SQL
  `account_auth_facts`): o corpo traz `password`; a função confere chamando o endpoint de token do
  Auth com a chave pública e, em seguida, revoga a sessão criada. Falhas contam em
  `rate_limit_check('reauth:account', …, 5, 900)` e geram `reautenticacao_falha`.
- **Conta só com o Google**: exige `last_sign_in_at` nos últimos 10 minutos. Senão, responde
  `reauth_required` e a tela oferece "Entrar de novo com o Google", que volta para a mesma tela.

**Por quê**: trocar o celular muda o contato que aparece na página de resgate; uma sessão roubada
poderia desviar o contato de um pet perdido. Excluir a conta desvincula tags. As duas ações
merecem a prova.

**Alternativa rejeitada**: confirmação por link enviado ao e-mail. Boa proteção, mas depende de
envio próprio de e-mail (`TODO(EMAIL_PROVIDER)`).

## R11. Exportar e excluir

**Exportar**: RPC `export_my_data()` (`security definer`, `authenticated`). Monta um `jsonb` com
conta, consentimento, eventos de `auth_audit_log` do próprio usuário (sem `ip_hash`) e, se existir,
o resultado de `export_tutor_tag_data(uuid)` da `003`. Limite 3/24 h; audita `dados_exportados`.
Sem nova prova de identidade: quem tem a sessão já lê esses dados pelo app.

**Excluir**: Edge Function `account-delete`:

1. autentica, limita, exige a prova de identidade (R10) e o texto de confirmação;
2. chama `delete_account_data(p_user_id)` (SQL, `service_role`): chama
   `end_assignments_for_account(p_user_id)` da `003`, limpa `phone_verifications` e
   `rate_limit_events` da conta, audita `conta_excluida`;
3. remove os arquivos em `pet-photos/<uid>/` (bucket da `003`);
4. `auth.admin.deleteUser(uid)`: o `ON DELETE CASCADE` leva `perfis`, pets e identidades; em
   `auth_audit_log` o `ator` vira `NULL` (o evento fica, a pessoa some).

**Falha fechada**: as migrations da `004` rodam antes das da `003`, então a chamada a
`end_assignments_for_account` é resolvida **em tempo de execução**. Se a função não existir **e** a
tabela `tag_assignments` existir, `delete_account_data` lança `deletion_hook_missing` e nada é
excluído. Se nenhuma das duas existir (a `003` ainda não foi implantada), segue.

**Atomicidade**: os passos 2 e 4 não estão na mesma transação. A ordem escolhida (dados e vínculos
primeiro, usuário depois) garante que uma falha no meio deixa uma conta vazia que ainda consegue
entrar e **repetir** a exclusão; todos os passos são idempotentes. A ordem inversa deixaria dados
órfãos sem dono para pedir de novo. Alternativa considerada: `DELETE FROM auth.users` dentro da
função SQL (atômico); rejeitada por depender de privilégio do papel `postgres` sobre o schema
`auth`, que o Supabase vem restringindo.

**Sem período de arrependimento** no MVP (ponto em aberto na spec).

## R12. Auditoria

Reuso de `auth_audit_log` e `log_auth_event` (Evento de Auditoria de Autenticação). Valores novos
em `evento_auth_enum`, criados em migration **isolada** (0008) e usados só a partir da seguinte:

`conta_criada`, `email_confirmado`, `termos_aceitos`, `celular_codigo_enviado`,
`celular_codigo_invalido`, `celular_bloqueado`, `celular_confirmado`,
`senha_recuperacao_solicitada`, `senha_alterada`, `reautenticacao_falha`, `dados_exportados`,
`conta_excluida`.

**Fonte dos eventos que acontecem entre o navegador e o Auth**: gatilhos em `auth.users`, não
relato do cliente. `handle_new_user` registra `conta_criada`; um gatilho `AFTER UPDATE OF
email_confirmed_at, encrypted_password, recovery_sent_at` registra `email_confirmado`,
`senha_alterada` e `senha_recuperacao_solicitada`. O gatilho **nunca** derruba a operação do Auth
(`EXCEPTION WHEN OTHERS` + `RAISE WARNING`): preferimos perder um evento a travar o login.

**Saída**: a `001` deixou a auditoria de `logout` como lacuna conhecida (`auth.service.ts`). "Sair"
está no escopo desta spec; a RPC `log_logout()` (autenticada, grava só para `auth.uid()`, limitada)
é chamada antes do `signOut`. É relato do cliente, aceito porque só afeta a trilha da própria conta.

## R13. Achados na base da `001` (afetam esta spec)

1. **`log_auth_event` e `record_login_attempt` são executáveis por `anon` e `authenticated`.**
   As migrations 0001–0007 não têm `REVOKE`/`GRANT`; no Supabase, funções em `public` nascem com
   `EXECUTE` para esses papéis, e a RLS das tabelas **não** barra uma função `security definer`.
   Qualquer pessoa com a chave pública consegue forjar eventos de auditoria e encher a tabela de
   tentativas. **Corrigido em 0009** (esta spec reutiliza `log_auth_event`). Toda função nova
   desta spec traz `REVOKE … FROM PUBLIC, anon, authenticated` e um `GRANT` específico.
2. **`login-guard` não responde ao preflight CORS** (`OPTIONS` → 405, sem cabeçalhos). Chamado do
   navegador, o `functions.invoke` falha e o `AuthService` cai no ramo de falha aberta: o limite e
   a auditoria de login ficam inertes sem aviso. A troca de senha desta spec depende dele. Tarefa
   de fundação para conferir e corrigir com o helper `_shared/http.ts`.
3. **`login-guard` aceita `success` e `user_id` informados pelo cliente** (`post_result`). Não é
   corrigido aqui; fica para o portão de segurança. As funções novas não copiam esse desenho.
4. **`HASH_SALT` cai para string vazia** se a variável faltar. As funções novas falham fechadas
   quando o segredo falta.

## R14. E-mails do Auth

- Modelos em `supabase/templates/` (`confirmation.html`, `recovery.html`), PT-BR, sem emoji,
  referenciados no `config.toml`. No projeto hospedado, os mesmos modelos precisam ser aplicados
  pelo painel ou por `supabase config push`.
- `TODO(EMAIL_PROVIDER)` (mesmo nome usado pela `003`): o SMTP embutido do Supabase serve só para
  teste (poucos e-mails por hora). Produção exige SMTP próprio. **Decisão de 2026-11-21**: será
  uma conta Google, ainda não ativada. Em desenvolvimento, o coletor de
  e-mails local (porta 54324) recebe tudo.

## R15. Aparência

O mecanismo (classe `.dark` na casca do app, leitura de `prefers-color-scheme`, persistência) é da
`002`. Esta spec entrega só a tela, que chama o serviço de tema da `002`. A preferência é por
aparelho; não há coluna no banco.

## R16. Páginas legais

`/legal/termos` e `/legal/privacidade`: páginas estáticas, pré-renderizadas, sempre claras, com um
rascunho marcado (`TODO(LEGAL_TEXTS)`). Dois segmentos de caminho, para não colidir com a rota
`/:code` da tag (Princípio VIII).

---

## Pendências registradas

| Item | Onde se resolve | Bloqueia? |
|---|---|---|
| `TODO(SMS_PROVIDER)` | decisão do dono + driver em `_shared/sms/` | **Bloqueia produção** (não o desenvolvimento) |
| `TODO(EMAIL_PROVIDER)` | compartilhado com a `003` | Bloqueia produção |
| `TODO(LEGAL_TEXTS)` | dono / jurídico | Bloqueia abertura ao público |
| `TODO(CAPTCHA)` | decisão do dono; toca `001`/`002` | Recomendado antes da abertura |
| `TODO(RETENCAO)` | constituição (janela de auditoria) | Não |
| `TODO(BILLING_MODEL)` | constituição | Não (fora do escopo) |
| `export_tutor_tag_data(uuid)` e limpeza de `pet-photos`, `pending_activations` e `tag_replacement_requests` na exclusão | pedido à `003` (ver `contracts/cross-spec-003.contract.md`) | Exportação sai sem a seção de tags até existir |
| `login-guard` com resultado relatado pelo cliente | portão de segurança | Não |
| Origem do IP (`x-forwarded-for`) nas Edge Functions: confirmar que a plataforma sobrescreve o cabeçalho | implementação | Não (o eixo de IP é o mais frouxo de propósito) |
| Passada de design nas telas sem referência aprovada | dono | Não |
| Página inicial `/`: a `002` (research R20, item 2) a deixou provisória "à espera da 004". Decisão aqui: a boas-vindas fica em `/auth` (precisa de `anonGuard` e do `ReturnUrlService`, que `features/public` não pode importar); `/` não é tocada. Falta o dono decidir o destino do botão de `/` (`/auth` ou `/auth/login`) e o conteúdo definitivo da página | dono | Não |
| Foto da boas-vindas (`public/photos/boas-vindas.jpg`) | dono (fotos geradas por ele) | Não: sem o arquivo, a tela usa o fundo `bg-photo` |
