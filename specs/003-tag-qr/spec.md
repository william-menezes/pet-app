# Feature Specification: Tag com QR Code

**Feature Branch**: `003-tag-qr`
**Created**: 2026-11-21
**Status**: Draft
**Input**: User description: "MVP = tag de coleira com QR Code: pool e lotes de códigos, etiqueta e QR, ativação com PIN, página pública de resgate, modo perdido, registro de scans com aviso ao tutor, app do tutor, painel admin com gestão completa de códigos, e reaproveitamento de tags."

> **Nota de domínio**: esta é a feature central do MVP do Faro (constituição v2.0.0, Princípio VI).
> Ela depende de `002-ui-zardui` (base visual e cascas de tela) e de `004-conta-tutor` (cadastro
> e confirmação do celular). O login já existe (`001-login`). A spec é **agnóstica de stack**
> (Princípio IV). As telas de referência são as páginas "MVP v2" do canvas *Faro · Telas do MVP* (direção aprovada pelo William em 12 telas-piloto; as demais ainda não foram revisadas por ele).

---

## Clarifications

### Session 2026-11-21

Decisões já tomadas pelo William (registradas em `docs/decisoes-pivo.md`):

- Q: O que o visitante vê quando o código não existe, está bloqueado ou foi anulado? → A: **A mesma
  mensagem** ("Não encontramos esta tag") nos três casos. A diferença fica registrada só no servidor.
- Q: O aviso de scan ao tutor depende de pagamento? → A: **Não.** É gratuito para sempre.
- Q: Onde a página de resgate fala em primeira pessoa? → A: O título e os cuidados falam **na voz do
  pet**. O recado do modo perdido é do tutor e é rotulado como tal.
- Q: O que o modo perdido mostra a mais? → A: Há quanto tempo o pet sumiu, um selo de recompensa
  (sem valor) e um recado do tutor. Cada item é ligado pelo tutor. "Onde foi visto por último" **não** entra.
- Q: Quantas ações a página de resgate tem? → A: **Uma principal** (avisar o tutor no WhatsApp) e
  "Enviar onde estou" como ação secundária. Não há botão de ligar.
- Q: O limite de vínculos por tutor existe no MVP? → A: A regra existe, mas hoje **sempre permite**
  (`TODO(BILLING_MODEL)`). O limite só pode barrar novos vínculos; nunca desativa uma tag já vinculada.
- Q: Tag perdida e tag danificada são a mesma segunda via? → A: Não. **Danificada**: reimprime o
  mesmo código. **Perdida**: o código antigo é anulado e o pet recebe um código novo.

### Decisões tomadas nesta spec (revisar)

- O scan é registrado **quando a página de resgate é de fato aberta num navegador**, e não quando um
  robô de pré-visualização de link a busca. Isso evita avisos falsos ao tutor.
- Leituras repetidas da mesma tag pela mesma origem em até **10 minutos** contam como um scan só.
- Bloqueio do PIN: **5 tentativas erradas em 15 minutos** travam aquela conta naquela tag por 15
  minutos; **20 tentativas erradas em 24 horas** (somando todas as contas) travam a tag por 24 horas
  e avisam o admin.
- Ao pedir segunda via por **perda**, o código antigo é anulado **na hora** e o pet fica sem tag
  até o tutor ativar a tag nova com o PIN dela.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quem achou o pet escaneia a tag e fala com o tutor (Priority: P1)

Uma pessoa encontra um pet na rua, aponta a câmera do celular para a tag e abre a página de resgate.
Em poucos segundos ela entende quem é o pet, o que precisa saber para lidar com ele e como avisar a
família. Com um toque abre uma conversa no WhatsApp com o tutor.

**Why this priority**: é o propósito do produto (Princípio I). Sem isso a tag não serve para nada.

**Independent Test**: com uma tag vinculada a um pet de exemplo, abrir o endereço da tag num celular
sem estar logado e conferir que a página mostra o pet e abre o WhatsApp do tutor.

**Acceptance Scenarios**:

1. **Dado** uma tag vinculada a um pet, **Quando** alguém abre o endereço da tag, **Então** vê a
   foto e o nome do pet, um título na voz do pet, as informações que o tutor liberou e um botão
   principal para avisar o tutor no WhatsApp.
2. **Dado** a página de resgate aberta, **Quando** a pessoa toca no botão principal, **Então** o
   WhatsApp abre numa conversa com o tutor, com uma mensagem já escrita que cita o nome do pet.
3. **Dado** que o tutor não liberou o WhatsApp, **Quando** a página abre, **Então** o botão do
   WhatsApp não aparece e a página oferece "Enviar onde estou" como forma de avisar.
4. **Dado** a página de resgate aberta, **Quando** a pessoa toca em "Enviar onde estou" e permite a
   localização, **Então** o tutor recebe a localização precisa; se ela negar, nada é enviado e a
   página continua funcionando.
5. **Dado** um endereço com código inexistente, bloqueado ou anulado, **Quando** alguém o abre,
   **Então** vê a mesma página "Não encontramos esta tag", com orientação para quem achou um pet,
   e nenhum dado de pet ou tutor.
