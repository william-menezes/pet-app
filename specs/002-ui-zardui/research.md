# Research: Migração de UI para ZardUI + Tailwind v4, com a nova identidade

**Feature**: `002-ui-zardui` · **Data**: 2026-11-21 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Decisões técnicas, com o motivo e o que foi descartado. Tudo aqui foi conferido contra o
repositório e contra o npm em 2026-11-21 (somente leitura; nada foi instalado no projeto). Onde
algo só pode ser confirmado rodando, está dito, e há uma tarefa para isso.

---

## R1. Compatibilidade ZardUI × Angular 21

**Decisão**: adotar `zard-cli@1.12.0`, com um **spike obrigatório** (tarefa T003) numa cópia de
trabalho separada antes de tocar na branch. Se o spike falhar, **para e reporta**; não há plano B
automático.

**O que já se sabe** (lendo o pacote `zard-cli@1.12.0` publicado no npm):

- O CLI declara suporte a "Angular 19 and above" e **fixa as versões pelo major do Angular do
  projeto**: `@angular/cdk@^21`, `@ng-icons/core@^34`, `@ng-icons/lucide@^34`. Não instala o
  `latest` (que hoje exige Angular 22).
- `@ng-icons/core@34.0.0` tem `peerDependencies` `@angular/core >=21.0.0`. `@angular/cdk@21.2.14`
  existe. `ngx-sonner@3.1.0` aceita `@angular/core >=19`.
- O projeto está em Angular 21.2 (LTS; o `latest` do Angular já é 22.3), Node 24, npm 11.
- O comando `add` chama `assertAngularSupported`: um componente pode exigir um Angular mais novo.
  Só rodando se sabe.

**O que o spike tem de provar**: instala sem `--force` nem `--legacy-peer-deps`; `ng build`
(com SSR e pré-render), `ng lint` e `ng test --watch=false` verdes com um `z-button` na página
inicial; a classe do Tailwind chega ao CSS gerado.

**Condições de PARADA** (lista fechada, repetida na tarefa): conflito de peer dependency; o CLI
recusar algum componente por versão do Angular; erro de build vindo de ZardUI/Tailwind/CDK que não
se resolve em 30 minutos editando arquivos do próprio projeto; o `init` escrever fora dos arquivos
esperados; um componente copiado importar pacote fora da lista permitida.

**Alternativas descartadas**: subir para Angular 22 junto (duas migrações de uma vez; o Angular
é restrição da constituição); spartan-ng ou outra biblioteca (a constituição v2.0.0 nomeia o
ZardUI); escrever todos os componentes à mão (perde acessibilidade pronta de diálogo, OTP, toggle).

---

## R2. Como o `zard-cli` funciona e o que ele muda no projeto

**Decisão**: usar os comandos em modo não interativo, com a versão fixa, e tratar o código copiado
como código do Faro (revisado e commitado).

```bash
npx zard-cli@1.12.0 init --yes --type angular --css src/styles.css --app-config src/app/app.config.ts --base-color neutral --no-rtl
npx zard-cli@1.12.0 add <componentes> --yes
```

Sem terminal interativo o `init` **exige** `--yes`, porque sobrescreve o CSS global.

O que o `init` faz (lido no código do CLI):

| Passo | Efeito |
|---|---|
| `components.json` | cria na raiz, com os aliases `@/shared/components`, `@/shared/utils`, `@/shared/core` |
| dependências | `@angular/cdk@^21`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@ng-icons/core@^34`, `@ng-icons/lucide@^34`; dev: `tailwindcss`, `tailwindcss-animate`, `@tailwindcss/postcss`, `postcss` |
| `src/app/app.config.ts` | acrescenta o import e `provideZard()` no fim de `providers` |
| `.postcssrc.json` | cria na raiz, com o plugin `@tailwindcss/postcss` |
| `src/styles.css` | **sobrescreve** com o tema neutro (hoje o arquivo só tem um comentário) |
| `tsconfig.json` | acrescenta `paths: { "@/*": ["./src/app/*"] }` |
| core e utils | copia `src/app/shared/core/` (provider, diretivas, i18n, `css/zard.css`) e `src/app/shared/utils/` |

**Por que fixar `1.12.0` e não `@latest`**: o pacote teve sete versões em dois dias
(1.6.0 em 12/11 a 1.12.0 em 14/11/2026). O `CLAUDE.md` mostra `@latest` no exemplo; a tarefa de
documentação (T067) troca pelo número.

**Risco e contrapartida (segurança)**: o `add` baixa o código dos componentes de
`https://zardui.com/r` **na hora**. Fixar a versão do CLI **não fixa o código**: ele não passa
pelo `package-lock.json` nem tem hash de integridade. Contrapartidas adotadas: (1) rodar uma vez,
ler o diff inteiro e conferir os imports contra uma lista permitida (T005); (2) commitar o código,
que a partir daí é do repositório e não depende mais do registro; (3) nunca rodar `add --overwrite`
sobre componente já editado; (4) `npm audit --audit-level=high` depois da instalação. A opção mais
dura (copiar à mão de um commit auditado do GitHub do ZardUI) foi descartada por custo; a revisão
do diff cobre o mesmo risco.

