# Tasks: Tag com QR Code

**Input**: `specs/003-tag-qr/` (spec.md, plan.md, research.md, data-model.md, contracts/)
**Prerequisites**: `002-ui-zardui` e `004-conta-tutor` implementadas (ver "Pré-requisitos").
**Executor**: agente **Sonnet**, pelos subagentes `backend-supabase` (**BE**), `frontend-angular`
(**FE**) e `qa-engineer` (**QA**). Quem executa não tem memória da conversa que gerou este arquivo.

## Regras para quem executa

1. **Leia antes de começar**: `CLAUDE.md`, `.specify/memory/constitution.md`, `DESIGN.md`,
   `docs/decisoes-pivo.md` e todos os arquivos de `specs/003-tag-qr/contracts/`.
2. **Uma tarefa por vez**, na ordem. Marque `[x]` ao concluir. Não pule o "Feito quando".
3. **Não improvise.** Se um contrato for ambíguo, ou se a tarefa pedir algo que contradiz a
   constituição, **pare e relate**. Não invente comportamento.
4. **Contrato físico** (`contracts/tag-code.contract.md` e `label-rendering.contract.md`): não mude
   nada. Se um teste cruzado com o lote-001 falhar, o erro está no código novo, nunca no lote.
5. **Banco**: RLS habilitada na mesma migration da tabela; nenhuma política para `anon`; toda função
   `security definer` com `SET search_path = public, pg_temp`. Migrations numeradas de **0020 a 0034**. Enquanto a branch não foi mesclada em `develop`, uma migration desta spec pode ser editada (por exemplo, `0031_rpc_tutor.sql` recebe funções em mais de uma fase); depois do merge, só migrations novas.
6. **Segredos** nunca no cliente, em fixture, em log ou em mensagem de erro. PIN nunca em log.
7. **UI**: ZardUI + Tailwind conforme `DESIGN.md`; nunca PrimeNG. Três larguras (base, `md`, `xl`).
   Copie o layout das telas em `design/telas-v2/` (HTML estático com estilos em linha: use como
   medida e conteúdo, reescrevendo em componentes e classes Tailwind). Textos de UI em PT-BR.
8. `features/public/` não importa nada de `features/activation`, `pets`, `scans`, `admin`, nem de
   `core/auth`. A regra de ESLint da `002` não é afrouxada (`contracts/integration-002-004.contract.md` §5).
9. `data-testid="<feature>-<elemento>"` em tudo que um teste precisa achar.
10. **Depois de cada fase**: `npm run lint`, `npm test -- --watch=false`, `npm run build`,
    `supabase test db`. Tudo verde antes de seguir.
11. **Git**: trabalhe na branch `003-tag-qr`, criada a partir de `develop`. Nunca commite em
    `homolog` ou `master`. Mensagens no padrão do repositório (`:sparkles: feat: …`).
12. Não edite `specs/002-ui-zardui/` nem `specs/004-conta-tutor/`. Não toque em `tools/tag-generator/`.
    **Não reescreva `supabase/seed.sql`**: a `004` depende do tutor A e do tutor B que estão lá
    (`contracts/integration-002-004.contract.md` §6).
13. **Códigos de exemplo.** `7K3M-Q9XA-C` é válido pela regra confirmada (`research.md` §2); os
    demais que aparecem nas telas e nos documentos podem não ser. Em teste e em seed, use os
    vetores de `contracts/tag-code.vectors.json` e os códigos de `e2e/fixtures/seed-codes.json`
    (gerados em T020). **Códigos reais do lote-001 e qualquer PIN nunca entram em arquivo
    versionado** (o repositório é público). Nada que gere ou valide códigos reais vai para
    produção antes de T011 passar.
13A. **RPC não lança exceção para erro de negócio.** Toda RPC do tutor devolve
    `{ "ok": false, "error": "<código>" }` em vez de `RAISE EXCEPTION`
    (`contracts/tutor-rpcs.contract.md`, "Formato de resposta"). Uma exceção desfaria o contador de
    PIN errado e o limite de chamadas. Em pgTAP, confira o erro com `is(… ->> 'error', …)`, nunca
    com `throws_ok`.
14. **Telas de referência**: `design/telas-v2/` é a direção visual aprovada pelo William em 12
    telas-piloto (resgate, modo perdido, painel e entrar, nas três larguras). As outras 75 seguem o
    mesmo sistema, mas ele ainda não as revisou, e nenhuma foi conferida renderizada. Onde a tela
    conflitar com um contrato ou com `DESIGN.md`, valem o contrato e o `DESIGN.md`; relate o conflito.

## Format: `- [ ] ID [P?] [Story] [BE|FE|QA] Descrição`

- **[P]**: pode rodar em paralelo com outras [P] da mesma fase (arquivos diferentes, sem dependência).
- **Feito quando**: verificação que precisa passar.

## Pré-requisitos

- De `002-ui-zardui` e de `004-conta-tutor`: **as duas já implementadas e em `develop`**. Nomes
  exatos de cascas, componentes, guards, rotas e colunas em
  `contracts/integration-002-004.contract.md` (§2 e §3). Leia esse arquivo antes da primeira tarefa.
- Rotas desta spec: tabela em `contracts/integration-002-004.contract.md` §1. Toda tarefa de tela
  usa o caminho dessa tabela.
- Do William: a fonte `JetBrainsMono-Bold.ttf` e as máscaras do QR do lote-001 (ou um ambiente
  Python para extraí-las). **Sem isso, as tarefas marcadas com 🔒 (T084, T085) ficam bloqueadas**;
  o restante segue. O script (`tools/tag-generator/gerar_tags.py`) e o lote-001 chegaram em
  2026-11-21; o lote fica em `tools/tag-generator/lote-001/`, **fora do git**.
- Operacional: `tagfaro.com.br` apontando para a Vercel com a página de contingência no ar antes de
  qualquer tag ser distribuída.

---

## Como verificar tarefas de banco sem Docker (leia antes da Phase 1)

