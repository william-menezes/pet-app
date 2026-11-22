# Documentação do Faro — Índice

> **Faro** é uma tag de coleira com QR Code para resgate de pets. O MVP é só a tag. Mercado: Brasil (PT-BR).

Este índice foi reescrito em 2026-11-21, depois do pivô do MVP. Ele diz o que vale hoje e o que
ficou para trás.

## O que vale (em ordem de autoridade)

| # | Documento | O que é |
|---|---|---|
| 1 | [`../.specify/memory/constitution.md`](../.specify/memory/constitution.md) | **Constituição v2.1.0**: os oito princípios inegociáveis. Em conflito, ela vence. |
| 2 | [`decisoes-pivo.md`](decisoes-pivo.md) | Todas as decisões de produto, marca e técnica tomadas no pivô. |
| 3 | [`../CLAUDE.md`](../CLAUDE.md) | Stack, estrutura de pastas, contrato do código da tag, convenções, glossário, fases. |
| 4 | [`../DESIGN.md`](../DESIGN.md) e [`../PRODUCT.md`](../PRODUCT.md) | Sistema visual e contexto de produto. |
| 5 | [`../specs/`](../specs/) | `001-login` (feito), `002-ui-zardui`, `003-tag-qr`, `004-conta-tutor`. |
| 6 | [`zardui-faro.md`](zardui-faro.md) | Tema Tailwind, ajustes nos componentes do ZardUI, ícones, tema escuro e larguras. |
| 7 | [`dev-pipeline.md`](dev-pipeline.md) | Quem faz o quê, portões e como pedir a execução. |
| 8 | [`git-workflow.md`](git-workflow.md) | Branches `develop` → `homolog` → `master`. |

Fora do repositório, no Claude Design: o canvas *Faro · Telas do MVP* (páginas "MVP v2", também
exportadas em `design/telas-v2/`) e o *Faro Design System*.

## Documentos anteriores ao pivô

Descrevem a plataforma de saúde por assinatura, em PrimeNG. Cada um tem um aviso no topo.
**Não use para decidir nada.**

| Documento | Situação |
|---|---|
| `architecture.md` | Histórico. O desenho atual está nos planos das specs 002 a 004. |
| `backend-supabase.md` | Histórico. Modelo de dados atual: `specs/003-tag-qr/data-model.md` e `specs/004-conta-tutor/data-model.md`. |
| `frontend.md` | Histórico. Vale `CLAUDE.md`, `DESIGN.md` e `zardui-faro.md`. |
| `design-system.md`, `claude-design-brief.md` | Histórico. Vale `DESIGN.md`. |
| `test-strategy.md` | Histórico. O gate atual está em `specs/*/contracts/rls-expectations.md`. |
| `primeng.md` | Referência do PrimeNG (2,4 MB). Sem uso depois da spec 002; candidato a remoção. |

## Decisões em aberto

| Decisão | Onde se resolve |
|---|---|
| `TODO(BILLING_MODEL)`: assinatura ou tag comprada | decisão dos sócios; hoje `can_link_tag` sempre permite |
| `TODO(EMAIL_PROVIDER)`: envio do aviso de scan | plano da spec 003 |
| `TODO(SMS_PROVIDER)`: confirmação do celular | plano da spec 004 |
| `TODO(PIN_LENGTH)`: PIN de 8 caracteres em lotes futuros | spec 003, `research.md` §3 |
| Retenção de scans e auditoria (LGPD) | sem janela definida |
| Logo redesenhado em Outfit | o William vai entregar os arquivos |
| `tools/tag-generator/` e os códigos do lote-001 | o William vai adicionar ao repositório |

## Roadmap

- **MVP**: `002-ui-zardui` → `004-conta-tutor` → `003-tag-qr`.
- **Fase 2**: carteira de saúde e lembretes.
- **Depois, sem ordem**: emergência, família e cuidadores, peso, relatório para o veterinário.
- **Ideia, sem compromisso**: checagem de sintomas por IA.

- [`seguranca-producao.md`](seguranca-producao.md): o que o William precisa ligar nos painéis (Supabase, Vercel, Cloudflare, GitHub) antes de abrir.

*Última atualização: 2026-11-21. Constituição em v2.1.0.*