**Não usar**: `add dark-mode` (liga um inicializador global que põe a classe no `<html>` e injeta
um script no `index.html`; contraria a regra "nunca em `:root`" e a CSP `script-src 'self'`),
`add sidebar` (as cascas do Faro são próprias), `add --all`.

**`zard.css`**: o tema gerado importa `src/app/shared/core/css/zard.css`. Isso **não** viola "um
único arquivo de tema" desde que o arquivo só tenha regras de apoio dos componentes. O spike lê o
arquivo; se ele declarar variáveis de cor, elas saem de lá (regra em `design-tokens.contract.md` §3).

---

## R3. Tailwind v4 no build do Angular 21 (com SSR)

**Decisão**: Tailwind v4 pelo PostCSS (`.postcssrc.json`), um único `src/styles.css`, varredura
de classes limitada a `src/`.

- O builder `@angular/build:application` carrega `.postcssrc.json` sozinho. Não há
  `tailwind.config.js` (o v4 é configurado no CSS).
- **Varredura**: por padrão o v4 lê todo arquivo de texto do projeto fora do `.gitignore`. Isso
  inclui `docs/primeng.md` (2,4 MB) e as specs, que citam classes em prosa, e geraria CSS inútil.
  `@import 'tailwindcss' source('.')` restringe à pasta do próprio `styles.css` (`src/`). Um
  canário no contrato prova que a restrição funciona. Plano B, se o builder rejeitar a sintaxe:
  `@import 'tailwindcss' source(none);` seguido de `@source './app';` e `@source './index.html';`.
- `url('/fonts/…')` com barra inicial é deixada como está pelo builder (conferido em
  `css-resource-plugin.js`), então as fontes em `public/fonts/` funcionam sem cópia para `media/`.
- O preflight do Tailwind zera margens e estilos de botão. Os componentes de tela ainda em PrimeNG
  convivem com ele por poucas tarefas (o login é migrado logo depois); o build fica verde o tempo
  todo, o visual intermediário não é entregue.
- O orçamento `anyComponentStyle` deixa de importar: os componentes novos não têm CSS próprio.

**Alternativas descartadas**: plugin Vite do Tailwind (é para Analog; o builder do Angular usa
PostCSS); manter `faro-ds.css` e migrar aos poucos (dois temas convivendo, contra a regra do
arquivo único).

---

## R4. Quais componentes do ZardUI entram agora

**Decisão**: 18 componentes, cada um justificado por uma tela aprovada do "MVP v2".

| Componente | Vira no Faro | Telas que usam |
|---|---|---|
| `button` | botão (todas as variantes) | todas |
| `input`, `field`, `textarea` | campo com rótulo, ajuda e erro | entrar, criar conta, novo pet, modo perdido, admin |
| `checkbox` | caixa | entrar ("Manter conectado"), admin (seleção de códigos) |
| `switch` | interruptor | visibilidade, página do pet (modo perdido) |
| `toggle` | chip | scans (filtros), admin (filtros) |
| `toggle-group` | segmentado | novo pet (sexo), vincular código (escanear/digitar) |
| `badge` | selo | painel, scans, admin (status do código), etiquetas de temperamento |
| `alert` | aviso | entrar (erros, sessão expirada), fluxos |
| `alert-dialog` | diálogo de decisão | desvincular tag, bloquear código, excluir conta |
| `card` | cartão | admin (caixas de detalhe), app |
| `item` | linha de lista | página do pet, visibilidade, gerenciar tag, admin |
| `empty` | estado vazio | scans sem registro, telas provisórias |
| `sonner` | aviso temporário | entrar (reenvio de confirmação), app |
| `spinner`, `skeleton` | carregando | retorno do Google, listas |
| `input-otp` | células do PIN e do código por SMS | ativação, vincular PIN, confirmar celular |

