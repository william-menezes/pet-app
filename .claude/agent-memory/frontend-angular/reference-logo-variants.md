---
name: reference-logo-variants
description: Mapa das variações de logo em public/logos/ e quando usar cada uma (por tema/fundo)
metadata:
  type: reference
---

Logos da marca Faro ficam em `public/logos/` (servidas em `/logos/*.svg`). Escolha a variante pelo **fundo/tema** onde a logo aparece:

- `logo-full-light.svg` — wordmark escuro (#25337A) + pata verde → **tema light** (fundo claro)
- `logo-full-light2.svg` — wordmark branco + pata escura (#25337A) → **fundo verde**
- `logo-full-dark.svg` — wordmark branco + pata verde → **tema dark** (fundo escuro)
- `logo-compact.svg` — só a pata verde → dark **ou** light
- `logo-compact2.svg` — só a pata escura (#25337A) → **fundo verde**

Padrão de troca por tema (usado no login): dois `<img>` (light/dark) alternados por CSS com `:host-context(.faro-dark)`. O seletor de dark mode do app é a classe `.faro-dark` (ver `app.config.ts`).

**How to apply:** Ao inserir a logo numa tela, cheque a cor do fundo daquela região. Fundo verde exige as variantes `2`. `.faro-dark` troca full-light↔full-dark.
