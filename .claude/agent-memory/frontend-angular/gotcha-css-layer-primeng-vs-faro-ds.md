---
name: gotcha-css-layer-primeng-vs-faro-ds
description: Regras unlayered do faro-ds.css vencem o @layer primeng — cuidado com resets globais que quebram componentes PrimeNG
metadata:
  type: feedback
---

O PrimeNG é registrado em `@layer primeng` (ver `providePrimeNG({ theme: { options: { cssLayer: { name: 'primeng' } } } })` em `app.config.ts`). Já o `src/styles/faro-ds.css` é **unlayered**. Na cascata do CSS, **qualquer regra unlayered vence qualquer regra em layer**, independentemente da especificidade. Então resets globais amplos em `faro-ds.css` sobrescrevem os tokens de tema do PrimeNG.

Caso concreto (001-login, 2026-07-01): o reset `button, input, select, textarea { color: inherit }` fazia o `.p-button` herdar a cor escura do texto, ignorando o `contrastColor: '#ffffff'` do primário no `FaroPreset` → texto "Entrar" escuro e ilegível sobre o índigo. Correção: excluir botões PrimeNG do reset — `input, select, textarea, button:not(.p-button) { color: inherit }` — mantendo `font: inherit` para todos.

**Why:** O tutor reportou baixo contraste no botão primário e pediu texto branco; a raiz não era o `FaroPreset` (estava correto), e sim o reset unlayered vencendo o layer.

**How to apply:** Ao estilizar componentes PrimeNG ou mexer em `faro-ds.css`, lembre que unlayered > layered. Prefira ajustar tokens do `FaroPreset` e restrinja resets globais para não atingir `.p-*`. Ver [[feedback-prefer-native-primeng]].