**Ficam de fora** (quem precisar acrescenta pela receita de `shared-components.contract.md` §7):
`radio-group` (o cartão de escolha de pet da ativação é desenho próprio, spec 003), `sheet`,
`dialog`, `select`/`native-select`, `tabs`, `avatar`, `tooltip`, `separator`, `sidebar`,
`dark-mode`. Nada do roadmap.

---

## R5. Componente do ZardUI ou componente próprio?

**Decisão**: se o ZardUI tem, usa-se o do ZardUI editado no repositório; componente próprio só
para o que é marca ou layout do Faro. Não se cria embrulho próprio em volta de componente da
biblioteca.

**Por quê**: (1) é o mapa de `docs/zardui-faro.md` §3; (2) o `CLAUDE.md` diz "componentes ZardUI
são editados no próprio repo"; (3) na feature 001 o William reprovou um embrulho próprio de campo
(`FaroField`) e pediu os componentes nativos da biblioteca (registrado na memória do agente).

**Leitura do briefing**: ele lista chip, segmentado, selos, linha de lista e células do PIN como
"componentes de marca do Faro". Aqui eles são do Faro porque o código mora no repositório e
carrega as variantes do Faro, mas partem do componente do ZardUI (`toggle`, `toggle-group`,
`badge`, `item`, `input-otp`). São próprios de fato, sem equivalente: logo, focinho, painel de
marca, marca circular, "G" do Google, quadrado de ícone, cartão de informação, nota, cartão de
número, indicador de passos, capa do pet, cartão de ação lima, as quatro cascas e os dois
componentes de página pública.

---

## R6. Divergências entre as fontes e como foram resolvidas

Ordem de autoridade (do `CLAUDE.md`): constituição > `docs/decisoes-pivo.md` > `CLAUDE.md` >
`DESIGN.md` > demais docs. As telas aprovadas (`lib.js`) valem como medida exata.

| Assunto | `docs/zardui-faro.md` | `DESIGN.md` / telas | Vale |
|---|---|---|---|
| Altura do campo | 44px (`h-11`) | 54px | **54px** |
| Altura do botão principal | 48px padrão, 56px `lg` | 56px | `lg` = 56px é o principal; 48px fica como `default` |
| Botão da página de resgate | 60px | 60px no celular, **64px** em tablet e desktop | 60 → 64px (`md:h-16`) |
| Botão só com ícone | 40px com área de 44 | 44px | **44px** |
| Botão tinta | não existe | "Botão tinta, 44px, dentro do cartão lima" | variante `ink` + tamanho `md` (44px) |
| Botão destrutivo | sólido vermelho | "botão de texto em vermelho-texto" | os dois: `danger` (texto) para telas; `destructive` (sólido) só no confirmar de um diálogo |
| Variantes `accent` e `whatsapp` | existem, iguais a `default` | WhatsApp é lima + ícone oficial | **não criar**; WhatsApp = `default` + ícone `whats` |
| `--whatsapp*` (verde) | definido | o botão é lima | **não criar** |
| `--info*` (azul) e aviso âmbar | definidos | só quatro regras de cor; âmbar é do modo perdido | **não criar**; aviso neutro no lugar |
| `--success`, `--warning` | `#157A3F`, `#946005` | `#0F5E30`, `#8A4A0C` (texto) | os do `DESIGN.md`, como `--success-foreground`, `--warning-foreground` |
| `--font-mono` JetBrains Mono | definido | "não use monoespaçada" | `ui-monospace` do sistema, sem uso |
| `--shadow-card` | definido | "cartões não têm borda nem sombra" | **não criar** |
| Tokens escuros de sucesso, aviso, perigo, divisor, ponto, foto | faltam | estão em `lib.js` (`D`) | os de `lib.js` |
| Tokens escuros de `--sidebar-*` | faltam | — | derivados do cartão escuro |
| Foco | classes `ring-2 ring-ring ring-offset-2` em cada variante | "anel de 2px em tinta com folga branca de 2px" | mesmo desenho, por **uma regra global** (ver R10) |
| Ícones | tabela com `vacina`, `consulta`, `peso`, `ai`… | telas usam `scan`, `print`, `camera`, `list`, `block`, `pin` | lista de `lib.js`; roadmap fora |
| Escala navy | sobrescreve `indigo-*` | "não use os tons antigos de índigo" | `navy-*` canônica; `indigo-*` fica como apelido (decisão do pivô), sem uso em código novo |
| Chip, selo, linha, cartão | componentes do ZardUI | briefing chama de "próprios" | ZardUI editado (ver R5) |
| Tela de login: botão "Voltar" | — | existe na tela, leva às boas-vindas | **fica para a 004**, que cria as boas-vindas |
| "G" do Google no código atual | — | cores oficiais | o `login.html` atual usa cores não oficiais; troca pelo oficial |

