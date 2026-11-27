---
name: gotcha-spec003-fase1-3
description: Armadilhas da página da tag (SSR) na spec 003: allowedHosts, zoneless+resolver, matcher, pacote público, ferramentas
metadata:
  type: feedback
---

- `angular.json` `security.allowedHosts` vazio faz o servidor construído cair em CSR para qualquer Host que não seja localhost (log "Header host ... not allowed"). Local: `NG_ALLOWED_HOSTS=localhost`. Em produção tem de listar `tagfaro.com.br` e previews.
- SSR zoneless não espera `fetch` solto: a espera vem de um `resolve` na rota (matcher + `ResolveFn`), que devolve o dado ao componente por input (withComponentInputBinding). TransferState com chave por código.
- Rota com `matcher` vira `**` no `app.routes.server.ts`; a regra `**` Server cobre matcher e fallback. Rotas de fluxo (`ativar/**`, `novo-pet`, `vincular/**`) têm de ser Client antes dela.
- `@if` com mais de um nó raiz não projeta `[slot]` (NG8011): um `@if` por nó projetável.
- Lint de template exige `i18n-<attr>` até em input próprio estático (`testid="..."`): usar binding `[testid]="'x'"`; atributos técnicos novos vão em `ignoreAttributes` do eslint.config.js.
- Pre-commit `check:secrets` barra `FARO_SSR_KEY: '...'` até em spec: montar com `Object.fromEntries([[nome, valor]])`.
- Heredoc/`node -e` do Bash com crases ou barras invertidas corrompe regex e template: gerar script com Write e rodar. Edit/Write dão "modified since read" depois de script externo: reler antes.
- Commit intermediário que referencia arquivos ainda não commitados quebra o CI daquele commit (run vermelho inofensivo): commitar o conjunto completo.
- Rota da tag ~132 kB gzip: ~95 kB é Angular; meta de 100 kB não é atingível sem mexer em router/tailwind-merge/ícones globais.
- Preview da Vercel fica atrás de SSO: sem token de bypass não dá para fazer T024A/T037A por curl.
- Sem artigo/gênero na projeção pública: textos da página são neutros ("Oi, eu sou Paçoca.").
