---
name: project-004-e2e-real-armadilhas
description: Armadilhas do e2e real (e2e-real/, job e2e do CI) da spec 004 e sessao que cai: o que ja causou falso vermelho
metadata:
  type: project
---

E2E reais ficam em `e2e-real/` (config `playwright.e2e-real.config.ts`, so roda no job `e2e` do CI contra Supabase local). `npm run e2e` (pasta `e2e/`) e o simulado local.

- Preencher/clicar no login ou no codigo do SMS sem esperar o app iniciar/botao habilitar da falso vermelho. Use `waitForLoadState('networkidle')` e `expect(btn).toBeEnabled()` antes do clique (nao `isEnabled()` instantaneo).
- Nao fazer `page.goto` logo apos clicar em "Entrar": aborta o login em andamento. Espere a URL.
- `loginViaUi` marca "Manter conectado" por padrao por causa do DEF-001 (sessao volatil perdida ao recarregar; `AuthService.setRememberMe` troca `auth.storage` mas o cliente novo le so localStorage). Teste `DEF-001` e `test.fail`: quando o frontend corrigir ele passa e o Playwright reprova, entao remover o `test.fail`.
- Logado, `page.goto('/auth/login')` redireciona para /app (anonGuard): saia pela Conta antes de logar de novo.
- Edicao com `node -e` e aspas de shell estraga `\/` em regex: use a ferramenta Edit e rode `npx tsc --noEmit --skipLibCheck --module esnext --moduleResolution bundler --target es2022 e2e-real/*.ts` antes de empurrar.
- `ci.yml` tem CRLF no Windows: `str.replace` multilinha em node falha em silencio; use Edit.
- `concurrency cancel-in-progress`: um push cancela o run em andamento; espere terminar antes de empurrar de novo. Uma volta do job e2e leva 5 a 7 min (14 min se houver timeouts de 60 s).
- Limites reais no stack: `sms:ip:h` 30/h, `guard:ip:m` 60/min, `sms:account:h` 5. Os 119 e2e cabem nisso.
- O dev server (`ng serve`) nao envia cabecalhos em arquivo estatico: isso e provado por passo do job `app` contra `dist/faro/server/server.mjs`.
- `gh` tem limite de 5000/h compartilhado; evite laco de polling curto.
