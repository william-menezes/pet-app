# Execution log: 002-ui-zardui

## Linha de base

- Data: 2026-11-21
- Branch: `002-ui-zardui` (criada de `develop`, commit de partida `2cf0173`)
- `git status --short` antes de qualquer mudança: vazio (árvore limpa)

| Comando | Resultado |
|---|---|
| `npm run build` | passou (Angular 21, SSR, 1 rota pré-renderizada) |
| `npm run lint` | passou ("All files pass linting.") |
| `npm test -- --watch=false` | passou: 9 arquivos, 44 testes |
| `npx playwright test e2e/smoke.spec.ts` | passou: 1 teste (na primeira rodada faltava o navegador; rodado `npx playwright install chromium` e repetido, como a T001 manda) |

### Tamanhos de `dist/faro/browser/` (bytes)

| Arquivo | Bytes |
|---|---|
| chunk-3QFA5SSD.js | 451 |
| chunk-6FFV4G3K.js | 88057 |
| chunk-6YZSW5GL.js | 81353 |
| chunk-6ZEZ5ST6.js | 982 |
| chunk-7AOSXPD2.js | 4840 |
| chunk-EP6PJF4N.js | 1822 |
| chunk-FKKVDWAJ.js | 41129 |
| chunk-GWVPYNGX.js | 176509 |
| chunk-H2B6VC2R.js | 211526 |
| chunk-JOHBSRU7.js | 198445 |
| chunk-MR2ECVFE.js | 12267 |
| chunk-PAQOKZQ6.js | 725 |
| chunk-ROGBYIJS.js | 65 |
| main-3KIOEV5V.js | 117680 |
| polyfills-PZSJNBYU.js | 494 |
| ngsw-worker.js | 84094 |
| safety-worker.js | 785 |
| worker-basic.min.js | 785 |
| styles-DUBPCF23.css | 35752 |
| index.csr.html | 19336 |
| index.html | 78658 |

- Soma dos `.js` (todos, incluindo os três do service worker): 1.022.009 bytes
- Soma dos `.js` sem os scripts do service worker (`ngsw-worker`, `safety-worker`, `worker-basic.min`): 936.345 bytes
- Soma dos `.css`: 35.752 bytes

## Spike

(a preencher na T003)

## Desvios e decisões

- `npx playwright install chromium` foi necessário (navegador ausente na máquina). Isso não altera o repositório.
- A pasta `test-results/` criada pelo Playwright não está no `.gitignore`; é artefato local e não é commitada.

## Regras de lint desligadas

(nenhuma até agora)

## Resultado final

(a preencher no fim da spec)
