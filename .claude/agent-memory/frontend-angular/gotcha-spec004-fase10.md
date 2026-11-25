---
name: gotcha-spec004-fase10
description: Armadilhas do desafio Turnstile (app-turnstile) e dos cabeçalhos de segurança (security-headers.ts, vercel.json, check:headers), spec 004 Phase 10
metadata:
  type: feedback
---

- `app-turnstile` sem chave tem de sumir do layout: o host usa `[class.block]`/`[class.hidden]` por `enabled`. Um host `block` vazio ainda gera `gap-*` e `mt-*` a mais nas sete telas. O teste sem chave confere a classe `hidden`.
- Conteúdo de `z-alert-dialog` existe mesmo fechado se for projetado: o widget do diálogo de exclusão fica em `@if (visible() && needsPassword())` para o script só ser pedido com o diálogo aberto.
- Testes de tela injetam a chave com `TestBed.overrideProvider(TURNSTILE_SITE_KEY, ...)` ANTES de `createComponent`, e `FakeTurnstile` (`turnstile-testing.ts`, sem `vi`, porque o `tsconfig.app` inclui `src/**/*.ts`) instala `window.turnstile`. Nunca mexer em `environment.ts` para testar.
- `requestRecovery` e `resendConfirmation` agora devolvem `{ok}` (não `void`); mocks de teste que devolviam `undefined` quebram em `result.ok`. Chamada com token opcional muda os `toHaveBeenCalledWith` (vira `(..., undefined)`).
- `captcha_failed` do Auth chega como `error.code`; `isCaptchaFailure` em `auth.service.ts` olha o código e "captcha" na mensagem. Não grava `post_result` do login-guard (não é senha errada).
- Cabeçalhos: `src/security-headers.ts` só pode ter sintaxe apagável e nenhum import (o `check-headers.mjs` carrega o `.ts` direto no Node 24; `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` no npm script, porque o `package.json` não tem `"type": "module"`). O `vercel.json` foi GERADO dessa fonte; edite o `.ts` e regere, não o JSON.
- A doc da Vercel (lida 2026-11-22) não diz como o mesmo cabeçalho de regras sobrepostas se combina: regras `source` mutuamente exclusivas (lookahead negativo no `app`). A simulação do `check:headers` é minha; o preview (T037A da 003) é a prova.
- Landing e `/legal/*` ficam na política `app` porque usam `routerLink` para `/auth/login` (a política vale para o documento, SPA não troca).
- `connect-src` do Turnstile não está no contrato (só script-src e frame-src): conferir no preview com a chave real.
- Bash: heredoc com aspas simples no meio de `node -e` ou script grande quebra o parse inteiro (nada roda); usar Write para arquivos e `cat > "$(cygpath -m "$TEMP")/x.js"` para scripts de edição. `Edit` casa texto exato mesmo em CRLF.

**Why:** reunidas na Phase 10 da spec 004 (2026-11-22).
**How to apply:** releia antes de mexer no desafio, em cabeçalhos ou no `vercel.json`. Ver [[gotcha-spec004-fase8-9]].
