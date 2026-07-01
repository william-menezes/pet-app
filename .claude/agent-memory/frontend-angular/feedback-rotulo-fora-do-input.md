---
name: feedback-rotulo-fora-do-input
description: Rótulos de campo devem ficar acima/fora da caixa do input, não in-field (evitar IftaLabel/FloatLabel)
metadata:
  type: feedback
---

Todos os inputs devem ter o **rótulo (label) fora da caixa**, posicionado **acima** do campo — use um `<label class="login-label">` (ou `pLabel`) padrão acima do control. **Não** use `p-iftalabel` nem `p-floatlabel` (label dentro/flutuando na caixa).

**Why:** Na 001-login (2026-07-01) a primeira versão usou `p-iftalabel` (label dentro da caixa) e o tutor reprovou: "Todos os inputs devem ter a label fora da caixa de input."

**How to apply:** Ao montar campos de formulário, `<label>` acima + control abaixo + `p-message` de erro embaixo. Vale para toda tela do painel. Ver [[feedback-prefer-native-primeng]].
