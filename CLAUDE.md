# Faro — Development Guidelines (CLAUDE.md)

> **Faro** é um web app SaaS de cuidado, saúde e **resgate de pets**. O tutor assina um
> plano, cadastra seus pets, registra vacinas/alimentação/consultas e recebe um **QR Code**
> (tag de coleira). Se o pet se perde, quem o encontra escaneia o QR e abre uma **página
> pública de resgate** com info do pet e contato do tutor.
>
> Guidance de runtime para agentes e devs. A fonte de princípios inegociáveis é a
> **constituição** em `.specify/memory/constitution.md` — em caso de conflito, ela vence.

## Active Technologies

- **Frontend**: Angular 21 — standalone components, **signals**, zoneless quando viável.
- **UI**: PrimeNG com tema **Aura** (+ PrimeIcons / PrimeFlex conforme necessário).
- **Renderização**: híbrida — **SSR/pré-render** nas rotas públicas, **CSR** no painel autenticado (`@angular/ssr`, render mode por rota).
- **PWA**: instalável, mobile-first.
- **Backend/Dados**: **Supabase** — Postgres, Auth, Storage, **Edge Functions**.
- **Segurança de dados**: **RLS obrigatória** em toda tabela; acesso público só via projeção/RPC *whitelisted*.
- **Pagamentos**: agnóstico de provedor (porta de billing + webhooks). `TODO(BILLING_PROVIDER)`: Stripe vs Asaas.
- **i18n**: PT-BR no MVP, arquitetura pronta para EN/ES.

## Project Structure

```text
pet-app/
├── .specify/                 # Spec Kit (constituição, templates, scripts)
│   └── memory/constitution.md
├── specs/                    # uma pasta por feature: NNN-nome/{spec,plan,tasks,...}.md
├── src/
│   ├── app/
│   │   ├── core/             # auth, supabase client, guards, interceptors, billing port
│   │   ├── shared/           # componentes/pipes/utils reutilizáveis (PrimeNG wrappers)
│   │   ├── features/         # telas por domínio (pets, health-records, subscription, reminders, admin)
│   │   │   └── public/       # página pública de resgate (rota SSR)
│   │   └── models/           # tipos/DTOs do domínio
│   └── environments/
├── supabase/
│   ├── migrations/           # schema versionado (SQL) + políticas RLS
│   └── functions/            # Edge Functions (webhook de pagamento, geo, scan, e-mail)
└── CLAUDE.md
```

> Estrutura proposta; cada `plan.md` confirma os caminhos reais da sua feature.

## Commands

```bash
# App Angular
npm install
npm start                      # ng serve (dev)
npm run build                  # build de produção (com SSR)
npm test                       # testes unitários

# Supabase (CLI)
supabase start                 # stack local
supabase db diff -f <nome>     # gerar migration a partir de mudanças
supabase db push               # aplicar migrations
supabase functions serve       # rodar Edge Functions localmente

# Spec Kit
/speckit.specify  /speckit.clarify  /speckit.plan  /speckit.tasks  /speckit.implement
```

## Architecture & Rendering

- **Rotas públicas** (`/{codigo}` da tag → página de resgate): **SSR/pré-render**. Carga
  rápida em rede móvel + preview de link. Leem **somente** a projeção pública (sem PII além
  do consentido). Devem funcionar **mesmo com assinatura inativa** (Princípio Rescue-First).
- **Painel autenticado** (tutor/admin): **CSR/SPA**, protegido por guards + sessão Supabase.
- **Edge Functions** para tudo que exige segredo/servidor: webhook de pagamento, resolução de
  geolocalização por IP, registro de scan + notificação, envio de e-mail/lembretes.

## Data & Security Conventions (LEIA ANTES DE CODAR)

- **RLS-first**: toda tabela nasce com RLS habilitada e política `deny by default`. Tutor só
  enxerga `tutor_id = auth.uid()` (e pets compartilhados via co-tutoria).
- **Exposição pública** só via *view*/RPC que projeta campos públicos do pet + config de
  visibilidade. Nunca exponha a tabela `pets` crua a `anon`.