Tudo isso está refletido nos contratos. Se o William discordar de alguma linha, a mudança é num
contrato só.

---

## R7. Fontes servidas pelo próprio domínio

**Decisão**: quatro arquivos `woff2` **variáveis** em `public/fonts/`, com `@font-face` escrito à
mão em `src/styles.css` e pré-carregamento dos dois arquivos latinos no `index.html`.

| Arquivo | Tamanho | Baixado quando |
|---|---|---|
| `inter-latin-wght-normal.woff2` | 48 KB | sempre (pré-carregado) |
| `outfit-latin-wght-normal.woff2` | 32 KB | sempre (pré-carregado) |
| `inter-latin-ext-wght-normal.woff2` | 85 KB | só se aparecer caractere do bloco estendido |
| `outfit-latin-ext-wght-normal.woff2` | 15 KB | idem |

Origem: pacotes `@fontsource-variable/inter@5.3.0` e `@fontsource-variable/outfit@5.3.0`
(licença OFL), instalados só para copiar os arquivos e desinstalados na mesma tarefa. A licença
vai junto, em `public/fonts/OFL.txt`.

**Por quê**: (1) a página de resgate usa Outfit 700 e 600 e Inter 400 e 600; com arquivos
estáticos seriam quatro downloads, com variáveis são dois; (2) nome de arquivo estável permite
`<link rel="preload">`; (3) não há chamada a `fonts.googleapis.com`, que hoje a própria CSP de
produção bloqueia (`style-src 'self'`) e que expõe o IP de quem achou o pet a um terceiro.
`font-display: swap` mostra o texto na hora com a fonte do sistema.

O briefing pede "Outfit (600, 700) e Inter (400, 500, 600)". O arquivo variável contém esses
pesos e os demais; o contrato limita o uso aos cinco.

**Alternativas descartadas**: `@import '@fontsource/…'` no CSS (nomes com hash, não dá para
pré-carregar; dependência permanente); arquivos estáticos por peso (mais requisições e mais
bytes); `optimization.fonts` do Angular com Google Fonts (continua dependendo do Google no build).

---

## R8. Ícones

**Decisão**: Boxicons v3 por `@boxicons/js@1.0.1` (MIT), registrados no `@ng-icons/core` 34.x sob
nomes do Faro, num arquivo só (`src/app/shared/icons/faro-icons.ts`). 32 ícones.

- Os nomes de export foram conferidos no pacote publicado: os 32 existem.
- `createSvgString` devolve o SVG com `fill="currentColor"`; tira-se `width`/`height` para o
  `ng-icon` controlar o tamanho.
- Os 32 SVGs entram no pacote inicial (cerca de 15 KB antes de comprimir). Aceito: é um conjunto
  pequeno e evita uma requisição por ícone na página de resgate.
- O ZardUI vem com Lucide. Troca-se cada símbolo pelo nome do Faro e desinstala-se
  `@ng-icons/lucide`, para haver um traço só. `components.json` continua com `"icons": "lucide"`
  (é o único valor que o CLI aceita hoje); por isso **todo `add` futuro traz Lucide de novo** e a
  troca faz parte da receita (`shared-components.contract.md` §7).
- WhatsApp: glifo oficial do pacote `brands` do Boxicons. Google: SVG oficial de quatro cores,
  embutido num componente próprio.

---

## R9. Achado: CSS crítico embutido × CSP de produção

**Fato**: o build de produção atual gera
`<link rel="stylesheet" href="styles-….css" media="print" onload="this.media='all'">`
(conferido em `dist/faro/browser/index.html` e `index.csr.html`). A CSP de `vercel.json` e de
`src/server.ts` é `script-src 'self'`, que **bloqueia manipuladores embutidos** como esse `onload`.
Com JavaScript ligado, a folha de estilo global fica presa em `media="print"`.

Hoje isso passa despercebido porque o PrimeNG injeta os estilos por JavaScript. **Com Tailwind,
toda a aparência está na folha global: em produção as telas renderizadas no navegador (login, app,
admin) sairiam sem estilo.** `ng serve`, os testes e o Playwright local não mostram o problema,
porque não aplicam a CSP nem embutem CSS crítico.

