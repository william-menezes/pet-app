---
name: faro-specs-roadmap
description: Numeração NNN das specs do Faro, roadmap planejado e onde estão as decisões travadas vs em aberto
metadata:
  type: project
---

**Numeração de specs**: pastas `specs/NNN-nome/` com NNN zero-padded de 3 dígitos. Próximo número
= maior existente + 1. Conferir varrendo `specs/` (NÃO confiar só na memória — ver nota de staleness).

**Roadmap planejado** (de `docs/README.md`, seção "Roadmap de specs"):
`001 auth-contas-tutor` · `002 assinaturas-planos` · `003 cadastro-pets` · `004 registros-saude` ·
`005 tags-qr-codigos` · `006 pagina-resgate` · `007 lembretes-notificacoes` · `008 backoffice-admin` ·
`009 privacidade-lgpd`. Fase 2: `010 marketplace-prestadores`.

**Estado em 2026-06-29** (verificar com glob antes de usar):
- `000-bootstrap` — feito (Angular 21 scaffold; só plan.md+tasks.md, sem spec.md por ser setup).
- `001-login` — primeira feature de produto. Escopo restrito SÓ ao login (signup e recuperação de
  senha são specs irmãs FUTURAS). Faz parte da família `auth-contas-tutor` do roadmap, mas o
  usuário fatiou: login agora, signup/recuperação depois. Login NÃO está no caminho de resgate.

**Fonte única de decisões** = `docs/README.md` (seções "Decisões tomadas" e "Decisões em aberto").
Em conflito, a constituição vence.

Decisões TRAVADAS relevantes para specs:
- Modelo = **Freemium híbrido** (Grátis 1 pet / Pro ~R$19,90 até 3 / Família ~R$34,90 até 10; trial 14d).
- Sem Pro → volta pro Grátis, nunca read-only.
- Paleta C (Índigo #3A4FD6 + Verde-Lima #7FBF3F); tipografia Poppins+Inter.
- Infra Vercel + Supabase (São Paulo BR). Tema da página pública = claro fixo.
- Papel admin = `is_admin()` (sem custom claim no MVP).

Decisões EM ABERTO (cada uma já isolada por porta/abstração; resolver na spec indicada):
provedor de pagamento (Stripe vs Asaas, spec 002), provedor Geo-IP (spec 006), e-mail transacional
(spec 007), retenção/anonimização LGPD (spec 009), parâmetros de rate-limit + dígito verificador (spec 005).

Ver [[faro-constitution-principles]].