- **Códigos de tag**: opacos, alta entropia, **não sequenciais**, com dígito verificador,
  gerados em pool. Endpoint público com **rate limiting** anti-enumeração.
- **Segredos** (chaves de pagamento, API de geo, SMTP) só em Edge Functions / env do servidor.
- **Geolocalização**: precisa (consentida no navegador) → fallback **aproximada por IP**
  rotulada como tal. Guardar método + precisão.
- **WhatsApp**: deep link `wa.me` com mensagem pré-definida; exibido apenas com **opt-in** do tutor.
- **Auditoria**: logar scans, mudanças de plano, acessos/exclusões de dados, realocação de tag.

## Domain Glossary

- **Tutor** — usuário dono do(s) pet(s); titular dos dados (LGPD).
- **Plano (Plan)** — definição de tier e limites (nº de pets, storage, recursos).
- **Assinatura (Subscription)** — vínculo tutor↔plano pago; status: `free | trial | ativo | carência | cancelado`. Piso = **free** (modelo freemium); sem Pro → volta pro free, nunca read-only.
- **Pet** — animal monitorado (cão/gato no MVP); inclui temperamento.
- **TagCode (Código)** — código opaco do pool; status `available | assigned | blocked`; vínculo opcional a 1 pet; histórico de realocação.
- **RegistroDeSaude (HealthRecord)** — vacinação | alimentação | consulta | vermifugação | peso | medicação (+ anexos).
- **Anexo (Attachment)** — arquivo no Storage ligado a registro/pet.
- **PerfilDeResgate (RescueProfile)** — projeção pública do pet + config de visibilidade + **modo perdido**.
- **ScanEvent** — leitura do QR: timestamp, geolocalização (método/precisão), destino do alerta (tutor/admin).
- **Lembrete (Reminder)** / **Notificação** — agendamento (vacina/consulta/vermífugo) e entrega (in-app/e-mail).
- **CoTutor** — compartilhamento de um pet (plano Família).
- **Admin** — backoffice (pool de códigos, planos, suporte, realocação, fila de scans de planos inativos).
- **Conta / Usuário (Account/User)** — identidade autenticável no Faro; titular dos dados (LGPD). Materializa-se como **Tutor** ou **Admin** conforme o **Papel**. Atributos de login: e-mail, credencial de senha (quando aplicável) e vínculo a uma ou mais identidades externas.
- **Papel (Role)** — classificação da Conta que determina o destino pós-login e o escopo de acesso: tutor → painel do tutor; admin → backoffice. (origem da spec `001-login`.)
- **Sessão (Session)** — vínculo temporário de acesso autenticado entre a Conta e o painel; estado `ativa | expirada | encerrada`; duração **curta** (sem "manter conectado") vs. **persistente** (com "manter conectado", com renovação automática).
- **Identidade Externa (External Identity)** — vínculo entre a Conta do Faro e uma conta de provedor social (ex.: **Google**) usada como método de autenticação alternativo; provedor entrega o e-mail já verificado.
- **Evento de Auditoria de Autenticação (AuthAuditEvent)** — registro estruturado de evento sensível de login (sucesso, falha, bloqueio por rate-limit, logout), com timestamp e contexto mínimo (minimização LGPD); subtipo do log de **Auditoria** (Princípio VII).
- *(Fase 2)* **Prestador (Provider)**, **AssinaturaPrestador**, **Anúncio (Ad)**, **ServiceListing** — marketplace.

## Code Style

- TypeScript estrito; nomes em inglês no código, textos de UI em PT-BR (via i18n).
- Componentes **standalone**; estado com **signals**; evitar `any`.
- PrimeNG: padronizar via wrappers em `shared/` quando houver repetição; respeitar o tema Aura.
- Acesso a dados centralizado em serviços `core/`; nunca chamar Supabase direto da view.
- Validação tanto no cliente (UX) quanto no banco (constraints/RLS) — banco é a fonte de verdade.
- Pastas de feature e nomes de serviço em **inglês** (`pets`, `health-records`, `subscription`, `reminders`, `admin`); atributo de teste padrão **`data-testid="<feature>-<elemento>"`**.

