# Feature Specification: Nova identidade visual e base de interface responsiva

**Feature Branch**: `002-ui-zardui`
**Created**: 2026-11-21
**Status**: Draft
**Input**: User description: "Trocar a base de interface do produto e aplicar a nova identidade visual do Faro em tudo: uma única fonte de cores e tipografia (clara e escura), botões e campos nas regras da marca, estruturas de tela para celular, tablet e desktop, tema escuro só no app do tutor, tela de entrar redesenhada sem mudar o comportamento, fim da cópia offline das páginas, ícone do produto com o focinho e remoção do que sobrou da identidade antiga e de funcionalidades fora do MVP." (A descrição original nomeia as tecnologias; elas estão no `plan.md`.)

> **Nota de domínio**: esta feature é a **fundação visual** do MVP (constituição v2.0.0,
> Princípios V e VI). As specs `003-tag-qr` e `004-conta-tutor` constroem as telas delas sobre o
> que esta entrega. A única tela de produto que muda aqui é a de **entrar** (spec `001-login`),
> que ganha o desenho novo e mantém o comportamento. A spec é **agnóstica de stack**
> (Princípio IV): o nome da pasta é só um identificador herdado. As telas aprovadas são as
> páginas "MVP v2" do canvas *Faro · Telas do MVP*; o sistema visual está em `DESIGN.md`.

---

## Clarifications

### Session 2026-11-21

Decisões já tomadas pelo William (registradas em `docs/decisoes-pivo.md`) e no briefing desta spec:

- Q: Qual é a cor de ação do produto? → A: **Lima** (`#84C32E`) com texto em tinta (`#13201E`).
  Só o botão principal e o único cartão da tela que pede uma ação são lima.
- Q: Como se mostra que algo está selecionado? → A: Em **tinta** (aba ativa, chip escolhido,
  segmento, item de navegação, caixa marcada, interruptor ligado). No tema escuro, o inverso.
  Lima nunca é seleção.
- Q: Qual é a cor de marca? → A: **Navy** (`#25337A`), em painéis, rodapé da página de resgate e
  links sublinhados. Navy não é cor de botão. O azul `#3A4FD6` saiu de vez.
- Q: Onde o âmbar aparece? → A: **Só no modo perdido** (e no atalho que leva a ele). Vermelho só
  em ação destrutiva.
- Q: Quais são as fontes? → A: **Outfit** em títulos e botões (no lugar de Poppins); **Inter** no
  texto. Não há fonte monoespaçada: o código da tag é escrito em Outfit.
- Q: Como são os botões de WhatsApp e de Google? → A: Usam o **ícone oficial** da empresa. O do
  WhatsApp é lima com o ícone em tinta; o do Google é branco com contorno e o "G" nas cores
  originais.
- Q: Em quais larguras toda tela precisa funcionar? → A: **Três**: celular (desenhado em 390),
  tablet (768) e desktop (1440). No celular a navegação do app é uma barra inferior; no tablet, um
  trilho lateral; no desktop, um menu lateral com o logo.
- Q: Onde existe tema escuro? → A: **Só nas telas autenticadas do tutor.** Página de resgate,
  conta, ativação e admin são sempre claros.
- Q: Como o tutor escolhe o tema? → A: Entre **claro, escuro e sistema**, e a escolha fica
  guardada **por aparelho**. A tela onde ele escolhe é da spec 004; o mecanismo é desta.
- Q: O logo aparece na tela de entrar? → A: Sim, o wordmark aparece **em todas as larguras**.
- Q: O produto continua guardando páginas para uso offline? → A: **Não.** Ficam só a
  identificação do produto e os ícones.
- Q: Como é o indicador de foco? → A: Um **anel de 2px em tinta com folga de 2px** (no escuro, anel
  claro). Lima não serve para foco.
- Q: O que acontece com as partes vazias de saúde, lembretes e assinatura? → A: **Saem.** São
  roadmap, não MVP.
- Q: E o novo wordmark redesenhado em Outfit? → A: O William vai entregar. Até lá valem os
  arquivos atuais; a troca tem de ser simples.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconhecer o mesmo Faro em toda tela (Priority: P1)