Igual à `004`: a máquina não tem Docker nem a CLI do Supabase. Todo "Feito quando" que cite pgTAP,
`supabase` ou `deno test` com banco é verificado no job "supabase" do CI: PR em rascunho para
`develop` aberto no primeiro push (sem ele o CI não dispara), commit, `git push origin 003-tag-qr`,
`gh run watch`, e só então marcar `[x]`. Detalhe em
`specs/004-conta-tutor/tasks.md`, seção de mesmo nome.

---

## Phase 1: Setup

- [x] T001 [BE] Criar a branch `003-tag-qr` a partir de `develop`. Adicionar ao `.gitignore`:
  `lote.csv`, `lote-*/`, `**/pins.csv`, `tools/tag-generator/lote-*/`.
  **Feito quando**: `git check-ignore lote.csv tools/tag-generator/lote-001/lote.csv` lista os dois.
- [x] T002 [P] [FE] Criar as pastas e arquivos `index.ts` vazios: `src/app/core/tag-code/`,
  `core/tags/`, `core/pets/`, `core/scans/`, `core/admin/`, `features/public/tag-page/`,
  `features/activation/`, `features/scans/`. **Feito quando**: `npm run build` passa.
- [x] T003 [P] [FE] Criar os tipos em `src/app/models/`: `pet.ts`, `tag.ts`, `rescue-profile.ts`,
  `scan.ts`, espelhando `data-model.md` e as saídas dos contratos (ex.: `TagResolution` com os
  quatro estados de `public-page.contract.md`). **Feito quando**: `npm run lint` passa, sem `any`.
- [x] T004 [P] [BE] Declarar em `supabase/.env.local.example` as variáveis `FARO_SSR_KEY`,
  `IP_HASH_SECRET`, `EMAIL_API_KEY`, `EMAIL_FROM`, com comentário de uma linha cada, sem valores.
  **Feito quando**: o arquivo lista as quatro e nenhum valor real aparece em `git diff`.
- [x] T005 [P] [FE] Documentar em `README.md` (seção "Variáveis do servidor SSR") `FARO_SSR_KEY`,
  `IP_HASH_SECRET`, `SUPABASE_FUNCTIONS_URL`. **Feito quando**: a seção existe.
- [x] T006 [BE] Criar `docs/importar-lote-001.md` com o procedimento de `research.md` §12, passo a
  passo, com os comandos SQL completos e a conferência final. **Feito quando**: o documento cobre
  importar, conferir 54 linhas, apagar a tabela temporária e apagar o CSV local.

---

## Phase 2: Foundational (bloqueia todas as histórias)

### Código da tag

- [x] T007 [FE] Implementar `src/app/core/tag-code/tag-code.ts` conforme
  `contracts/tag-code.contract.md` (API completa). **Feito quando**: compila sem dependências externas.
- [x] T008 [FE] Escrever `tag-code.spec.ts` com a tabela de casos e o teste de propriedade do
  contrato. **Feito quando**: `npm test -- --watch=false tag-code` passa.
- [x] T009 [BE] Copiar o módulo para `supabase/functions/_shared/tag-code.ts` e criar
  `src/app/core/tag-code/tag-code.sync.spec.ts` que falha se os dois arquivos diferirem.
  **Feito quando**: o teste passa e falha ao alterar um caractere em qualquer um dos dois.
- [x] T010 [P] [QA] Teste que procura no repositório (`src/`, `supabase/functions/`) qualquer
  domínio de tag diferente de `TAGFARO.COM.BR` (incluindo `vercel.app`) em código que monta URL.
  **Feito quando**: passa e falha se alguém trocar a constante.
- [x] T011 [QA] Copiar `specs/003-tag-qr/contracts/tag-code.vectors.json` para
  `src/app/core/tag-code/fixtures/tag-code.vectors.json` (sem alterar) e escrever o teste cruzado
  em TypeScript conforme `contracts/tag-code.contract.md`: para cada `valid`, `checkDigit(body)`
  devolve `check` e `isValid(code)` é `true`; cada `invalid` é `false`; cada par de
  `normalize` confere. Segundo teste, **só local**: se `tools/tag-generator/lote-001/codes.txt`
  existir, cada linha passa em `isValid`; se não existir, o teste é pulado com a mensagem
  "lote-001 ausente (arquivo fora do git)". **Nunca copie códigos do lote para arquivo
  versionado.** **Feito quando**: os vetores passam; onde o arquivo do lote existe, os 54 passam.

### Banco

- [x] T012 [BE] `0020_pets_e_perfil_resgate.sql`: tabelas `pets` e `rescue_profiles`, gatilhos
  (`updated_at`, criação do perfil, regra do celular confirmado), RLS e políticas do tutor e do
  admin, privilégios de coluna em `rescue_profiles`. **Feito quando**: `supabase db reset` aplica.
- [x] T013 [BE] `0021_tag_batches_e_codes.sql`: primeiro as funções `tag_normalize`,
  `tag_is_valid` e `tag_format` (`immutable`, mesma regra do TypeScript de T007); depois as tabelas,
  `CHECK`s (incluindo `tag_is_valid(code)`), gatilhos de imutabilidade (sem `UPDATE` de
  `code`/`batch_id`/`qr_*`, sem `DELETE`, sem sair de `void`) e RLS sem política para
  `authenticated` em `tag_codes`. **Feito quando**: aplica; `delete` falha; inserir código com
  dígito errado falha; `select tag_is_valid('7K3M-Q9XA-C')` devolve o mesmo que o TypeScript.
- [x] T014 [BE] `0022_tag_assignments_e_pin_attempts.sql`: tabelas, índices únicos parciais,
  regra `ended_at`/`end_reason`, RLS. **Feito quando**: aplica; segundo vínculo ativo falha.
- [x] T015 [P] [BE] `0023_pending_activations_e_rate_limits.sql`: as duas tabelas de `data-model.md` e a função interna `rate_limit_hit(scope, key, limit, window)` que incrementa e devolve se estourou. **Feito quando**: aplica com RLS e sem políticas; pgTAP mostra a 31ª chamada estourando um limite de 30.
- [x] T016 [P] [BE] `0024_scan_events.sql` com índices e a view `my_scans` (sem `ip_hash` nem token).
  **Feito quando**: aplica; `authenticated` não seleciona `ip_hash`.
