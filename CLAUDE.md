# Faro — Development Guidelines (CLAUDE.md)

> **Faro** é um web app de **resgate de pets**. O tutor compra uma **tag de coleira com QR
> Code**, ativa com o PIN que vem no cartão da embalagem e vincula a um pet. Se o pet se
> perde, quem o encontra escaneia o QR e abre uma **página pública de resgate** com as
> informações que o tutor consentiu em mostrar e um botão de WhatsApp.
>
> **O MVP é só a tag.** Saúde, lembretes, família e o resto são roadmap (ver Fases).
>
> Guidance de runtime para agentes e devs. Ordem de autoridade em caso de conflito:
> **constituição** (`.specify/memory/constitution.md`, v2.1.0) > `docs/decisoes-pivo.md` >
> este arquivo > `DESIGN.md` e specs > demais docs.

## Active Technologies

- **Frontend**: Angular 21 — standalone components, **signals**, zoneless.
- **UI**: **ZardUI** (`zard-cli`; o código dos componentes é copiado para o repo, variantes
  por CVA) + **Tailwind CSS v4**. Ícones **Boxicons v3** via `@ng-icons/core` 34.x.
  **Exceção explícita ao padrão PrimeNG da casa**: neste projeto não se usa PrimeNG, PrimeIcons
  nem `@primeuix/themes`. Ignore a skill `angular-primeng-standard` aqui.
- **Estado atual do código**: o bootstrap (`000`) e o login (`001`) foram feitos em PrimeNG.
  A spec `002-ui-zardui` faz a migração; até ela ser executada o código ainda importa PrimeNG.
- **Renderização**: híbrida — **SSR** nas rotas públicas, **CSR** no app autenticado
  (`@angular/ssr`, render mode por rota).
- **Responsivo, mobile first**: toda tela em três larguras — celular (base), tablet (`md`,
  768px) e desktop (`xl`, 1280px; desenhado em 1440).
- **Tema**: claro em tudo; **escuro só no app autenticado do tutor**. Página de resgate,
  conta, ativação e admin são sempre claros.
- **PWA**: sem service worker no MVP. Ficam só o manifest e os ícones.
- **Backend/Dados**: **Supabase** — Postgres, Auth, Storage, **Edge Functions**; região São Paulo.
- **Segurança de dados**: **RLS obrigatória** em toda tabela; `anon` não lê tabela nenhuma;
  acesso público só por RPC `security definer`.
- **Cobrança**: `TODO(BILLING_MODEL)` (assinatura vs. tag comprada). **Sem gateway e sem
  planos no MVP.** Todo limite passa por `can_link_tag(tutor_id)`, que hoje retorna "permitido".
- **Hospedagem**: Vercel (SSR), domínio **`tagfaro.com.br`**.
- **i18n**: PT-BR no MVP, arquitetura pronta para EN/ES.

## Project Structure

