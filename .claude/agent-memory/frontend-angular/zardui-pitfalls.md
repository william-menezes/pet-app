---
name: zardui-pitfalls
description: Armadilhas do ZardUI + Tailwind v4 no Faro (seletores z-, foco global, h1-h3, href #, provideIcons local, lint de i18n)
metadata:
  type: feedback
---

- O `zard-cli init` **sobrescreve** `src/styles.css`. Não rode de novo.
- Seletores do ZardUI (`z-button`, `[z-button]`) reprovam as regras de seletor do ESLint (prefixo `app`). A saída é o bloco de exceção do `eslint.config.js` só para o código copiado; não se edita o componente para agradar o lint de estilo.
- O foco é global (anel em tinta). Ao copiar componente novo, tire `focus-visible:ring-*`, `outline-none` e `outline-hidden`.
- `h1` a `h3` recebem `text-foreground` na camada base; dentro do cartão lima o título precisa de `text-primary-foreground` explícito.
- Com `<base href="/">`, `href="#conteudo"` navega para a raiz: o atalho "pular para o conteúdo" usa manipulador de clique.
- `provideIcons` local de componente do ZardUI sobrepõe o global; troque os ícones Lucide por nomes do Faro e remova o `provideIcons`/`viewProviders` local.
- Seletor do aviso temporário é `z-sonner`, não `z-toaster`; o CSS do `ngx-sonner` e o host do `ng-icon` não estão em camada, então vencem utilidades do Tailwind (use `!`).
- Regra de i18n do template (`@angular-eslint/template/i18n`) está ligada com `ignoreAttributes` para atributos técnicos; texto novo precisa de `i18n` e `i18n-<atributo>`. Fica desligada no código copiado, na galeria e em `rescue-page/`.
- `npm test` só pelo PowerShell e sempre com `-- --watch=false`; o shell não tem `&&`.

**Why:** reunidas durante a spec 002 (research §R17 e fases 2 a 8).
**How to apply:** releia antes de copiar um componente novo ou mexer em tema. Detalhes de teste e e2e: [[gotcha-zardui-css-e-testes]], [[gotcha-zardui-ambiente-windows]].
