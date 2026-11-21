<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 2.0.0 (MAJOR)

Histórico:
- 1.0.0 (2026-06-05): ratificação inicial.
- 1.1.0 (2026-06-05): Princípio I refinado para o modelo Freemium (piso Grátis = alerta in-app).
- 2.0.0 (2026-11-17): PIVÔ DO MVP — o produto passa a ser a tag de coleira com QR Code.
- 2.1.0 (2026-11-21): Princípio III — exceção à troca do PIN quando o vínculo termina sem ninguém
  presente para receber o PIN novo (exclusão da conta; troca da tag de um pet). Decisão do William.
  MINOR: orientação ampliada, sem remover nem redefinir princípio. Documentos atualizados: CLAUDE.md,
  docs/decisoes-pivo.md, specs/003-tag-qr (spec, contratos, tarefas), specs/004-conta-tutor (contrato
  cruzado).

Por que MAJOR: redefinição incompatível de princípios existentes, não só expansão.
- Princípio I perde o piso Freemium (Grátis/Pro/Família SUSPENSO) e passa a falar em
  entitlement abstrato + TODO(BILLING_MODEL); vira o centro do produto.
- Princípio VI troca o escopo do MVP (saúde, lembretes, co-tutoria saem para o backlog).
- Restrições de Stack trocam a biblioteca de UI (PrimeNG Aura → ZardUI + Tailwind v4) e
  o modelo de pagamento (porta de billing → sem gateway no MVP).
- Novo princípio NÃO-NEGOCIÁVEL (VIII) com contrato físico imutável.

Modified principles:
- I.   Segurança do Pet Acima de Tudo (Rescue-First) — título mantido; conteúdo redefinido:
       todo código resolve para página amigável; resgate independe de cobrança/entitlement;
       limite vale só para NOVOS vínculos; aviso de scan ao tutor faz parte do piso;
       scans de tags blocked/void visíveis ao Admin. Removidos: tiers Grátis/Pro, fila de
       planos inativos.
- II.  Privacidade & LGPD por Design — expandido: minimização (nome, e-mail, telefone),
       telefone confirmado antes de ficar público, prévia "como estranhos verão",
       isolamento de dados entre vínculos sucessivos da mesma tag.
- III. Segurança em Profundidade & RLS-First — expandido: PIN obrigatório em todo vínculo
       (hash lento, tentativas limitadas, uso único, nunca impresso nem versionado);
       dígito verificador antes do banco; critérios explícitos para a resposta pública
       distinguir estados (substitui a "resposta uniforme" incondicional dos docs).
- V.   Mobile-First, Performance & Acesso Universal — responsivo em três larguras; "PWA
       instalável" deixa de ser exigência e o MVP não tem service worker; página de resgate
       sempre clara.
- VI.  Simplicidade & Entrega Incremental — escopo do MVP redefinido (tag com QR) e backlog
       explícito.
- VII. Observabilidade, Auditoria & Confiabilidade — eventos sensíveis atualizados para o
       domínio de tags (lotes, PIN, vínculos, status, reimpressão); "régua de carência"
       removida.
- IV.  Spec-Driven Development — sem mudança.

Added sections:
- Princípio VIII. O Que É Impresso É Para Sempre (Contrato Físico Imutável) — NÃO-NEGOCIÁVEL
- Portão de Qualidade: mudança no contrato físico exige aprovação humana + testes cruzados.
- Governança: emendas não podem invalidar tags já impressas (evolução só aditiva).

Removed sections: nenhuma (o modelo Freemium foi SUSPENSO, não apagado do histórico de decisões).

Templates status:
- .specify/templates/plan-template.md ........ ✅ compatível (Constitution Check é derivado deste
                                                arquivo na hora do plan; checar I–VIII)
- .specify/templates/spec-template.md ......... ✅ compatível (specs continuam sem stack)
- .specify/templates/tasks-template.md ........ ✅ compatível (organização por user story)

