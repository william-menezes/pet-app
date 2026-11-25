---
name: gotcha-spec004-fase8-9
description: Armadilhas das telas de Conta (dados, celular, senha, aparência), do modo troca de celular e do flake do ui-shells (spec 004, Phases 8 e 9)
metadata:
  type: feedback
---

- `z-toggle-group` não expõe `data-testid` por item: o componente de aparência põe os ids nos botões `[data-slot="toggle-group-item"]` em `afterNextRender` (itens fixos). O ThemeService é só preferência; nunca tocar no DOM ou no storage na tela.
- `check:ui` reprova a string `classList.contains('dark')` em `html`/`body` até em `*.spec.ts` de `src/`; e o lint reprova `localStorage` em specs de `features/` (só `core/`). Provas de tema ficam no e2e.
- ngx-sonner não aceita `data-testid` no toast: o contrato pede `account-personal-saved`; deixei um `<span class="sr-only">` (sem `role`) só para teste, e o aviso visível é o toast.
- Modo troca de celular: o campo "Senha atual" aparece de saída em conta com senha (como na referência), não só após `reauth_required`; Google-only recebe o botão depois de `reauth_required` com `method: google`. `changeMode` = `AccountStore.phoneConfirmed()`. Cancelar usa `navigateByUrl(returnUrl ?? '/app/conta/celular')`.
- `PasswordService.changePassword` usa `AuthService.signInPassword` (passa pelo login-guard e renova a sessão). Falha de rede vira `network` (o contrato diria `invalid_current`, que mentiria).
- Arquivos com CRLF: `String.replace` com `\n` literal não casa; usar regex `\r?\n` ou trocar só linhas simples. Heredoc com `node -e '...'` e aspas simples dentro quebra o parse do Bash: gravar o script com `cat > "$(cygpath -m "$TEMP")/x.js"` (nunca `/tmp`, que não é o `/tmp` do Node) ou usar Write/Edit.
- `page.addInitScript` com a sessão roda a cada navegação: para provar o login "sem sessão" abrir outra página do mesmo contexto (sem o init script) depois de remover a chave `sb-*-auth-token`.
- Rotas CSR (`/app/**`, `/auth/**`) não emitem "Angular hydrated" no console: não esperar hidratação nelas (cada espera custa 20 s de timeout).
- Flake do `ui-shells` com muitos workers: era o `box()` com `expect.poll` de 5 s (padrão) e uma segunda leitura sem corrida protegida; o servidor `ng serve` demora a entregar a página sob carga. Solução: um `box()` com leitura única e 20 s, e `expectWidth` que mede de novo até a largura chegar a 560/480 (±2). Reproduz com `--repeat-each=3 --workers=20` em ui-shells, ui-theme e ui-identity.

**Why:** reunidas nas Phases 8 e 9 da spec 004 (2026-11-22).
**How to apply:** releia antes de mexer em telas de Conta, no modo troca de celular ou em teste e2e de medida de layout. Ver [[gotcha-spec004-fase6-7]].
