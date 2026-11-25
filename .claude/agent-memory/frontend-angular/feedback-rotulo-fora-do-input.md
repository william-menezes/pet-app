---
name: feedback-rotulo-fora-do-input
description: Rótulo de campo fica acima e fora da caixa do input; nada de rótulo dentro ou flutuando
metadata:
  type: feedback
---

Todo input tem o **rótulo fora da caixa**, **acima** do campo. Hoje isso é o `z-field` com `z-field-label`, o controle embaixo e `z-field-error` abaixo dele. Nada de rótulo dentro da caixa nem flutuante.

**Why:** na 001-login (2026-07-01) a primeira versão pôs o rótulo dentro da caixa (componente do PrimeNG, que saiu na 002) e o William reprovou: "Todos os inputs devem ter a label fora da caixa de input."

**How to apply:** ao montar formulário, rótulo acima, controle, erro abaixo. Vale para toda tela.
