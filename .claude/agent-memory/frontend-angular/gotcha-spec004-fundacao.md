---
name: gotcha-spec004-fundacao
description: Armadilhas da fundação da spec 004 (guards, returnUrl, restoreSession, pacote inicial, e2e simulado)
metadata:
  type: feedback
---

- `AuthService.restoreSession()` nunca foi chamado desde a 001: abrir o app a frio ignora a sessão persistida e os guards mandam para o login. **How to apply:** não assumir que um `goto('/app')` com sessão no storage entra; verificar se o William decidiu ligar o inicializador (com `import()` dinâmico) antes de depender disso (T035, recargas de `/app/conta`).
- Guard `canMatch` recebe só os `segments` que sobram para a rota que o declara (filha de `auth` vê `[termos]`). **How to apply:** montar o `returnUrl` com `requestedUrl(router, segments)` (`core/auth/guard-url.ts`) e testar com o roteador real (`nested-routes.spec.ts`).
- Guard em `app.routes.ts` vive no pacote inicial: importar `AccountService` (supabase-js) de forma estática tirou o inicial de 397 kB para 613 kB. **Why:** estourou o orçamento de 500 kB e contamina a página pública. **How to apply:** `await import('../account/...')` + `Injector.get` dentro do guard (o token é o mesmo, os testes substituem normalmente). Vale para o `phoneConfirmedGuard`.
- `inject()` falha depois de um `await`: funções utilitárias que usam `inject(PLATFORM_ID)` devem aceitar o `platformId` como parâmetro opcional (padrão `inject(...)`).
- Escrever arquivos com heredoc do Bash que tenham aspas e acentos quebrou (`unexpected EOF`); usar a ferramenta Write. Arquivos do repo têm CRLF: `String.replace` com `\n` em script Node falha em silêncio; normalizar com `replace(/\r\n/g, '\n')` (o Git reconverte).
- E2E sem Supabase local: registrar primeiro `page.route(/\.supabase\.co\//, abort)` e depois os mocks (o último registro vence). Cobre login → `PostAuthNavigator` sem tocar o projeto hospedado (`e2e/account-foundation.spec.ts`). Roteiro do mock: `login-guard`, `auth/v1/token?grant_type=password`, `rpc/current_user_role`, `rpc/my_account`; JWT falso com `exp` basta.