6. **Dado** que o serviço está com falha parcial, **Quando** alguém abre o endereço de uma tag,
   **Então** vê uma página amigável de contingência ("Este pet tem dono") e nunca uma tela de erro técnico.
7. **Dado** um código digitado com letras minúsculas, hífens, espaços ou com `O`, `I`, `L` no lugar
   de `0`, `1`, `1`, **Quando** o endereço é aberto, **Então** ele resolve para a mesma tag.
8. **Dado** uma rede móvel lenta, **Quando** a página abre, **Então** foto, título e botão principal
   aparecem e funcionam antes de o restante da página terminar de carregar.

---

### User Story 2 - Tutor ativa a tag que acabou de comprar (Priority: P1)

O tutor recebe a tag, escaneia o QR e cai na página "Esta tag ainda não foi ativada". Ele toca em
"Ativar minha tag", entra ou cria a conta, escolhe o pet (ou cadastra um novo), digita o PIN do
cartão e a tag fica ativa. Ele testa escaneando de novo e vê a página como um estranho veria.

**Why this priority**: sem ativação não existe tag vinculada, e a User Story 1 não acontece.

**Independent Test**: com uma tag disponível e o PIN dela, percorrer o caminho da primeira leitura
até "Tag ativa" e conferir que o endereço da tag passa a abrir a página de resgate do pet.

**Acceptance Scenarios**:

1. **Dado** uma tag disponível, **Quando** alguém abre o endereço dela, **Então** vê "Esta tag ainda
   não foi ativada", o código da tag, a ação "Ativar minha tag" e uma orientação para quem achou um pet.
2. **Dado** um visitante sem conta que tocou em "Ativar minha tag", **Quando** ele termina de criar
   a conta e confirmar o celular, **Então** é levado de volta à ativação daquela mesma tag, sem
   precisar escanear de novo.
3. **Dado** que o visitante confirmou o e-mail em outro aparelho, **Quando** ele entra na conta,
   **Então** o painel mostra que há uma tag esperando ativação e oferece continuar.
4. **Dado** o tutor na ativação, **Quando** ele escolhe um pet seu que não tem tag, digita o PIN
   correto e confirma, **Então** a tag fica vinculada àquele pet e ele vê "Tag ativa!".
5. **Dado** o tutor sem pets, **Quando** chega à escolha do pet, **Então** pode cadastrar um pet novo
   (dados e, em seguida, foto e cuidados) e voltar à ativação com esse pet escolhido.
6. **Dado** um pet que já tem uma tag ativa, **Quando** o tutor o escolhe para a tag nova, **Então**
   é avisado de que a tag atual será trocada e precisa confirmar; ao confirmar, a tag antiga é
   liberada e a nova fica ativa.
7. **Dado** um PIN errado, **Quando** o tutor confirma, **Então** vê uma mensagem clara, a tag não é
   vinculada e a tentativa é contada.
8. **Dado** 5 PINs errados em 15 minutos, **Quando** o tutor tenta de novo, **Então** é informado de
   que a tag está travada por alguns minutos, mesmo que o próximo PIN esteja certo.
9. **Dado** um tutor sem celular confirmado, **Quando** tenta ativar, **Então** é levado a confirmar
   o celular antes de concluir.
10. **Dado** a tela "Tag ativa!", **Quando** o tutor toca em "Ver a página do Paçoca", **Então** vê a
    página de resgate na **visão do dono**: com um aviso de que está vendo como um estranho, sem
    gerar aviso de scan e com os botões de contato desativados.

---

### User Story 3 - Tutor é avisado quando a tag é escaneada e vê o histórico (Priority: P2)

Quando alguém abre a página de resgate do pet, o tutor recebe um e-mail e vê o scan no app, com a
hora e a localização (aproximada ou precisa).

**Why this priority**: é o que dá tranquilidade ao tutor e o que o faz agir. Depende das histórias 1 e 2.

**Independent Test**: abrir a página de resgate de um pet de exemplo num navegador sem login e
conferir o e-mail recebido e o scan no histórico.

**Acceptance Scenarios**:

1. **Dado** uma tag vinculada, **Quando** um estranho abre a página de resgate, **Então** o tutor
   recebe um e-mail com o nome do pet, a hora e a localização aproximada, rotulada como aproximada.
2. **Dado** o mesmo estranho abrindo a página várias vezes em 10 minutos, **Quando** os scans são
   contados, **Então** há um scan só e um e-mail só.
3. **Dado** que quem achou enviou a localização, **Quando** o tutor abre o histórico, **Então** o
   scan mostra a localização precisa com a margem de erro, e o tutor é avisado da atualização.
4. **Dado** o tutor no painel, **Quando** houve um scan recente, **Então** ele vê um destaque
   "Alguém escaneou a tag do [pet]" com a hora e um atalho para o mapa.
5. **Dado** o histórico de scans, **Quando** o tutor filtra por "Este mês" ou "Localização precisa",
   **Então** a lista mostra só os scans correspondentes.
6. **Dado** um robô de pré-visualização de link (por exemplo, ao colar o endereço numa conversa),
   **Quando** ele busca a página, **Então** nenhum scan é registrado e nenhum e-mail é enviado.
