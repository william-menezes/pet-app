<!--
SYNC IMPACT REPORT
==================
Version change: (template / não versionado) → 1.0.0 → 1.1.0
Ratification: ratificação inicial 2026-06-05 (1.0.0).
Amendment 1.1.0 (2026-06-05): Princípio I (Rescue-First) refinado para o modelo Freemium —
o piso do tier Grátis garante o alerta in-app ao tutor; o roteamento ao Admin passa a ser
rede de segurança para contas inalcançáveis (substitui 'assinatura inativa → Admin').

Added sections:
- Core Principles (I a VII)
- Restrições de Tecnologia & Stack
- Fluxo de Desenvolvimento & Portões de Qualidade
- Governança

Principles defined:
- I.   Segurança do Pet Acima de Tudo (Rescue-First) — NON-NEGOTIABLE
- II.  Privacidade & LGPD por Design — NON-NEGOTIABLE
- III. Segurança em Profundidade & RLS-First — NON-NEGOTIABLE
- IV.  Spec-Driven Development
- V.   Mobile-First, Performance & Acesso Universal
- VI.  Simplicidade & Entrega Incremental (MVP-First / YAGNI)
- VII. Observabilidade, Auditoria & Confiabilidade

Templates status:
- .specify/templates/plan-template.md ........ ✅ compatível (seção "Constitution Check" referencia estes princípios)
- .specify/templates/spec-template.md ......... ✅ compatível (specs permanecem agnósticas de stack)
- .specify/templates/tasks-template.md ........ ✅ compatível (organização por user story P1/P2/P3)
- CLAUDE.md ................................... ✅ criado (guidance de runtime alinhada)

Deferred / Follow-up TODOs:
- TODO(BILLING_PROVIDER): provedor de pagamento ainda não decidido (candidatos: Stripe vs Asaas).
- Valores de preço dos planos são provisórios (definidos na spec de Assinaturas, sujeitos a validação de custo).
-->

# Faro Constitution
<!-- Faro — Plataforma de cuidado, saúde e resgate de pets via QR -->

Faro é um web app (SaaS por assinatura) onde tutores monitoram a saúde e os hábitos
de seus pets e contam com uma página pública de resgate acessível por um QR Code fixado
à coleira. Esta constituição define os princípios inegociáveis do produto e da engenharia.

## Core Principles

### I. Segurança do Pet Acima de Tudo (Rescue-First) — NÃO-NEGOCIÁVEL

O propósito social do Faro — reunir um pet perdido ao seu tutor — nunca pode ser refém
de cobrança ou de falhas técnicas.

- A página pública de resgate e a resolução do QR Code **DEVEM** permanecer acessíveis
  **independentemente do status da assinatura** (ativa, em carência, inativa ou cancelada),
  desde que exista um pet vinculado ao código.
- O caminho de contato com o tutor (ex.: botão de WhatsApp) **DEVE** estar sempre operante
  na página de resgate.
- Com o modelo **freemium**, o piso é o tier Grátis: o tutor **sempre recebe ao menos o
  alerta in-app de scan**. Alertas enriquecidos (e-mail/push) são do plano pago; o
  **roteamento ao Admin** é uma **rede de segurança** para contas inalcançáveis/abandonadas.
  O resgate jamais é suprimido.
- Nenhuma decisão de produto ou degradação por inadimplência pode quebrar o fluxo de resgate.

**Rationale**: é o diferencial e a responsabilidade ética do produto; um pet perdido não
pode "sumir da plataforma" por causa de um pagamento pendente.

### II. Privacidade & LGPD por Design — NÃO-NEGOCIÁVEL

Tratamos dados pessoais do tutor e dados do pet sob minimização e consentimento.

- Exposição pública **APENAS** de campos que o tutor consentiu explicitamente em tornar
  públicos; o restante é privado por padrão.
- O tutor **DEVE** poder exportar e excluir seus dados (direito do titular).
- Geolocalização é capturada **somente com consentimento** (precisa, via navegador) ou de
  forma **aproximada por IP claramente rotulada como aproximada**; a finalidade é informada.
- Consentimentos, base legal e política de retenção **DEVEM** ser registrados e auditáveis.
- O número de contato do tutor só é exposto mediante opt-in consentido para fins de resgate.

**Rationale**: a página de resgate é "internet aberta"; expor dados pessoais exige rigor
legal (LGPD) e respeito ao titular.

### III. Segurança em Profundidade & RLS-First — NÃO-NEGOCIÁVEL

A segurança é imposta no banco, não apenas na interface.

- Toda tabela com dados de usuário **DEVE** ter Row Level Security habilitada, com política
  padrão de **negar**; o tutor acessa somente os próprios dados.
- O acesso público (anônimo) ocorre **somente** através de uma projeção/visão *whitelisted*
  (ou RPC) que expõe exclusivamente os campos públicos — nunca a tabela bruta.
