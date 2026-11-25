---
name: project-pivo-ui-zardui
description: Pivô de 2026-11 trocou PrimeNG por ZardUI + Tailwind v4; a spec 002 foi executada e as memórias de PrimeNG saíram
metadata:
  type: project
---

Em 2026-11-21 o Faro passou a usar **ZardUI + Tailwind CSS v4** no lugar de PrimeNG. O MVP virou só a tag com QR Code. A fonte de verdade visual é `DESIGN.md`; o tema e os ajustes do ZardUI estão em `docs/zardui-faro.md`; as telas aprovadas estão em `design/telas-v2/`.

**Why:** decisão do William no pivô do MVP (constituição v2.0.0, `docs/decisoes-pivo.md`). O padrão PrimeNG da casa não vale neste projeto.

**How to apply:** a spec `002-ui-zardui` foi executada (PrimeNG saiu do código; as memórias `feedback-prefer-native-primeng` e `gotcha-css-layer-primeng-vs-faro-ds` foram apagadas na 002). Não escreva código em PrimeNG. Continuam valendo [[feedback-rotulo-fora-do-input]], [[gotcha-ng-test-no-watch]] e [[zardui-pitfalls]].