```text
pet-app/
├── .specify/                 # Spec Kit (constituição, templates, scripts)
│   └── memory/constitution.md
├── DESIGN.md                 # sistema visual: cores, tipo, regras, responsivo (leia antes de UI)
├── PRODUCT.md                # quem usa, em que situação, e o que o produto promete
├── specs/                    # uma pasta por feature: NNN-nome/{spec,plan,tasks,...}.md
├── docs/                     # decisoes-pivo.md (decisões), git-workflow.md, dev-pipeline.md
├── design/telas-v2/          # telas de referência (HTML estático) e, ao lado, o gerador
├── tools/tag-generator/      # gerar_tags.py: implementação de referência do código e da etiqueta
├── public/logos/             # wordmark e focinho em SVG
├── src/
│   ├── app/
│   │   ├── core/             # supabase client, auth, guards, tag-code (normalize/validar)
│   │   ├── shared/
│   │   │   ├── components/   # componentes ZardUI copiados + componentes próprios do Faro
│   │   │   └── icons/        # faro-icons.ts (Boxicons sob nomes do Faro)
│   │   ├── features/
│   │   │   ├── public/       # página da tag (SSR): resgate, não ativada, não encontrada
│   │   │   ├── auth/         # boas-vindas, entrar, criar conta, confirmar celular
│   │   │   ├── activation/   # ativar e vincular tag (código + PIN)
│   │   │   ├── pets/         # painel, página do pet, novo pet, visibilidade, modo perdido
│   │   │   ├── scans/        # histórico de scans
│   │   │   ├── account/      # dados pessoais, telefone, privacidade
│   │   │   └── admin/        # lotes, códigos, detalhe, fila de scans, auditoria
│   │   └── models/           # tipos/DTOs do domínio
│   └── styles.css            # ÚNICO arquivo de tema: Tailwind v4 + variáveis do Faro
├── supabase/
│   ├── migrations/           # schema versionado (SQL) + políticas RLS
│   ├── functions/            # Edge Functions (lotes, etiquetas, scan, e-mail, SMS)
│   └── tests/                # pgTAP: RLS e RPCs
└── CLAUDE.md
```

> Cada `plan.md` confirma os caminhos reais da sua feature.

## Commands

```bash
# App Angular
npm install
npm start                      # ng serve (dev)
npm run build                  # build de produção (com SSR)
npm test                       # testes unitários (Vitest); use --watch=false em agente
npm run lint
npm run e2e                    # Playwright

# Supabase (CLI)
supabase start                 # stack local
supabase db diff -f <nome>     # gerar migration a partir de mudanças
supabase db push               # aplicar migrations
supabase test db               # pgTAP
supabase functions serve       # rodar Edge Functions localmente

# ZardUI
npx zard-cli@latest add <componente>   # copia o componente para src/app/shared/components/

# Spec Kit
/speckit.specify  /speckit.clarify  /speckit.plan  /speckit.tasks  /speckit.implement
```

## Architecture & Rendering

- **Página da tag** (`/:code`, na raiz do domínio): **SSR**. Chama **uma** RPC,
  `resolve_tag(code)`, e mostra uma de três telas: resgate (tag vinculada), "tag não ativada"
  (disponível) ou "tag não encontrada" (inexistente, bloqueada ou anulada, **mesma mensagem**).
  Nunca cai em erro técnico. Funciona independentemente de cobrança.
- **Dono logado** abrindo a própria tag vê a "visão do dono": sem aviso de scan e com os
  botões de contato desativados.
- **App autenticado** (tutor) e **admin**: **CSR**, protegidos por guards + sessão Supabase.
  Guards são UX; a autorização real é RLS.
- **`features/public/` não importa** nada do app autenticado nem de `core/auth` além do
  necessário para detectar o dono. O bundle público fica pequeno.
- **Edge Functions** para tudo que exige segredo ou servidor: criar lote e gerar etiquetas,
  registrar scan e avisar o tutor por e-mail, geolocalização por IP, SMS de confirmação.
- **Na página pública não há overlay** (dialog, popover, sheet).

## Contrato do código da tag (IMUTÁVEL — Princípio VIII)

O que está impresso é para sempre. Nada aqui muda sem aprovação explícita do William.

- **Código**: 8 caracteres aleatórios em Crockford Base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`)
  + 1 dígito verificador **Luhn mod 32** = 9 caracteres. Fonte criptográfica.
- **Exibição**: `XXXX-XXXX-X` (ex.: `7K3M-Q9XA-C`).
- **Normalização**, igual no backend e no frontend, em toda entrada: maiúsculas; remover `-`
  e espaços; `O→0`, `I→1`, `L→1`. **Validar o dígito antes de consultar o banco.**
- **URL no QR**: `HTTPS://TAGFARO.COM.BR/<CODIGO>`, toda em maiúsculas, código na raiz.
- **PIN de ativação**: 6 caracteres Crockford; vai no cartão, nunca na etiqueta; no banco só
  o hash (`crypt(pin, gen_salt('bf', <custo>))`).
