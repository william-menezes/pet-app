---
name: project-003-e2e-real-harness
description: Como o e2e real da spec 003 funciona (pool de tags, servidor SSR, prod build) e as armadilhas que deram falso vermelho ou achado
metadata:
  type: project
---

E2E real da 003 em `e2e-real/` (tag-page, activation, owner, admin, gate-security, prod-server, a11y-screens), mesmo job `e2e` da 004.

- **Pool de tags**: `global-setup` cria 2 lotes de 24 pelo `admin-create-batch` e grava codigo/PIN em `os.tmpdir()/faro-e2e-pool.json` (NAO em `test-results-real/`: o Playwright limpa essa pasta). `takeTag()` consome um par por teste; seed so leitura. Local: `E2E_REUSE_POOL=1` evita novo lote (admin tem 10 lotes/h; 429 = limite, nao bug).
- **Lote grande falha**: `admin_insert_batch` leva ~0,2 s por codigo (bcrypt 12) e o PostgREST corta em 8 s (`authenticator.statement_timeout`). 54 codigos = 500 (DEF-003-01). Nunca criar pool > 24 por lote.
- **Servidor SSR no ng serve**: precisa de `SUPABASE_FUNCTIONS_URL`, `FARO_SSR_KEY`, `IP_HASH_SECRET` (config `webServer.env`; no CI vem de `E2E_SSR_KEY`/`E2E_IPHASH_SECRET` sorteadas no `e2e-prepare.sh`). `check:secrets` (hook de commit) barra qualquer atribuicao literal a esses nomes: use `$VAR`.
- **Limites por IP**: o servidor usa `x-real-ip`; sem ele todo mundo cai no balde `unknown` (resolve 30/min, scan 20/min). Injetar `x-real-ip` por teste via `page.route` so para `localhost:4200`. Janela do limite e fixa por minuto: testes de limite devem disparar em paralelo, nao em serie com o piso de 150 ms (virada de minuto zera a contagem).
- **Prod build**: o servidor construido responde 400 a `localhost` (allowedHosts); subir com `NG_ALLOWED_HOSTS=localhost`. Medidas locais: TTFB 45 ms, LCP 112 ms, JS 134 kB gzip (> 100). Ler tamanho de script com `Promise.all` das promessas de `res.body()` (ler antes dava numero errado).
- **Botao de localizacao** da pagina de resgate so aparece com algum contato liberado (ativar com `whatsapp: true`).
- **Toast** `ngx-sonner-toast` nao e `visible` pro Playwright (host sem caixa): usar `toBeAttached()`. Axe com toast na tela = violacao `list` (DEF-003-03).
- **login-guard** conta so falhas; o eixo por IP e compartilhado: sondar o guard com falhas bloqueia todos os logins locais por 15 min (`delete from auth_login_attempts` no banco local).
- **Edicao**: `ci.yml` e `e2e-prepare.sh` sao CRLF; usar Edit, nao regex multilinha em node. Heredoc grande com acento no Bash tool quebrou ("unexpected EOF"): escrever com Write e `cat >>`.
- O e2e simulado (`npm run e2e`, 294 testes) NAO roda no CI: rodar localmente antes de afirmar T093.