Como qualquer pessoa que usa o Faro (quem achou um pet, o Tutor ou o Admin), quero que toda tela
tenha a mesma cara e siga as mesmas regras: uma cor que age, uma que marca seleção, uma que é
marca e uma que avisa; as mesmas duas fontes; botões e campos iguais em todo lugar; texto que dá
para ler e controles que dá para tocar. Assim entendo o que fazer sem aprender cada tela de novo.

**Why this priority**: É a base de tudo. Sem uma única fonte de cores, tipografia e componentes,
cada tela das próximas features inventaria a própria aparência e a identidade aprovada não
chegaria ao produto. Entrega valor sozinha: a equipe passa a ter um conjunto de peças pronto e
conferido, e nenhuma tela nova nasce com a identidade antiga.

**Independent Test**: Abrir o catálogo de referência interno, que mostra todas as peças de
interface em todos os estados, e conferir que (a) as quatro regras de cor valem, (b) as fontes são
Outfit e Inter, (c) o contraste e os alvos de toque passam nas verificações automáticas e (d) não
há vestígio da identidade anterior no produto.

**Acceptance Scenarios**:

1. **Dado** uma tela com uma ação principal, **Quando** ela é exibida, **Então** essa ação é o
   único elemento em lima da tela (além, no máximo, de um cartão de ação) e o texto sobre o lima
   está em tinta.
2. **Dado** um controle com estado selecionado (item de navegação, chip, segmento, caixa,
   interruptor), **Quando** ele está selecionado, **Então** aparece em tinta com texto claro, e
   nunca em lima.
3. **Dado** qualquer texto do produto, **Quando** medido contra o fundo em que aparece, **Então**
   o contraste é de pelo menos 4,5:1; bordas de controle e ícones têm pelo menos 3:1.
4. **Dado** uma pessoa que navega só pelo teclado, **Quando** o foco chega a qualquer controle,
   **Então** aparece um anel de foco visível em tinta, com folga, igual em todos os controles.
5. **Dado** uma pessoa usando o celular, **Quando** toca em qualquer controle, **Então** a área de
   toque tem pelo menos 44 por 44 pontos.
6. **Dado** um botão que abre o WhatsApp ou o login com Google, **Quando** ele é exibido,
   **Então** traz o ícone oficial da empresa: o do WhatsApp é lima com o ícone em tinta e o do
   Google é branco com contorno e o "G" nas cores originais.
7. **Dado** qualquer tela, **Quando** ela carrega, **Então** títulos e botões estão em Outfit e o
   texto em Inter, e nenhuma fonte é buscada em serviço de terceiros.
8. **Dado** uma pessoa que pediu menos movimento no aparelho, **Quando** usa o produto, **Então**
   as animações e transições são suprimidas.
9. **Dado** o produto inteiro, **Quando** se procura a cor, a fonte ou um componente da identidade
   anterior, **Então** não se encontra nenhum.

---

### User Story 2 - Entrar no Faro com a cara nova, em qualquer aparelho (Priority: P2)

Como Tutor (ou Admin), quero que a tela de entrar tenha a nova identidade e se ajuste ao meu
aparelho (celular, tablet ou computador), funcionando exatamente como já funcionava: e-mail e
senha, Google, "manter conectado", os mesmos avisos e os mesmos destinos.

**Why this priority**: É a única tela de produto que já existe; ela é a porta do app e a primeira
prova de que a base visual funciona numa tela real. Depende da história 1 e não muda regra de
negócio, por isso vem depois dela.

**Independent Test**: Abrir a tela de entrar em 390, 768 e 1440 de largura e comparar com as telas
aprovadas; repetir os cenários de aceitação da spec `001-login` e verificar que todos dão o mesmo
resultado; rodar as verificações automáticas que já existiam para essa tela.

**Acceptance Scenarios**:

1. **Dado** um celular, **Quando** abro a tela de entrar, **Então** vejo o wordmark, o título em
   destaque, os campos de e-mail e senha, "Manter conectado", "Esqueci a senha", o botão "Entrar"
   em lima, o botão do Google com contorno e o convite para criar conta no pé da tela, com o
   focinho gigante sangrando pelo canto de cima.