7. **Dado** o próprio tutor logado abrindo a página da sua tag, **Quando** a página abre, **Então**
   nenhum scan é registrado.
8. **Dado** uma tag que mudou de dono, **Quando** o novo tutor abre o histórico, **Então** não vê
   nenhum scan do dono anterior; e o dono anterior não vê os scans novos.

---

### User Story 4 - Tutor ativa o modo perdido (Priority: P2)

O pet sumiu. O tutor ativa o modo perdido, escreve um recado para quem achar e escolhe se mostra há
quanto tempo o pet sumiu e se há recompensa. A página de resgate muda de aparência e de texto.
Quando o pet volta, o tutor desativa.

**Why this priority**: é o momento de maior valor emocional do produto e o que diferencia a página
de um simples cartão de contato.

**Independent Test**: ativar o modo perdido de um pet de exemplo, abrir o endereço da tag sem login
e conferir o bloco de alerta e os itens escolhidos; desativar e conferir que a página volta ao normal.

**Acceptance Scenarios**:

1. **Dado** um pet com tag ativa, **Quando** o tutor ativa o modo perdido com um recado, **Então** a
   página de resgate passa a mostrar um bloco de alerta com "Estou perdido" na voz do pet e o recado
   rotulado como sendo do tutor.
2. **Dado** o modo perdido com "mostrar há quanto tempo sumiu" ligado, **Quando** um estranho abre a
   página, **Então** vê "Perdido há N dias" (ou horas), contado desde a ativação.
3. **Dado** o modo perdido com "há recompensa" ligado, **Quando** a página abre, **Então** mostra um
   selo "Há recompensa", sem valor.
4. **Dado** o tutor na ativação do modo perdido, **Quando** olha a tela, **Então** vê uma prévia de
   como o alerta vai aparecer antes de confirmar.
5. **Dado** o modo perdido ativo, **Quando** o tutor desativa ("pet encontrado"), **Então** a página
   de resgate volta ao estado normal na próxima abertura.
6. **Dado** um pet sem tag ativa, **Quando** o tutor tenta ativar o modo perdido, **Então** é
   avisado de que precisa vincular uma tag primeiro.

---

### User Story 5 - Tutor controla o que estranhos veem (Priority: P2)

O tutor decide, item por item, o que aparece na página de resgate, e vê a prévia antes de salvar.

**Why this priority**: é exigência de privacidade (Princípio II) e condição para o tutor confiar no produto.

**Independent Test**: desligar um item, salvar, abrir o endereço da tag sem login e conferir que o
item não aparece; conferir que a prévia mostrou a mesma coisa.

**Acceptance Scenarios**:

1. **Dado** a tela "O que estranhos veem", **Quando** o tutor a abre, **Então** vê os itens sobre o
   pet (nome e foto, sempre visíveis; temperamento; cuidados), os de contato (primeiro nome,
   botão de WhatsApp, telefone) e os do modo perdido (tempo desde o sumiço, selo de recompensa, recado).
2. **Dado** um item desligado e salvo, **Quando** um estranho abre a página de resgate, **Então** o
   item não aparece em nenhuma parte da página nem do seu código-fonte.
3. **Dado** alterações ainda não salvas, **Quando** o tutor toca em "Pré-visualizar", **Então** vê a
   página exatamente como um estranho veria com aquelas escolhas.
4. **Dado** um celular ainda não confirmado, **Quando** o tutor tenta ligar "Telefone" ou "WhatsApp",
   **Então** é avisado de que precisa confirmar o celular antes, e o item fica desligado.
5. **Dado** uma conta nova, **Quando** o tutor cadastra o primeiro pet, **Então** os itens de contato
   começam desligados. Na ativação da tag, a opção de liberar o botão de WhatsApp aparece **já
   marcada**, com um aviso ao lado dizendo que o número ficará disponível para quem escanear a tag
   e onde desligar; o tutor pode desmarcar antes de ativar.

---

### User Story 6 - Tutor acompanha seus pets e vincula uma tag pelo app (Priority: P2)

O tutor entra no app, vê seus pets, abre a página de um pet e, se o pet não tem tag, vincula uma
escaneando o QR com a câmera ou digitando o código impresso, e informando o PIN.

**Why this priority**: é a segunda porta de ativação e o lugar de onde o tutor chega a todo o resto.

**Independent Test**: com uma conta com um pet sem tag e uma tag disponível, vincular a tag pelo app
digitando o código e o PIN.

**Acceptance Scenarios**:

1. **Dado** o tutor logado, **Quando** abre o painel, **Então** vê o pet em destaque com a foto, o
   estado da tag, os números do mês e a lista dos seus pets, com a opção de adicionar um pet.
2. **Dado** a página de um pet, **Quando** o tutor a abre, **Então** vê a foto, os dados principais,
   o atalho do modo perdido, o estado da tag, o último scan e os caminhos para os dados do pet, o
   que estranhos veem, a tag e o histórico de scans.
3. **Dado** um pet sem tag, **Quando** o tutor escolhe "Vincular tag" e digita um código válido de
   uma tag disponível, **Então** vê a confirmação de que o código é válido e segue para o PIN.
