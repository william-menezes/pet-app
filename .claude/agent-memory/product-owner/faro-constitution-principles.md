---
name: faro-constitution-principles
description: Os 7 princípios da constituição do Faro e como costumam virar requisitos/invariantes nas specs
metadata:
  type: project
---

Constituição em `.specify/memory/constitution.md` (v1.1.0, ratificada 2026-06-05). Prevalece
sobre tudo. Os princípios que mais impactam specs e como traduzi-los:

**Why:** toda feature que toca resgate, dados públicos, PII ou pagamento precisa refletir estes
princípios — revisores bloqueiam o que não reflete.
**How to apply:** transformar cada princípio relevante em FR testável + Success Criteria + Edge case.

- **I. Rescue-First (NÃO-NEGOCIÁVEL)** → invariante recorrente: a página pública de resgate e a
  resolução do QR funcionam SEMPRE, para anônimos, independente de status de assinatura. Qualquer
  feature do painel deve declarar que NÃO introduz dependência de auth/assinatura na rota pública.
  Vira FR de invariante + SC de "zero regressão" verificável por teste.
- **II. LGPD por design (NÃO-NEGOCIÁVEL)** → minimização de dados; só expõe campo consentido;
  geo consentida e rotulada (precisa vs aproximada por IP); export/exclusão do titular; logs sem
  PII além do necessário. Vira FR de minimização + consentimento.
- **III. Segurança em profundidade & RLS-first (NÃO-NEGOCIÁVEL)** → RLS deny-by-default em toda
  tabela; público só via projeção/RPC whitelisted; códigos opacos não sequenciais com rate-limit
  anti-enumeração; segredos no servidor (Edge Functions). Em spec (agnóstica) vira: anti-injeção,
  proteção de token, mensagens genéricas/anti-enumeração — sem citar stack.
- **IV. Spec-Driven** → specs são AGNÓSTICAS DE STACK (nada de Angular/Supabase/cookies/SQL no
  spec.md; isso é do plan.md). Spec antes do código.
- **V. Mobile-first/perf/a11y/i18n** → rotas públicas SSR; painel CSR; WCAG 2.1 AA; PT-BR no MVP;
  orçamento de performance para rede móvel. Vira SC de latência/interatividade.
- **VI. MVP-first/YAGNI** → cada user story é fatia entregável e testável independentemente
  (P1/P2/P3); marketplace é Fase 2; complexidade exige justificativa.
- **VII. Observabilidade/Auditoria** → logar eventos sensíveis (scans, mudança de plano/pagamento,
  acessos/exclusões de dados, realocação de tag, eventos de auth). Vira FR de auditoria + SC de cobertura.

Ver [[faro-glossary]] e [[faro-spec-patterns]].