- **Referência**: `tools/tag-generator/gerar_tags.py`. O porte para TypeScript em
  `core/tag-code/` tem de ser idêntico. A regra do dígito foi conferida contra os 54 códigos do
  lote-001 em 2026-11-21. **O repositório é público**: a lista de códigos reais e as folhas de
  etiquetas ficam fora do git (`tools/tag-generator/lote*/`); o teste cruzado versionado usa
  vetores sintéticos (`specs/003-tag-qr/contracts/tag-code.vectors.json`).
- **Etiqueta**: módulos e texto em `#0E1336`, pontos, olhos arredondados, texto em JetBrains Mono
  Bold; disco de 21,6 mm com o topo reto; 54 por folha A4. Vale o script, não a descrição.
- **QR**: correção H, versão 3; versão e máscara gravadas por código para a reimpressão sair
  idêntica. Logo de 8 módulos; **não aumentar**.
- **Código nunca é apagado**: "excluir" é o status `void`. O campo `code` é imutável.
- **Domínio `tagfaro.com.br` nunca pode expirar nem mudar.** Se expirar, todas as tags param
  e um terceiro pode registrar o domínio e receber os scans. Renovar com anos de antecedência.
- **`lote.csv` tem PINs em texto puro: nunca vai para o git.**

## Data & Security Conventions (LEIA ANTES DE CODAR)

- **RLS-first**: toda tabela nasce com RLS habilitada e `deny by default`, na mesma migration.
  Tutor só enxerga o que é dele (`tutor_id = auth.uid()`). Admin passa por `is_admin()`.
- **`anon` não tem acesso direto a tabela nenhuma.** A página pública usa `resolve_tag`.
- **PIN obrigatório em todo vínculo**, pela tag ou pelo app. Tentativas limitadas com bloqueio
  temporário. Vale uma vez: ao liberar a tag, gera-se um PIN novo, mostrado uma única vez.
  **Exceção**: sem ninguém para receber o PIN novo (exclusão de conta; troca da tag de um pet), o
  PIN vigente é mantido. Nunca se gera PIN para descartar.
- **Isolamento entre vínculos**: `scan_events` referencia `tag_code` **e** `assignment_id`.
  Scans de um vínculo antigo nunca aparecem para o novo dono.
- **Um pet tem no máximo uma tag ativa; uma tag tem no máximo um vínculo ativo.**
- **Limite de vínculos** só barra **novos** vínculos; nunca desativa uma tag já vinculada.
- **Aviso de scan ao tutor** (e-mail + histórico) é gratuito para sempre.
- **Dados pessoais mínimos**: nome, e-mail e celular. Sem CPF e sem endereço.
- **Celular confirmado por SMS** antes de aparecer na página pública.
- **Geolocalização**: precisa só com consentimento no navegador; senão aproximada por IP,
  rotulada como aproximada. Guardar método e precisão. IP nunca cru: `ip_hash`.
- **WhatsApp**: link `wa.me` com mensagem pré-definida, só com opt-in do tutor.
- **Segredos** (service role, SMTP, SMS, API de geo) só em Edge Functions / env do servidor.
- **Auditoria**: scans, criação de lote, emissão/reemissão de PIN, tentativas de ativação
  falhas e bloqueios, criar/encerrar/transferir vínculo, mudança de status, reimpressão,
  eventos de autenticação, acessos e exclusões de dados.

## Domain Glossary

- **Tutor** — dono do(s) pet(s); titular dos dados (LGPD).
- **Pet** — animal identificado pela tag (cão ou gato no MVP): nome, foto, espécie, raça,
  sexo, porte, temperamento, cuidados importantes.
