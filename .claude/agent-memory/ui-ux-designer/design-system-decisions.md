---
name: design-system-decisions
description: Decisões de identidade visual travadas do Faro — paleta, tipografia, tokens e invariantes visuais
metadata:
  type: project
---

# Decisões do Design System Faro (travadas)

## Paleta selecionada — Opção C "Faro Noturno"
- Primária: Índigo `#3A4FD6` (tom 500, passa AA-normal 6.42:1 com texto branco)
- Hover/pressed: `#2D3CAC` (tom 600)
- Accent: Verde-Lima `#7FBF3F` — CTA secundário, selos (texto **escuro** sobre lima)
- Modo perdido: âmbar `--faro-lost-band: #C26A12` (urgência calma; NUNCA primária índigo nem danger vermelho)
- Semânticas: success `#157A3F` / info `#1F6FB2` / warn `#946005` / danger `#C23A2B`
- Superfícies: surface-0 `#FFFFFF`, app `#F7F8F8`, borda `#E2E5E7`
- Texto: strong `#13201E`, default `#33403D`, muted `#5E6C69`

## Tipografia (decidida)
- Display/Títulos: **Poppins** (600/700) — geométrica, arredondada, amigável
- Texto/UI: **Inter** (400/500/600) — legibilidade em telas pequenas, tabular-nums
- Mono: JetBrains Mono (apenas códigos de tag)

## Tokens de forma
- Raio: 8px (sm) / 12px (md) / 20px (lg — cards, dialogs)
- Espaço: escala 4/8/12/16/24/32px
- Toque mínimo: 44px (`--faro-touch-min`)
- Sombra: `0 1px 3px rgba(19,32,30,.08), 0 4px 12px rgba(19,32,30,.06)`

## Preset Angular
- `FaroPreset = definePreset(Aura, {...})` em `src/theme/faro-preset.ts`
- Tokens de marca em `src/styles/faro-ds.css`
- Dark mode via `.faro-dark` (classe na raiz)
- Página de resgate pública: tema claro fixo (previsibilidade em rua/sol)

## Invariantes visuais (não negociáveis)
- Modo perdido: usa faixa âmbar `--faro-lost-band`, NUNCA vermelho danger
- Página de resgate: foto do pet como elemento principal, UMA ação primária
- Texto normal sobre cor de ação: tom 600 como padrão conservador (índigo 500 exceção — já passa AA)
- Verde-lima (accent): SEMPRE texto escuro sobre ele (não branco)

## Logo (ainda pendente)
- Candidatos: A (Pata-Farol/Pin), B (Focinho+sinal), C (Casa-coleira)
- Conceito: geometria arredondada, funciona em 16px, monocromático
- Marca na página de resgate: discreta no rodapé

**Why:** Design system decidido em 2026-06-05, consolidado em `docs/design-system.md`.
**How to apply:** Toda nova tela deve seguir estes tokens; qualquer desvio precisa justificativa e atualização do design-system.md.