4. **Dado** a opção "Escanear QR", **Quando** a câmera não está disponível ou a permissão é negada,
   **Então** o tutor continua podendo digitar o código.
5. **Dado** um código de tag que não está disponível, **Quando** o tutor o informa, **Então** vê uma
   mensagem neutra de que não é possível usar aquela tag, sem saber o motivo.
6. **Dado** o cadastro de um pet, **Quando** o tutor informa espécie, nome, raça, sexo e porte, e em
   seguida foto, temperamento e cuidados, **Então** o pet é criado; a segunda etapa pode ser pulada.
7. **Dado** telas largas (tablet e computador), **Quando** o tutor usa o app, **Então** todas as
   telas se reorganizam e continuam completas.

---

### User Story 7 - Admin gera lotes, imprime etiquetas e administra os códigos (Priority: P2)

O admin cria um lote de códigos, baixa uma única vez o pacote com as etiquetas para impressão e os
PINs dos cartões, e depois acompanha e administra cada código.

**Why this priority**: sem lotes não há tags para vender. O primeiro lote (lote-001) já foi gerado
fora do sistema e entra por importação, por isso esta história não bloqueia as P1.

**Independent Test**: criar um lote pequeno, baixar o pacote, conferir que uma etiqueta lê no celular
e leva à página "tag não ativada", e que o PIN do pacote ativa aquela tag.

**Acceptance Scenarios**:

1. **Dado** o admin em "Lotes", **Quando** cria um lote com uma quantidade, **Então** o sistema gera
   os códigos e os PINs e oferece o pacote (etiquetas para impressão + PINs) para baixar **uma única vez**.
2. **Dado** um pacote já baixado, **Quando** o admin volta ao lote, **Então** consegue reimprimir as
   etiquetas, mas **não** consegue obter os PINs de novo.
3. **Dado** uma etiqueta reimpressa, **Quando** comparada à original, **Então** é visualmente idêntica.
4. **Dado** a lista de códigos, **Quando** o admin busca por código, pet ou tutor, ou filtra por
   situação ou lote, **Então** vê os códigos correspondentes com situação, vínculo e último scan.
5. **Dado** o detalhe de um código, **Quando** o admin o abre, **Então** vê o vínculo atual, o
   histórico de vínculos, os scans e as ações disponíveis.
6. **Dado** um código, **Quando** o admin bloqueia, desbloqueia ou anula, **Então** a situação muda,
   a ação fica registrada com autor e hora, e quem escanear um código bloqueado ou anulado vê "tag
   não encontrada".
7. **Dado** um cartão de PIN perdido, **Quando** o admin reemite o PIN de uma tag disponível,
   **Então** um PIN novo é mostrado uma única vez e o anterior deixa de valer.
8. **Dado** um vínculo que precisa ser desfeito pelo suporte, **Quando** o admin o encerra com um
   motivo, **Então** a tag volta a ficar disponível com um PIN novo e o histórico é preservado.
9. **Dado** scans de tags bloqueadas ou anuladas, **Quando** o admin abre a fila de scans, **Então**
   vê esses scans com hora e localização aproximada.
10. **Dado** qualquer ação sensível, **Quando** o admin abre a auditoria, **Então** vê quem fez o
    quê e quando.
11. **Dado** um código impresso, **Quando** qualquer pessoa tenta apagá-lo, **Então** não é possível;
    só é possível anular.

---

### User Story 8 - Tutor passa a tag adiante ou pede segunda via (Priority: P3)

O tutor pode desvincular a tag, passá-la para outra pessoa, ou pedir segunda via porque a tag
estragou ou sumiu.

**Why this priority**: importante para o ciclo de vida da tag, mas não impede o uso inicial.

**Independent Test**: passar adiante a tag de um pet de exemplo, anotar o PIN novo e ativar a mesma
tag em outra conta; conferir que a primeira conta não vê nada da segunda.

**Acceptance Scenarios**:

1. **Dado** uma tag ativa, **Quando** o tutor escolhe "Passar a tag adiante" e confirma, **Então** o
   vínculo é encerrado, a tag volta a ficar disponível e um PIN novo é mostrado **uma única vez**.
2. **Dado** o PIN novo exibido, **Quando** o tutor sai da tela, **Então** não há como vê-lo de novo.
3. **Dado** uma tag passada adiante, **Quando** o novo dono a ativa com o PIN novo, **Então** o PIN
   do cartão original não funciona mais e o novo dono não vê pets, scans nem dados do anterior.
4. **Dado** uma tag ativa, **Quando** o tutor escolhe "Desvincular tag", **Então** o pet fica sem
   tag, a tag volta a ficar disponível com PIN novo e o endereço da tag passa a mostrar "tag não ativada".
5. **Dado** uma tag danificada, **Quando** o tutor pede segunda via, **Então** o pedido fica
   registrado para o admin reimprimir o mesmo código, e a tag continua funcionando.