2. **Dado** um tablet, **Quando** abro a tela de entrar, **Então** o formulário aparece numa
   coluna centralizada, com o wordmark acima do título.
3. **Dado** um computador, **Quando** abro a tela de entrar, **Então** a metade esquerda é o
   painel de marca em navy, com o wordmark de letras brancas, o focinho gigante e a frase "O
   caminho de volta para casa.", e o formulário fica centralizado na metade direita.
4. **Dado** credenciais válidas, inválidas, e-mail não confirmado, excesso de tentativas, sessão
   expirada ou saída da conta, **Quando** uso a tela, **Então** o resultado e as mensagens são os
   mesmos de antes desta mudança.
5. **Dado** as verificações automáticas que já existiam para a tela de entrar, **Quando** são
   executadas depois da mudança, **Então** todas passam sem que aquilo que elas verificam tenha
   sido alterado.
6. **Dado** um aparelho configurado para tema escuro, **Quando** abro a tela de entrar, **Então**
   ela aparece no tema claro.
7. **Dado** um aviso da tela de entrar que antes aparecia em âmbar, **Quando** ele é exibido,
   **Então** aparece em tom neutro (âmbar é só do modo perdido) e continua com o mesmo texto.

---

### User Story 3 - Usar o Faro bem no celular, no tablet e no computador (Priority: P2)

Como Tutor, quero que o app se organize de acordo com a largura da minha tela: no celular, uma
barra de navegação embaixo nas telas principais; no tablet, um trilho lateral com ícones; no
computador, um menu lateral com o logo. Como Admin, quero o mesmo cuidado no painel
administrativo. Como quem achou um pet, quero que a página pública caiba bem em qualquer aparelho,
abra rápido e funcione mesmo com rede ruim.

**Why this priority**: Os tutores também usam o computador, e a constituição exige toda tela em
três larguras. As estruturas de tela são o que as próximas features vão preencher; sem elas, cada
tela resolveria navegação e colunas por conta própria.

**Independent Test**: No catálogo de referência interno, abrir cada estrutura de tela (app do
tutor, fluxo, admin, página pública) em 320, 390, 768 e 1440 de largura e verificar a navegação
esperada, a ausência de rolagem horizontal e a ausência de conteúdo cortado ou sobreposto.

**Acceptance Scenarios**:

1. **Dado** o app do tutor no celular numa tela principal (Início, Pets, Scans ou Conta),
   **Quando** ela é exibida, **Então** há uma barra de navegação em pílula flutuando embaixo, com
   o item atual em tinta.
2. **Dado** o app do tutor no celular numa tela interna (por exemplo, os detalhes de um pet),
   **Quando** ela é exibida, **Então** não há barra inferior; há um topo com o título e o botão de
   voltar.
3. **Dado** o app do tutor no tablet, **Quando** qualquer tela é exibida, **Então** a navegação é
   um trilho lateral estreito com ícones e rótulos curtos.
4. **Dado** o app do tutor no computador, **Quando** qualquer tela é exibida, **Então** a
   navegação é um menu lateral com o wordmark no topo e a identificação do tutor no pé.
5. **Dado** um fluxo passo a passo (conta, ativação, cadastro), **Quando** é exibido, **Então** é
   uma coluna só: de largura total no celular, com a ação principal ancorada embaixo;
   centralizada no tablet; ao lado do painel de marca no computador.
6. **Dado** o painel administrativo, **Quando** é exibido no computador, **Então** tem menu
   lateral; no tablet e no celular, uma barra no topo com abas que rolam para os lados.
7. **Dado** uma página pública, **Quando** é exibida no celular ou no tablet, **Então** a foto do
   pet ou o painel de marca ocupa a faixa do topo e o conteúdo entra numa folha de cantos
   arredondados que sobe sobre ela; no computador, a foto ou o painel ocupa a metade esquerda.
8. **Dado** uma página pública, **Quando** é aberta, **Então** ela não carrega nenhuma parte do app
   autenticado, não usa janelas sobrepostas e a ação principal funciona antes de a página terminar
   de carregar.
9. **Dado** qualquer estrutura de tela em 320 de largura, **Quando** é exibida, **Então** não há
   rolagem horizontal.
