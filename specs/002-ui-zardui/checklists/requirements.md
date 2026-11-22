# Specification Quality Checklist: Nova identidade visual e base de interface responsiva

**Purpose**: Validar a qualidade da especificação antes de avançar para o planejamento técnico
(`/speckit.plan`).
**Created**: 2026-11-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] CHK001 Nenhum detalhe de implementação (frameworks, bibliotecas de interface, linguagens,
      nomes de arquivo, nomes de variável, mecanismos de armazenamento do navegador) vazou para a
      spec. A única ocorrência de nome de tecnologia é o identificador da pasta e da branch
      (`002-ui-zardui`), herdado e declarado na nota de domínio (Constituição, Princípio IV).
- [x] CHK002 Focada em valor para quem usa (quem achou, Tutor, Admin) e no porquê; o "como" está
      no `plan.md`.
- [x] CHK003 Escrita em PT-BR, em linguagem de produto. Nomes de fonte (Outfit, Inter) e de cor
      (lima, tinta, navy, âmbar) são decisões de marca, não de stack.
- [x] CHK004 Todas as seções obrigatórias do template estão preenchidas (User Scenarios & Testing,
      Requirements, Success Criteria, Assumptions), sem placeholders.

## Requirement Completeness

- [x] CHK005 **Zero** marcadores `[NEEDS CLARIFICATION]`. Os pontos que poderiam virar pergunta
      foram resolvidos por premissa documentada (tema padrão, botão "Voltar" do login, página
      inicial, destinos provisórios, ícone do produto) porque a pessoa responsável não estava
      disponível e nenhum deles bloqueia o planejamento.
- [x] CHK006 A seção "Clarifications" lista as decisões já tomadas em 2026-11-21
      (`docs/decisoes-pivo.md` e briefing).
- [x] CHK007 Todos os requisitos funcionais (FR-001 a FR-047) são testáveis e não ambíguos; os que
      têm número (44 pontos, 4,5:1, 3:1, 2px, 320 de largura) o declaram.
- [x] CHK008 Os Success Criteria (SC-001 a SC-014) são mensuráveis e agnósticos de tecnologia.
- [x] CHK009 Cada Success Criteria é verificável sem conhecer a implementação.
- [x] CHK010 As quatro regras de cor, o foco, o toque, o contraste, os botões e os ícones oficiais
      estão capturados como requisitos (FR-002, FR-003, FR-006 a FR-010).
- [x] CHK011 As três larguras e as quatro estruturas de tela (app do tutor, fluxo, admin, página
      pública) estão capturadas (FR-016 a FR-023).
- [x] CHK012 O escopo do tema escuro (só o app do tutor; preferência por aparelho; tela de escolha
      na spec 004) está capturado sem ambiguidade (FR-028 a FR-035).
- [x] CHK013 A preservação do comportamento do login está expressa por referência à spec 001, sem
      reescrever os requisitos dela (FR-037, FR-038, SC-002).
- [x] CHK014 Edge cases relevantes identificados: tela estreita, zoom, textos longos, pet sem foto,
      aparelho em modo escuro em área clara, armazenamento indisponível, troca de tema com o app
      aberto, menos movimento, alto contraste, rede lenta, cópia offline antiga, logo com outra
      proporção, destino ainda não construído.
- [x] CHK015 O que está fora do escopo está listado explicitamente, incluindo as telas das specs
      003 e 004 e o redesenho do wordmark.
- [x] CHK016 Dependências e premissas registradas em Assumptions.

## Feature Readiness

- [x] CHK017 Cada user story tem prioridade (P1, P2, P2, P3, P3) e é independentemente testável,
      com a seção "Independent Test".
- [x] CHK018 Cada user story tem cenários de aceitação no formato Dado/Quando/Então.
- [x] CHK019 Todos os FR mapeiam para pelo menos uma user story, edge case ou critério de sucesso:
      FR-001 a FR-015 → US1; FR-036 a FR-039 → US2; FR-016 a FR-027 → US3; FR-028 a FR-035 → US4;
      FR-040 a FR-042 → US5; FR-043 a FR-047 → US1, US2 e os critérios SC-006 e SC-014.
- [x] CHK020 Os Success Criteria cobrem acessibilidade (SC-001, SC-004, SC-005), preservação do
      login (SC-002, SC-013), responsividade (SC-003), limpeza (SC-006), Rescue-First (SC-007),
      tema (SC-008), cópia offline (SC-009), privacidade e desempenho (SC-010, SC-012) e a troca do
      logo (SC-011).

## Alinhamento com a Constituição do Faro (v2.0.0)

- [x] CHK021 **Princípio I (Rescue-First)**: a página pública não ganha dependência do app
      autenticado, do tema escuro nem de janelas sobrepostas (FR-024 a FR-027, SC-007); o fim da
      cópia offline elimina o risco de uma página de resgate desatualizada (FR-040, FR-041).
- [x] CHK022 **Princípio II (LGPD)**: nenhum dado pessoal novo; a preferência de tema fica no
      aparelho e fora da Conta (FR-031); fontes entregues pelo próprio produto, sem expor quem
      achou o pet a terceiros (FR-005, SC-010).
- [x] CHK023 **Princípio III (Segurança)**: nenhuma mudança de dados ou de regras de acesso (Out
      of Scope); o comportamento de segurança do login é preservado (FR-037).
- [x] CHK024 **Princípio IV (Spec-Driven)**: spec sem stack; decisões técnicas no plano.
- [x] CHK025 **Princípio V (Mobile-first e acesso universal)**: três larguras (FR-016), página
      pública sempre clara e sem janelas sobrepostas (FR-024, FR-025), sem cópia offline (FR-040),
      meta WCAG 2.1 AA (FR-008 a FR-011, FR-022), preparação para tradução (FR-045).
- [x] CHK026 **Princípio VI (MVP/YAGNI)**: histórias independentes; partes vazias do roadmap saem
      (FR-044); nenhuma tela das próximas specs é antecipada.
- [x] CHK027 **Princípio VII (Confiabilidade)**: destino não construído e falha ao guardar a
      preferência terminam em estado amigável, nunca em erro técnico (FR-023, FR-035).
- [x] CHK028 **Princípio VIII (Contrato físico)**: nada do que é impresso muda; o código da tag só
      muda de fonte na tela (FR-004).
- [x] CHK029 Terminologia do glossário usada (Tutor, Admin, Pet, Conta, Papel, Sessão, modo
      perdido, página de resgate, tag). Os termos de interface novos (identidade visual, tema,
      preferência de tema, estrutura de tela, peça de interface) estão definidos em Key Entities e
      não conflitam com o glossário.

## Notes

- Itens marcados `[x]` foram verificados na autorrevisão de quem escreveu a spec (sessão
  principal, 2026-11-21), sem a presença do William.
- **Pendências para o William conferir pela manhã** (nenhuma bloqueia o plano): tema padrão
  "sistema"; ícone do produto (focinho lima sobre navy); página inicial provisória; botão
  "Voltar" do login adiado para a spec 004. Estão em Assumptions e em `research.md` §R20.
- Em qualquer conflito, a Constituição (`.specify/memory/constitution.md`) prevalece.
