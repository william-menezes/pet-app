# Research — Login (001-login)

**Fase 0 do plano.** Consolida as decisões de stack que materializam os FRs de segurança da spec, com alternativas consideradas e o porquê da escolha. Nenhuma decisão aqui reabre o que está travado em `docs/README.md`.

---

## R1. Armazenamento do token de sessão (FR-017 / FR-022)

**Decisão (MVP):** delegar ao `@supabase/supabase-js` o gerenciamento do token no **browser** (default = `localStorage`), com `persistSession`/`autoRefreshToken`/`detectSessionInUrl` **somente quando `isBrowser`** (já implementado em `core/supabase/supabase.service.ts`). O painel é **CSR puro** — não há sessão no servidor a proteger.

**Como atende "manter conectado" (FR-007/008/009):** ver R3 — o storage é trocado entre persistente (sobrevive ao fechar o navegador) e volátil (limpo ao encerrar o contexto) conforme o checkbox.

**Mitigação de XSS — CONTROLES OBRIGATÓRIOS (gates bloqueantes de P1, não best-effort).** Como o token vive em `localStorage`/`sessionStorage`, as defesas anti-XSS foram elevadas de recomendação a **gates que quebram o build/CI** e que **bloqueiam a entrega de P1** (tarefas T020a–T020d na Foundational, confirmadas por T033a). Sem elas verdes, P1 não é entregue:

1. **CSP estrita (obrigatória) — T020a/T020b.** `Content-Security-Policy` sem `unsafe-inline` nem `unsafe-eval` em `script-src`, com allowlist de origens (`self` + domínio do Supabase em `connect-src`). Configurada em **`vercel.json`** (headers da hospedagem) e espelhada nos headers do handler SSR (**`src/server.ts`**). Uma **checagem de CI** (`scripts/check-csp.mjs` e/ou `e2e/security/csp.spec.ts`) lê o header da app servida e **falha o build** se a CSP estiver ausente ou permissiva.
2. **Pinagem + auditoria de dependências (obrigatória) — T020c.** `package-lock.json` commitado com versões fixas (sem ranges flutuantes nas deps de runtime que tocam render/HTML); passo de gate `npm audit --audit-level=high`; **proibidas** libs de UI que façam `innerHTML` arbitrário.
3. **Lint anti-XSS + isolamento do token (obrigatório) — T020d.** Regra(s) em `eslint.config.*` que **proíbem** `innerHTML`/`[innerHTML]`/`bypassSecurityTrust*` com entrada do usuário no código de feature (quebra o build) e **proíbem** acesso a `localStorage`/`sessionStorage` de auth fora de `src/app/core/**` (o token só é tocado em `core/`). Reforça o boundary do T004.
4. **Sanitização nativa do Angular** (defesa de base) e token **nunca** lido por código de feature — só o SDK em `core/` o manipula.
5. **Transporte sempre HTTPS/TLS** (FR-022) — garantido por Vercel + Supabase.

> Estes controles **reduzem o risco residual** de roubo de token via XSS a um nível aceitável para o MVP CSR, sem reabrir a decisão de `localStorage` nem introduzir BFF/SSR de sessão.

**Alternativa rejeitada para o MVP:** cookies `httpOnly` + `Secure` + `SameSite=Lax` via `@supabase/ssr`. É o padrão-ouro contra XSS porque o JS não lê o token, mas exige um **fluxo de sessão SSR** (cookie read/write no servidor + middleware) que **não existe** hoje — o painel é CSR. Adotá-lo agora viola YAGNI (Princípio VI) sem benefício real enquanto o painel não for server-rendered.

**Porta de evolução (documentada, sem refatorar domínio):** migrar para cookie `httpOnly` toca **apenas** `core/supabase` + `core/auth`. Gatilho: quando/se o painel adotar SSR autenticado. Registrado em Complexity Tracking do `plan.md`.

---

## R2. Rate-limit / anti-força-bruta (FR-018 — 5 falhas / 15 min, por identidade + IP, backoff)

**Decisão:** **duas camadas**.
1. **GoTrue nativo** (config `supabase/config.toml` / painel): limites de tentativas de senha por IP/janela como rede ampla de proteção (ex.: `[auth.rate_limit]`). É a primeira barreira, mas não garante a granularidade "identidade **E** IP" nem backoff progressivo determinístico.
2. **Reforço próprio determinístico** (fonte da verdade do parâmetro da spec): tabela `auth_login_attempts` + função `record_login_attempt(p_identity_hash, p_ip_hash)` que:
   - conta **falhas na janela de 15 min** separadamente por `identity_hash` **e** por `ip_hash`;
   - retorna decisão `allow | backoff | block` (backoff progressivo após falhas; **block** ao atingir 5 na janela);
   - é chamada por uma **Edge Function `login-guard`** (com `service_role`) **antes** de delegar a autenticação ao GoTrue, e registra o resultado.
   - `identity_hash` e `ip_hash` são **hashes** (pgcrypto/`digest`) — minimização LGPD (R5).

**Por que Edge Function e não só policy/RPC chamada do cliente:** o IP de origem confiável e os segredos vivem no servidor; chamar a contagem direto do cliente permitiria *spoofing* do IP e contornar o backoff. A Edge centraliza a decisão com `service_role`.

**Parâmetros:** janela = **15 min**, limite = **5 falhas**, contagem **por identidade E por IP**, **backoff progressivo** (clarify 2026-06-29). A calibragem fina do backoff (ex.: 1s→2s→4s…) é detalhe de implementação ajustável; o gate (block aos 5/15min) é fixo e testável (SC-005).