10. **Dado** uma pessoa que usa leitor de tela, **Quando** entra numa área com navegação,
    **Então** encontra a navegação nomeada, o item atual anunciado e um atalho para pular direto
    ao conteúdo.

---

### User Story 4 - Usar o app do tutor no tema escuro (Priority: P3)

Como Tutor, quero poder usar o app no tema escuro, escolhendo entre claro, escuro ou "seguir o
aparelho", e quero que essa escolha continue valendo quando eu voltar naquele aparelho. Como quem
achou um pet, quero que a página pública esteja sempre clara, porque provavelmente estou na rua,
no sol.

**Why this priority**: Melhora o conforto de uso, mas o app já funciona sem ela. Depende das
estruturas de tela da história 3. A tela onde o tutor muda a escolha pertence à spec 004; aqui
entra o mecanismo.

**Independent Test**: Com a preferência em "escuro" (e, separadamente, com o aparelho em modo
escuro e a preferência em "sistema"), abrir o app do tutor e verificar que está escuro; abrir a
página pública, a tela de entrar, um fluxo e o admin e verificar que todos estão claros; fechar e
reabrir e verificar que a escolha foi mantida.

**Acceptance Scenarios**:

1. **Dado** um tutor que nunca escolheu um tema, **Quando** abre o app num aparelho em modo
   escuro, **Então** o app aparece escuro; num aparelho em modo claro, aparece claro.
2. **Dado** um tutor que escolheu "escuro", **Quando** abre o app em qualquer aparelho onde fez
   essa escolha, **Então** o app aparece escuro, mesmo com o aparelho em modo claro.
3. **Dado** um tutor que escolheu "claro" ou "escuro", **Quando** fecha e reabre o navegador
   naquele aparelho, **Então** a escolha continua valendo.
4. **Dado** a preferência "sistema" e o app aberto, **Quando** o aparelho muda de claro para
   escuro (ou o contrário), **Então** o app acompanha sem precisar recarregar.
5. **Dado** qualquer preferência de tema e qualquer modo do aparelho, **Quando** abro uma página
   pública, a tela de entrar, um fluxo de conta ou ativação, ou o admin, **Então** a tela aparece
   **clara**.
6. **Dado** o app do tutor no tema escuro, **Quando** uma janela de confirmação é aberta,
   **Então** ela também aparece no tema escuro.
7. **Dado** o tema escuro, **Quando** se mede o contraste, **Então** vale o mesmo mínimo do tema
   claro; lima e âmbar não mudam, e a seleção inverte (pílula clara com texto escuro).
8. **Dado** um tutor que sai do app escuro para uma área sempre clara, **Quando** a nova tela
   aparece, **Então** não sobra nenhum elemento escuro do app.

---

### User Story 5 - Ver sempre a versão atual, e o focinho como ícone (Priority: P3)

Como qualquer pessoa que usa o Faro, quero ver sempre a versão atual das páginas, e não uma cópia
guardada no aparelho. Quero também reconhecer o Faro pelo focinho na aba do navegador e na tela
inicial do celular.

**Why this priority**: A constituição decidiu que o MVP não guarda páginas para uso offline; uma
cópia antiga da página de resgate é um risco para o propósito do produto. O ícone ainda é o
genérico do início do projeto. São mudanças pequenas e independentes das demais.

**Independent Test**: Num navegador que tinha a versão anterior guardada, abrir o produto depois
da atualização e verificar que, no máximo na segunda visita, a página vem da rede e não há mais
cópia guardada; conferir o ícone na aba e na tela inicial do celular.

**Acceptance Scenarios**:

1. **Dado** um aparelho que nunca abriu o Faro, **Quando** abre qualquer página, **Então** o
   produto não guarda cópia das páginas para uso offline.
2. **Dado** um aparelho que guardou a versão anterior, **Quando** abre o produto depois da
   atualização, **Então** a cópia guardada é descartada sozinha e, no máximo na visita seguinte, a
   página exibida é a atual.
3. **Dado** qualquer página, **Quando** olho a aba do navegador, **Então** o ícone é o focinho do
   Faro.
4. **Dado** um celular, **Quando** adiciono o Faro à tela inicial, **Então** o ícone é o focinho e
   o nome é "Faro".
