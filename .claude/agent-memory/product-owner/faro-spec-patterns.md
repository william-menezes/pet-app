---
name: faro-spec-patterns
description: Padrões recorrentes ao escrever specs do Faro — formato, fatiamento de user stories, edge cases e clarifications típicos
metadata:
  type: feedback
---

Padrões que se repetem ao especificar features do Faro. Reusar para acelerar e manter consistência.

**Why:** o template Spec Kit + a constituição impõem uma forma estável; reaproveitar evita retrabalho
e divergência entre specs.
**How to apply:** ao iniciar uma nova spec, partir destes padrões.

Formato e procedimento:
- Template em `.specify/templates/spec-template.md`. Seções obrigatórias: User Scenarios & Testing,
  Requirements (FR-xxx), Success Criteria (SC-xxx), Assumptions. Há checklist-template.md para o
  `checklists/requirements.md` (Specification Quality Checklist).
- speckit-specify é user-invocable-only; o PO executa o procedimento manualmente.
- Atualizar `.specify/feature.json` -> `{"feature_directory": "specs/NNN-nome"}`.
- Criar branch `NNN-nome` (a partir de master). Tudo em PT-BR; identificadores em kebab-case.
- Máx. 3 `[NEEDS CLARIFICATION]`, só alto impacto, sempre com default proposto registrado em Assumptions.

Fatiamento típico de user stories (P1/P2/P3): P1 = caminho feliz + erros do mecanismo central;
P2 = método/conveniência alternativo; P3 = persistência/ciclo de vida (sessão, logout, etc.).
Cada uma INDEPENDENTEMENTE testável (com seção "Independent Test") e Acceptance em Given/When/Then.

Requisitos de segurança que aparecem com frequência (capturar como FR agnósticos — o QUÊ, não o COMO):
anti-injeção, proteção do token contra XSS, rate-limit/anti-bruteforce, mensagens genéricas +
anti-enumeração (resposta idêntica para credencial inválida vs conta inexistente, inclusive em
tempo de resposta), auditoria de eventos sensíveis, minimização LGPD, transporte seguro.

Edge cases recorrentes em fluxos de painel/auth: credenciais inválidas, recurso inexistente,
excesso de tentativas, usuário já autenticado, sessão expirada, falha/cancelamento de provedor
externo, perda de conexão, conta bloqueada.

Clarifications recorrentes: confirmação de e-mail como pré-requisito, parâmetros exatos de
rate-limit, MFA (sempre tratar como fase futura/out-of-scope a menos que pedido).

Success Criteria sempre mensuráveis e agnósticos: tempo para concluir, % de sucesso na 1ª
tentativa, latência percebida em rede móvel, eficácia anti-bruteforce, cobertura de auditoria,
e SC de "zero regressão Rescue-First" sempre que a feature for do painel.

Ver [[faro-constitution-principles]] e [[faro-glossary]].