6. **Dado** uma tag perdida, **Quando** o tutor pede segunda via e confirma, **Então** o código
   antigo é anulado na hora, o endereço antigo passa a mostrar "tag não encontrada" e o pet fica
   sem tag até a nova ser ativada.

---

### Edge Cases

- **Código com dígito verificador errado**: tratado como inexistente, sem consulta aos dados.
- **Muitas consultas da mesma origem**: a origem é limitada; o visitante vê a página de contingência,
  não um erro.
- **Tag bloqueada pelo admin enquanto vinculada**: o endereço mostra "tag não encontrada"; o tutor
  vê no app que a tag está bloqueada e é orientado a falar com o suporte.
- **Pet sem foto**: a página de resgate usa um espaço reservado com a marca, não uma imagem quebrada.
- **Tutor apaga um pet com tag ativa**: precisa desvincular antes, ou confirmar que a tag será liberada.
- **Duas pessoas tentando ativar a mesma tag ao mesmo tempo**: só uma consegue; a outra vê que a tag
  não está mais disponível.
- **Tutor tenta ativar uma tag já vinculada a outra pessoa**: mensagem neutra, sem revelar o vínculo.
- **Modo perdido ligado e tag passada adiante**: o modo perdido é desligado junto com o vínculo.
- **Pedido de localização negado ou indisponível**: nada é enviado; a página segue funcionando.
- **Envio de e-mail falha**: o scan fica registrado e aparece no app; o envio é tentado de novo.
- **Tutor sem WhatsApp liberado e sem localização enviada**: o scan ainda avisa o tutor, com a
  localização aproximada.
- **Link aberto dentro do navegador de um aplicativo de mensagens**: a página funciona igual.
- **Lote com quantidade inválida** (zero, negativa ou acima do máximo por lote): recusado com explicação.
- **Admin anula um código vinculado**: o vínculo é encerrado com motivo de suporte e o tutor é avisado.
- **Domínio impresso**: nenhum fluxo exibe ou imprime outro domínio.

---

## Requirements *(mandatory)*

### Functional Requirements

**Código da tag e endereço (contrato imutável — Princípio VIII)**

- **FR-001**: O sistema DEVE aceitar o código da tag em qualquer caixa, com ou sem hífens e espaços,
  e tratar `O` como `0` e `I` e `L` como `1`, sempre resolvendo para o mesmo código.
- **FR-002**: O sistema DEVE rejeitar códigos com dígito verificador inválido antes de consultar
  qualquer dado armazenado.
- **FR-003**: O sistema DEVE exibir o código sempre no formato `XXXX-XXXX-X`.
- **FR-004**: O endereço de uma tag DEVE ser o domínio impresso seguido do código, na raiz, sem prefixo.
- **FR-005**: Um código impresso NUNCA pode ser alterado nem apagado; só pode ser anulado, com o
  histórico preservado.
- **FR-006**: As regras de formação, normalização e validação do código DEVEM ser idênticas em todas
  as partes do sistema e à implementação de referência, comprovado por teste com os códigos do lote-001.

**Página pública da tag**

- **FR-007**: Toda abertura do endereço de uma tag DEVE terminar em uma de três páginas: resgate
  (tag vinculada), "tag não ativada" (tag disponível) ou "tag não encontrada" (todo o resto).
- **FR-008**: Código inexistente, bloqueado e anulado DEVEM produzir a mesma página e a mesma
  resposta observável para o visitante.
- **FR-009**: A página de resgate DEVE mostrar a foto e o nome do pet e apenas os demais itens que o
  tutor liberou; itens não liberados NÃO PODEM estar presentes na página em nenhuma forma.
- **FR-010**: A página de resgate DEVE ter uma única ação principal (avisar o tutor no WhatsApp,
  quando liberado) e "Enviar onde estou" como ação secundária.
- **FR-011**: A ação do WhatsApp DEVE abrir a conversa com o tutor com uma mensagem pronta que cita
  o nome do pet, e DEVE funcionar sem depender do carregamento completo da página.
- **FR-012**: A página de resgate DEVE funcionar independentemente de qualquer estado de cobrança,
  limite de uso ou plano do tutor.
- **FR-013**: Em qualquer falha interna, a página pública DEVE mostrar uma página amigável de
  contingência e NUNCA um erro técnico.
- **FR-014**: A página pública DEVE ser sempre exibida no tema claro e NÃO PODE usar janelas
  sobrepostas (diálogos, menus flutuantes).
- **FR-015**: A página pública DEVE limitar a quantidade de consultas por origem em um período, sem
  revelar a existência de códigos.
- **FR-016**: Quando o próprio tutor, logado, abre a página da sua tag, o sistema DEVE mostrar a
  visão do dono: aviso de que é uma prévia, nenhum scan registrado, ações de contato desativadas e
  um atalho para editar o que estranhos veem.
- **FR-017**: A página "tag não ativada" DEVE mostrar o código, a ação "Ativar minha tag" e uma
  orientação para quem achou um pet, sem nenhum dado pessoal.

**Ativação e vínculo**

- **FR-018**: Vincular uma tag a um pet DEVE exigir o PIN de ativação, em qualquer caminho.
- **FR-019**: O PIN NUNCA pode ser armazenado nem registrado em forma legível; só é possível
  verificar se um PIN informado confere.