**Decisão**: desligar o CSS crítico embutido em produção
(`optimization.styles.inlineCritical: false` em `angular.json`) e verificar por script que nenhum
HTML gerado tem `onload=`. Custo: a folha de estilo passa a bloquear a primeira pintura; é um
arquivo só, pequeno e com cache longo. A CSP **não** é afrouxada.

**Alternativa descartada**: `'unsafe-inline'` ou `'unsafe-hashes'` em `script-src` (enfraquece a
proteção contra XSS exigida pela spec 001).

**Fora do escopo desta spec, mas precisa de dono**: o mesmo HTML tem dois `<script>` embutidos do
*event replay* do Angular (`withEventReplay()`), também bloqueados por `script-src 'self'`. O
efeito é menor (cliques dados antes da hidratação não são repetidos e aparece um erro de CSP no
console), mas toca a página de resgate. Opções para a spec 003: tirar `withEventReplay()` (o botão
principal do resgate é um link e funciona sem JavaScript) ou adotar CSP com nonce/hash
(`security.autoCsp`). Recomendação: tirar o *event replay*.

---

## R10. Foco: um mecanismo só

**Decisão**: uma regra global `:focus-visible` com `outline: 2px solid var(--ring)`,
`outline-offset: 2px` e `box-shadow: 0 0 0 2px var(--ring-gap)`. Os componentes não têm classe de
foco.