**Alternativa rejeitada:** confiar **apenas** no rate-limit nativo do GoTrue — não expõe a granularidade exigida nem é determinístico o suficiente para o teste de eficácia (SC-005).

---

## R3. "Manter conectado" — sessão persistente vs. curta (FR-007/008/009)

**Decisão:** um helper `core/auth/session-persistence.ts` escolhe, **no momento do login**, o `storage` do SDK:
- **marcado (persistente):** `localStorage` — sessão sobrevive ao fechar/reabrir o navegador; `autoRefreshToken` renova enquanto o `refresh_token` for válido (FR-008).
- **desmarcado (curta):** `sessionStorage` (volátil) — sessão termina ao encerrar o contexto do navegador/aba (FR-009).

Implementação: o `supabase-js` aceita `auth.storage` customizado na criação do client; como o client é singleton, o MVP pode (a) recriar a configuração de storage por escolha, ou (b) usar `signInWithPassword` e, após sucesso, mover/limpar a sessão entre storages. **Decisão de implementação travada no plano:** expor `setRememberMe(boolean)` em `auth.service.ts` que define qual storage o client usa antes do `signIn`. (Detalhe fino fica para a implementação; o contrato está em `contracts/auth-service.contract.md`.)

**Expiração/renovação coerente (FR-022):** com "manter conectado", o refresh automático mantém a sessão; sem, a sessão curta expira e o `auth.guard` redireciona ao login preservando o destino pretendido (FR-012).

---

## R4. Roteamento por papel sem claim manipulável (FR-005 / FR-006)

**Decisão:** papel = **`perfis.papel`** (fonte no banco), provisionado por trigger no signup (`handle_new_user`, default `'tutor'`; admin promovido manualmente/seed). O cliente **lê** o papel (via leitura de `perfis` sob RLS própria, ou RPC `current_user_role()`) **apenas para rotear** (Tutor → `/app`, Admin → `/admin`). A **autorização real** dos dados de admin é a **RLS via `is_admin()`** (decisão travada no README) — um guard de UI burlado **não** concede acesso a dados.

**Por que não custom claim no JWT (Opção A do backend-supabase §4.4):** README trava **Opção B (`is_admin()`)** para o MVP (YAGNI; sempre fresco; custo por query aceitável com poucos admins). Custom claim fica como evolução futura se o custo aparecer em profiling.

---

## R5. Mensagens genéricas + anti-enumeração (FR-014 / FR-019, SC-004) e minimização (FR-021)

**Decisão:**
- **Mensagem única** PT-BR para credenciais inválidas **e** conta inexistente: `"E-mail ou senha inválidos."`. O frontend **não** ramifica por código de erro do GoTrue.
- **Timing uniforme:** o caminho de falha passa pela mesma rota (rate-limit + delegação) para inexistente e senha-errada, sem early-return que vaze diferença perceptível (SC-004 exige indistinguível em conteúdo, formato **e** tempo).
- **E-mail não confirmado (FR-024):** mensagem genérica própria + ação **"reenviar confirmação"** (chama `auth.resend`), sem afirmar que a conta existe.
- **Minimização (FR-021):** `auth_audit_log`/`auth_login_attempts` guardam **hash** de e-mail e IP, nunca o valor cru, nunca senha/token.

---

## R6. Google OAuth (US2)

**Decisão:** provider `google` do Supabase Auth (`signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback' } })`). **Client id/secret** ficam em **secrets do servidor** (painel Supabase / `config.toml` local) — **nunca** no frontend. E-mail do Google chega **verificado** → dispensa confirmação (FR-024). Rota `/auth/callback` (CSR) trata sucesso (cria sessão → roteia por papel) e **cancelamento/erro** (mensagem neutra + volta ao login; FR-015, US2 cenários 2/3). Vínculo de identidade Google ↔ conta existente por e-mail é tratado pelo GoTrue (`auth.identities`); política fina de conflito = spec de cadastro (Assumption da spec).

**Dependência externa não-bloqueante:** o reenvio de e-mail de confirmação (FR-024) e os templates de Auth dependem do **provedor de e-mail transacional** (em aberto, spec **007**). Para o login em si, o GoTrue de dev usa Inbucket local; em prod o provedor é configurado depois — não bloqueia P1.

---

## R7. Anti-injeção (FR-016)

**Decisão:** todo acesso a dados via `supabase-js` (PostgREST parametrizado) ou **RPC** com parâmetros tipados (`p_*`). RPCs `SECURITY DEFINER` com `SET search_path = public` e **sem** `EXECUTE` de string montada com input. Nenhum SQL no cliente. Validação de formato no cliente (UX) espelhada por constraints no banco. Não há superfície de SQL injection porque não há SQL concatenado.

---

## Dependências externas e itens diferidos (não bloqueiam o MVP do login)

| Item | Onde se resolve | Impacto no login |
|---|---|---|
| Provedor de e-mail transacional (templates Auth, reenvio confirmação) | spec **007** | Dev usa Inbucket local; prod configura depois. P1 não bloqueado. |
| Política de retenção/anonimização de `auth_audit_log`/`auth_login_attempts`/`ip_hash` | spec **009-privacidade-lgpd** | Colunas já minimizadas (hash); janela de retenção definida depois. |
| Custom claim de papel no JWT (performance) | evolução futura (se profiling exigir) | MVP usa `is_admin()` (travado no README). |
| Cookie `httpOnly` para sessão (SSR autenticado) | quando o painel adotar SSR | Porta aberta; toca só `core/`. |
| MFA / 2FA | fase futura | Schema próprio não impede (TOTP nativo do Supabase). |

**Nenhum `NEEDS CLARIFICATION` remanescente bloqueia a implementação.** Os itens acima estão isolados por porta/decisão e têm spec de destino.