- **FR-020**: O sistema DEVE limitar tentativas de PIN: 5 erradas em 15 minutos travam aquela conta
  naquela tag por 15 minutos; 20 erradas em 24 horas, somando todas as contas, travam a tag por 24
  horas e avisam o admin.
- **FR-021**: Durante um bloqueio, o sistema DEVE recusar inclusive o PIN correto, com mensagem que
  informe a espera sem dizer se o PIN estava certo.
- **FR-022**: Só uma tag disponível pode ser vinculada; tentativas sobre tags em outra situação DEVEM
  receber uma mensagem neutra, sem revelar a situação.
- **FR-023**: O tutor só pode vincular uma tag a um pet seu.
- **FR-024**: Um pet DEVE ter no máximo uma tag ativa, e uma tag no máximo um vínculo ativo; duas
  ativações simultâneas da mesma tag NÃO PODEM ambas ter sucesso.
- **FR-025**: Ao escolher, na ativação, um pet que já tem tag, o sistema DEVE pedir confirmação e, ao
  confirmar, liberar a tag anterior e vincular a nova.
- **FR-026**: O sistema DEVE consultar a regra de direito a novo vínculo antes de vincular; no MVP
  ela sempre permite. Essa regra NUNCA pode desativar um vínculo existente.
- **FR-027**: O sistema DEVE exigir celular confirmado para concluir uma ativação.
- **FR-028**: O sistema DEVE lembrar a tag que um visitante quis ativar enquanto ele cria a conta, e
  retomá-la quando ele entrar, inclusive em outro aparelho, por até 7 dias.
- **FR-029**: O tutor DEVE poder vincular uma tag pelo app, lendo o QR com a câmera ou digitando o
  código; digitar DEVE estar sempre disponível.
- **FR-030**: Ao concluir a ativação, o sistema DEVE confirmar o que ficou ativo (contato liberado,
  celular confirmado, aviso a cada scan) e convidar o tutor a testar.

**Pets**

- **FR-031**: O tutor DEVE poder cadastrar um pet com espécie (cão ou gato), nome, raça, sexo e
  porte, e opcionalmente foto, temperamento e cuidados importantes.
- **FR-032**: O tutor DEVE poder editar e remover seus pets; remover um pet com tag ativa DEVE
  liberar a tag, com confirmação.
- **FR-033**: Um pet pode existir sem tag; a tag pode ser vinculada depois.
- **FR-034**: O tutor só pode ver e alterar os próprios pets.

**O que estranhos veem**

- **FR-035**: O tutor DEVE poder ligar e desligar, por pet: temperamento, cuidados, primeiro nome do
  tutor, botão de WhatsApp, telefone e os três itens do modo perdido. Nome e foto são sempre visíveis.
- **FR-036**: O telefone e o WhatsApp só podem ser ligados com celular confirmado.
- **FR-037**: O sistema DEVE oferecer a prévia "como estranhos verão" com as escolhas atuais, antes
  de salvar.
- **FR-038**: Itens de contato DEVEM começar desligados no cadastro do pet. Na ativação, a opção de
  liberar o botão de WhatsApp DEVE aparecer **marcada por padrão**, acompanhada, na mesma tela, de
  um aviso visível de que o WhatsApp do tutor ficará disponível para quem escanear a tag e de onde
  desligar. O tutor PODE desmarcar antes de ativar, e a tela de conclusão DEVE dizer se o WhatsApp
  ficou ligado. (Decisão do William em 2026-11-21; antes a opção começava desmarcada.)

**Modo perdido**

- **FR-039**: O tutor DEVE poder ativar e desativar o modo perdido de um pet com tag ativa.
- **FR-040**: Ao ativar, o tutor DEVE poder escrever um recado e escolher se mostra o tempo desde o
  sumiço e o selo de recompensa, vendo a prévia do alerta.
- **FR-041**: Com o modo perdido ativo, a página de resgate DEVE trocar o título e o destaque para
  o alerta de pet perdido, na voz do pet, com o recado identificado como sendo do tutor.
- **FR-042**: O selo de recompensa NUNCA mostra valor.
- **FR-043**: Encerrar o vínculo DEVE desligar o modo perdido daquele pet.

**Scans e avisos**

- **FR-044**: O sistema DEVE registrar um scan quando a página de resgate é aberta num navegador por
  alguém que não é o tutor da tag, guardando hora, vínculo vigente e localização aproximada.
- **FR-045**: Aberturas por robôs de pré-visualização de link NÃO PODEM gerar scan.
- **FR-046**: Aberturas repetidas da mesma tag pela mesma origem em até 10 minutos DEVEM contar como
  um único scan.
- **FR-047**: A localização DEVE ser rotulada como aproximada ou precisa, com o método e a margem; a
  precisa só é obtida com permissão explícita de quem achou.
- **FR-048**: O sistema NUNCA guarda o endereço de rede de quem escaneou em forma legível.
- **FR-049**: A cada scan o tutor DEVE receber um aviso por e-mail e ver o scan no app; esse aviso
  NÃO PODE depender de cobrança.