5. **Dado** o produto sem conexão, **Quando** tento abrir uma página, **Então** vejo o erro de
   conexão do próprio navegador, e não uma página antiga.

---

### Edge Cases

- **Tela muito estreita (320)**: nenhuma estrutura de tela pode gerar rolagem horizontal; a barra
  inferior continua com os quatro itens legíveis.
- **Texto ampliado (zoom de 200%)**: o conteúdo reflui; nada essencial fica cortado ou escondido
  atrás da navegação.
- **Nome ou e-mail longo do tutor** no menu lateral: é cortado com reticências, sem quebrar o
  layout.
- **Pet sem foto**: a capa do pet mostra um fundo neutro com um símbolo de pata, com o nome
  legível.
- **Aparelho em modo escuro abrindo a página pública, a tela de entrar ou o admin**: continuam
  claros.
- **Preferência de tema que não pôde ser guardada** (navegação privada, armazenamento bloqueado):
  o app segue o aparelho e não mostra erro.
- **Preferência guardada com valor desconhecido**: é tratada como "sistema".
- **Troca de tema com o app aberto**: nenhum elemento fica com a cor do tema anterior.
- **Janela de confirmação aberta no app escuro**: acompanha o tema; ao fechar, nada sobra.
- **Pessoa que pediu menos movimento**: nenhuma animação é essencial para entender a tela.
- **Modo de alto contraste do sistema**: o foco continua visível.
- **Rede lenta**: o texto aparece na hora com a fonte do sistema e é trocado quando as fontes do
  Faro chegam; o layout não salta.
- **Página pública sem o carregamento completo dos scripts**: a ação principal e o conteúdo
  continuam utilizáveis.
- **Cópia offline antiga da versão anterior**: é descartada sozinha (história 5).
- **Novo arquivo de logo com proporção diferente**: a troca continua sendo feita num lugar só.
- **Rota do app ainda não construída** (as telas das próximas features): a pessoa vê um aviso de
  "em construção" com um caminho de volta, nunca um erro técnico.
- **Invariante Rescue-First**: nada desta feature pode introduzir, na página pública da tag,
  dependência do app autenticado, do tema escuro ou de janelas sobrepostas (FR-027, SC-007).

## Requirements *(mandatory)*

### Functional Requirements

**Identidade visual**

- **FR-001**: O produto DEVE ter **uma única fonte** de valores visuais (cores, tipografia, raios,
  sombra), nas versões clara e escura. Mudar um valor nessa fonte DEVE refletir em todas as telas.
  NÃO PODE existir uma segunda fonte de valores.
- **FR-002**: O produto DEVE aplicar as quatro regras de cor: lima é ação; tinta é seleção; navy é
  marca; âmbar é só modo perdido. Vermelho só em ação destrutiva e em mensagem de erro.
- **FR-003**: Lima NÃO PODE ser usado como estado selecionado, como texto sobre fundo claro nem
  como marca pequena (check, barra de progresso, ponto).
- **FR-004**: Títulos, botões, números de destaque e o código da tag DEVEM usar Outfit; o texto
  corrido DEVE usar Inter. NÃO PODE haver fonte monoespaçada nem a fonte de títulos anterior.
- **FR-005**: As fontes DEVEM ser entregues pelo próprio produto, sem chamada a serviço de
  terceiros no carregamento de nenhuma tela.
- **FR-006**: O produto DEVE oferecer botões nos tipos: principal (lima), contorno, tinta, texto e
  destrutivo, além de um tamanho maior exclusivo para a página de resgate.
- **FR-007**: O botão do WhatsApp DEVE ser lima com o ícone oficial em tinta; o botão do Google
  DEVE ser branco com contorno e o "G" oficial nas cores originais.
- **FR-008**: Todo controle que recebe foco DEVE mostrar o mesmo indicador: anel de 2px em tinta
  com folga de 2px (no tema escuro, anel claro), visível sobre qualquer fundo do produto.
- **FR-009**: Todo controle interativo DEVE ter área de toque de pelo menos 44 por 44 pontos.
- **FR-010**: Todo par de texto e fundo em uso DEVE ter contraste de pelo menos 4,5:1; bordas de
  controle e ícones, pelo menos 3:1; nos dois temas.
