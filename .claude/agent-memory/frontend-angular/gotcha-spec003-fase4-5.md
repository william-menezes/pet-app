---
name: gotcha-spec003-fase4-5
description: Armadilhas da ativação, novo pet e histórico de scans (spec 003, fases 4 e 5): guards em ordem, Leaflet, chips, e2e simulado do tutor
metadata:
  type: feedback
---

- `canMatch` com vários guards: o roteador usa `prioritizedGuardValue`, o PRIMEIRO guard da lista que não devolve `true` manda. Por isso `activationGuard` vai na frente de `authGuard` (sem sessão, `/auth/criar-conta?returnUrl=/ativar/<código normalizado>` e não `/auth`). Teste com roteador real, como `nested-routes.spec`.
- Whitespace-only entre elementos some no template do Angular: `<span>a</span> <strong>` perde o espaço. Usar `&ngsp;` (um espaço inicial dentro do `<span>` seguinte basta).
- Passos de um fluxo são componentes com a PRÓPRIA `app-flow-shell` (o `[footer]` não atravessa um componente filho). O PIN fica só no `FormControl` do passo e é entregue por `output` uma vez.
- Chip marcado (`z-toggle-group`, `toggleVariants`) ficava cinza no hover (`hover:bg-background` ganhava de `data-[state=on]`). Corrigido com `hover:not-data-[state=on]:bg-background` em `toggle.variants.ts`.
- Leaflet: `styles: ["@import 'leaflet/dist/leaflet.css'"]` inline quebra o build (os `url(images/...)` resolvem errado); usar `styleUrl` para um `.css` com o `@import`. `circle.getBounds()` só funciona depois de `map.setView(...)`. O SVG pede cor literal e o `check:ui` barra hex solto: ler `--brand` com `getComputedStyle`. `attributionControl: false` e mapa `aria-hidden` (link focável dentro dele reprova no axe); a atribuição do OSM fica no cartão.
- `check:bundle` agora reprova `core/pets`, `core/scans`, `core/tags/tag.service`, `core/tags/activation*` e `leaflet` no fecho estático público.
- E2E simulado do tutor logado: `e2e/support/mock-tutor.ts` (sessão em `localStorage`, `my_account`, `my_dashboard`, `activate_tag`, `my_scans`, upload de foto, tiles do OSM). O tema escuro se confere em `app-tutor-shell`, não em `html`. Chips animam a cor por 150 ms: `waitForTimeout(400)` antes do axe.
- PNG de teste: `makePng()` em `e2e/support/png.ts` monta um PNG válido (o base64 escrito à mão deu `unsupported` no `createImageBitmap`); usa `zlib.crc32` (Node 24 do CI).
- Bash: heredoc com crase/aspas dentro de `node -e` quebra; escrever o script em `/tmp/pN.mjs` com `cat > ... <<'EOF'` e rodar com `node`. Arquivo grande: ferramenta Write.
- O job `e2e` do CI da 003 ficou vermelho (run 45532380623) porque `account-a11y.spec.ts` dava `goto` logo depois do clique do login (sem esperar o app iniciar); a 004 já tinha o `toHaveURL` e o `networkidle`. Não era defeito do frontend.