## Spec Kit Workflow

1. `/speckit.specify "<feature>"` — cria `specs/NNN-nome/spec.md` (WHAT/WHY, sem stack).
2. `/speckit.clarify` — resolve `[NEEDS CLARIFICATION]` quando houver.
3. `/speckit.plan` — gera `plan.md`, `research.md`, `data-model.md`, `contracts/` (aqui entra a stack).
4. `/speckit.tasks` — quebra em tarefas por user story.
5. `/speckit.implement` — implementa.

## Esteira & Subagentes

Pipeline completo em [docs/dev-pipeline.md](docs/dev-pipeline.md). Subagentes em `.claude/agents/`: **product-owner** (spec) → **tech-lead-planner** (plan+tasks, Constitution Check) → **ui-ux-designer** (blueprint de telas + identidade) ∥ **backend-supabase** (migrations/RLS/Edge; usa **MCP Supabase** de `.mcp.json`) → **frontend-angular** (implementa UI) → **qa-engineer** (testes + gate de segurança/RLS) → gate humano `/security-review` + `/code-review`. As skills `speckit-*` são *user-invocable-only* (os agentes executam o procedimento lendo os templates); `angular-developer` é pré-carregada no frontend/QA. Após criar/editar agentes, **reinicie a sessão** (ou use `/agents`) para carregá-los.

## Guard-rails (resumo da constituição)

1. **Resgate sempre funciona** — página pública/QR não dependem de assinatura ativa.
2. **LGPD/privacidade por design** — só expõe o consentido; minimização; geo rotulada.
3. **RLS-first + códigos opacos + segredos no servidor**.
4. **Spec antes do código**; specs sem stack.
5. **Mobile-first + SSR nas rotas públicas + a11y/i18n**.
6. **MVP-first/YAGNI**; marketplace é Fase 2.
7. **Observabilidade/auditoria** de eventos sensíveis.

## Recent Changes

- 2026-06-05: Constituição v1.0.0 ratificada; `CLAUDE.md` inicial criado; docs/ (arquitetura, design system, frontend, Supabase, testes) gerados.
- 2026-06-05: Esteira de desenvolvimento criada — 5 subagentes em `.claude/agents/` + [docs/dev-pipeline.md](docs/dev-pipeline.md).
- 2026-06-05: Adicionado subagente **ui-ux-designer**; **backend-supabase** ligado ao **MCP Supabase** (`.mcp.json`).
- 2026-06-05: Cobrança = **Freemium híbrido** (Grátis/Pro/Família); infra = **manter Vercel + Supabase**; constituição → **v1.1.0** (Princípio I refinado).
- 2026-06-09: Projeto consolidado numa raiz única (fim do duplo-aninhamento `pet-app/pet-app`); 6 subagentes movidos para o `.claude/agents/` do repositório.
- 2026-06-10: **Bootstrap (spec `000-bootstrap`) executado** — app **Angular 21** (zoneless, SSR híbrido), **PrimeNG 21 + `@primeuix/themes`** (FaroPreset/Aura), `@supabase/supabase-js`, ESLint flat + boundary Rescue-First, Vitest, Playwright (Chromium), `@angular/localize` (PT-BR), PWA. `ng build`/`lint`/`test` verdes. ⚠️ Tema do PrimeNG migrou de `@primeng/themes` (deprecado no v21) para **`@primeuix/themes`**.
- 2026-06-29: **Spec `001-login`** criada (product-owner) e clarificada (Sessão 2026-06-29): login **e-mail/senha + Google**, mesma porta para **Tutor/Admin** com roteamento por papel, **"manter conectado"**, e requisitos de segurança agnósticos de stack (anti-injeção, token de sessão protegido contra XSS, rate-limit **5/15min por identidade+origem**, anti-enumeração, auditoria, LGPD); confirmação de e-mail exigida para e-mail/senha (Google já verificado); MFA fora do MVP mas arquitetura aberta a ele. Glossário ampliado: **Conta/Usuário, Papel (Role), Sessão, Identidade Externa, Evento de Auditoria de Autenticação**. Próximo: `/speckit.plan`.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