- [x] T017 [BE] `0027_funcoes_tag.sql`: `can_link_tag` (retorna `true`, com o comentário
  `TODO(BILLING_MODEL)`) e `new_activation_pin` (6 caracteres do alfabeto, com `gen_random_bytes`).
  **Feito quando**: `select length(new_activation_pin())` devolve 6 e 1.000 chamadas só produzem
  caracteres do alfabeto.
- [x] T018 [P] [BE] `0025_tag_replacement_requests.sql`. **Feito quando**: aplica com RLS.
- [x] T019 [P] [BE] `0026_audit_log.sql`: tabela e função `audit(...)`. **Feito quando**: aplica;
  `update` e `delete` falham para `authenticated`.
- [x] T019A [BE] Em `0027_funcoes_tag.sql`, acrescentar `end_assignments_for_account(p_tutor uuid)`
  e `export_tutor_tag_data(p_tutor uuid)`, as duas só para `service_role`, conforme
  `contracts/integration-002-004.contract.md` §4. **Vem nesta fase de propósito**: a exclusão de
  conta da `004` recusa o pedido enquanto existir `tag_assignments` sem a primeira função.
  Criar `supabase/tests/account_tags.test.sql` com a primeira lista de §4.4 (só tabelas; a
  verificação com `resolve_tag` fica para T036). **Feito quando**: esse arquivo passa (segunda
  chamada devolve 0; tag bloqueada continua bloqueada; o código continua em `tag_codes` como
  `available` **com o mesmo `activation_pin_hash` de antes**; exportação sem dado de outro tutor) e `supabase/tests/conta_privacidade.test.sql`,
  da `004`, continua verde com as tabelas da `003` presentes (se quebrar, ver o último parágrafo de
  §4.4).
- [x] T020 [BE] Seed das tags, **sem reescrever `supabase/seed.sql`**
  (`contracts/integration-002-004.contract.md` §6): o script `supabase/scripts/make-seed.ts`
  escreve só o trecho entre os marcadores `-- >>> 003-tag-qr` e `-- <<< 003-tag-qr` no fim do
  arquivo, e também `e2e/fixtures/seed-codes.json`. Conteúdo: dados de exemplo de `data-model.md`
  (Paçoca e Mel para o **tutor A**, que é a "Ana" dos documentos; `lote-teste`; 3 scans). Não cria
  usuário, não toca no tutor B. Os seis códigos são **gerados pelo módulo de código**; nenhum
  escrito à mão. **Feito quando**: `supabase db reset` termina; `select count(*) from tag_codes`
  devolve 6; o JSON tem as chaves `assigned`, `available`, `blocked`, `void`; `git diff` de
  `seed.sql` só mostra linhas entre os marcadores; rodar o script de novo não muda o arquivo; os
  testes pgTAP da `004` continuam verdes.
- [x] T021 [QA] `supabase/tests/tag_code.test.sql`: mesma tabela de casos do contrato, em SQL.
  **Feito quando**: `supabase test db` passa.
- [x] T022 [QA] `supabase/tests/rls_tags_base.test.sql`: "Regras gerais" e "Testes do contrato
  físico" de `contracts/rls-expectations.md`. **Feito quando**: passa.

### Edge Functions compartilhadas e rotas

- [x] T023 [BE] `supabase/functions/_shared/`: `auth.ts` (valida `x-faro-ssr-key`; valida JWT e
  papel de admin), `supabase.ts` (cliente com role de serviço), `responses.ts`. Testes em `deno test`.
  **Feito quando**: chamada sem chave devolve `401` no teste.
- [x] T024 [FE] `src/app/app.routes.ts` e `app.routes.server.ts`: todas as rotas da tabela de
  `contracts/integration-002-004.contract.md` §1, com o `UrlMatcher` do código (research §15);
  remover `:codigo/perdido`. As filhas de `app` e de `admin` entram **antes** do `**` que a `002`
  deixou. Em `app.routes.server.ts`, acrescentar `ativar/**`, `novo-pet` e `vincular/**` em
  `RenderMode.Client` antes da regra `**`. Componentes ainda vazios. **Feito quando**: teste unitário do roteador mostra que `/app`,
  `/app/pets`, `/admin/codigos`, `/novo-pet`, `/ativar/7K3M-Q9XA-C` e `/7k3m-q9xa-c` casam com as
  rotas certas; `/qualquer-coisa` cai na página "não encontrada" do app; e o teste da regra de
  §1.5 passa (nenhum segmento fixo tem 9 caracteres do alfabeto depois de normalizado).
- [ ] T024A [FE] **Verificação da hospedagem (PARE se falhar).** Em um deploy de preview na Vercel,
  com uma rota de teste temporária em `src/server.ts` (`GET /api/ping`), confirmar três coisas:
  (1) rotas próprias do servidor Express respondem em produção com o preset do Angular; (2) uma
  variável de ambiente só do servidor é lida ali e **não** aparece no bundle do navegador; (3) os
  cabeçalhos `x-forwarded-for` e `x-vercel-ip-city`/`-latitude`/`-longitude` chegam à rota.
  Remover a rota de teste ao final. **Se qualquer um dos três falhar, PARE e relate**, com a
  alternativa: mover `/api/scan` e a chamada a `resolve-tag` para Vercel Functions (`api/*.ts`).
  **Feito quando**: o resultado dos três itens está escrito no PR, com a saída do `curl`.
- [ ] T025 [FE] (depende de T024A) `src/server.ts`: rotas `POST /api/scan` e `POST /api/scan/location` conforme
  `contracts/public-page.contract.md` (cálculo do `ip_hash`, leitura dos cabeçalhos da Vercel,
  checagem de mesma origem, repasse com a chave). Ajustar a CSP. **Feito quando**: teste do servidor
  cobre mesma origem, origem cruzada (recusa) e ausência de cabeçalhos de geo.

**Checkpoint**: base pronta. As histórias podem começar.

---

## Phase 3: User Story 1 — Quem achou escaneia e fala com o tutor (P1) 🎯 MVP

**Goal**: `/:code` mostra resgate, não ativada, não encontrada ou contingência.
**Independent Test**: com o seed, abrir `/7K3M-Q9XA-C` sem login num celular e abrir o WhatsApp.

