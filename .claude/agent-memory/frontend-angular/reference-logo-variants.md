---
name: reference-logo-variants
description: Quais arquivos de logo existem em public/logos/ e como o app escolhe entre eles (por tone, não por tema)
metadata:
  type: reference
---

Arquivos em `public/logos/` (servidos em `/logos/*.svg`): `logo-full-light.svg` (letras navy, para fundo claro), `logo-full-dark.svg` (letras brancas, para navy ou tema escuro), `logo-full-light2.svg` e `logo-compact2.svg` (para fundo lima; sem uso no código), `logo-compact.svg` (só o focinho).

O código **não referencia `/logos/` fora de** `src/app/shared/components/faro/logo/brand-assets.ts`. A troca é pela propriedade `tone` do `<app-logo>` (`on-light` ou `on-dark`), não por `.faro-dark` nem por CSS. O `<app-focinho>` usa o path copiado de `logo-compact.svg`; os ícones do app saem de `node scripts/generate-icons.mjs`.

**Why:** a classe `.faro-dark` e o par de `<img>` alternado por CSS eram da identidade antiga (saíram na 002).
**How to apply:** ao trocar os arquivos do logo, mantenha os `d` dos paths de `brand-assets.ts` idênticos aos SVG e rode `npm run check:ui`.
