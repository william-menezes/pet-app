---
name: project-pivo-ui-zardui
description: Pivô de 2026-11 troca PrimeNG por ZardUI + Tailwind v4; memórias sobre PrimeNG ficam obsoletas após a spec 002
metadata:
  type: project
---

Em 2026-11-21 o Faro passou a usar **ZardUI + Tailwind CSS v4** no lugar de PrimeNG. O MVP virou só a tag com QR Code. A fonte de verdade visual é `DESIGN.md`; o tema e os ajustes do ZardUI estão em `docs/zardui-faro.md`; as telas aprovadas estão em `design/telas-v2/`.

**Why:** decisão do William no pivô do MVP (constituição v2.0.0, `docs/decisoes-pivo.md`). O padrão PrimeNG da casa não vale neste projeto.

**How to apply:** enquanto a spec `002-ui-zardui` não for executada, o código ainda importa PrimeNG; não escreva código novo em PrimeNG. Depois da 002, trate como obsoletas [[feedback-prefer-native-primeng]] e [[gotcha-css-layer-primeng-vs-faro-ds]]. Continuam valendo [[feedback-rotulo-fora-do-input]] (rótulo acima do campo) e [[gotcha-ng-test-no-watch]].