- **TagBatch (Lote)** — conjunto de códigos gerados de uma vez (ex.: `lote-001`).
- **TagCode (Código)** — código impresso; status `available | assigned | blocked | void`;
  guarda hash do PIN, tentativas, versão e máscara do QR. Nunca apagado.
- **TagAssignment (Vínculo)** — ligação tag↔pet↔tutor com início e fim; motivo do fim:
  `released | transferred | lost | damaged | admin | account_deleted`. O histórico permite reaproveitar a tag.
- **PIN de ativação** — 6 caracteres do cartão; prova de posse da tag; uso único.
- **Entitlement** — direito de criar um novo vínculo; decidido por `can_link_tag`.
- **PerfilDeResgate (RescueProfile)** — o que a página pública mostra: campos do pet que o
  tutor liberou, contato com opt-in e o estado de **modo perdido**.
- **Modo perdido** — estado ligado pelo tutor; muda a página de resgate (bloco âmbar, há
  quanto tempo sumiu, selo de recompensa, recado do tutor).
- **Visão do dono** — a página de resgate vista pelo próprio tutor logado.
- **ScanEvent** — leitura do QR: quando, geolocalização (método e precisão), vínculo vigente.
- **Segunda via** — tag danificada: reimprimir o **mesmo** código. Tag perdida: código
  **novo** e o antigo vira `void`.
- **Admin** — backoffice: lotes, códigos, vínculos, fila de scans de tags bloqueadas, auditoria.
- **Conta / Usuário**, **Papel (Role)**, **Sessão**, **Identidade Externa**, **Evento de
  Auditoria de Autenticação** — como definidos na spec `001-login`.
- *(Fora do MVP)* **Plano**, **Assinatura**, **RegistroDeSaude**, **Anexo**, **Lembrete**,
  **CoTutor**, **Prestador** — conceitos do roadmap; não criar tabelas nem telas para eles.

## Design (resumo; o detalhe está em `DESIGN.md`)

- **Lima age** (`#84C32E`, texto `#13201E`): botão principal e o cartão que pede ação.
- **Tinta seleciona** (`#13201E`): aba ativa, chip escolhido, caixa marcada, interruptor ligado.
- **Navy é marca** (`#25337A`): painéis, rodapé da página de resgate, links.
- **Âmbar é só modo perdido** (`#A85A0E` no bloco). Vermelho só para ação destrutiva.
- **Outfit** em títulos e botões; **Inter** no texto.
- WhatsApp e Google usam o ícone oficial da empresa.
- As telas de referência são as páginas "MVP v2" do canvas *Faro · Telas do MVP*, com cópia em `design/telas-v2/`. A direção foi aprovada em 12 telas-piloto; as demais ainda não foram revisadas pelo William. Em conflito, `DESIGN.md` e os contratos vencem a tela.
- Para criticar ou refinar UI, use a skill **`impeccable`**.

## Code Style

- TypeScript estrito; nomes em inglês no código, textos de UI em PT-BR (via i18n).
- Componentes **standalone**; estado com **signals**; evitar `any`.
- Estilo com classes Tailwind e as variáveis de `src/styles.css`. Sem segundo arquivo de tema.
- Componentes ZardUI são editados no próprio repo; componentes de marca (botão de resgate,
  bloco do modo perdido, prévia "como estranhos verão", navegação) são próprios do Faro.
- Acesso a dados centralizado em serviços `core/`; nunca chamar Supabase direto da view.
- Validação no cliente (UX) e no banco (constraints/RLS/RPC) — o banco é a fonte de verdade.
- Pastas de feature e serviços em **inglês**; atributo de teste **`data-testid="<feature>-<elemento>"`**.

## Spec Kit Workflow

1. `/speckit.specify "<feature>"` — cria `specs/NNN-nome/spec.md` (WHAT/WHY, sem stack).
2. `/speckit.clarify` — resolve `[NEEDS CLARIFICATION]` quando houver.
3. `/speckit.plan` — gera `plan.md`, `research.md`, `data-model.md`, `contracts/` (aqui entra a stack).
4. `/speckit.tasks` — quebra em tarefas por user story.
5. `/speckit.implement` — implementa. **Só depois da aprovação do William.**