- **FR-050**: Quando quem achou envia a localização precisa, o scan DEVE ser atualizado e o tutor avisado.
- **FR-051**: O tutor DEVE ver o histórico de scans dos seus vínculos, com filtros por período e por
  tipo de localização, e a área do último scan num mapa.
- **FR-052**: Scans de um vínculo encerrado NUNCA ficam visíveis ao tutor de um vínculo posterior da
  mesma tag, e vice-versa.
- **FR-053**: Scans de tags bloqueadas, anuladas ou não ativadas DEVEM ser registrados para o admin,
  sem aviso a tutores.
- **FR-054**: Falha no envio do e-mail NÃO PODE impedir o registro do scan; o envio DEVE ser tentado de novo.

**Reaproveitamento e segunda via**

- **FR-055**: O tutor DEVE poder encerrar o vínculo de uma tag sua (passar adiante ou desvincular);
  a tag volta a ficar disponível com um PIN novo.
- **FR-056**: O PIN novo DEVE ser mostrado uma única vez, só a quem encerrou o vínculo, e o PIN
  anterior deixa de valer.
- **FR-056A**: Quando o vínculo termina sem ninguém presente para receber um PIN novo (exclusão da
  conta; troca da tag de um pet durante a ativação de outra), o PIN vigente DEVE ser mantido: a tag
  volta a "não ativada" e quem estiver com ela e com o cartão consegue ativá-la. Um PIN novo NUNCA
  é gerado para ser descartado. (Decisão do William em 2026-11-21; constituição v2.1.0.)
- **FR-057**: O tutor DEVE poder pedir segunda via por dano (mesmo código) ou por perda (código
  antigo anulado na hora).
- **FR-058**: Todo vínculo, encerramento e motivo DEVEM ficar no histórico da tag.

**Admin**

- **FR-059**: O admin DEVE poder criar um lote informando a quantidade; o sistema gera códigos e
  PINs com fonte imprevisível e sem repetição.
- **FR-060**: O pacote do lote (etiquetas para impressão e PINs para os cartões) DEVE estar
  disponível para download uma única vez; depois disso os PINs não podem ser recuperados.
- **FR-061**: O admin DEVE poder reimprimir as etiquetas de códigos selecionados, visualmente
  idênticas às originais.
- **FR-062**: A etiqueta DEVE seguir a especificação física aprovada (formato, QR, logo, código
  legível e folha de impressão) e ser idêntica à produzida pela implementação de referência.
- **FR-063**: O admin DEVE poder listar códigos com busca por código, pet ou tutor e filtros por
  situação e por lote.
- **FR-064**: O admin DEVE ver, por código: lote, situação, vínculo atual, histórico de vínculos,
  scans e estado do PIN (usado ou não, tentativas erradas), sem nunca ver o PIN.
- **FR-065**: O admin DEVE poder bloquear, desbloquear e anular um código, reemitir o PIN de uma tag
  disponível e encerrar um vínculo com motivo.
- **FR-066**: O admin DEVE ver a fila de scans de tags bloqueadas, anuladas e não ativadas, os
  pedidos de segunda via e os avisos de tags travadas por excesso de tentativas.
- **FR-067**: Apenas contas com papel de admin acessam qualquer função administrativa; a verificação
  é feita onde os dados ficam, não só na interface.

**Segurança, privacidade e auditoria**

- **FR-068**: Visitantes não identificados NÃO PODEM ler nenhum dado armazenado a não ser pela
  página pública da tag.
- **FR-069**: Um tutor NUNCA acessa pets, vínculos, scans ou configurações de outro tutor.
- **FR-070**: O sistema DEVE registrar em trilha de auditoria: criação de lote, download do pacote,
  emissão e reemissão de PIN, tentativas de ativação falhas e bloqueios, criação e encerramento de
  vínculo, mudança de situação de código, reimpressão, ativação e desativação do modo perdido e
  pedidos de segunda via, com autor, hora e contexto mínimo.
- **FR-071**: Nenhum segredo (chaves, PINs, credenciais de envio) pode chegar ao aparelho do usuário
  nem aos registros.
- **FR-072**: Todas as telas DEVEM funcionar em celular, tablet e computador, com textos em
  português do Brasil e preparadas para outros idiomas.
- **FR-073**: As telas DEVEM atender ao nível AA de acessibilidade (contraste, foco visível,
  navegação por teclado, alvos de toque).

### Key Entities *(include if feature involves data)*

- **Pet**: animal do tutor. Espécie, nome, raça, sexo, porte, foto, temperamento, cuidados.
- **TagBatch (Lote)**: conjunto de códigos gerados juntos; quantidade, autor, data, observação,
  estado do pacote (baixado ou não).
- **TagCode (Código)**: código impresso; situação (disponível, vinculado, bloqueado, anulado),
  lote, parâmetros de impressão do QR, prova do PIN e contadores de tentativa. Nunca apagado.
- **TagAssignment (Vínculo)**: ligação entre tag, pet e tutor, com início, fim e motivo do fim.
- **PIN de ativação**: prova de posse da tag; uso único.
- **PerfilDeResgate**: por pet, o que estranhos veem e o estado do modo perdido (ligado, desde
  quando, recado, opções).