- **FR-011**: O produto DEVE respeitar o pedido de menos movimento do aparelho.
- **FR-012**: A interface NÃO PODE usar emoji.
- **FR-013**: O produto DEVE oferecer, prontas para as próximas telas, as peças de marca: painel
  de marca (navy com o focinho gigante), focinho gigante, logo, capa com a foto do pet, cartão de
  ação lima, cartão de número, linha e grupo de lista, chip, segmentado, células para PIN e
  código, indicador de passos, selos, cartão de informação e nota.
- **FR-014**: Trocar os arquivos do logo DEVE ser uma mudança feita **num único lugar**, com
  efeito em todas as telas.
- **FR-015**: Cartões NÃO PODEM ter borda e sombra ao mesmo tempo, e não se aninham.

**Responsividade e estruturas de tela**

- **FR-016**: Toda tela DEVE funcionar em três larguras (celular, tablet, desktop), partindo do
  celular, sem rolagem horizontal a partir de 320 de largura.
- **FR-017**: O app do tutor DEVE ter navegação com os destinos Início, Pets, Scans e Conta, na
  forma de barra inferior em pílula no celular, trilho lateral no tablet e menu lateral com o
  wordmark no desktop.
- **FR-018**: No celular, a barra inferior DEVE aparecer **somente** nas telas principais; as
  telas internas DEVEM ter um topo com título e botão de voltar.
- **FR-019**: Os fluxos passo a passo DEVEM usar uma coluna única: largura total no celular com a
  ação principal ancorada embaixo; centralizada no tablet; ao lado do painel de marca no desktop.
- **FR-020**: O painel administrativo DEVE ter menu lateral no desktop e, no tablet e no celular,
  uma barra no topo com abas roláveis.
- **FR-021**: As páginas públicas DEVEM ter a foto do pet ou o painel de marca como faixa do topo
  no celular e no tablet e como metade esquerda no desktop, com o conteúdo numa folha de cantos
  arredondados que sobe sobre a faixa.
- **FR-022**: Toda área com navegação DEVE nomear a navegação para tecnologias assistivas,
  anunciar o item atual e oferecer um atalho para pular ao conteúdo.
- **FR-023**: Um destino do app ainda não construído DEVE mostrar um aviso amigável com um caminho
  de volta, nunca um erro técnico.

**Página pública (Rescue-First)**

- **FR-024**: As páginas públicas DEVEM ser sempre claras, independentemente da preferência do
  tutor e do modo do aparelho.
- **FR-025**: As páginas públicas NÃO PODEM usar janelas sobrepostas (diálogo, folha deslizante,
  menu suspenso, aviso temporário).
- **FR-026**: O conteúdo e a ação principal das páginas públicas DEVEM ser utilizáveis antes do
  carregamento completo da página e em conexão lenta.
- **FR-027**: As páginas públicas NÃO PODEM carregar nenhuma parte do app autenticado (app do
  tutor, admin, telas de conta e ativação).

**Tema escuro**

- **FR-028**: O tema escuro DEVE existir **somente** no app autenticado do tutor.
- **FR-029**: As telas de entrar, de conta e de ativação e o painel administrativo DEVEM ser
  sempre claros.
- **FR-030**: O tutor DEVE poder ter uma preferência de tema com três valores: claro, escuro e
  sistema. Sem escolha, vale "sistema".
- **FR-031**: A preferência DEVE ficar guardada **por aparelho** e continuar valendo ao reabrir o
  navegador. Ela NÃO faz parte dos dados da conta.
- **FR-032**: Com a preferência "sistema", o app DEVE acompanhar o modo do aparelho, inclusive
  quando ele muda com o app aberto.
- **FR-033**: Janelas de confirmação abertas a partir do app escuro DEVEM aparecer escuras.
- **FR-034**: O mecanismo de tema DEVE ficar disponível para a tela de preferências da spec 004,
  que só precisa informar a escolha do tutor.
- **FR-035**: Se a preferência não puder ser lida ou guardada, o app DEVE seguir o aparelho, sem
  mostrar erro.

**Tela de entrar**

- **FR-036**: A tela de entrar DEVE seguir o desenho aprovado nas três larguras, com o wordmark
  visível em todas.