- [x] T026 [US1] [BE] `0028_rpc_resolve_tag.sql`: RPC `resolve_tag` conforme o contrato (projeção
  sem campos desligados, contador de limite por `ip_hash`, `EXECUTE` só para `service_role`).
  **Feito quando**: os quatro estados saem corretos com o seed.
- [x] T027 [US1] [BE] Edge Function `supabase/functions/resolve-tag/index.ts`: chave, validação do
  dígito antes do banco, limite, RPC, URL assinada da foto, piso de 150 ms.
  **Feito quando**: `deno test` cobre os quatro estados e a recusa sem chave.
- [x] T028 [P] [US1] [BE] `0032_storage_pet_photos.sql`: bucket privado e políticas.
  **Feito quando**: tutor A não lê objeto de tutor B (pgTAP ou teste de integração).
- [x] T029 [US1] [FE] `core/tags/public-tag.service.ts`: no servidor chama `resolve-tag` com tempo
  limite de 2,5 s e guarda no `TransferState`; no navegador só lê o estado transferido.
  **Feito quando**: teste unitário cobre sucesso, erro e tempo esgotado (vira `contingency`).
- [x] T030 [US1] [FE] `features/public/tag-page/tag-page.ts`: componente da rota que escolhe a tela
  pelo estado. **Feito quando**: teste unitário cobre os cinco ramos.
- [x] T031 [US1] [FE] Tela de resgate (`rescue-view`) nas três larguras conforme
  `design/telas-v2/V2-resgate{,-tablet,-desktop}.dc.html`: foto, título na voz do pet, chips,
  cuidados, botão do WhatsApp como `<a href>`, "Enviar onde estou", rodapé navy. Sem foto: espaço
  reservado. **Feito quando**: teste de componente cobre com e sem cada campo opcional.
- [x] T032 [P] [US1] [FE] Tela "tag não encontrada" e a de contingência conforme
  `V2-tag-nao-encontrada*.dc.html`. **Feito quando**: as duas renderizam em teste.
- [x] T033 [P] [US1] [FE] Tela "tag não ativada" conforme `V2-tag-nao-ativada*.dc.html`;
  "Ativar minha tag" leva a `/ativar/<código>`. **Feito quando**: o link tem o código normalizado.
- [x] T034 [US1] [FE] Metadados da rota pública: `<title>` e Open Graph genéricos, `noindex`,
  `Cache-Control: no-store`. **Feito quando**: teste de SSR confere os cabeçalhos e a ausência do
  nome do pet no `<head>`.
- [x] T034A [US1] [FE] Em `src/app/app.config.ts`, trocar a hidratação para
  `provideClientHydration()` puro: saem `withEventReplay()` **e** `withIncrementalHydration()`
  (`contracts/integration-002-004.contract.md` §5.1). Não afrouxar a CSP. **Feito quando**:
  `npm run build` passa e nenhum HTML de `dist/` tem `<script>` embutido sem `src` além dos de
  dados (`type="application/json"`). **Se ainda houver, PARE e relate** (alternativa em §5.1).
- [x] T034B [US1] [FE] Tirar a autenticação do pacote da página pública (§5.2 do mesmo contrato):
  todos os guards de `app.routes.ts` carregados sob demanda pelo auxiliar `lazyCanMatch`;
  `scripts/ui-checks/public-bundle.mjs` passa a
  **reprovar** se `core/auth` ou `@supabase/supabase-js` forem alcançáveis por import estático a
  partir do pacote inicial. **Feito quando**: `npm run check:bundle` passa; o JavaScript baixado
  pela rota pública fica em 100 KB (gzip) ou menos; os testes de guard e o e2e de login continuam
  verdes.
- [ ] T035 [US1] [QA] `e2e/tag-page.spec.ts`: resgate; sem JavaScript (`javaScriptEnabled: false`);
  normalização (`/7k3m q9xa c`); inexistente, bloqueado e anulado com HTML idêntico; contingência
  com a função derrubada. **Feito quando**: passa em Chromium nas três larguras.
- [x] T036 [US1] [QA] `supabase/tests/rpc_resolve_tag.test.sql`: anti-enumeração e Rescue-First de
  `contracts/rls-expectations.md`, mais o caso de `contracts/integration-002-004.contract.md` §4.4
  (depois de `end_assignments_for_account`, a tag responde "não ativada"). **Feito quando**: passa.
- [ ] T037 [US1] [QA] Orçamento da rota pública (LCP, TTFB, JS) e axe nas quatro telas públicas.
  **Feito quando**: dentro do orçamento e sem violações AA.
- [ ] T037A [US1] [QA] **Conferência no preview da Vercel (PARE se falhar).** Com a página de
  resgate pronta, abrir uma tag do seed num deploy de preview, com o console do navegador aberto, e
  confirmar: a hidratação termina; o `POST /api/scan` sai e volta `200`; **não há erro de CSP** no
  console; a folha de estilo carrega. O Playwright local não aplica a CSP de produção: só o
  preview mostra esse tipo de problema. **Feito quando**: o resultado está escrito no PR, com a
  captura do console e da aba de rede.

**Checkpoint**: a página pública funciona com dados do seed.

---

## Phase 4: User Story 2 — Tutor ativa a tag (P1)

**Goal**: da primeira leitura até "Tag ativa!".
**Independent Test**: com `2FX8-CN73-F` do seed e o PIN de desenvolvimento, ativar para a Mel.

- [x] T038 [US2] [BE] `0029_rpc_ativacao.sql`: `check_tag_for_link`, `activate_tag`,
  `set/get/clear_pending_activation`, na ordem de verificações de `contracts/tutor-rpcs.contract.md`.
  **Feito quando**: ativa com o seed; erros devolvem os códigos do contrato.
- [x] T039 [US2] [QA] `supabase/tests/rpc_activate_tag.test.sql`: todos os itens de "Testes
  obrigatórios" do contrato ligados a ativação (PIN, bloqueios, concorrência, mensagem única).
  **Feito quando**: passa. Medir e anotar no PR o tempo de uma verificação de PIN.
