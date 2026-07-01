# Fluxo de Trabalho Git — Faro

Este projeto usa um fluxo de três branches principais com **promoção em cadeia**:
`feature` → **`develop`** → **`homolog`** → **`master`**.

O código só sobe **um degrau de cada vez**. Nunca commite direto em `homolog` ou `master` — eles só recebem merge do degrau anterior.

## Branches principais

| Branch    | Papel                              | Deploy (Vercel) | Recebe merge de   |
| --------- | ---------------------------------- | --------------- | ----------------- |
| `develop` | Integração do desenvolvimento      | Preview         | branches de feature |
| `homolog` | Homologação / testes (staging)     | Preview         | `develop`         |
| `master`  | **Produção** (rodando na Vercel)   | **Produção**    | `homolog`         |

## Ciclo de uma feature

1. **Criar a branch a partir de `develop`** (atualizada):
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b NNN-nome-da-feature   # ex.: 002-cadastro-pet (mesmo número da pasta em specs/)
   ```
2. **Desenvolver e commitar** na branch de feature.
3. **Merge na `develop`** (via Pull Request no GitHub, de preferência):
   ```bash
   git checkout develop && git pull origin develop
   git merge --no-ff NNN-nome-da-feature
   git push origin develop
   ```
4. **Promover `develop` → `homolog`** e testar:
   ```bash
   git checkout homolog && git pull origin homolog
   git merge --no-ff develop
   git push origin homolog     # dispara o deploy de preview para homologar
   ```
5. **Testar na homologação.** Só avançar se **não houver erros**.
6. **Promover `homolog` → `master`** (produção):
   ```bash
   git checkout master && git pull origin master
   git merge --no-ff homolog
   git push origin master      # dispara o deploy de PRODUÇÃO na Vercel
   ```

## Convenções

- **Branches de feature**: `NNN-nome` (mesmo número da pasta em `specs/`), sempre criadas de `develop`.
- **Mensagens de commit**: gitmoji + tipo — ex.: `:sparkles: feat: ...`, `:bug: fix: ...`, `:books: docs: ...`, `:recycle: refactor: ...` (padrão já em uso no repositório).
- **Merges de promoção**: prefira `--no-ff` para manter o histórico de promoção legível.

## Vercel

- **Produção = branch `master`**. Cada push em `master` publica em produção.
- `develop` e `homolog` geram **deploys de preview** automáticos (URLs próprias), úteis para revisão e homologação.
- Para tratar `homolog` como ambiente de staging dedicado (domínio fixo, variáveis de ambiente próprias), configure em **Vercel → Settings → Environments/Domains** (feito no dashboard, não versionável aqui).

## Proteção de branches (recomendado)

No GitHub (**Settings → Branches**), proteja `master` e `homolog`:
- Exigir Pull Request antes do merge;
- Proibir push direto;
- (Opcional) exigir checks de CI verdes.

## Correção urgente em produção (hotfix)

Para um bug crítico já em produção:
```bash
git checkout master && git pull origin master
git checkout -b hotfix/nome
# corrige, commita
```
Depois faça o merge do hotfix em `master` (produção) **e** de volta em `homolog` e `develop`, para a correção não se perder nas próximas promoções.
