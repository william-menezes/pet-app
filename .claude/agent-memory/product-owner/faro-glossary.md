---
name: faro-glossary
description: Entidades canônicas do domínio Faro (Tutor, Pet, TagCode, Assinatura, PerfilDeResgate, ScanEvent...) e onde estão definidas
metadata:
  type: project
---

O glossário canônico do Faro vive em `CLAUDE.md` (seção "Domain Glossary"). É a fonte
dos nomes que toda spec deve reusar. Não redefinir nem inventar nomes conflitantes; se um
conceito não existir, sinalizar explicitamente na spec em vez de cunhar nome novo.

**Why:** specs devem ser coerentes e contínuas entre si; nomes divergentes quebram o encaixe
com `models/` (frontend) e tabelas (backend).
**How to apply:** ao escrever Key Entities/FR, usar exatamente estes termos.

Entidades (resumo):
- **Tutor** — dono do(s) pet(s); titular dos dados (LGPD).
- **Plano (Plan)** — tier e limites (nº de pets, storage, recursos).
- **Assinatura (Subscription)** — vínculo tutor↔plano; status `free | trial | ativo | carência | cancelado`. Piso = free (freemium); sem Pro → volta pro free, NUNCA read-only.
- **Pet** — animal monitorado (cão/gato no MVP); inclui temperamento.
- **TagCode (Código)** — código opaco do pool; status `available | assigned | blocked`; 1 pet opcional; histórico de realocação.
- **RegistroDeSaude (HealthRecord)** — vacinação | alimentação | consulta | vermifugação | peso | medicação (+anexos).
- **Anexo (Attachment)** — arquivo no Storage ligado a registro/pet.
- **PerfilDeResgate (RescueProfile)** — projeção pública do pet + visibilidade + modo perdido.
- **ScanEvent** — leitura do QR: timestamp, geo (método/precisão), destino do alerta.
- **Lembrete (Reminder) / Notificação** — agendamento + entrega (in-app/e-mail).
- **CoTutor** — compartilhamento de pet (plano Família).
- **Admin** — backoffice (pool de códigos, planos, suporte, realocação, fila de scans inativos).
- (Fase 2) Prestador, AssinaturaPrestador, Anúncio, ServiceListing — marketplace.

Conceitos NÃO no glossário (introduzidos por features, sinalizar como tal): **Conta/Usuário**
(o glossário só nomeia os papéis Tutor/Admin), **Sessão**, **Identidade externa (Google)**,
**Evento de Auditoria de Autenticação** (Princípio VII menciona auditoria mas não nomeia a entidade).
Ver [[faro-specs-roadmap]].