- [x] T040 [US2] [FE] `core/tags/tag.service.ts`: métodos para as RPCs de ativação, com tradução
  dos códigos de erro para as mensagens do contrato. **Feito quando**: teste unitário cobre cada erro.
- [x] T041 [P] [US2] [FE] `core/pets/pet.service.ts`: criar, editar, remover e listar pets; upload
  de foto (redimensiona para 1600 px, converte para WebP, grava em `pet-photos/<uid>/<pet>/…`).
  **Feito quando**: teste unitário com o cliente Supabase simulado.
- [x] T042 [US2] [FE] Guard e rota `/ativar/:code`: sem sessão, redireciona para
  `/auth/criar-conta?returnUrl=/ativar/<código normalizado>`; com sessão, chama
  `set_pending_activation` e abre o passo 1. A rota também leva o `phoneConfirmedGuard` da `004`.
  Ao receber `phone_not_confirmed` de uma RPC, navegar para `/auth/celular?returnUrl=<rota atual>`.
  **Feito quando**: teste do guard cobre os dois casos e o endereço exato do redirecionamento.
- [x] T043 [US2] [FE] Passo 1, escolher o pet, conforme `V2-ativacao-pet*.dc.html`: lista de pets
  do tutor, "Cadastrar um pet novo", aviso e confirmação quando o pet já tem tag (`pet_has_tag` →
  reenviar com `p_replace`). **Feito quando**: teste de componente cobre pet sem tag e com tag.
- [ ] T044 [P] [US2] [FE] Novo pet, passo 1 (dados), conforme `V2-novo-pet-dados*.dc.html`.
  **Feito quando**: validação de nome obrigatório e espécie; teste de componente.
- [ ] T045 [P] [US2] [FE] Novo pet, passo 2 (foto, temperamento, cuidados), conforme
  `V2-novo-pet-resgate*.dc.html`, com "Pular por enquanto". Ao salvar, volta para onde veio
  (ativação ou painel). **Feito quando**: teste cobre salvar e pular.
- [x] T046 [US2] [FE] Passo 2, PIN, conforme `V2-ativacao-pin*.dc.html`: seis células, normalização
  da entrada, colar o PIN inteiro, resumo com "Trocar", nota de bloqueio, erros `wrong_pin`,
  `locked`, `phone_not_confirmed` (leva à confirmação do celular e volta). Incluir o controle
  "Quero que quem achar o [pet] possa me chamar no WhatsApp", **marcado por padrão**, com o aviso
  logo abaixo ("Seu WhatsApp vai aparecer na página do [pet] para quem escanear a tag. Você pode
  desligar depois em O que estranhos veem."), sempre enviado de forma explícita como
  `p_enable_whatsapp`. Posição e desenho conforme `V2-ativacao-pin*.dc.html`. **Feito quando**:
  teste de componente cobre os três erros, os dois estados do controle e que o aviso está visível
  sem rolar no celular.
- [x] T047 [US2] [FE] Tela "Tag ativa!" conforme `V2-ativacao-sucesso*.dc.html`; "Ver a página do
  Paçoca" abre `/<código>`. A primeira linha da lista reflete a escolha: "WhatsApp liberado para
  quem escanear" ou, se o tutor não marcou, "WhatsApp desligado" com o atalho "Ligar agora" (leva a
  "O que estranhos veem"). **Feito quando**: renderiza com o nome do pet, o código e os dois estados.
- [ ] T048 [US2] [FE] Visão do dono na página pública conforme `V2-resgate-visao-dono*.dc.html`:
  após hidratar, `POST /api/scan` com o token; se `owner: true`, mostra a faixa, desativa os botões
  e liga "Editar" a "O que estranhos veem". O token vem de `core/tags/owner-probe.service.ts`
  (`contracts/integration-002-004.contract.md` §5.2): sem chave de sessão no `localStorage`, nada é
  importado; com chave, o cliente Supabase é importado dinamicamente. Nenhum import de `core/auth`. **Feito quando**: teste cobre `owner` verdadeiro e falso.
- [ ] T049 [US2] [QA] `e2e/activation.spec.ts`: tag não ativada → cadastro (com SMS simulado) →
  novo pet → PIN → sucesso → visão do dono; PIN errado; bloqueio após 5 erros.
  **Feito quando**: passa nas três larguras.

**Checkpoint**: P1 completa. Com o lote-001 importado, o produto já serve.

---

## Phase 5: User Story 3 — Aviso de scan e histórico (P2)

- [x] T050 [US3] [BE] `0030_rpc_scans.sql`: `register_scan`, `set_scan_location` (só `service_role`)
  com deduplicação de 10 min, token de localização e `status_at_scan`.
  **Feito quando**: pgTAP cobre novo scan, duplicado e dono.
- [x] T051 [US3] [BE] Edge Function `supabase/functions/register-scan/index.ts`: ações `scan`,
  `location` e `resend` conforme o contrato; interface `sendEmail` em `_shared/email.ts` com a
  implementação HTTP do provedor (`TODO(EMAIL_PROVIDER)`) e uma implementação de teste em memória.
  **Feito quando**: `deno test` cobre dono (não grava), duplicado (não envia), tag bloqueada (grava
  sem e-mail) e falha de envio (scan fica com `notified_at` nulo).
- [x] T052 [P] [US3] [BE] Modelos de e-mail em `supabase/functions/_shared/email-templates.ts`:
  "tag escaneada" e "localização enviada", em PT-BR, sem dados de quem escaneou.
  **Feito quando**: teste de snapshot dos dois modelos.
- [x] T053 [US3] [BE] `0033_cron.sql`: `pg_cron` de reenvio (5 min) e limpeza de ativações
  pendentes vencidas (diária). **Feito quando**: os jobs aparecem em `cron.job`.
- [ ] T054 [US3] [FE] Página de resgate: disparar `POST /api/scan` após hidratar; "Enviar onde estou"
  pede a localização do navegador e envia a `/api/scan/location`; estados de permissão negada e de
  sucesso ("Localização enviada para a Ana"). **Feito quando**: teste de componente com
  geolocalização simulada cobre permitir e negar.
