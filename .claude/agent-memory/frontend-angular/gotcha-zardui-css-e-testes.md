---
name: gotcha-zardui-css-e-testes
description: Armadilhas de CSS e de e2e da spec 002 (camadas, ng-icon, ngx-sonner, area de toque, leitura de cor em dev)
metadata:
  type: feedback
---

- CSS não colocado em `@layer` (estilo do host do `ng-icon`, CSS do `ngx-sonner`, `faro-ds.css` antigo) vence as utilidades do Tailwind. **How to apply:** em `ng-icon` use `size-4!` ou o input `size`; em toast use `!`; ao ver cor errada na galeria, suspeite de folha sem camada.
- `before`/`after` com `inset` contam a partir da caixa de preenchimento (altura menos a borda, que vira 1px em DPR 1). **How to apply:** para chegar a 44px de toque, calcule sobre a altura menos 2px (botão `sm` `-inset-y-1.5`, chip `-inset-y-[5px]`).
- `z-skeleton`/`z-alert` etc. recebem `class` como input E como atributo do host: classes de tamanho em percentual dobram. Use px ou `w-full`.
- e2e em dev: o CSS chega depois do primeiro desenho e `transition-colors` faz ler cor no meio da transição. **How to apply:** `expect.poll` nas leituras de `getComputedStyle`; espere o `body` ficar claro antes.
- `@layer legacy` temporário envolve `faro-ds.css` até a T037; some junto com o arquivo.
