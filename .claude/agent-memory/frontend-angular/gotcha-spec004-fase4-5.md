---
name: gotcha-spec004-fase4-5
description: Armadilhas das telas de celular, termos e Google da spec 004 (projeção do footer, testes com relógio falso, z-input-otp, e2e simulado)
metadata:
  type: feedback
---

- `app-flow-shell` projeta `[footer]` por seletor: elemento `footer` dentro de `@if`/`@switch` só projeta se o bloco tiver **uma única raiz**. Um `@if` por elemento (ou `@switch` com um botão por `@case`). Um bloco grande com vários filhos joga os botões no corpo.
- `z-button` com `[disabled]`: parece funcionar na primeira renderização, mas `zLoading` ligando e desligando faz o host remover o atributo e reabilitar o botão. Teste que prova: ligar `isLoading`, depois desligar com o estado de "desabilitado" ainda verdadeiro. Sempre `[zDisabled]`.
- Spec com `vi.useFakeTimers()` em componente zoneless: `fixture.whenStable()` trava (o agendamento do Angular usa `setTimeout`/rAF falsos). Usar `await vi.advanceTimersByTimeAsync(0)` no lugar quando `vi.isFakeTimers()`; vale também para o `create()` se o `ngOnInit` for assíncrono.
- `z-input-otp` não expõe `data-testid` por célula: um `effect` sobre `viewChild(ZardInputOtpComponent).inputs()` põe `confirm-phone-cell-N`. Colar = `input` na célula 1 com mais de um caractere (jsdom); no navegador, `page.keyboard.type` avança sozinho. `clearValue()` limpa e foca a primeira.
- Entre `<span>` e `<strong>` o Angular colapsa a quebra de linha: "para(11) 98765-4421". Usar `&ngsp;` e `whitespace-nowrap` no número.
- `AuthService.signInWithGoogle()` não lança: o erro vai para o `AuthStore` (`status() === 'error'`). A tela confere o store depois da chamada.
- Lint de i18n: `zMode`, `zRole` (e qualquer atributo estático de componente) pedem `[attr]="'valor'"`.
- Heredoc/`node -e` com aspas duplas no Bash come crases e `$`: usar `node -e '...'` com aspas simples (e `\x27` para aspas dentro) ou a ferramenta Write/Edit. `/tmp` do Bash não é o `/tmp` do Node (`D:\tmp`): passar o caminho com `cygpath -m`.
- E2E sem Supabase local: além de `abort` para `*.supabase.co`, simular `functions/v1/phone-verify-*` e `rpc/phone_verification_status`; o botão do Google dispara um `authorize` que o `abort` barra e dá para capturar com `page.waitForRequest`.

**Why:** reunidas na Phases 4 e 5 da spec 004 (2026-11-22).
**How to apply:** releia antes de criar tela de fluxo com contagem, células de código ou botão de provedor. Ver [[gotcha-spec004-fase3-telas]].