- [ ] T055 [P] [US3] [FE] `core/scans/scan.service.ts`: lista de `my_scans` com filtros.
  **Feito quando**: teste unitário.
- [ ] T056 [US3] [FE] Tela "Histórico de scans" conforme `V2-scans*.dc.html` (claro e escuro):
  filtros, cartão do mapa com Leaflet carregado sob demanda (círculo para aproximada, pino com raio
  para precisa), lista agrupada por mês, nota de privacidade, estado vazio.
  **Feito quando**: teste de componente; o chunk do Leaflet não entra no bundle inicial.
- [ ] T057 [US3] [QA] `e2e/scans.spec.ts`: abrir a página gera 1 scan e 1 e-mail (provedor
  simulado); recarregar não duplica; buscar o HTML sem JS não gera; dono não gera; localização
  precisa atualiza o scan. **Feito quando**: passa.
- [x] T058 [US3] [QA] `supabase/tests/rls_scans.test.sql`: "Testes de isolamento entre vínculos".
  **Feito quando**: passa.

---

## Phase 6: User Story 4 — Modo perdido (P2)

- [x] T059 [US4] [BE] `set_lost_mode` em `0031_rpc_tutor.sql`. **Feito quando**: pgTAP cobre ligar,
  desligar, sem tag ativa e a preservação de `lost_since` ao religar.
- [ ] T060 [US4] [FE] Tela "Ativar modo perdido" conforme `V2-modo-perdido*.dc.html` (claro e
  escuro): recado com contador de 280, dois interruptores, prévia do alerta em tablet e desktop,
  "Ativar modo perdido" e "Agora não". **Feito quando**: teste de componente.
- [ ] T061 [US4] [FE] Página de resgate em modo perdido conforme `V2-resgate-perdido*.dc.html`:
  bloco âmbar, "Perdido há N" calculado no servidor, selo de recompensa, recado rotulado; cada item
  só aparece se veio na projeção. **Feito quando**: teste de componente cobre as combinações.
- [ ] T062 [US4] [FE] Desativar ("Pet encontrado") a partir da página do pet, com confirmação
  simples. **Feito quando**: teste de componente.
- [ ] T063 [US4] [QA] e2e: ativar → página pública muda → desativar → volta ao normal; item
  desligado não aparece no HTML. **Feito quando**: passa.

---

## Phase 7: User Story 5 — O que estranhos veem (P2)

- [ ] T064 [US5] [FE] `core/pets/rescue-profile.service.ts`: ler e salvar as opções `show_*` e
  `lost_show_*`. **Feito quando**: teste unitário.
- [ ] T065 [US5] [FE] Tela "O que estranhos veem" conforme `V2-visibilidade*.dc.html` (claro e
  escuro): três grupos, "Nome e foto" travado em "Sempre", interruptores, "Pré-visualizar" e
  "Salvar"; ligar telefone ou WhatsApp sem celular confirmado mostra o aviso e leva à confirmação.
  **Feito quando**: teste de componente cobre o aviso.
- [ ] T066 [US5] [FE] Prévia: reutilizar os componentes da página de resgate com as escolhas ainda
  não salvas, na visão do dono. **Feito quando**: a prévia reflete um interruptor alterado sem salvar.
- [ ] T067 [US5] [QA] e2e: desligar "Cuidados", salvar, abrir a página pública sem login e conferir
  que o texto não está no HTML bruto. **Feito quando**: passa.

---

## Phase 8: User Story 6 — App do tutor e vínculo pelo app (P2)

- [x] T068 [US6] [BE] `my_dashboard()` em `0031_rpc_tutor.sql`. **Feito quando**: pgTAP confere o
  conteúdo para a Ana do seed e que não traz nada de outro tutor.
- [ ] T069 [US6] [FE] Painel conforme `V2-painel*.dc.html` (claro e escuro, três larguras): capa do
  pet com seletor quando há mais de um, cartão lima do último scan (só se houver scan nas últimas
  48 h), cartões de número, atalho do modo perdido, "Seus pets", "Últimos scans" (desktop),
  "Adicionar pet", cartão de ativação pendente. Estado sem pets: convite para cadastrar o primeiro.
  **Feito quando**: teste de componente cobre com e sem pets, com e sem scan recente.
- [ ] T070 [US6] [FE] Página do pet conforme `V2-pet*.dc.html`: capa, chips, linha do modo perdido,
  cartões da tag e do último scan, menu. Pet sem tag: botão "Vincular tag" no lugar do cartão da
  tag. Tag bloqueada: aviso "Tag bloqueada. Fale com o suporte." **Feito quando**: teste cobre os
  três estados da tag.
- [ ] T071 [P] [US6] [FE] Editar dados do pet (reutiliza os formulários do novo pet) e remover pet,
  com a confirmação de liberar a tag. **Feito quando**: teste de componente.
- [ ] T072 [US6] [FE] Vincular tag, passo 1, conforme `V2-vincular-codigo*.dc.html`: abas "Escanear
  QR" e "Digitar código"; leitura com `BarcodeDetector` e reserva `jsQR` sob demanda; falha de
  câmera cai em "Digitar código"; `check_tag_for_link` mostra "Código válido · tag disponível".
  **Feito quando**: teste cobre câmera indisponível e código inválido.
- [ ] T073 [US6] [FE] Vincular tag, passo 2 (PIN), conforme `V2-vincular-pin*.dc.html`,
  reutilizando o componente de PIN de T046. **Feito quando**: vincula com o seed em teste de integração.
- [ ] T074 [US6] [QA] e2e: entrar, abrir a Mel, vincular `2FX8-CN73-F` digitando código e PIN;
  conferir as três larguras e o tema escuro com axe. **Feito quando**: passa sem violações AA.

---

## Phase 9: User Story 7 — Admin (P2)

- [x] T075 [US7] [BE] `0034_rpc_admin.sql` (arquivo próprio, separado das RPCs do tutor; não usar
  `0031b`): todas as RPCs `admin_*` de `contracts/admin.contract.md` e `admin_insert_batch`.
  **Feito quando**: pgTAP cobre `forbidden` para tutor e as transições de situação.