- **FR-037**: A tela de entrar DEVE manter **todo** o comportamento definido na spec `001-login`
  (métodos de acesso, roteamento por papel, "manter conectado", mensagens genéricas, limite de
  tentativas, confirmação de e-mail, sessão expirada, saída). Esta feature NÃO altera nenhum
  requisito daquela spec.
- **FR-038**: Os identificadores usados pelos testes automatizados da tela de entrar DEVEM
  continuar os mesmos, e as verificações automáticas existentes DEVEM continuar passando sem
  alteração do que verificam.
- **FR-039**: Avisos da tela de entrar que usavam âmbar DEVEM passar a um tom neutro, com o mesmo
  texto.

**Cópia offline e identificação do produto**

- **FR-040**: O produto NÃO PODE guardar cópia das páginas no aparelho para uso offline.
- **FR-041**: Aparelhos que guardaram a versão anterior DEVEM descartar a cópia automaticamente e
  passar a exibir a versão atual, sem ação da pessoa.
- **FR-042**: O ícone do produto (aba do navegador e tela inicial do celular) DEVE ser o focinho
  do Faro, e o nome DEVE ser "Faro".

**Limpeza**

- **FR-043**: O produto NÃO PODE conter vestígios da identidade anterior: cores, fontes, ícones,
  arquivos de aparência ou componentes da base de interface anterior.
- **FR-044**: As partes vazias de funcionalidades fora do MVP (registros de saúde, lembretes,
  assinatura) DEVEM ser removidas do produto.
- **FR-045**: Os textos fixos da interface DEVEM estar em PT-BR e preparados para tradução.

**Verificações sem intervenção humana**

- **FR-046**: DEVEM existir verificações automáticas, executáveis sem uma pessoa, para:
  acessibilidade da tela de entrar; contraste de todos os pares de cor em uso, nos dois temas;
  ausência de vestígios da base de interface anterior; e isolamento das páginas públicas em
  relação ao app autenticado.
- **FR-047**: As verificações que o projeto já tinha (construção do produto, análise estática,
  testes automatizados e teste de fumaça) DEVEM continuar passando.

### Key Entities *(include if feature involves data)*

Esta feature não cria dados de domínio. As "entidades" são de interface:

- **Identidade visual**: o conjunto único de valores de cor, tipografia, raio e sombra, com uma
  versão clara e uma escura, e as regras de uso de cada cor.
- **Tema**: a versão da identidade em vigor numa área do produto (claro em tudo; escuro só no app
  do tutor).
- **Preferência de tema**: a escolha do tutor (claro, escuro ou sistema), guardada no aparelho,
  fora da Conta.
- **Peça de interface**: um elemento reutilizável (botão, campo, selo, capa do pet, cartão de
  ação…), com seus estados e regras de acessibilidade.
- **Estrutura de tela**: o arranjo fixo de uma área (app do tutor, fluxo, admin, página pública),
  que define navegação e colunas em cada largura.
- **Item de navegação**: um destino do app (rótulo, ícone, caminho, estado atual).
- **Marca**: o wordmark e o focinho, em suas versões para fundo claro e escuro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos pares de texto e fundo em uso têm contraste de pelo menos 4,5:1, e 100% das
  bordas de controle e ícones têm pelo menos 3:1, no tema claro e no escuro.
- **SC-002**: 100% das verificações automáticas que existiam para a tela de entrar continuam
  passando, e todos os cenários de aceitação da spec `001-login` dão o mesmo resultado de antes.
- **SC-003**: A tela de entrar e todas as estruturas de tela desta feature aparecem sem rolagem
  horizontal e sem conteúdo cortado ou sobreposto em 320, 390, 768 e 1440 de largura.
- **SC-004**: As verificações automáticas de acessibilidade não apontam nenhuma violação grave ou
  crítica na tela de entrar nem nas páginas do catálogo de referência, nos dois temas.
- **SC-005**: 100% dos controles interativos da tela de entrar têm área de toque de pelo menos 44
  por 44 pontos.
- **SC-006**: O número de ocorrências da identidade anterior no produto (cores, fontes, ícones,
  componentes, arquivos de aparência) é **zero**.