**Por quê**: (1) o desenho é o pedido ("anel de 2px em tinta com folga de 2px; no escuro, anel
claro"); (2) a folga em cor sólida mantém o anel visível sobre qualquer fundo, inclusive lima e
navy; (3) `outline` continua visível no modo de alto contraste do Windows, onde `box-shadow` some
(as classes `ring-*` do Tailwind são `box-shadow`); (4) um teste só confere qualquer elemento.

**Diferença para `docs/zardui-faro.md` §2**: lá o anel é escrito em cada variante com `ring-*`.
O resultado visual é o mesmo; muda onde está escrito.

---

## R11. Tema escuro só no app do tutor

**Decisão**: a classe `.dark` é posta no hospedeiro de `app-tutor-shell`, e só ali. A preferência
(`claro | escuro | sistema`) fica em `ThemeService` (`core/theme`), gravada em `localStorage`
(`faro.theme`), por aparelho. Padrão: `sistema`.

Pontos que alguém sem contexto erraria:

- `@custom-variant dark (&:is(.dark *))` alcança só **descendentes**; por isso as classes visuais
  ficam num contêiner interno, e é ele que pinta o fundo (o `body` é sempre claro).
- **Overlays ficam fora da casca.** Diálogos são anexados a um contêiner em `body`. A casca replica
  `dark` nesse contêiner enquanto está montada e remove ao sair. O spike confirma qual é o
  contêiner (o ZardUI traz `core/overlay/*`; o esperado é o `cdk-overlay-container`).
- O aviso temporário tem a mesma cor nos dois temas (`--toast`), então não depende da classe.
- `color-scheme: dark` dentro de `.dark` faz controles nativos e barras de rolagem acompanharem.
- O serviço mora em `core/` porque o ESLint do projeto proíbe `localStorage` em `shared/` e
  `features/`.
- O app do tutor é renderizado no navegador, então a classe entra antes da primeira pintura: não
  precisa de script no `<head>`.

**LGPD**: a preferência de tema é configuração funcional do aparelho, não dado pessoal, e não sai
do navegador. Não exige consentimento.

**Alternativas descartadas**: classe no `<html>` ligada e desligada por rota (um erro de navegação
deixaria a página de resgate escura); `prefers-color-scheme` direto no CSS (não permite a escolha
do tutor e escureceria as páginas públicas); guardar a preferência na conta (exigiria tabela; a
decisão é "por aparelho").

---

## R12. Remoção do service worker e desligamento dos já instalados

**Decisão**: remover `@angular/service-worker`, `provideServiceWorker`, `ngsw-config.json` e a
opção `serviceWorker` do `angular.json`; manter `manifest.webmanifest` e os ícones; e deixar um
**arquivo de desligamento** no endereço que os navegadores já registraram.

**Por que não basta apagar**: quem abriu o site em produção tem o worker antigo registrado em
`/ngsw-worker.js`, servindo o app em cache. O worker do Angular se autodestrói quando
`/ngsw.json` responde 404; mas aqui um caminho de um segmento que não é arquivo cai na rota
`/:codigo`, que responde HTML com status 200. O worker antigo **nunca morreria** e continuaria
servindo a versão em PrimeNG.

**Três camadas**:

1. `public/ngsw-worker.js` com o conteúdo do `safety-worker.js` do Angular (copiado de
   `node_modules/@angular/service-worker/safety-worker.js` **antes** de desinstalar o pacote). O
   navegador revalida o script do worker a cada navegação; ao receber o novo, ele assume
   (`skipWaiting`), cancela o próprio registro e apaga os caches `ngsw:*`. Na visita seguinte a
   página vem da rede.
2. `src/app/core/pwa/unregister-service-workers.ts`, chamado em `src/main.ts`: cancela qualquer
   registro e apaga caches `ngsw:*`. Cobre workers de outra origem de script. Fica dentro de
   `try/catch`; nunca derruba a página.
3. Verificação: teste e2e que registra `/ngsw-worker.js` e espera a lista de registros esvaziar.

**Exceção declarada ao "sem service worker"**: `public/ngsw-worker.js` é um arquivo de service
worker, mas o único efeito dele é se remover. A checagem "não sobrou service worker" o isenta e
exige que ele contenha `registration.unregister`. Fica no repositório **por pelo menos 12 meses**
depois do deploy em produção; a retirada é decisão do William.

**Princípios**: I (uma página de resgate em cache antigo poderia mostrar dados desatualizados) e V
(o MVP não tem service worker).

---

## R13. Ícones do app e manifest

**Decisão**: gerar os PNGs a partir de `public/logos/logo-compact.svg` com um script que usa o
Chromium do Playwright (já instalado): focinho lima centralizado sobre navy `#25337A`.

| Arquivo | Uso |
|---|---|
| `public/favicon.svg` | ícone da aba (navegadores modernos) |
| `public/favicon.ico` | 32 e 48px; atende quem pede `/favicon.ico` direto (sem isso a requisição cairia em `/:codigo`) |
| `public/icons/favicon-32x32.png` | aba |
| `public/icons/apple-touch-icon.png` | 180px, sem transparência |
| `public/icons/icon-192x192.png`, `icon-512x512.png` | manifest, `purpose: any` (focinho com 72% da largura) |
| `public/icons/icon-maskable-192x192.png`, `icon-maskable-512x512.png` | manifest, `purpose: maskable` (focinho com 52%, dentro da zona segura) |

O `.ico` é montado pelo próprio script: cabeçalho de 6 bytes, uma entrada de 16 bytes por imagem
e os PNGs embutidos (formato aceito desde o Windows Vista). Não precisa de dependência nova.

Manifest: `name` e `short_name` "Faro", `lang` "pt-BR", `start_url` e `scope` "/",
`display` "standalone", `theme_color` "#25337A", `background_color` "#F7F8F8". `theme-color` do
`index.html` passa de `#3A4FD6` (cor que saiu da marca) para `#25337A`.

**Alternativas descartadas**: `sharp` ou `pwa-asset-generator` (dependência nova para rodar uma
vez); desenhar à mão (a pessoa responsável está dormindo, e o script é repetível quando o logo
mudar).

---

## R14. Galeria de desenvolvimento

**Decisão**: uma rota `/dev/ui`, registrada só quando `ngDevMode` é verdadeiro, mostra todos os
componentes e as quatro cascas com dados de exemplo.

**Por quê**: o app do tutor e o admin exigem sessão, e as telas reais são das specs 003 e 004. Sem
a galeria não há como **ver** nem **testar sozinho** (Playwright + axe, três larguras, tema
escuro) o que esta spec entrega. É também onde o William olha o resultado pela manhã.

**Como fica fora de produção**: o Angular CLI define `ngDevMode` como `false` quando otimiza; o
ramo do operador ternário é eliminado junto com o `import()` da galeria. A checagem do pacote
(R15) reprova se sobrar qualquer fonte de `features/dev-gallery/`.

Custo: uma pasta a mais para manter. Registrado em *Complexity Tracking*.

**Alternativa descartada**: Storybook (dependência grande, outro build, outra configuração de
Tailwind).

---

## R15. Fronteira Rescue-First: lint e pacote

**Decisão**: duas provas independentes.

1. **Lint** (`no-restricted-imports` em `features/public/**`): atualizado para as pastas novas,
   para o tema escuro e para os componentes de overlay. Um script passa imports proibidos e
   permitidos pela API do ESLint e confere o resultado.
2. **Pacote** (`ng build --stats-json` → `dist/faro/stats.json`): o script calcula tudo o que é
   alcançável por import estático a partir do pacote inicial e dos pontos de entrada de
   `features/public/` e reprova se encontrar o app autenticado, a galeria, o tema ou overlays.
   A existência do `stats.json` e do campo `entryPoint` foi conferida no código do builder.

**Dívida conhecida, não resolvida aqui**: `app.routes.ts` importa `authGuard`, `adminGuard` e
`anonGuard` de forma estática; com isso `core/auth` e o `@supabase/supabase-js` já estão no pacote
inicial que a página pública baixa. O script lista isso como aviso. A spec 003 tem meta de 100 KB
de JavaScript na rota pública e é o lugar de resolver (carregar os guards sob demanda). Mexer nos
guards aqui mudaria o comportamento do login, que esta spec promete não mudar.

---

## R16. Verificações que não precisam de pessoa

| Verificação | Ferramenta | Por que assim |
|---|---|---|
| Valores dos tokens, pares de contraste, arquivo único de tema | `scripts/ui-checks/tokens.mjs` (Node puro) | lê `src/styles.css` do disco; os testes do Angular rodam em jsdom e não têm os tipos de `node:fs` no `tsconfig.spec.json` |
| Sem PrimeNG, sem service worker, sem identidade antiga, `.dark` só na casca do tutor, sem cor solta | `scripts/ui-checks/removed-stack.mjs` | varredura de arquivos e do `package.json` |
| Fronteira de imports | `scripts/ui-checks/boundary.mjs` | API do ESLint |
| Fronteira no pacote, galeria fora, sem `onload=`, canário do Tailwind | `scripts/ui-checks/public-bundle.mjs` | lê `dist/faro/stats.json` |
| Acessibilidade (axe) no login e na galeria, nos dois temas | `@axe-core/playwright` 4.14 | única dependência nova de teste |
| Larguras, navegação, foco, alvo de toque, fontes do próprio domínio, tema, worker antigo | Playwright (`e2e/ui-*.spec.ts`, `e2e/login-ui.spec.ts`, `e2e/legacy-sw.spec.ts`) | precisa de navegador |
| Lógica de componentes e serviços | Vitest (`*.spec.ts`) | já é o padrão |

Scripts de `package.json`: `check:tokens`, `check:stack`, `check:boundary`, `check:ui` (os três
anteriores), `build:stats` e `check:bundle`.

---

## R17. Armadilhas

**Já aprendidas (memória do agente `frontend-angular`, continuam valendo)**:

- `npm test` sem `--watch=false` entra em modo de observação e **não termina**. Use sempre
  `npm test -- --watch=false`. Nunca rode `npm start` para "verificar".
- Tirar um `import` do TypeScript sem tirar do `imports: []` do `@Component` dá erro `NG1010`.
- `computed()` **não** acompanha `touched`/`valid` de Reactive Forms: use `get`.
- `no-unused-vars` do ESLint reprova import sem uso, inclusive em `*.spec.ts`.

**Deixaram de valer** (são da época do PrimeNG; a memória do agente ainda os lista):
"prefira componentes nativos do PrimeNG", a nota sobre `@layer primeng` × `faro-ds.css`, a classe
`.faro-dark` e os caminhos `src/styles/` e `src/theme/`.

**Novas**:

- O `init` **sobrescreve** `src/styles.css`.
- Os seletores do ZardUI (`z-button`, `[z-button]`) reprovam nas regras
  `@angular-eslint/component-selector` e `directive-selector` do projeto (prefixo `app`). Solução:
  um bloco de exceção no `eslint.config.js` só para o código copiado. Não se edita o código do
  ZardUI para agradar o lint de estilo.
- `h1`, `h2`, `h3` recebem `text-foreground` na camada base. Dentro do cartão lima o título
  precisa de `text-primary-foreground` explícito, ou some no tema escuro.
- Com `<base href="/">`, `href="#conteudo"` navega para a raiz. O atalho "pular para o conteúdo"
  usa manipulador de clique.
- PowerShell 5.1 (o shell da máquina) não tem `&&`. As tarefas dão um comando por linha.
- Há trabalho do pivô ainda não commitado na árvore. `git clean`, `git reset --hard`,
  `git stash` e `git checkout -- .` estão proibidos para quem executa.
- `provideIcons` local de um componente do ZardUI sobrepõe o global; ao trocar Lucide por
  Boxicons, remova o `provideIcons`/`viewProviders` local.

---

## R18. Login: migrar sem mudar o comportamento

**Decisão**: reescrever `login.html` com os componentes novos e o layout de `V2-entrar*`; em
`login.ts`, trocar só imports e o mecanismo dos três avisos temporários; apagar `login.css`.

- `login.spec.ts` importa `MessageService` de `primeng/api`. O arquivo **não pode** ficar
  intocado. Edição permitida, e só ela: remover esse import e a linha do provider. Nenhuma
  expectativa muda.
- Os 17 `data-testid` da feature 001 estão listados em `shared-components.contract.md` §6.1.
- Avisos que eram `warn` (âmbar) passam a `neutral`: âmbar é só do modo perdido.
- Os textos de título e de botão seguem a tela aprovada; mensagens de erro não mudam.
- "Esqueci a senha" e "Criar conta" continuam provisórios (aviso "Em breve"), como hoje.
- A spec 001 prevê `e2e/login.spec.ts`, que **não existe** no repositório; hoje só há
  `e2e/smoke.spec.ts`. O e2e novo desta spec (`e2e/login-ui.spec.ts`) cobre aparência e
  acessibilidade, não o fluxo com banco.

---

## R19. Trade-offs de segurança, explícitos

| Tema | Risco | O que se fez | O que fica |
|---|---|---|---|
| Registro remoto do ZardUI | código de terceiro entra sem hash nem lockfile | revisão do diff, lista de imports permitidos, código commitado, sem `--overwrite`, `npm audit` | confiança no conteúdo revisado uma vez |
| CSS crítico embutido × CSP | telas sem estilo em produção | `inlineCritical: false` + checagem; CSP mantida estrita | folha de estilo bloqueia a primeira pintura |
| Scripts embutidos do *event replay* × CSP | já quebrado em produção, independentemente desta spec | **apenas reportado** (R9) | decisão na spec 003 |
| `style-src 'self' 'unsafe-inline'` | a justificativa no código cita o PrimeNG, que sai | comentário atualizado (T066): o Angular e o `ngx-sonner` ainda injetam `<style>` | endurecer para nonce é melhoria futura; não foi afrouxado nem endurecido aqui |
| Fontes | chamada a terceiro (Google) na página pública | fontes no próprio domínio | nenhuma |
| Worker antigo | usuário preso em versão velha, inclusive da página de resgate | arquivo de desligamento + limpeza no carregamento + teste | arquivo fica 12 meses |
| Preferência de tema em `localStorage` | nenhuma informação sensível | só em `core/`, com `try/catch` | nenhuma |
| Galeria de desenvolvimento | superfície extra | não entra no build de produção, com checagem | nenhuma |
| Guards no pacote inicial | página pública carrega código de autenticação | **apenas reportado** (R15) | spec 003 |

Em todos os casos a escolha foi a mais restritiva que não exigia redesenhar outra spec.

---

## R20. Pontos em aberto (para o William)

1. **Tema padrão**: assumido `sistema` (segue o aparelho até o tutor escolher). Trocar para
   `claro` é uma linha em `theme.service.ts`.
2. **Página inicial (`/`)**: assumida como página provisória com o painel de marca, a tagline e um
   botão "Entrar". O conteúdo definitivo é da spec 004 (boas-vindas).
3. **Botão "Voltar" do login**: fica para a 004, junto com a tela de boas-vindas.
4. **Caminhos `/app/pets`, `/app/scans`, `/app/conta`, `/admin/codigos`, `/admin/fila`,
   `/admin/auditoria`**: provisórios, só para a navegação das cascas ter destino. As specs 003 e
   004 confirmam.
5. ***Event replay* × CSP** (R9) e **guards no pacote inicial** (R15): achados fora do escopo.
6. **Novo wordmark em Outfit**: a tarefa T070 fica bloqueada até os arquivos chegarem.
7. **Ícone do app**: focinho lima sobre navy. É a única decisão visual tomada sem tela de
   referência; trocar a cor de fundo é uma constante no script gerador.
8. **Retirada do arquivo de desligamento do worker**: sugerido 12 meses após o deploy.
9. **Definições dos subagentes**: `.claude/agents/frontend-angular.md` foi reescrito para o pivô
   em 2026-11-21 (ZardUI, nunca PrimeNG). Pode restar na memória do agente uma nota antiga que
   manda preferir PrimeNG; as regras do `tasks.md` mandam ignorar e a T067 a remove.
10. **Caminhos confirmados** (item 4): a tabela de rotas da `003` está em
    `specs/003-tag-qr/contracts/integration-002-004.contract.md` §1 e mantém os caminhos acima.
    Os dois achados do item 5 viraram as tarefas T034A e T034B da `003`.