Runtime guidance / docs (situação em 2026-11-21):
- CLAUDE.md ................................... ✅ reescrito em 2026-11-21
- docs/README.md .............................. ✅ reescrito; decisões em docs/decisoes-pivo.md
- docs/architecture.md ........................ ⚠ histórico, com aviso de desatualizado
- docs/backend-supabase.md .................... ⚠ histórico, com aviso; vale specs/003 e 004
- docs/frontend.md ............................ ⚠ histórico, com aviso; vale DESIGN.md e zardui-faro.md
- docs/design-system.md + brand book .......... ⚠ histórico, com aviso; vale DESIGN.md
- docs/test-strategy.md ....................... ⚠ histórico, com aviso; gate em specs/*/contracts
- docs/dev-pipeline.md ........................ ✅ reescrito em 2026-11-21
- .claude/agents/*.md + .claude/agent-memory/ . ✅ três agentes reescritos; três aposentados
- specs/001-login/ ............................ ⚠ revisar (continua no MVP; Constitution Check citava v1.1.0)

Deferred / Follow-up TODOs:
- TODO(BILLING_MODEL): assinatura vs. tag comprada (cada tag = 1 vínculo). Até decidir, todo limite
  passa por uma abstração única de entitlement que hoje retorna "permitido".
- TODO(BILLING_PROVIDER): Stripe vs Asaas — subordinado ao BILLING_MODEL; fora do MVP.
- TODO(PWA) FECHADO em 2026-11-21: service worker removido do MVP; manifest e ícones ficam.
- Compatibilidade ZardUI × Angular 21 a confirmar no `init` (CLI `zard-cli` 1.12.0).
- Ajustes de 2026-11-21, ainda dentro da v2.0.0 (não ratificada até então): Princípio III
  passa a exigir mensagem única para código inexistente/bloqueado/anulado; Princípio V passa
  a exigir responsividade (celular, tablet, desktop) e fixa a página de resgate no tema claro.
  Decisões de origem em `docs/decisoes-pivo.md`.
- Política de retenção/anonimização (scans, ip_hash, auditoria) continua sem janela definida (LGPD).
-->

# Faro Constitution
<!-- Faro — tag de coleira com QR Code para resgate de pets -->

Faro é um web app de **resgate de pets**. O tutor ativa uma **tag de coleira com QR Code**,
vinculando-a ao pet com um PIN; quem encontra um pet perdido escaneia o QR e abre uma
**página pública de resgate** com as informações que o tutor consentiu em mostrar e um
caminho de contato. O MVP é **somente a tag**; a plataforma de cuidado e saúde é visão de
longo prazo e está no backlog. Esta constituição define os princípios inegociáveis do produto
e da engenharia.

## Core Principles

### I. Segurança do Pet Acima de Tudo (Rescue-First) — NÃO-NEGOCIÁVEL

Reunir um pet perdido ao seu tutor é o centro do produto. Isso nunca pode ser refém de
cobrança, de limite de uso ou de falha técnica.

- Toda requisição a `/<código>` **DEVE** terminar numa página amigável, em qualquer estado
  do código (inexistente, disponível, vinculado, bloqueado ou anulado). O QR **NUNCA** cai em
  erro técnico. Enquanto o produto não estiver no ar, o domínio impresso **DEVE** responder a
  qualquer código com uma página estática de contingência ("Este pet tem dono").
- A página pública de resgate e o caminho de contato consentido pelo tutor **DEVEM**
  funcionar **independentemente do estado de cobrança, entitlement ou plano** do tutor.
- Limites de uso (entitlement, ver `TODO(BILLING_MODEL)`) restringem **apenas novos
  vínculos**. Eles **NUNCA** desativam, ocultam ou degradam uma tag já vinculada, nem depois
  de downgrade, vencimento ou cancelamento.
- O aviso de scan ao tutor (no MVP, e-mail e histórico no painel) faz parte do piso de
  resgate e **NÃO** é condicionado a cobrança. Enriquecimentos futuros podem depender de
  entitlement quando o modelo de cobrança for decidido.
- Scans de tags bloqueadas ou anuladas **DEVEM** ser registrados e ficar visíveis ao Admin.

**Rationale**: é o propósito ético e o diferencial do produto. Um pet perdido não pode
"sumir da plataforma" por causa de pagamento, limite de plano ou configuração.

### II. Privacidade & LGPD por Design — NÃO-NEGOCIÁVEL

Tratamos dados pessoais do tutor e dados do pet sob minimização e consentimento.

- **Minimização**: os dados pessoais do tutor se limitam a nome, e-mail e telefone. CPF e
  endereço só entram se a cobrança vier a exigir (`TODO(BILLING_MODEL)`).
- Exposição pública **APENAS** de campos que o tutor consentiu explicitamente em tornar
  públicos; o restante é privado por padrão.
- O telefone de contato só aparece na página pública depois de **confirmado** (posse
  verificada) e com **opt-in** para fins de resgate.
- Antes de salvar a visibilidade, o tutor **DEVE** ver uma prévia de exatamente o que
  estranhos verão.
- **Isolamento entre vínculos**: scans e dados de um vínculo encerrado **NUNCA** ficam
  visíveis ao próximo titular da mesma tag, e vice-versa.
- O tutor **DEVE** poder exportar e excluir seus dados (direito do titular).
- Geolocalização é capturada **somente com consentimento** (precisa, via navegador) ou de
  forma **aproximada por IP claramente rotulada como aproximada**; a finalidade é informada.
- Consentimentos, base legal e política de retenção **DEVEM** ser registrados e auditáveis.

**Rationale**: a página de resgate é "internet aberta" e a tag pode trocar de dono; expor
dados pessoais exige rigor legal (LGPD) e respeito ao titular.

### III. Segurança em Profundidade & RLS-First — NÃO-NEGOCIÁVEL

A segurança é imposta no banco, não apenas na interface.

- Toda tabela com dados de usuário **DEVE** ter Row Level Security habilitada, com política
  padrão de **negar**; o tutor acessa somente os próprios dados. O Admin acessa por um papel
  próprio verificado no banco.
- O acesso anônimo ocorre **somente** através de RPC/projeção *whitelisted* que expõe
  exclusivamente os campos públicos. Nenhuma tabela é acessível diretamente por `anon`.
- Códigos de tag **DEVEM** ser opacos, gerados por fonte criptográfica, não sequenciais e
  **não deriváveis** do pet. O dígito verificador **DEVE** ser validado antes de qualquer
  consulta ao banco. Endpoints públicos **DEVEM** ter rate limiting contra enumeração.
- A resposta pública distingue **apenas três situações**: tag vinculada (página de resgate),
  tag disponível (convite para ativar) e **todo o resto**. Código inexistente, bloqueado ou
  anulado **DEVEM** mostrar a mesma mensagem ao visitante ("tag não encontrada"); a diferença
  fica registrada só no servidor. Isso vale porque o espaço de códigos tem ≥ 40 bits, o
  dígito verificador filtra antes do banco, há rate limiting por origem, nenhuma resposta
  sobre tag não vinculada expõe dados e vincular exige PIN.
- **Vincular uma tag a um pet EXIGE o PIN de ativação**, sem exceção e em qualquer porta de
  entrada. O PIN:
  - **NUNCA** é impresso na etiqueta; vai num cartão separado na embalagem;
  - é armazenado **somente como hash lento** (bcrypt), nunca em claro;
  - tem tentativas limitadas, com bloqueio temporário após erros sucessivos;
  - vale para **um único vínculo**: ao liberar ou transferir a tag, um PIN novo é gerado e
    exibido uma única vez a quem encerrou o vínculo.
  - **Exceção (v2.1.0)**: quando o vínculo termina **sem ninguém presente para receber o PIN
    novo** (exclusão da conta; troca da tag de um pet durante a ativação de outra), o PIN vigente
    é **mantido**, porque um PIN que ninguém recebe inutiliza a tag. Risco aceito e registrado: o
    antigo dono continua conhecendo um PIN válido até a próxima ativação. Um PIN novo **NUNCA** é
    gerado para ser descartado.
- PINs em texto puro existem apenas no momento da emissão, são entregues uma única vez e
  **NUNCA** são versionados nem persistidos em claro (arquivos de lote com PIN ficam fora
  do git).
- Segredos e integrações sensíveis (geração de lotes e PINs, geolocalização por IP,
  e-mail/SMS, futuro pagamento) ficam **no servidor** (Edge Functions); chaves privadas
  **NUNCA** vão para o cliente.

**Rationale**: um código adivinhável, um PIN recuperável ou uma tabela sem RLS permitiriam
sequestrar tags ou vazar dados de milhares de pets e tutores de uma só vez.

### IV. Spec-Driven Development

O fluxo do GitHub Spec Kit é a forma de trabalho.

- Nenhuma feature entra em código sem **spec aprovada** (WHAT/WHY) → **plan** → **tasks**.
- Specs são **agnósticas de stack**; decisões técnicas vivem no `plan.md` e no `CLAUDE.md`.
- Esta constituição prevalece sobre práticas ad-hoc; conflitos são resolvidos a favor dela.

### V. Mobile-First, Performance & Acesso Universal

O produto é usado majoritariamente no celular, inclusive por estranhos que acham o pet.

- Experiência **mobile-first e responsiva**: toda tela funciona em celular, tablet e
  desktop, porque o tutor também acessa pelo computador.
- As **rotas públicas (resgate)** são servidas com **SSR** para carga rápida em redes móveis
  e para preview de link em redes sociais/WhatsApp; o painel autenticado é CSR.
- A página de resgate **DEVE** ser utilizável antes da hidratação e em conexões lentas
  (orçamento de performance), sem depender de componentes de overlay. Ela é sempre no tema
  claro; o tema escuro existe só no app autenticado do tutor.
- O MVP **não tem service worker**. O app mantém apenas o manifest e os ícones. Se um
  service worker voltar no futuro, ele **NUNCA** pode interceptar as rotas públicas de
  resgate nem servir no lugar delas conteúdo em cache.
- Acessibilidade com meta **WCAG 2.1 AA** e arquitetura **i18n-ready** (PT-BR no MVP).

### VI. Simplicidade & Entrega Incremental (MVP-First / YAGNI)

- Cada user story é uma **fatia entregável e testável de forma independente** (P1, P2, P3…).
- Complexidade exige justificativa explícita (Complexity Tracking no plan).
- O **MVP é a tag com QR Code**: contas de tutor, cadastro mínimo de pet (com foto), pool e
  lotes de códigos, geração e impressão de etiquetas, ativação com PIN, página pública de
  resgate, modo perdido, registro de scans com geolocalização e aviso ao tutor por e-mail,
  painel do tutor, painel admin de códigos e reaproveitamento de tags.
- **Backlog (fora do MVP)**: registros de saúde, anexos, lembretes, co-tutoria, tracker GPS,
  marketplace de prestadores, gateway de pagamento e planos. Nada do backlog entra em
  código do MVP "por antecipação".

### VII. Observabilidade, Auditoria & Confiabilidade

- Eventos sensíveis **DEVEM** ser registrados com log estruturado e auditável: scans de QR
  (ligados ao vínculo vigente), criação de lote, emissão e reemissão de PIN, tentativas de
  ativação falhas e bloqueios, criação/encerramento/transferência de vínculo, mudança de
  status de código, reimpressão, eventos de autenticação, acessos e exclusões de dados.
- Erros são tratados com mensagens amigáveis e fallback.
- Nenhuma falha de cobrança ou de entitlement corta o fluxo de resgate (ver Princípio I).

### VIII. O Que É Impresso É Para Sempre (Contrato Físico Imutável) — NÃO-NEGOCIÁVEL

Uma etiqueta impressa e selada sob resina não pode ser atualizada. Tudo o que ela carrega é
um contrato permanente com quem a comprou.

- **Domínio**: `tagfaro.com.br` é o único domínio impresso e **NUNCA** pode expirar, mudar de
  dono ou deixar de apontar para o Faro. A renovação **DEVE** ser feita com vários anos de
  antecedência. Nenhum outro domínio (incluindo `*.vercel.app`) é impresso.
- **URL**: `HTTPS://TAGFARO.COM.BR/<CODIGO>`, toda em maiúsculas, com o código na raiz do
  domínio e sem prefixo. A rota pública aceita o código em qualquer caixa e normaliza.
- **Formato do código**: 8 caracteres aleatórios em Crockford Base32 mais 1 dígito
  verificador Luhn mod 32 (9 caracteres). Exibição `XXXX-XXXX-X`. Toda entrada, no backend e
  no frontend, é normalizada da mesma forma (maiúsculas; remover `-` e espaços; `O→0`,
  `I→1`, `L→1`). As implementações **DEVEM** ser idênticas entre si e com o gerador de
  referência, comprovado por fixtures cruzadas.
- **Imutabilidade**: o valor de um código impresso **NUNCA** muda e o código **NUNCA** é
  apagado; "excluir" é anular (`void`), preservando o histórico.
- **Reimpressão idêntica**: os parâmetros de QR de cada código (versão e máscara) são
  registrados no banco, e a reimpressão **DEVE** sair visualmente idêntica à original. A
  especificação de renderização da etiqueta só muda com novo teste de leitura física.

**Rationale**: se o domínio expirar, todas as tags param de funcionar e um terceiro pode
registrá-lo e passar a receber os scans de pets perdidos. Se o formato ou a normalização
mudarem, códigos já colados em coleiras deixam de resolver.

## Restrições de Tecnologia & Stack

- **Frontend**: Angular 21 (standalone components, signals, zoneless). UI com **ZardUI**
  (código-fonte dos componentes no repositório, variantes tipadas por CVA) + **Tailwind CSS
  v4**, com tokens no CSS global único. É uma **exceção explícita** ao padrão PrimeNG da casa;
  a migração do bootstrap é rastreada em spec própria. Renderização **híbrida**: SSR nas rotas
  públicas, CSR no painel autenticado.
- **Dados/Backend**: **Supabase** (Postgres + Auth + Storage + Edge Functions), região São
  Paulo. **RLS obrigatória** em todas as tabelas de dados. Migrations versionadas e revisadas.
  Operações sobre códigos, vínculos e PINs passam por RPCs `security definer` auditadas.
- **Cobrança**: `TODO(BILLING_MODEL)`. **Sem gateway de pagamento nem planos no MVP.** Todo
  limite passa por uma abstração única de entitlement (ex.: `can_link_tag(tutor_id)`), que
  hoje retorna "permitido". `TODO(BILLING_PROVIDER)` fica subordinado a essa decisão.
- **QR/Tags**: contrato do Princípio VIII. A geração de lotes ocorre no servidor; a
  renderização das etiquetas (SVG/PDF) reproduz o gerador de referência com saída idêntica.
- **Hospedagem**: SSR na Vercel, servido em `tagfaro.com.br`; Supabase gerenciado.
- **Geração de lotes e PINs, geolocalização por IP e envio de e-mail** ocorrem em Edge
  Functions (servidor).

## Fluxo de Desenvolvimento & Portões de Qualidade

- Cadência Spec Kit: `/speckit.specify` → `/speckit.clarify` (se necessário) → `/speckit.plan`
  → `/speckit.tasks` → `/speckit.implement`.
- **Constitution Check** é obrigatório na fase de `plan`; violações exigem justificativa em
  *Complexity Tracking*.
- **Revisão de segurança & privacidade** obrigatória para qualquer feature que toque PII,
  RLS, PIN/ativação, pagamento ou exposição pública.
- Qualquer mudança que toque o **contrato físico** (Princípio VIII: domínio, URL, formato,
  normalização, renderização do QR) exige **aprovação humana explícita** e testes cruzados
  contra os códigos de lotes já impressos.
- Versionamento semântico; toda mudança de schema entra por migration revisada.

## Governança

- Esta constituição **supera** quaisquer outras práticas. Emendas exigem registro,
  justificativa, bump de versão (semver) e atualização dos templates dependentes
  (plan/spec/tasks) e do `CLAUDE.md`.
- **Nenhuma emenda pode invalidar tags já impressas.** Mudanças no contrato do Princípio VIII
  só podem ser aditivas: todo código impresso continua resolvendo para sempre.
- Revisões de PR **DEVEM** verificar conformidade com os princípios; complexidade não
  justificada é bloqueada.
- A orientação de runtime para agentes e devs vive no `CLAUDE.md`.
- Regras de versionamento: **MAJOR** = remoção/redefinição incompatível de princípio;
  **MINOR** = novo princípio/seção ou expansão material; **PATCH** = esclarecimentos e ajustes.

**Version**: 2.1.0 | **Ratified**: 2026-06-05 | **Last Amended**: 2026-11-21
