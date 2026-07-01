---
name: gotcha-ng-test-no-watch
description: Rodar testes com "ng test --no-watch" — sem a flag o vitest entra em watch e trava o agente
metadata:
  type: feedback
---

O alvo de teste usa `@angular/build:unit-test` com runner **vitest** (ver `angular.json`). `npm test` / `ng test` sem flag entra em **watch mode** e **nunca retorna** — um agente que espera o comando terminar fica preso num loop/hang.

Sempre rode em modo único: **`npx ng test --no-watch`** (opcionalmente com timeout). Nunca rode `npm start`/`ng serve` para "verificar" — é servidor de dev que não termina.

**Why:** Na 001-login (2026-07-01) um agente frontend travou justamente rodando o teste em watch; o tutor percebeu ("ficou preso em algum loop"). Verificação correta = `ng build` (não trava) + `ng test --no-watch`.

**How to apply:** Em qualquer verificação automatizada, use comandos que terminam sozinhos. E2E é do QA (Playwright).
