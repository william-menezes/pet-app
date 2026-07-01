---
name: feedback-prefer-native-primeng
description: Usar componentes nativos do PrimeNG antes de escrever HTML/CSS custom em formulários e UI
metadata:
  type: feedback
---

Sempre prefira os **componentes nativos do PrimeNG** a HTML/CSS feito à mão. Não crie wrappers/componentes custom que reinventam o que o PrimeNG já entrega. Consulte `docs/primeng.md` (dump da doc oficial, ~2.4MB — pesquise por seção `## <Componente>`, não leia inteiro).

Mapa canônico para formulários/telas:
- input de texto → diretiva `pInputText` (`primeng/inputtext`)
- senha → `<p-password toggleMask [feedback]="false">` (`primeng/password`)
- checkbox → `<p-checkbox binary>` (`primeng/checkbox`)
- botão → `pButton` / `<p-button [loading]>` (`primeng/button`)
- alerta/banner → `<p-message [severity]>` (`primeng/message`)
- divisor → `<p-divider>` (`primeng/divider`)

Para preservar `data-testid` em elementos internos do PrimeNG (ex.: input dentro de `p-password`, ícone de toggle), use o `[pt]` (passthrough), ex.: `[pt]="{ pcInputText: { root: { 'data-testid': '...' } }, maskIcon: { 'data-testid': '...' } }"`.

**Why:** Na feature 001-login (2026-07-01) o tutor reprovou a primeira implementação por ter feito a tela de login 100% à mão + um wrapper custom `FaroField` desnecessário: "O correto é utilizar os componentes nativos do PrimeNg". Também pediu para **remover** o `FaroField` e usar padrões nativos.

**How to apply:** Antes de escrever `<input>`/`<button>`/CSS de controle na mão, cheque se há componente PrimeNG equivalente e use-o. HTML/CSS custom só para layout de página/card/marca que o PrimeNG não cobre. Ver [[feedback-rotulo-fora-do-input]] e [[gotcha-css-layer-primeng-vs-faro-ds]].
