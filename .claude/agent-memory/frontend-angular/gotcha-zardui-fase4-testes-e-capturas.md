---
name: gotcha-zardui-fase4-testes-e-capturas
description: Armadilhas da fase 4 da spec 002: matchMedia no jsdom, playwright apaga test-results, heredoc com barra invertida, /tmp do Bash vs Node
metadata:
  type: feedback
---

- `ngx-sonner` (`z-sonner`) chama `window.matchMedia`; o jsdom não tem. Há `src/test-setup.ts` registrado em `setupFiles` do `test` no `angular.json`. **How to apply:** qualquer teste que monte um componente com `<z-sonner />` já funciona; não stubar de novo.
- Toda execução do Playwright apaga `test-results/`. **How to apply:** capturas para entregar: gerar numa única rodada por último, ou copiar para o scratchpad antes de rodar outro e2e e restaurar depois.
- Em scripts Node escritos por heredoc, `\.` e `\(` dentro de template literal viram `.` e `(`; use `String.raw` para montar `RegExp`. O `/tmp` do Bash não é o `/tmp` que o Node (Windows) enxerga: use `cygpath -m`.
- Arquivos do repo têm fim de linha misto (CRLF/LF); editar por script: normalizar para `\n`, editar e gravar de volta no estilo original.
- Credencial inválida não dá para ver sem Supabase configurado (`environment.development.ts` tem `YOUR_PROJECT`): para capturar esse estado, `page.route('**/auth/v1/token**')` com 400 `invalid_credentials`.