- [x] T076 [US7] [BE] ⚠ **Só desenvolvimento até T011 passar: não fazer deploy em produção nem gerar lote real.** Edge Function `admin-create-batch`: geração de códigos e PINs, cálculo da
  máscara, inserção, e o pacote **só com `pins.csv`** enquanto a etiqueta não existe (o PDF entra em
  T084). **Feito quando**: `deno test` gera um lote de 54, todos válidos e distintos; o PIN do CSV
  ativa o código; nenhum PIN aparece na saída de log do teste.
- [ ] T077 [P] [US7] [FE] `core/admin/admin-tag.service.ts`. **Feito quando**: teste unitário.
- [ ] T078 [US7] [FE] Tela "Lotes" conforme `V2-admin-lotes*.dc.html`: contadores, tabela (lista de
  cartões no celular), aviso do pacote, "Criar lote" com formulário, confirmação e download do
  pacote. **Feito quando**: teste de componente; o download não fica em memória depois de salvo.
- [ ] T079 [US7] [FE] Tela "Códigos" conforme `V2-admin-codigos*.dc.html`: busca, filtros, tabela
  com seleção e paginação, "Reimprimir seleção". **Feito quando**: teste cobre busca e filtro.
- [ ] T080 [US7] [FE] Tela "Detalhe do código" conforme `V2-admin-codigo*.dc.html`: vínculo, scans,
  histórico, ações com confirmação, exibição única do PIN novo. **Feito quando**: teste cobre cada ação.
- [ ] T081 [P] [US7] [FE] Tela "Fila": scans de tags não vinculadas, pedidos de 2ª via, tags
  travadas, conforme `V2-admin-fila*.dc.html` (três seções, filtro por chips; no celular, um cartão por linha). **Feito quando**: teste de componente.
- [ ] T082 [P] [US7] [FE] Tela "Auditoria" conforme `V2-admin-auditoria*.dc.html`: lista filtrável por evento e por código, com "Carregar mais".
  **Feito quando**: teste de componente.
- [ ] T083 [US7] [QA] `e2e/admin.spec.ts`: criar lote, baixar o pacote, bloquear um código e
  conferir "tag não encontrada" na página pública, reemitir PIN, encerrar vínculo; tutor comum não
  entra em `/admin`. **Feito quando**: passa.
- [ ] T084 🔒 [US7] [BE] Edge Function `admin-labels` e inclusão de `etiquetas.pdf` no pacote do
  lote, conforme `contracts/label-rendering.contract.md`. **Bloqueada** até a fonte
  `JetBrainsMono-Bold.ttf` e as máscaras do lote-001 chegarem. **Feito quando**: os critérios de aceite 1, 2, 3 e 5 do contrato passam em teste.
- [ ] T085 🔒 [US7] [QA] Teste cruzado de matriz e máscara contra o lote-001 e roteiro de leitura
  física em `quickstart.md`. **Bloqueada** como T084. **Feito quando**: passa e o roteiro está escrito.
- [x] T086 [US7] [BE] Enquanto T084 estiver bloqueada: botão "Exportar códigos do lote" (CSV só
  com códigos, sem PINs) e instrução de usar o script local, em `docs/producao-tags.md`, junto das
  notas de produção do contrato. **Feito quando**: o CSV sai e o documento existe.

---

## Phase 10: User Story 8 — Passar adiante e segunda via (P3)

- [x] T087 [US8] [BE] `release_tag` e `request_tag_replacement` em `0031_rpc_tutor.sql`
  (`end_assignments_for_account` já existe desde T019A). **Feito quando**: pgTAP cobre os itens do
  contrato e o isolamento após a troca de dono.
- [ ] T088 [US8] [FE] Tela "Gerenciar tag" conforme `V2-tag*.dc.html` (claro e escuro): cartão do
  código, três ações e "Desvincular". **Feito quando**: teste de componente.
- [ ] T089 [US8] [FE] Fluxo "Passar a tag adiante" e "Desvincular": confirmação, depois a tela do
  PIN novo com "Copiar" e o aviso de que não aparece de novo; sair da tela apaga o PIN da memória.
  **Feito quando**: teste confere que o PIN não fica em nenhum estado depois de sair.
- [ ] T090 [US8] [FE] Fluxo de segunda via: danificada (confirmação e mensagem de pedido
  registrado) e perdida (confirmação explicando que o endereço antigo para de funcionar).
  **Feito quando**: teste de componente cobre os dois.
- [ ] T091 [US8] [QA] e2e: Ana passa a tag adiante; outra conta (criada pelo próprio teste, pela
  API de admin, com celular confirmado) ativa com o PIN novo; o PIN antigo
  falha; a outra conta não vê scans da Ana. **Feito quando**: passa.

---

## Phase 11: Polish

- [ ] T092 [P] [QA] Gate completo de `contracts/rls-expectations.md`, incluindo a busca por
  segredos em `dist/` e a checagem dos chunks do bundle público. **Feito quando**: tudo verde.
- [ ] T093 [P] [QA] axe em todas as telas desta spec, três larguras, claro e escuro onde houver.
  **Feito quando**: zero violações AA.
- [ ] T094 [P] [FE] Revisão de textos: todos os textos de UI passam por i18n; nenhum texto fixo em
  componente. **Feito quando**: `ng extract-i18n` não deixa texto de fora.
- [ ] T095 [P] [FE] Estados vazios, de carregamento e de erro em todas as listas, cada um
  terminando com um próximo passo. **Feito quando**: checklist por tela no PR.
- [x] T096 [BE] Atualizar a memória do agente de backend com a matriz de RLS final e os contratos
  expostos. **Feito quando**: arquivo em `.claude/agent-memory/backend-supabase/`.
- [ ] T097 [QA] Rodar `specs/003-tag-qr/quickstart.md` do começo ao fim e corrigir o que divergir.
  **Feito quando**: todos os passos funcionam numa máquina limpa.
- [ ] T098 Parar e avisar o William: pedir `/security-review` e `/code-review` antes do merge em `develop`.

---

## Operação (fora das fases; pode ser feita já, antes de qualquer tag sair)

Estas duas tarefas não dependem das specs 002 e 004. Elas protegem o lote-001, que pode ser
impresso antes de o MVP ficar pronto.