- **SC-007**: As páginas públicas carregam **zero** partes do app autenticado.
- **SC-008**: Com o aparelho em modo escuro e a preferência em "escuro", **zero** telas fora do
  app do tutor aparecem escuras; a preferência do tutor é mantida em 100% das reaberturas no mesmo
  aparelho.
- **SC-009**: Um aparelho que guardou a versão anterior passa a exibir a versão atual **no máximo
  na segunda visita** depois da atualização, sem ação da pessoa.
- **SC-010**: O carregamento de qualquer tela faz **zero** requisições de fonte ou de estilo a
  domínios de terceiros.
- **SC-011**: Trocar os arquivos do logo exige mudar **um** lugar e aparece em todas as telas que
  mostram o logo.
- **SC-012**: A página pública inicial não fica mais pesada: o volume transferido para exibi-la é
  menor ou igual ao de antes desta feature.
- **SC-013**: A tela de entrar continua interativa em até 3 segundos numa conexão móvel típica
  (mesmo critério da spec `001-login`).
- **SC-014**: 100% das verificações que o projeto já tinha continuam passando ao fim da feature.

## Assumptions

- **Tema padrão**: sem escolha do tutor, vale "sistema" (o app segue o aparelho). É a leitura mais
  comum de "claro, escuro ou sistema"; pode ser trocada para "claro" sem afetar o resto.
- **Onde o tutor escolhe o tema**: na tela de conta da spec 004. Até ela existir, a preferência só
  muda pelo modo do aparelho.
- **Botão "Voltar" da tela de entrar**: a tela aprovada tem um botão que leva às boas-vindas. Como
  a tela de boas-vindas é da spec 004, o botão entra junto com ela; aqui o espaço fica reservado.
- **"Esqueci a senha" e "Criar conta"** continuam como hoje (aviso de "em breve"), porque
  recuperação de senha e cadastro são de outras specs.
- **Página inicial**: fica como uma página provisória com o painel de marca, a frase da marca e um
  caminho para entrar. O conteúdo definitivo é decidido na spec 004.
- **Destinos da navegação** (Pets, Scans, Conta; Códigos, Fila de scans, Auditoria): as telas são
  das specs 003 e 004. Aqui eles levam ao aviso de "em construção".
- **Catálogo de referência interno**: existe só para a equipe ver e verificar as peças e as
  estruturas; não é parte do produto entregue aos usuários.
- **Fotografia e ilustrações**: as fotos de pets e o conjunto de ilustrações de traço não fazem
  parte desta feature; as peças que mostram foto têm um estado sem foto.
- **Ícone do produto**: focinho lima sobre fundo navy. Não havia tela de referência para o ícone;
  a escolha segue a regra "navy é marca em área grande".
- **Wordmark atual**: valem os arquivos de logo existentes até o William entregar o redesenho em
  Outfit.
- **Aparelhos com cópia offline antiga**: assume-se que são poucos (ainda não há usuários reais),
  mas o descarte automático é obrigatório mesmo assim.
- **Dependências**: nenhuma mudança de dados ou de servidor é necessária. As specs `003-tag-qr` e
  `004-conta-tutor` dependem desta.
- **Em qualquer conflito**, prevalecem a constituição (v2.0.0), depois `docs/decisoes-pivo.md`,
  depois `DESIGN.md`.

## Out of Scope

- As telas das specs 003 e 004: boas-vindas, criar conta, confirmar celular, ativação, painel do
  tutor, página do pet, scans, visibilidade, modo perdido, gerenciar tag, telas do admin e o
  conteúdo da página de resgate. Esta feature entrega as estruturas e as peças, não essas telas.
- A tela em que o tutor escolhe o tema (spec 004).
- O redesenho do wordmark em Outfit (o William entrega os arquivos; a troca é uma tarefa bloqueada
  até lá).
- Tema escuro no admin, nas páginas públicas e nos fluxos de conta e ativação.
- Qualquer mudança no comportamento do login, na recuperação de senha ou no cadastro.
- Tradução para outros idiomas (só a preparação).
- Uso offline do produto.
- Funcionalidades do roadmap (saúde, lembretes, família, peso, pagamento).
- Mudanças de dados, de regras de acesso ou de servidor.
- Página de marketing do produto.
