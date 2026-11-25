---
name: gotcha-spec002-fase6-7
description: Armadilhas das fases 6 e 7 da spec 002 (tema escuro, service worker, ícones): ambiente sem Python, sed e regex, galeria em SSR
metadata:
  type: feedback
---

- Não há Python na máquina. Edição de arquivo: use Edit/Write. `sed -i` com barras invertidas dentro de heredoc ou aspas perde o escape (regex de `.mjs` ficou inválido duas vezes); regex novo vai por Edit.
- A galeria `/dev/ui/*` é renderizada no servidor em dev (sempre clara). O tema escuro só vale depois da hidratação: nos e2e espere o log "Angular hydrated" e use `expect.poll` para ler a classe `dark`.
- `localStorage` direto em `*.spec.ts` fora de `core/` falha no lint (`no-restricted-globals`); no teste da casca, fixe a preferência pelo `ThemeService`.
- A regra 9 do `check:stack` (`classList` de `html`/`body` com `dark`) vale também para specs; leia a classe por `getAttribute('class')`.
- `check:ui` inclui a regra de ícones do manifest: apagar um PNG de `public/icons/` sem atualizar o manifest o reprova.

**Why:** cada item custou uma rodada de falha nesta execução.
**How to apply:** ao mexer em tema, service worker, manifest ou scripts de `scripts/ui-checks/`.