- [ ] T099 [FE] Página de contingência de pré-lançamento: enquanto a rota `/:code` de verdade não
  existir em produção, qualquer caminho de um segmento em `tagfaro.com.br` responde `200` com uma
  página estática "Este pet tem dono. Em breve mais informações.", com o logo, sem JavaScript
  obrigatório, sem dados e com `noindex`. Implementar como a própria rota `/:codigo` atual
  renderizando essa página fixa (substituindo o conteúdo provisório de
  `src/app/features/public/rescue-page/`), sem chamada a banco.
  **Feito quando**: `curl -i https://<preview>/7K3M-Q9XA-C` e `curl -i https://<preview>/qualquer`
  devolvem `200` com a mensagem, e o teste e2e sem JavaScript passa.
- [ ] T100 Checklist de domínio em `docs/dominio-tagfaro.md` (para o William executar): adicionar
  `tagfaro.com.br` ao projeto na Vercel; criar no Registro.br os registros DNS indicados; conferir
  HTTPS; renovar o domínio por vários anos e ativar renovação automática; registrar a data de
  vencimento e um lembrete anual; confirmar que `HTTPS://TAGFARO.COM.BR/<CODIGO>` em maiúsculas
  abre a página. **Feito quando**: o documento existe e cada item tem um campo de data de conclusão.

---

## Phase 12: Endurecimento contra ataque e automação

**Objetivo**: aplicar `contracts/security-hardening.contract.md` (decisão do William em
2026-11-21). Depende da fase de endurecimento da `004` (portão de catálogo, cabeçalhos, CI). Leia
os dois contratos antes da primeira tarefa.

- [x] T101 [BE] Migration `0035_endurecimento_tags.sql`: `rpc_guard`, os escopos novos, o teto de
  20 pets por tutor, o teto de 3 pedidos de 2ª via abertos e os limites do bucket `pet-photos`
  (contrato §4 e §6). Chamar `rpc_guard` no começo de cada RPC da tabela do §4.
  **Feito quando**: `supabase/tests/endurecimento_tags.test.sql` passa e o portão
  `security_catalog.test.sql` continua verde com todas as tabelas da `003`.
- [x] T102 [BE] Chave do servidor (contrato §2): comparação em tempo constante, chave anterior
  aceita durante a rotação, recusa de chave com menos de 32 caracteres, tetos globais
  `resolve_global_min` e `scan_global_min` com um evento de auditoria por minuto.
  **Feito quando**: `deno test` cobre os seis casos do contrato §7.
- [x] T103 [BE] `register-scan`: limites `scan_ip_min` e `scan_ip_hour` (contrato §3).
  **Feito quando**: o 21º pedido do mesmo `ip_hash` em um minuto devolve `200` e não grava scan
  nem envia e-mail.
- [ ] T104 [FE] `POST /api/scan` e `/api/scan/location` no servidor do app: só JSON, até 2 KB,
  chave desconhecida recusada, IP só dos cabeçalhos da Vercel (contrato §3). Política `tag` de
  cabeçalhos nas rotas públicas da tag e piso de 150 ms nos três estados (contrato §1).
  **Feito quando**: teste do servidor cobre `413`, `415` e `400`, e `npm run check:headers` passa.
- [x] T105 [P] [BE] Admin (contrato §5): `is_admin()` conferido dentro de `admin-labels`; limites
  de `admin-create-batch`, `admin_reissue_pin` e `admin_end_assignment`.
  **Feito quando**: pgTAP e `deno test` cobrem `forbidden` para tutor e `too_many_requests` no
  estouro.
- [ ] T106 [P] [FE] Texto e tratamento de `too_many_requests` e de `pet_limit` nas telas do
  tutor; todo link da página da tag para o app como `<a href>` comum (contrato §1).
  **Feito quando**: teste de componente cobre os dois erros e um teste prova que a página da tag
  não usa `routerLink` para fora dela.
- [ ] T107 [QA] `e2e/security/tag-page-hardening.spec.ts` (contrato §7) e o passo a passo de
  rotação da chave em `quickstart.md`. **Feito quando**: passa; a rotação foi executada uma vez
  no ambiente local seguindo o roteiro.

**Checkpoint**: todos os testes da spec, os dois portões de segurança e a conferência no preview
(T037A) repetida depois dos cabeçalhos novos.

---

## Dependencies & Execution Order

- **Setup → Foundational → histórias**. Nenhuma história começa antes do checkpoint da Phase 2.
- **US1** não depende de outra história. **US2** depende de US1 (página "não ativada" e visão do dono).
- **US3** depende de US1 e US2. **US4** e **US5** dependem de US1 e US2 e são independentes entre si.
- **US6** depende de US2 (componente de PIN, serviços de pet). **US7** só depende da base.
- **US8** depende de US2 e US6.
- Dentro de cada história: banco e contrato primeiro, depois Edge Function, depois frontend, depois e2e.
- 🔒 T084 e T085 dependem de entregas do William e não bloqueiam o resto. T011 foi desbloqueada em 2026-11-21.

### Parallel Opportunities

- Phase 2: T015, T016, T018, T019 em paralelo depois de T013/T014; T010 a qualquer momento.
  T019A depois de T017 e T019.
- US7 (admin) pode andar em paralelo com US3–US6, por outro agente, depois da base.
- Em cada história, BE e FE correm em paralelo depois que a migration da RPC existe.

## Implementation Strategy

1. **MVP mínimo**: Phases 1 a 4, mais a importação do lote-001 (T006). Com isso as 54 tags já
   funcionam: ativar e ser encontrado.
2. **Segundo incremento**: US3 (avisos), depois US4 e US5.
3. **Terceiro**: US6 e US7 (admin sem etiqueta; a etiqueta entra quando o script chegar).
4. **Quarto**: US8.
5. Pare em cada checkpoint, rode a verificação e relate antes de seguir.

## Verificação final

```bash
npm run lint
npm test -- --watch=false
npm run build
supabase db reset && supabase test db
deno test supabase/functions/
npm run e2e
```

Tudo verde, o gate de `contracts/rls-expectations.md` aprovado, e então o gate humano.
