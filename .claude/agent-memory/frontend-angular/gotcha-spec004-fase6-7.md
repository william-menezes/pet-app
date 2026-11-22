---
name: gotcha-spec004-fase6-7
description: Armadilhas das telas de recuperar senha, Conta (lista), privacidade e diálogo de exclusão da spec 004 (testes, overlay, e2e simulado)
metadata:
  type: feedback
---

- `npm test -- --watch=false src/...arquivo.spec.ts` falha com "Unknown argument: watch" (o argumento posicional muda o parse). Para um arquivo: `npx ng test --no-watch --include src/app/.../x.spec.ts` (PowerShell). Sem arquivo, `npm test -- --watch=false` funciona.
- Depois de `verifyOtp`/`signOut({scope})`/exclusão, **não** passar por `AuthService.signOut()`: ele não aceita `scope` e navega para `/auth/login?loggedOut=1`. Chamar `supabase.client.auth.signOut({ scope })` e zerar `AuthStore` e `AccountStore` antes de devolver `ok`: `/auth` e `/auth/login` têm `anonGuard` e com sessão no store desviam `?senha=alterada` e `?conta=excluida` para `/app`.
- `z-alert-dialog` declarativo renderiza no overlay do CDK: nos specs consultar `document`, não `fixture.nativeElement`; destruir `OverlayContainer` no `afterEach`. O escuro vem da classe que `TutorShell` replica no contêiner de overlays (provado no e2e com `emulateMedia`).
- `z-skeleton` tem input `class`: usar só `[class]="'...'"`; misturar `class="..."` com `[class]` quebra.
- Atributos estáticos que reprovam o lint de i18n: `autocapitalize`, `back`, `backLink`. Usar `[attr.autocapitalize]="'characters'"`.
- Boxicons v3 não tem `LogOut`/`Download`: usei `DoorOpen` (sair) e `ArrowToBottom` (baixar). Ícones novos de Conta ficam em `features/account/shared/account-icons.ts` (provedor local repetindo `...faroIcons`).
- jsdom não tem `URL.createObjectURL`/`revokeObjectURL`: definir com `Object.defineProperty(URL, ...)` e espiar `HTMLAnchorElement.prototype.click`.
- E2E: `page.evaluate` dentro de `page.route` trava quando o pedido é uma navegação. Para provar o que foi guardado antes do Google, responder `authorize` com 302 de volta ao app e ler a `sessionStorage` depois. Heredoc/`node -e` com regex literal `/\/x/` come as barras: usar a ferramenta Edit.
- Chave de sessão simulada nos e2e: `sb-orawzpslqvduwsvmlemv-auth-token` (a ref do projeto hospedado está em `environment`).

**Why:** reunidas nas Phases 6 e 7 da spec 004 (2026-11-22).
**How to apply:** releia antes de mexer em fluxo de senha, sair, exportar ou excluir conta. Ver [[gotcha-spec004-fase4-5]] e [[zardui-pitfalls]].