## Fases

- **MVP (em andamento)**: `001-login` (feito, em PrimeNG) · `002-ui-zardui` · `003-tag-qr` ·
  `004-conta-tutor`.
- **Fase 2**: carteira de saúde (vacinas, remédios, consultas, documentos) + lembretes.
- **Depois, sem ordem**: emergência, família e cuidadores, peso, relatório para o veterinário.
- **Ideia, sem compromisso**: checagem de sintomas por IA.

## Git Workflow

Fluxo de três branches com promoção em cadeia: `feature` → **`develop`** → **`homolog`** → **`master`** (produção na Vercel). Features partem de `develop`; o código sobe um degrau por vez; nunca commite direto em `homolog`/`master`. Comandos e convenções em [docs/git-workflow.md](docs/git-workflow.md).

## Esteira & Subagentes

Pipeline em [docs/dev-pipeline.md](docs/dev-pipeline.md). Specs, planos e tarefas são escritos na sessão principal (modelo forte). A **implementação** é feita por três subagentes em `.claude/agents/`, todos em **Sonnet**: **backend-supabase** (migrations, RLS, RPCs, Edge Functions) ∥ **frontend-angular** (UI em ZardUI/Tailwind) → **qa-engineer** (testes + gate de segurança/RLS). Depois, gate humano com `/security-review` e `/code-review`. Após criar ou editar agentes, **reinicie a sessão** (ou use `/agents`).

## Guard-rails (resumo da constituição v2.1.0)

1. **Resgate sempre funciona** — o QR nunca cai em erro e não depende de cobrança.
2. **LGPD por design** — só expõe o consentido; dados mínimos; scans isolados por vínculo.
3. **RLS-first + PIN obrigatório + segredos no servidor**.
4. **Spec antes do código**; specs sem stack.
5. **Mobile first, responsivo, SSR nas rotas públicas, a11y e i18n**.
6. **MVP = tag**; nada do roadmap entra "por antecipação".
7. **Auditoria** dos eventos sensíveis.
8. **O que é impresso é para sempre** — código, URL, domínio e QR são contrato.

## Recent Changes

- 2026-06-05 a 2026-07-01: constituição v1.x, bootstrap em Angular 21 + PrimeNG (`000`), spec e implementação do login (`001`), fluxo Git de três branches. Detalhe no histórico do git.
- 2026-11-17: **Pivô do MVP para a tag com QR Code.** Constituição emendada para **v2.0.0** (Princípio VIII novo; Freemium suspenso; `TODO(BILLING_MODEL)`).
- 2026-11-21: Decisões de marca e produto fechadas em entrevista ([docs/decisoes-pivo.md](docs/decisoes-pivo.md)): lima como cor de ação, navy `#25337A`, Outfit, responsivo em três larguras, tema escuro só no app do tutor, sem service worker, SMS para confirmar celular. Telas "MVP v2" (87) e design system revisados no Claude Design.
- 2026-11-21 (retomada): William confirmou as decisões das specs, com duas mudanças (WhatsApp começa marcado na ativação, com aviso; excluir conta mantém o PIN). Constituição **v2.1.0**. Logo em Outfit, `tools/tag-generator/gerar_tags.py` e o lote-001 entregues. Implementação **liberada**, começando pela `002`.
- 2026-11-21: `CLAUDE.md` reescrito; `DESIGN.md` e `PRODUCT.md` criados; specs **`002-ui-zardui`**, **`003-tag-qr`** e **`004-conta-tutor`** criadas com plano e tarefas; subagentes reduzidos a três (backend, frontend, QA) e reescritos para o pivô. Implementação ainda **não iniciada**.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