- Códigos de tag **DEVEM** ser opacos, de alta entropia, não sequenciais e **não deriváveis**
  do identificador do pet; endpoints públicos **DEVEM** ter rate limiting contra enumeração.
- Segredos e integrações sensíveis (pagamento, geolocalização, e-mail/SMS) ficam **no servidor**
  (Edge Functions); chaves privadas **NUNCA** vão para o cliente.

**Rationale**: um identificador adivinhável ou uma tabela sem RLS vazaria dados de milhares
de pets e tutores de uma só vez.

### IV. Spec-Driven Development

O fluxo do GitHub Spec Kit é a forma de trabalho.

- Nenhuma feature entra em código sem **spec aprovada** (WHAT/WHY) → **plan** → **tasks**.
- Specs são **agnósticas de stack**; decisões técnicas vivem no `plan.md` e no `CLAUDE.md`.
- Esta constituição prevalece sobre práticas ad-hoc; conflitos são resolvidos a favor dela.

### V. Mobile-First, Performance & Acesso Universal

O produto é usado majoritariamente no celular, inclusive por estranhos que acham o pet.

- Experiência **mobile-first** e **PWA instalável**.
- As **rotas públicas (resgate)** são servidas com **SSR/pré-render** para carga rápida em
  redes móveis e para preview de link em redes sociais/WhatsApp; o painel autenticado é CSR.
- Acessibilidade com meta **WCAG 2.1 AA** e arquitetura **i18n-ready** (PT-BR no MVP).
- A página de resgate **DEVE** ser utilizável em conexões lentas (orçamento de performance).

### VI. Simplicidade & Entrega Incremental (MVP-First / YAGNI)

- Cada user story é uma **fatia entregável e testável de forma independente** (P1, P2, P3…).
- Complexidade exige justificativa explícita (Complexity Tracking no plan).
- O **marketplace de prestadores** e demais extras ficam para **fases posteriores**; o MVP
  foca no laço tutor → pet → registros → QR/resgate → assinatura.

### VII. Observabilidade, Auditoria & Confiabilidade

- Eventos sensíveis — scans de QR, mudanças de plano/pagamento, acessos e exclusões de dados,
  realocação de tags — **DEVEM** ser registrados com log estruturado e auditável.
- Erros são tratados com mensagens amigáveis e fallback.
- Falhas de pagamento seguem uma **régua de carência** e nunca cortam o fluxo de resgate
  (ver Princípio I).

## Restrições de Tecnologia & Stack

- **Frontend**: Angular 21 (standalone components, signals, zoneless quando viável),
  PrimeNG com tema **Aura**. Renderização **híbrida**: SSR/pré-render nas rotas públicas,
  CSR no painel autenticado.
- **Dados/Backend**: **Supabase** (Postgres + Auth + Storage + Edge Functions). **RLS
  obrigatória** em todas as tabelas de dados. Migrations versionadas e revisadas.
- **Pagamentos**: integração **agnóstica de provedor** por meio de uma "porta de billing"
  + **webhooks** que alimentam a tabela de assinaturas. TODO(BILLING_PROVIDER): Stripe vs Asaas.
- **QR/Tags**: pool pré-provisionado de **códigos opacos**; URL canônica `https://<dominio>/{codigo}`.
- **Hospedagem**: SSR na Vercel/Cloudflare; Supabase gerenciado.
- **Pagamento, geolocalização e envio de e-mail** ocorrem em Edge Functions (servidor).

## Fluxo de Desenvolvimento & Portões de Qualidade

- Cadência Spec Kit: `/speckit.specify` → `/speckit.clarify` (se necessário) → `/speckit.plan`
  → `/speckit.tasks` → `/speckit.implement`.
- **Constitution Check** é obrigatório na fase de `plan`; violações exigem justificativa em
  *Complexity Tracking*.
- **Revisão de segurança & privacidade** obrigatória para qualquer feature que toque PII,
  RLS, pagamento ou exposição pública.
- Versionamento semântico; toda mudança de schema entra por migration revisada.

## Governança

- Esta constituição **supera** quaisquer outras práticas. Emendas exigem registro,
  justificativa, bump de versão (semver) e atualização dos templates dependentes
  (plan/spec/tasks) e do `CLAUDE.md`.
- Revisões de PR **DEVEM** verificar conformidade com os princípios; complexidade não
  justificada é bloqueada.
- A orientação de runtime para agentes e devs vive no `CLAUDE.md`.
- Regras de versionamento: **MAJOR** = remoção/redefinição incompatível de princípio;
  **MINOR** = novo princípio/seção ou expansão material; **PATCH** = esclarecimentos e ajustes.

**Version**: 1.1.0 | **Ratified**: 2026-06-05 | **Last Amended**: 2026-06-05
