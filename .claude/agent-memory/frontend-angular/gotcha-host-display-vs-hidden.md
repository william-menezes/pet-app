---
name: gotcha-host-display-vs-hidden
description: Classe hidden/md:hidden aplicada no host de componente com display próprio (app-logo) não esconde; e e2e de atalho em página SSR de dev
metadata:
  type: feedback
---

Visibilidade responsiva vai num `div` de embrulho, nunca direto no host de um componente cujo `host.class` já define `display` (ex.: `app-logo` é `inline-block`): o `display` do host vence `hidden`/`md:hidden` e o elemento aparece nas duas larguras (apareceram dois logos nas cascas de fluxo e admin).

**Why:** pego só na captura de tela da Fase 5; os testes de visibilidade por `data-testid` não pegaram porque mediam outros elementos.

**How to apply:** ao esconder por largura, embrulhe em `<div class="hidden md:block">`. Confira com captura nas três larguras, não só com e2e.

Também: na galeria (`/dev/ui/**`) a página é SSR em dev; clique em `href="#conteudo"` antes da hidratação recarrega a página. No e2e, espere o log "Angular hydrated" (`page.waitForEvent('console', ...)`) antes de apertar Tab/Enter. Medições de `boundingBox` logo após o `goto` podem falhar por um reload do servidor de dev: use `expect.poll`.