- **ScanEvent**: leitura da tag; hora, vínculo vigente, localização (método e precisão), situação
  da tag no momento, se o tutor foi avisado.
- **Ativação pendente**: tag que um tutor quis ativar e ainda não concluiu.
- **Pedido de segunda via**: tag, pet, tipo (dano ou perda), situação do pedido.
- **Registro de auditoria**: quem, o quê, quando, sobre qual código ou vínculo.
- **Tutor** e **Admin**: como definidos em `001-login`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em rede móvel lenta, quem escaneia uma tag vinculada vê foto, título e botão principal
  em até 2,5 segundos em 90% das aberturas.
- **SC-002**: Uma pessoa que nunca viu o Faro consegue abrir a conversa com o tutor em até 10
  segundos depois de a página aparecer.
- **SC-003**: 100% dos endereços de tag, em qualquer situação do código e em caso de falha interna,
  resultam numa página amigável; zero telas de erro técnico em teste.
- **SC-004**: Um tutor com a tag e o cartão em mãos conclui a ativação, incluindo criar a conta e
  cadastrar o pet, em até 5 minutos.
- **SC-005**: 100% das tentativas de vincular sem o PIN correto falham em teste, incluindo
  tentativas automatizadas dentro dos limites de bloqueio.
- **SC-006**: O tutor recebe o aviso de scan em até 1 minuto em 95% dos casos.
- **SC-007**: Zero avisos de scan gerados por pré-visualização de link ou pela visão do dono em teste.
- **SC-008**: Em teste de isolamento, um tutor não consegue ler nenhum dado de outro tutor, e um
  visitante não consegue ler nada além da página pública (100% dos casos de teste).
- **SC-009**: Depois de uma tag mudar de dono, nenhum scan, pet ou dado do dono anterior é visível
  ao novo (100% dos casos de teste).
- **SC-010**: Itens desligados em "O que estranhos veem" não aparecem na página nem no seu conteúdo
  bruto (100% dos casos de teste).
- **SC-011**: Uma etiqueta gerada pelo sistema e a etiqueta de referência do mesmo código são
  idênticas, e ambas leem em pelo menos um iPhone e um Android antes e depois da resina.
- **SC-012**: Os códigos do lote-001 são validados de forma idêntica por todas as partes do sistema
  (100% de concordância com a implementação de referência).
- **SC-013**: Todas as telas da feature passam nas verificações automáticas de acessibilidade AA e
  são utilizáveis em celular, tablet e computador.
- **SC-014**: O admin cria um lote de 54 códigos e baixa o pacote em menos de 1 minuto.

## Assumptions

- **Dependências**: `002-ui-zardui` (base visual, cascas de tela, tema escuro do app) e
  `004-conta-tutor` (cadastro, confirmação do celular, preservação do destino de retorno) estão
  implementadas antes das telas desta feature. O login vem de `001-login`.
- **Lote-001**: os 54 códigos já gerados entram por um procedimento de importação único, documentado,
  fora do fluxo normal de criação de lote. O arquivo com os PINs em texto puro nunca é versionado.
- **Implementação de referência**: o gerador de códigos e etiquetas usado no lote-001 foi entregue
  em 2026-11-21, e a regra do dígito verificador foi confirmada com os 54 códigos do lote. A fonte
  usada no texto da etiqueta ainda não foi entregue: a etiqueta idêntica gerada pelo sistema segue
  bloqueada até lá. A lista de códigos reais não é versionada (o repositório é público).
- **Domínio**: `tagfaro.com.br` já aponta para o produto antes de qualquer tag ser distribuída, com
  a página de contingência no ar.
- **Cobrança**: sem pagamento no MVP. A regra de direito a vínculo sempre permite.
- **Espécies**: cão e gato.
- **Limites padrão**: máximo de 500 códigos por lote; ativação pendente vale 7 dias; recado do modo
  perdido com até 280 caracteres; cuidados com até 280 caracteres; até 5 itens de temperamento.
- **E-mail**: o aviso de scan usa o e-mail da conta. O provedor de envio é escolha do plano técnico.
- **Mapa**: o histórico mostra a área do scan num mapa; a página pública não tem mapa.
- **Tema**: o app do tutor tem tema claro e escuro; página pública, ativação e admin são claros.
- **Idioma**: PT-BR.

### Out of Scope

- Pagamento, planos e qualquer limite real de vínculos (`TODO(BILLING_MODEL)`).
- Carteira de saúde, lembretes, anexos, co-tutoria, emergência, peso, relatório para o veterinário.
- Rastreador GPS e localização em tempo real.
- Notificações por push ou SMS de scan (o MVP avisa por e-mail e no app).
- Mais de um contato por pet.
- Cadastro, confirmação de celular, recuperação de senha e tela de conta (`004-conta-tutor`).
- Cartaz de pet perdido para imprimir ou compartilhar.
- Exportação e exclusão de dados do titular: o fluxo é de `004-conta-tutor`; esta feature só fornece
  a operação que encerra vínculos e anonimiza scans de uma conta.
