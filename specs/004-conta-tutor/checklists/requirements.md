# Specification Quality Checklist: Conta do tutor

**Purpose**: validar a qualidade da especificação antes do planejamento técnico.
**Created**: 2026-11-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] CHK001 Nenhum detalhe de implementação (linguagem, framework, biblioteca, nome de tabela,
      endpoint, serviço de nuvem) na spec. Conferido por busca de termos de stack: só restam os
      nomes das specs irmãs (`002-ui-zardui`, `003-tag-qr`).
- [x] CHK002 Focada em valor para a pessoa e no porquê; o "como" está em `plan.md` e `research.md`.
- [x] CHK003 Escrita em PT-BR, em linguagem de produto, com o vocabulário de `PRODUCT.md` (tutor,
      tag, página de resgate, quem achou).
- [x] CHK004 Seções obrigatórias do modelo preenchidas: User Scenarios & Testing, Requirements,
      Success Criteria, Assumptions. Sem texto de exemplo remanescente.

## Requirement Completeness

- [x] CHK005 Zero `[NEEDS CLARIFICATION]`. Os pontos sem decisão do dono têm padrão concreto em
      Clarifications e Assumptions, e os que dependem de escolha externa estão em "Pontos em aberto".
- [x] CHK006 FR-001 a FR-062 são testáveis e não ambíguos; todo limite tem número (validade do
      código, intervalo de reenvio, tentativas, limites por conta, por número e por origem).
- [x] CHK007 SC-001 a SC-013 são mensuráveis e agnósticos de tecnologia.
- [x] CHK008 Todos os itens do escopo pedido estão cobertos: boas-vindas (FR-001), cadastro
      (FR-002 a FR-009), confirmação de e-mail (FR-010 a FR-015), celular por SMS (FR-016 a
      FR-029), destino de retorno (FR-030 a FR-033), recuperação de senha (FR-034 a FR-039), Conta
      (FR-040 a FR-046), privacidade (FR-047 a FR-052).
- [x] CHK009 Requisitos de segurança no espírito da `001`: mensagens genéricas (FR-006, FR-034,
      FR-053), limites no servidor (FR-021, FR-037, FR-043, FR-054), auditoria (FR-055), segredos
      no servidor (FR-056), isolamento (FR-057), SMS simulado fora de produção (FR-059).
- [x] CHK010 Edge cases identificados (16), incluindo leitores de e-mail que abrem links, outro
      aparelho, troca de celular abandonada, exclusão interrompida e destino de retorno malicioso.
- [x] CHK011 Escopo delimitado: seção "Out of Scope" lista MFA, troca de e-mail, pagamento e tudo
      o que é das specs `002` e `003`.
- [x] CHK012 Dependências e premissas registradas, com os padrões numéricos.
- [x] CHK013 Telas sem referência aprovada listadas em "Telas que ainda precisam de desenho".

## Feature Readiness

- [x] CHK014 Seis histórias com prioridade (P1, P1, P2, P2, P2, P3), cada uma com "Independent
      Test".
- [x] CHK015 Cenários de aceitação em Dado / Quando / Então.
- [x] CHK016 Todo FR está ligado a pelo menos uma história, edge case ou critério de sucesso.
- [x] CHK017 Os critérios de sucesso cobrem tempo de conclusão (SC-001, SC-010), eficácia de
      segurança (SC-003 a SC-008), direitos do titular (SC-009), retorno ao ponto de origem
      (SC-011), resgate (SC-012) e acessibilidade (SC-013).

## Alinhamento com a Constituição v2.0.0

- [x] CHK018 **I (Resgate primeiro)**: FR-058 e SC-012; a troca de celular nunca deixa o pet sem
      contato (FR-042); falha de SMS não afeta tags ativas (FR-027).
- [x] CHK019 **II (LGPD)**: dados mínimos (FR-002); telefone público só confirmado (FR-025);
      exportar e excluir (FR-047 a FR-052); aceite registrado (FR-005); auditoria sem dado pessoal
      (FR-055).
- [x] CHK020 **III (Segurança em profundidade)**: o tutor não se autoconfirma nem muda de papel
      (FR-007, FR-024); limites no servidor (FR-054); segredos no servidor (FR-056).
- [x] CHK021 **IV (Spec antes do código)**: spec sem stack; plano e tarefas separados.
- [x] CHK022 **V (Mobile first)**: três larguras, WCAG AA, PT-BR (FR-060); tema escuro só no app
      do tutor (FR-045).
- [x] CHK023 **VI (Simplicidade)**: histórias independentes; nada de plano, cobrança ou MFA.
- [x] CHK024 **VII (Auditoria)**: eventos do FR-055; todo estado com próximo passo (FR-062).
- [x] CHK025 **VIII (O que é impresso é para sempre)**: excluir conta nunca apaga código (FR-049,
      SC-009); nenhuma rota nova compete com o endereço da tag.
- [x] CHK026 Terminologia do glossário e da `001-login` reutilizada (Conta/Usuário, Papel, Sessão,
      Identidade Externa, Evento de Auditoria de Autenticação) sem redefinir; entidades novas
      nomeadas sem conflito.

## Notes

- Itens marcados `[x]` foram verificados na autorrevisão de 2026-11-21.
- Decisões que mudam o que estava nas telas aprovadas e precisam do olhar do dono: (1) a etapa
  "Confirme seu e-mail" entre "Criar conta" e "Confirmar celular"; (2) a saída "Agora não" na tela
  de informar celular; (3) a confirmação do celular não bloqueia o app.
- **As três decisões acima foram confirmadas pelo William em 2026-11-21.** As telas que não tinham
  desenho de referência foram desenhadas na mesma data.
- Pontos em aberto que bloqueiam **produção**, não o desenvolvimento: `TODO(SMS_PROVIDER)`,
  `TODO(EMAIL_PROVIDER)`, `TODO(LEGAL_TEXTS)`.
- Em qualquer conflito, vale a Constituição (`.specify/memory/constitution.md`).
