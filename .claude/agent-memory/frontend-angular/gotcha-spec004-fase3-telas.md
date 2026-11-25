---
name: gotcha-spec004-fase3-telas
description: Armadilhas das telas de /auth da spec 004 (z-button disabled, provideIcons local, flow-shell, AuthStore após verifyOtp, lint de i18n)
metadata:
  type: feedback
---

- `z-button` em `<button>`: use `[zDisabled]` (e `[zLoading]`). `[disabled]` funciona só até o `zLoading` ligar e desligar (o host remove o atributo e reabilita); o login foi corrigido na Phase 4 (ver [[gotcha-spec004-fase4-5]]).
- `provideIcons` em `providers` de componente **substitui** o conjunto global (provedor múltiplo não mescla entre injetores): repita `...faroIcons`. Ícone novo fora de `shared/icons/faro-icons.ts` (proibido editar) vai num componente pequeno com provedor próprio (`features/auth/shared/status-badge.ts`).
- `app-flow-shell` não projeta título: o `h1` e o `p` vão no corpo. Botão de envio do formulário vai em `[footer]` com `[attr.form]="'id'"`. `back`/`backLink`/`form` como atributo estático reprovam o lint de i18n: use `[back]="'back'"`.
- `AuthStore` só ganha a sessão por `AuthService` ou `restoreSession()`: depois de `verifyOtp` alguém precisa chamar `authStore.setSession(...)`, senão o `authGuard` volta às boas-vindas (feito em `RegistrationService.confirmEmail`).
- `authGuard` sem a marca `faro.returning` vai para `/auth` (boas-vindas) e não mais para o login; e2e antigos que esperavam o login precisam da marca.
- Em e2e o `xl` começa em 1280: o viewport padrão do Playwright (1280×720) já é desktop; elementos `xl:hidden` (Voltar do login) exigem `setViewportSize` menor.
- Vitest: no primeiro run depois de mexer em muitos arquivos o worker pode estourar o tempo ("Timeout waiting for worker"); rodar de novo.
- `$localize` em `protected readonly` de classe; `Location.getState()` lê o estado do roteador (e-mail do cadastro) sem tocar na URL.

**Why:** reunidas na Phase 3 da spec 004 (2026-11-22).
**How to apply:** releia antes de criar tela de fluxo em `features/auth/` ou mexer em sessão após link de e-mail. Ver também [[gotcha-spec004-fundacao]] e [[zardui-pitfalls]].
