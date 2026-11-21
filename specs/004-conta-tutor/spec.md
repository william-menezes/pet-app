# Feature Specification: Conta do tutor

**Feature Branch**: `004-conta-tutor`
**Created**: 2026-11-21
**Status**: Draft
**Input**: User description: "Conta do tutor: tudo o que o MVP precisa sobre a conta e que a spec 001 (só login) deixou de fora. Boas-vindas, cadastro (nome, e-mail, celular, senha, aceite dos termos) ou com o Google, confirmação de e-mail, confirmação do celular por SMS, recuperação de senha, seção Conta (dados pessoais, trocar celular, trocar senha, aparência, privacidade com exportar e excluir, sair), com requisitos de segurança no mesmo espírito da 001."

> **Nota de domínio**: esta feature estende a `001-login` (entrar com e-mail e senha ou com o
> Google, "manter conectado", papéis, limite de tentativas e auditoria já existem lá) e reaproveita
> as entidades dela. Depende da `002-ui-zardui` (base visual e cascas de tela) e é pré-requisito da
> `003-tag-qr` (que exige celular confirmado para ativar uma tag e devolve o visitante ao ponto de
> onde saiu). A spec é **agnóstica de stack** (Constituição, Princípio IV).

---

## Clarifications

### Sessão 2026-11-21

Decisões já tomadas pelo dono do produto (`docs/decisoes-pivo.md`) e aplicadas aqui:

- Q: Por qual canal o celular é confirmado? → A: **SMS**, com código de 6 dígitos. A opção
  "enviar pelo WhatsApp" saiu.
- Q: Quais dados pessoais o cadastro pede? → A: **nome, e-mail e celular**. Nunca CPF nem
  endereço (Constituição, Princípio II).
- Q: Em quais larguras as telas funcionam? → A: **três**: celular (base), tablet e computador.
- Q: Onde existe tema escuro? → A: **só no app autenticado do tutor**. Boas-vindas, cadastro,
  confirmações e recuperação de senha são sempre claros. A seção **Conta**, que fica dentro do app
  do tutor, acompanha o tema do app. (Onde documentos antigos dizem "conta sempre clara", leia-se
  "os fluxos de cadastro e acesso".)
- Q: O login com o Google usa qual ícone? → A: o **ícone oficial** do Google.

Decisões tomadas nesta especificação (o dono não estava disponível; cada uma tem um padrão
concreto e pode ser revista):

- Q: Em que ordem vêm a confirmação de e-mail e a do celular? → A: **e-mail primeiro, celular
  depois**. Um SMS só é enviado para uma conta que já provou ser dona do e-mail. Isso muda a
  ordem da tela aprovada ("Criar conta" levava direto a "Confirmar celular"): entre as duas entra
  a etapa "Confirme seu e-mail". Motivo: impedir que qualquer visitante dispare SMS pagos para
  números de terceiros.
- Q: A confirmação do celular bloqueia o uso do app? → A: **não**. Ela é o passo seguinte do
  cadastro e a pessoa pode adiar; o que fica bloqueado é o que depende do celular: vincular uma
  tag e mostrar telefone ou WhatsApp na página de resgate (regra aplicada pela `003-tag-qr`).
- Q: O celular vira forma de entrar na conta? → A: **não**. Serve só como contato de resgate.
- Q: O mesmo número pode estar em mais de uma conta? → A: **sim** (casais e famílias dividem um
  número). A posse é provada por SMS em cada conta.
- Q: A exclusão de conta tem período de arrependimento? → A: **não** no MVP. É imediata e
  irreversível, protegida por nova prova de identidade e confirmação explícita.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criar conta com e-mail e senha e confirmar o e-mail (Priority: P1)

Como pessoa que acabou de comprar uma tag (ou que chegou ao app por conta própria), quero criar
minha conta informando só nome, e-mail, celular e uma senha, aceitar os termos e confirmar meu
e-mail, para poder entrar no Faro. Chego pela tela de boas-vindas, que me oferece "Criar conta" e
"Já tenho conta". Depois de enviar o cadastro, vejo a tela "Confirme seu e-mail", abro o link que
recebi e sigo adiante já autenticada.

**Why this priority**: sem conta não existe tutor, e sem tutor não existe tag ativada. É o primeiro
passo do único caminho de valor do MVP. Entrega valor sozinha: uma pessoa passa a ter uma conta
confirmada e consegue entrar.

**Independent Test**: abrir a boas-vindas, criar uma conta com um e-mail novo, abrir o link de
confirmação recebido e verificar que a pessoa fica autenticada, com papel de tutor, com o aceite
dos termos registrado, e que antes de confirmar o e-mail não consegue entrar.

**Acceptance Scenarios**:

1. **Dado** um visitante sem sessão que abre a área do app pela primeira vez, **Quando** a tela
   carrega, **Então** ele vê a boas-vindas com as ações "Criar conta" e "Já tenho conta".
2. **Dado** o formulário de cadastro, **Quando** a pessoa informa nome, e-mail válido, celular
   brasileiro válido, senha com 8 caracteres ou mais e marca o aceite, **Então** a conta é criada,
   um e-mail de confirmação é enviado e ela vê a tela "Confirme seu e-mail" com o endereço usado.
3. **Dado** o formulário de cadastro, **Quando** falta um campo, o e-mail ou o celular têm formato
   inválido, a senha tem menos de 8 caracteres ou o aceite não foi marcado, **Então** nada é
   enviado e cada campo com problema mostra a correção esperada.
4. **Dado** um e-mail que **já tem conta**, **Quando** alguém tenta se cadastrar com ele, **Então**
   a tela mostrada, o texto e o tempo de resposta são os mesmos de um cadastro novo, e nenhuma
   informação da conta existente é alterada.
5. **Dado** a tela "Confirme seu e-mail", **Quando** a pessoa pede o reenvio depois de 60 segundos,
   **Então** um novo e-mail é enviado e a contagem recomeça; antes disso, a ação fica indisponível
   e mostra quanto falta.
6. **Dado** o link de confirmação dentro da validade, **Quando** a pessoa o abre e aciona
   "Confirmar meu e-mail", **Então** o e-mail fica confirmado, ela fica autenticada e segue para a
   confirmação do celular (User Story 2).
7. **Dado** um link de confirmação vencido, já usado ou adulterado, **Quando** a pessoa o abre,
   **Então** vê uma tela dizendo que o link não vale mais, com a ação de pedir um novo.
8. **Dado** que a pessoa se cadastrou num aparelho e abriu o link em outro, **Quando** confirma,
   **Então** a confirmação vale e o fluxo continua no aparelho em que o link foi aberto; no
   aparelho original ela consegue entrar com e-mail e senha.
9. **Dado** uma conta de e-mail e senha ainda não confirmada, **Quando** a pessoa tenta entrar,
   **Então** o acesso é recusado com a orientação genérica já definida na `001-login` e a opção de
   reenviar a confirmação.
10. **Dado** um cadastro enviado com qualquer tentativa de informar papel, **Quando** a conta é
    criada, **Então** ela nasce como tutor.

---

### User Story 2 - Confirmar o celular por SMS (Priority: P1)

Como tutor recém-cadastrado, quero confirmar o número do meu celular digitando o código de 6
dígitos que recebi por SMS, para que esse número possa aparecer para quem encontrar meu pet. Se
digitei o número errado, quero corrigi-lo. Se o SMS não chegou, quero pedir outro depois de uma
contagem regressiva.

**Why this priority**: a Constituição só permite mostrar na página de resgate um telefone cuja
posse foi verificada, e a ativação da tag exige celular confirmado. Sem esta história a conta
existe mas a tag não pode ser ativada.

**Independent Test**: com uma conta de e-mail confirmado e um número pendente, pedir o código,
digitá-lo e verificar que o celular passa a constar como confirmado; repetir com código errado,
código vencido, reenvio e correção do número, verificando limites e mensagens.

**Acceptance Scenarios**:

1. **Dado** um tutor que acabou de confirmar o e-mail e informou um celular no cadastro, **Quando**
   chega à confirmação do celular, **Então** um SMS com um código de 6 dígitos é enviado para
   aquele número e a tela mostra o número, os seis campos do código e a contagem para reenviar.
2. **Dado** um código válido e dentro de 10 minutos, **Quando** o tutor o digita e confirma,
   **Então** o celular passa a constar como confirmado e ele é levado ao destino de retorno (ou à
   área do tutor, se não houver).
3. **Dado** um código errado, **Quando** o tutor confirma, **Então** vê que o código não confere e
   quantas tentativas restam; nada é confirmado.
4. **Dado** 5 tentativas erradas para o mesmo código, **Quando** o tutor tenta de novo, **Então**
   aquele código deixa de valer e a tela orienta a pedir um novo.
5. **Dado** um código com mais de 10 minutos, **Quando** o tutor o digita, **Então** vê que o
   código venceu e pode pedir outro.
6. **Dado** a contagem de 60 segundos em andamento, **Quando** o tutor tenta reenviar, **Então** a
   ação está indisponível; ao zerar, ele pode reenviar, e o código anterior deixa de valer.
7. **Dado** que o tutor tocou em "Número errado? Corrigir", **Quando** informa outro número e pede
   o código, **Então** o código anterior deixa de valer e um novo é enviado ao novo número.
8. **Dado** uma conta que atingiu o limite de envios (por conta, por número ou por origem),
   **Quando** pede mais um código, **Então** nenhum SMS é enviado e a tela diz quando poderá
   tentar de novo, com a opção de continuar sem confirmar por enquanto.
9. **Dado** que o serviço de SMS está fora do ar, **Quando** o tutor pede o código, **Então** vê
   uma mensagem amigável com as opções de tentar de novo ou continuar sem confirmar por enquanto.
10. **Dado** um tutor sem celular confirmado, **Quando** qualquer parte do produto pergunta "o
    celular desta conta está confirmado?", **Então** a resposta é não; depois da confirmação, sim.
11. **Dado** um tutor autenticado, **Quando** ele tenta, por qualquer meio que não seja o código
    recebido por SMS, marcar o próprio celular como confirmado, **Então** a tentativa é recusada.
12. **Dado** um número que não é um celular brasileiro válido, **Quando** o tutor pede o código,
    **Então** nenhum SMS é enviado e o campo mostra o formato esperado.

---

### User Story 3 - Criar conta com o Google (Priority: P2)

Como pessoa que prefere não criar mais uma senha, quero criar minha conta com "Continuar com o
Google". Como o Google não informa meu celular nem registra meu aceite, depois de autorizar eu
aceito os termos e informo o celular, que é confirmado por SMS como na User Story 2.

**Why this priority**: reduz o atrito de entrada, mas o cadastro por e-mail e senha já resolve o
caminho principal.

**Independent Test**: acionar "Continuar com o Google" com uma conta Google que ainda não existe
no Faro, concluir o consentimento e verificar que a conta é criada como tutor, que o app só fica
acessível depois do aceite dos termos e que a pessoa é convidada a informar e confirmar o celular.

**Acceptance Scenarios**:

1. **Dado** um visitante na tela de cadastro, **Quando** escolhe "Continuar com o Google" e conclui
   o consentimento, **Então** a conta é criada como tutor, com o nome e o e-mail vindos do Google e
   o e-mail já considerado confirmado.
2. **Dado** uma conta criada pelo Google que ainda não aceitou os termos, **Quando** a pessoa tenta
   chegar a qualquer tela do app, **Então** é levada à tela de aceite e só segue depois de aceitar;
   o aceite fica registrado com versão e data.
3. **Dado** uma conta criada pelo Google, com os termos aceitos e sem celular, **Quando** a pessoa
   segue, **Então** é convidada a informar o celular e confirmá-lo por SMS, podendo adiar.
4. **Dado** uma conta criada pelo "Entrar com o Google" da tela de login (e não pelo cadastro),
   **Quando** a pessoa entra pela primeira vez, **Então** valem as mesmas etapas dos cenários 2 e 3.
5. **Dado** uma conta Google cujo e-mail já corresponde a uma conta existente do Faro, **Quando** a
   pessoa continua com o Google, **Então** entra na mesma conta, sem duplicar, como já definido na
   `001-login`.
6. **Dado** que a pessoa cancelou o consentimento no Google, **Quando** volta ao Faro, **Então**
   nenhuma conta é criada e ela vê uma mensagem neutra, com o cadastro por e-mail disponível.

---

### User Story 4 - Recuperar a senha (Priority: P2)

Como tutor que esqueceu a senha, quero pedir a recuperação informando meu e-mail, receber um link
e definir uma senha nova, para voltar a entrar. Quem pede a recuperação nunca descobre se aquele
e-mail tem conta.

**Why this priority**: sem isso, esquecer a senha significa perder o acesso à conta e às tags. Não
é necessário para a primeira ativação, por isso vem depois do cadastro.

**Independent Test**: pedir a recuperação com um e-mail que tem conta e com um que não tem e
comparar as respostas; abrir o link recebido, definir a senha nova e verificar que a antiga deixa
de funcionar, que a nova funciona e que as sessões abertas foram encerradas.

**Acceptance Scenarios**:

1. **Dado** a tela "Esqueci a senha", **Quando** a pessoa informa um e-mail que tem conta, **Então**
   vê "Se existir uma conta com este e-mail, enviamos um link" e o e-mail com o link é enviado.
2. **Dado** a mesma tela, **Quando** a pessoa informa um e-mail sem conta, **Então** vê exatamente
   a mesma mensagem, no mesmo tempo, e nenhum e-mail é enviado.
3. **Dado** o link de recuperação dentro de 1 hora, **Quando** a pessoa o abre, informa uma senha
   nova com 8 caracteres ou mais e confirma, **Então** a senha é trocada, todas as sessões da conta
   são encerradas e ela é levada a entrar com a senha nova.
4. **Dado** um link vencido, já usado ou adulterado, **Quando** a pessoa tenta definir a senha,
   **Então** a troca não acontece e ela vê a opção de pedir um novo link.
5. **Dado** mais de 3 pedidos em 1 hora para o mesmo e-mail (ou mais de 10 da mesma origem),
   **Quando** chega mais um, **Então** a resposta visível é a mesma, mas nenhum e-mail é enviado.
6. **Dado** uma conta criada só com o Google, **Quando** a pessoa usa a recuperação, **Então**
   consegue definir uma senha e passa a poder entrar também com e-mail e senha.

---

### User Story 5 - Sair, exportar meus dados e excluir minha conta (Priority: P2)

Como titular dos meus dados, quero encontrar no app a seção **Conta**, sair quando quiser, baixar
uma cópia de tudo o que o Faro guarda sobre mim e excluir minha conta de forma definitiva.
Excluir a conta encerra os vínculos das minhas tags, mas as tags continuam existindo e podem ser
ativadas de novo por outra pessoa.

**Why this priority**: exportar e excluir são direitos do titular exigidos pela Constituição
(Princípio II). Precisam estar no MVP, mas não bloqueiam a primeira ativação.

**Independent Test**: com uma conta de exemplo, abrir Conta, baixar a exportação e conferir o
conteúdo; excluir a conta e verificar que não é mais possível entrar, que os dados pessoais
sumiram, que os vínculos de tag foram encerrados, que nenhum código de tag foi apagado e que a
trilha de auditoria continua existindo sem dado pessoal.

**Acceptance Scenarios**:

1. **Dado** um tutor autenticado, **Quando** abre "Conta", **Então** vê as entradas dados
   pessoais, celular, senha, aparência, privacidade e sair, no tema do app.
2. **Dado** um tutor em "Conta", **Quando** aciona "Sair", **Então** a sessão é encerrada, o evento
   é registrado e ele volta para a tela de entrada.
3. **Dado** um tutor em "Privacidade", **Quando** pede "Exportar meus dados", **Então** recebe um
   arquivo com os dados da conta, os consentimentos, o histórico de eventos da própria conta e os
   dados de pets, tags e scans que são dele; nada de outras contas aparece.
4. **Dado** um tutor que já exportou 3 vezes em 24 horas, **Quando** pede de novo, **Então** é
   informado de quando poderá exportar outra vez.
5. **Dado** um tutor em "Excluir minha conta", **Quando** a tela abre, **Então** ela explica o que
   acontece: tags desvinculadas, página de resgate dos pets deixa de mostrar seus dados, a ação não
   pode ser desfeita.
6. **Dado** um tutor com senha, **Quando** confirma a exclusão digitando a senha atual correta,
   **Então** os vínculos ativos são encerrados, os scans ligados a ele são anonimizados, seus dados
   pessoais, pets e fotos são removidos, as sessões são encerradas e ele não consegue mais entrar.
7. **Dado** um tutor que entra só com o Google, **Quando** pede a exclusão tendo entrado há mais
   de 10 minutos, **Então** é pedido que entre de novo com o Google antes de confirmar.
8. **Dado** uma senha errada na confirmação, **Quando** o tutor tenta excluir, **Então** nada é
   excluído; depois de 5 erros em 15 minutos, novas tentativas ficam bloqueadas por um tempo.
9. **Dado** que o encerramento dos vínculos de tag falhou, **Quando** a exclusão é processada,
   **Então** a conta **não** é excluída e o tutor é avisado para tentar mais tarde.
10. **Dado** uma conta excluída, **Quando** se consulta qualquer tag que era dela, **Então** o
    código continua existindo, o histórico da tag continua íntegro e nenhum dado do antigo tutor
    aparece para ninguém.
11. **Dado** uma conta excluída, **Quando** alguém se cadastra com o mesmo e-mail, **Então** nasce
    uma conta nova que não herda nada da antiga.

---

### User Story 6 - Cuidar da minha conta: nome, celular, senha e aparência (Priority: P3)

Como tutor, quero corrigir meu nome, trocar meu celular, trocar minha senha e escolher a aparência
do app (clara, escura ou a do sistema). Ao trocar o celular, o número antigo continua valendo na
página de resgate até o novo ser confirmado.

**Why this priority**: são ajustes de manutenção. O produto já funciona sem eles.

**Independent Test**: com uma conta de celular confirmado, alterar o nome; iniciar a troca de
celular e verificar que o número antigo continua confirmado até o código do novo ser aceito;
trocar a senha e verificar que as outras sessões caem; alternar a aparência e verificar que vale
no app e não nas telas de cadastro e acesso.

**Acceptance Scenarios**:

1. **Dado** um tutor em "Dados pessoais", **Quando** altera o nome para um valor entre 2 e 80
   caracteres e salva, **Então** o novo nome passa a valer; o e-mail aparece, mas não é editável.
2. **Dado** um tutor com celular confirmado, **Quando** inicia a troca informando um número novo e
   prova de novo a identidade, **Então** um código é enviado ao número novo e o número antigo
   continua confirmado e em uso.
3. **Dado** a troca em andamento, **Quando** o tutor digita o código certo, **Então** o número novo
   substitui o antigo e fica confirmado; se ele desiste ou o código vence, o antigo permanece.
4. **Dado** um tutor com senha, **Quando** informa a senha atual correta e uma nova com 8
   caracteres ou mais, **Então** a senha é trocada e as outras sessões da conta são encerradas.
5. **Dado** a senha atual errada, **Quando** tenta trocar, **Então** a troca é recusada com
   mensagem genérica e as tentativas contam para o limite já definido na `001-login`.
6. **Dado** um tutor que entra só com o Google, **Quando** abre "Senha", **Então** vê que a conta
   usa o Google e como criar uma senha pela recuperação.
7. **Dado** um tutor em "Aparência", **Quando** escolhe clara, escura ou "igual ao sistema",
   **Então** o app do tutor passa a usar a escolha e a lembra nas próximas visitas naquele
   aparelho; as telas de cadastro, acesso e a página de resgate continuam claras.

---

### Edge Cases

- **E-mail já cadastrado no cadastro**: resposta idêntica à de um e-mail novo, em conteúdo e em
  tempo. Os dados digitados (nome, celular) são descartados.
- **Leitor de e-mail que abre links sozinho** (antivírus, pré-visualização): abrir o link não
  consome a confirmação nem a recuperação; elas só valem quando a pessoa aciona o botão da página.
- **Link aberto em outro aparelho ou navegador**: funciona; nada depende do navegador onde o
  cadastro começou. O destino de retorno também sobrevive.
- **Pessoa fecha a tela "Confirme seu e-mail"**: ao tentar entrar depois, recebe a orientação de
  confirmar e pode pedir o reenvio.
- **SMS não chega**: a tela oferece reenviar (após a contagem), corrigir o número e, se os limites
  forem atingidos ou o serviço falhar, continuar sem confirmar por enquanto.
- **Dois pedidos de código quase simultâneos**: só o último código vale; a contagem de envios
  considera os dois.
- **Código certo depois de vencido ou depois de 5 erros**: recusado; é preciso pedir outro.
- **Troca de celular abandonada**: o número antigo continua confirmado; o pedido pendente some
  quando vence.
- **Troca de celular para o mesmo número já confirmado**: recusada com mensagem clara, sem SMS.
- **Conta sem celular tentando ativar uma tag**: a `003-tag-qr` a envia para a confirmação do
  celular e, ao terminar, ela volta ao ponto de onde saiu.
- **Destino de retorno malicioso** (endereço externo, esquema estranho): ignorado; a pessoa vai
  para a área do tutor.
- **Admin**: entra pela mesma porta e não passa pelas etapas de celular; o aceite dos termos e a
  confirmação do celular valem para tutores.
- **Sessão expira no meio do fluxo**: a pessoa é levada a entrar e, depois, volta à etapa que
  faltava (aceite, celular) e ao destino de retorno.
- **Exclusão com a sessão aberta em outros aparelhos**: todas as sessões caem.
- **Exclusão interrompida depois de encerrar os vínculos**: uma nova tentativa conclui a exclusão
  sem erro e sem efeitos repetidos.
- **Serviço de SMS, de e-mail ou o login do Google fora do ar**: nenhuma dessas falhas afeta a
  página pública de resgate nem as tags já ativadas (Princípio I).

## Requirements *(mandatory)*

### Functional Requirements

**Entrada e cadastro**

- **FR-001**: O sistema DEVE mostrar a um visitante sem sessão, na entrada da área do app, uma tela
  de boas-vindas com as ações "Criar conta" e "Já tenho conta". Quem já usou o app naquele
  aparelho e teve a sessão encerrada vai direto para a tela de entrada.
- **FR-002**: O cadastro DEVE pedir apenas nome, e-mail, celular, senha e o aceite dos Termos e da
  Política de privacidade. O sistema NÃO DEVE pedir nem guardar CPF, endereço ou data de nascimento.
- **FR-003**: A senha DEVE ter no mínimo 8 e no máximo 72 caracteres, sem regras de composição.
  O limite DEVE ser imposto também no servidor. A pessoa DEVE poder ver o que digitou.
- **FR-004**: O sistema DEVE validar formato de e-mail, celular brasileiro e tamanho do nome (2 a
  80 caracteres) antes de enviar, sinalizando cada campo, e DEVE repetir a validação no servidor.
- **FR-005**: O aceite dos Termos e da Política de privacidade DEVE ser obrigatório e DEVE ficar
  registrado com a versão dos documentos e a data e hora, em qualquer forma de cadastro.
- **FR-006**: A resposta a um cadastro com e-mail já existente DEVE ser indistinguível, em
  conteúdo e em tempo perceptível, da resposta a um cadastro novo, e NÃO DEVE alterar a conta
  existente.
- **FR-007**: Toda conta criada por esta feature DEVE nascer com o papel de tutor. Nenhum dado
  enviado pela pessoa pode definir ou alterar o papel.
- **FR-008**: O sistema DEVE permitir criar conta com o Google, com o ícone oficial, sem duplicar
  uma conta que já exista com o mesmo e-mail.
- **FR-009**: Uma conta de tutor sem aceite registrado (criada pelo Google, por qualquer tela)
  NÃO DEVE acessar o app antes de aceitar; a tela de aceite DEVE oferecer "Sair".

**Confirmação de e-mail**

- **FR-010**: Depois do cadastro por e-mail e senha, o sistema DEVE enviar um e-mail com um link
  de confirmação e mostrar a tela "Confirme seu e-mail", com o endereço usado e a ação de reenviar.
- **FR-011**: O reenvio DEVE respeitar um intervalo mínimo de 60 segundos, com contagem visível, e
  DEVE responder da mesma forma exista ou não uma conta pendente para aquele e-mail.
- **FR-012**: O link de confirmação DEVE valer por 1 hora e uma única vez, e DEVE funcionar em
  qualquer aparelho ou navegador.
- **FR-013**: A confirmação só DEVE ser concluída quando a pessoa aciona "Confirmar meu e-mail" na
  página aberta pelo link; abrir o endereço, por si só, não consome o link.
- **FR-014**: Um link vencido, usado ou inválido DEVE levar a uma tela que explica isso e oferece
  pedir um novo.
- **FR-015**: Ao confirmar o e-mail, a pessoa DEVE ficar autenticada e ser levada à próxima etapa
  pendente (confirmação do celular) ou ao destino de retorno.

**Confirmação do celular**

- **FR-016**: O sistema DEVE aceitar apenas números de celular brasileiros.
- **FR-017**: O sistema DEVE confirmar a posse do celular enviando por SMS um código numérico de 6
  dígitos. Um SMS só pode ser enviado a pedido de uma conta autenticada, com e-mail confirmado e
  aceite registrado.
- **FR-018**: Cada código DEVE valer por 10 minutos e uma única vez. Pedir um código novo ou
  corrigir o número DEVE invalidar o anterior.
- **FR-019**: Depois de 5 tentativas erradas, o código DEVE deixar de valer. A tela DEVE informar
  quantas tentativas restam.
- **FR-020**: O reenvio DEVE ficar disponível só depois de 60 segundos, com contagem regressiva
  visível.
- **FR-021**: O sistema DEVE limitar os envios a 5 por hora e 10 por 24 horas **por conta**, 5 por
  24 horas **por número** (somando todas as contas) e 30 por hora **por origem**, além de um teto
  diário global configurável. Ao atingir um limite, nenhum SMS é enviado e a pessoa é informada de
  quando pode tentar de novo.
- **FR-022**: A tela de confirmação DEVE oferecer "Número errado? Corrigir".
- **FR-023**: O código NÃO DEVE ser guardado de forma que permita recuperá-lo, nem aparecer em
  registros, respostas ou telas além do próprio SMS.
- **FR-024**: A conferência do código e a contagem de tentativas DEVEM acontecer juntas, no
  servidor. O celular só passa a "confirmado" por esse caminho; a própria pessoa NÃO DEVE conseguir
  marcar o celular como confirmado, nem trocar o número confirmado, por outro meio.
- **FR-025**: O sistema DEVE expor às outras features um único fato, "o celular desta conta está
  confirmado?", e DEVE garantir que o número disponível para a página de resgate é sempre um
  número confirmado.
- **FR-026**: Um tutor sem celular confirmado DEVE poder usar o app e adiar a confirmação. Ao
  entrar, ele é convidado a confirmar. O que depende do celular (vincular tag, mostrar contato)
  fica indisponível até lá; a aplicação dessa regra é da `003-tag-qr`.
- **FR-027**: Falha ou indisponibilidade do serviço de SMS DEVE resultar em mensagem amigável com
  próximo passo, e NÃO DEVE afetar contas que já têm celular confirmado.
- **FR-028**: O celular NÃO DEVE ser aceito como forma de entrar na conta.
- **FR-029**: O mesmo número PODE ser confirmado em mais de uma conta.

**Destino de retorno**

- **FR-030**: Quando uma pessoa é enviada para criar conta ou entrar a partir de outro ponto do
  produto, o sistema DEVE guardar esse ponto ("destino de retorno") e levá-la de volta a ele depois
  de concluir cadastro, confirmação de e-mail e confirmação do celular, inclusive quando o e-mail é
  confirmado em outro aparelho e quando o cadastro é feito com o Google.
- **FR-031**: O destino de retorno DEVE ser sempre um endereço interno do próprio Faro. Qualquer
  outro valor é descartado. O destino nunca concede acesso por si só.
- **FR-032**: Sem destino de retorno, o tutor vai para a área do tutor e o admin para o backoffice.
- **FR-033**: Um destino de retorno guardado na conta DEVE valer por no máximo 7 dias e ser usado
  uma única vez.

**Recuperação de senha**

- **FR-034**: O sistema DEVE permitir pedir a recuperação de senha informando o e-mail, e DEVE
  responder com a mesma mensagem e no mesmo tempo perceptível, exista ou não uma conta.
- **FR-035**: O link de recuperação DEVE valer por 1 hora e uma única vez, e a senha só é trocada
  quando a pessoa envia a nova senha na página aberta pelo link.
- **FR-036**: A nova senha DEVE obedecer ao FR-003. Depois da troca, todas as sessões da conta
  DEVEM ser encerradas e a pessoa DEVE entrar com a senha nova.
- **FR-037**: O sistema DEVE limitar os pedidos de recuperação a 3 por hora por e-mail e 10 por
  hora por origem. Pedidos além do limite recebem a mesma resposta visível e não geram e-mail.
- **FR-038**: Um link vencido, usado ou inválido DEVE levar a uma tela que oferece pedir um novo.
- **FR-039**: Uma conta criada só com o Google DEVE poder criar uma senha pela recuperação.

**Conta**

- **FR-040**: O app do tutor DEVE ter a seção "Conta" com: dados pessoais, celular, senha,
  aparência, privacidade e sair.
- **FR-041**: O tutor DEVE poder alterar o próprio nome (2 a 80 caracteres). O e-mail é exibido e
  não é editável nesta feature.
- **FR-042**: O tutor DEVE poder trocar o celular. O número novo passa pela mesma confirmação por
  SMS, e o número antigo continua confirmado e em uso até o novo ser confirmado.
- **FR-043**: Trocar um celular já confirmado, trocar a senha e excluir a conta DEVEM exigir nova
  prova de identidade: a senha atual, para contas com senha; ter entrado com o Google há no
  máximo 10 minutos, para contas só com o Google. Erros nessa prova são limitados a 5 em 15 minutos.
- **FR-044**: O tutor com senha DEVE poder trocá-la informando a senha atual e a nova (FR-003).
  Depois da troca, as outras sessões da conta DEVEM ser encerradas.
- **FR-045**: O tutor DEVE poder escolher a aparência do app: clara, escura ou igual à do sistema.
  A escolha vale só no app autenticado do tutor e é lembrada no aparelho. Boas-vindas, cadastro,
  confirmações, recuperação e a página de resgate são sempre claros.
- **FR-046**: O tutor DEVE poder sair pela seção "Conta"; o evento DEVE ser registrado.

**Privacidade (direitos do titular)**

- **FR-047**: O tutor DEVE poder exportar seus dados num arquivo legível por máquina contendo:
  dados da conta, consentimentos, eventos de auditoria da própria conta e os dados de pets, tags e
  scans que são dele (fornecidos pela `003-tag-qr`). Limite: 3 exportações por 24 horas.
- **FR-048**: O tutor DEVE poder excluir a própria conta. Antes de confirmar, a tela DEVE explicar
  as consequências. A confirmação exige a prova de identidade do FR-043.
- **FR-049**: Ao excluir uma conta, o sistema DEVE: encerrar todos os vínculos ativos de tag da
  conta; **nunca** apagar ou alterar um código de tag (Princípio VIII); anonimizar ou remover os
  scans ligados à conta; remover os dados pessoais, os pets e as fotos; encerrar todas as sessões.
- **FR-050**: Se o encerramento dos vínculos ou a anonimização dos scans falhar, a conta NÃO DEVE
  ser excluída. Repetir uma exclusão interrompida DEVE concluí-la sem efeitos duplicados.
- **FR-051**: Os eventos de auditoria de uma conta excluída DEVEM permanecer, sem nenhum dado que
  identifique a pessoa.
- **FR-052**: Depois da exclusão, o mesmo e-mail DEVE poder criar uma conta nova, que não herda
  nada da anterior.

**Segurança, privacidade e auditoria**

- **FR-053**: As mensagens de erro DEVEM ser genéricas onde revelar o motivo permitiria descobrir
  se uma conta existe (cadastro, reenvio de confirmação, recuperação de senha).
- **FR-054**: Todo limite desta feature DEVE ser imposto no servidor, no ponto que realmente
  executa a ação, e não depender do comportamento da tela.
- **FR-055**: O sistema DEVE registrar como Evento de Auditoria de Autenticação: conta criada,
  e-mail confirmado, aceite dos termos, código de celular enviado, código inválido, bloqueio por
  limite, celular confirmado, recuperação de senha pedida, senha alterada, falha de nova prova de
  identidade, dados exportados, conta excluída e saída. Nenhum evento guarda senha, código, link,
  número de telefone ou e-mail em claro.
- **FR-056**: Chaves e segredos (do serviço de SMS, do envio de e-mail, do login com o Google e os
  usados para proteger códigos) DEVEM ficar só no servidor.
- **FR-057**: Uma conta NÃO DEVE conseguir ler nem alterar dados de outra conta. Um visitante sem
  sessão NÃO DEVE conseguir ler nenhum dado de conta.
- **FR-058**: Esta feature NÃO DEVE criar nenhuma dependência de conta, sessão, e-mail ou SMS na
  página pública de resgate nem na leitura do QR Code (Princípio I).
- **FR-059**: O envio de SMS de teste ou simulado NÃO DEVE poder ser ligado em produção.

**Experiência e acesso**

- **FR-060**: Todas as telas DEVEM funcionar em celular, tablet e computador, em PT-BR, com meta
  WCAG 2.1 AA, navegação por teclado e alvos de toque de 44 px ou mais.
- **FR-061**: O campo do código por SMS DEVE aceitar colar o código inteiro e o preenchimento
  automático oferecido pelo aparelho.
- **FR-062**: Todo estado de erro, espera ou bloqueio DEVE terminar num próximo passo visível.

### Key Entities *(include if feature involves data)*

Reaproveitadas da `001-login` e do glossário, sem redefinir:

- **Conta / Usuário**: ganha, nesta feature, o **celular** (com a marca de confirmado e a data), um
  **celular pendente** (informado e ainda não confirmado) e o **aceite dos termos**.
- **Papel (Role)**: toda conta criada aqui é Tutor.
- **Sessão**: encerrada em massa na redefinição de senha e na exclusão; as outras sessões caem na
  troca de senha.
- **Identidade Externa (Google)**: forma de criar conta e de provar identidade de novo.
- **Evento de Auditoria de Autenticação**: ganha os eventos do FR-055.

Novas:

- **Verificação de celular**: pedido de confirmação de um número para uma conta. Tem validade,
  contador de tentativas, situação (ativa, usada, invalidada, vencida) e uma prova do código que
  não permite recuperá-lo.
- **Aceite dos termos (Consentimento)**: versão dos documentos e data e hora do aceite, por conta.
- **Destino de retorno**: endereço interno para onde a pessoa volta ao fim do fluxo; vale 7 dias e
  é usado uma vez.
- **Pedido de recuperação de senha**: pedido de troca de senha por e-mail; gera um link de uso
  único com validade de 1 hora.
- **Preferência de aparência**: clara, escura ou igual ao sistema; guardada no aparelho.
- **Exportação de dados**: arquivo gerado a pedido do titular com os dados dele.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa com o celular e o e-mail à mão conclui cadastro, confirmação de e-mail e
  confirmação do celular em até **3 minutos**.
- **SC-002**: Pelo menos **90%** das pessoas que iniciam a confirmação do celular a concluem na
  primeira sessão.
- **SC-003**: **100%** dos números exibidos em páginas de resgate pertencem a contas com celular
  confirmado (verificável por teste: não existe caminho que torne público um número não confirmado).
- **SC-004**: As respostas de cadastro e de recuperação de senha para um e-mail **com** conta e
  **sem** conta são idênticas em conteúdo e não diferem em mais de **200 ms** no tempo mediano.
- **SC-005**: Nenhuma sequência automatizada consegue provocar mais envios de SMS do que os limites
  do FR-021, nem mais de 5 tentativas por código (verificável por teste).
- **SC-006**: Um código de 6 dígitos tem menos de **1 chance em 4.000 por dia** de ser adivinhado
  por conta, dados os limites de envio e de tentativas.
- **SC-007**: **100%** dos eventos do FR-055 ficam registrados e nenhum registro contém senha,
  código, link, telefone ou e-mail em claro.
- **SC-008**: Em testes com duas contas, **0** leituras ou alterações cruzadas de dados de conta; um
  visitante sem sessão lê **0** registros.
- **SC-009**: Depois de uma exclusão de conta, **0** dados pessoais da conta permanecem
  recuperáveis, **100%** dos vínculos ativos estão encerrados e **100%** dos códigos de tag
  continuam existindo com o mesmo valor.
- **SC-010**: A exportação entrega o arquivo em até **10 segundos** para uma conta com até 10 pets
  e 1.000 scans.
- **SC-011**: Um visitante que saiu de um ponto do produto para criar conta volta a esse ponto em
  **100%** dos casos, inclusive confirmando o e-mail em outro aparelho.
- **SC-012**: A página pública de resgate permanece **100%** acessível sem sessão antes e depois
  desta feature, inclusive com os serviços de SMS e de e-mail fora do ar.
- **SC-013**: Todas as telas passam na verificação automática de acessibilidade sem violações
  sérias e são utilizáveis nas três larguras.

## Assumptions

- **Dependências**: a `002-ui-zardui` (cascas de fluxo e do app, componentes, mecanismo de tema
  escuro, tela de entrada migrada) está implementada antes das telas desta feature. O login vem da
  `001-login`. A `003-tag-qr` fornece a operação que encerra vínculos e anonimiza scans de uma
  conta, e os dados de pets, tags e scans para a exportação.
- **País**: só celulares do Brasil no MVP.
- **Validade dos links de e-mail**: 1 hora, tanto para confirmação quanto para recuperação.
- **Reenvio de e-mail**: no mínimo 60 segundos entre envios.
- **Código por SMS**: 6 dígitos, 10 minutos, 5 tentativas, reenvio após 60 segundos, limites do
  FR-021. Teto global diário inicial de 500 SMS.
- **Prova recente de identidade**: senha atual, ou login com o Google há no máximo 10 minutos.
- **Versão dos termos**: a versão inicial é `2026-11`. Os textos dos Termos e da Política de
  privacidade ainda não existem; as páginas entram com um rascunho marcado como tal.
- **Aparência**: guardada por aparelho, não por conta.
- **Exclusão**: imediata, sem período de arrependimento.
- **Página inicial do site**: a boas-vindas desta feature é a entrada da **área do app**. A página
  inicial pública do domínio continua sendo a página provisória entregue pela `002-ui-zardui`, com
  o caminho para entrar; o conteúdo definitivo dela (página de apresentação do produto) não faz
  parte desta feature.
- **Admin**: contas de admin continuam sendo criadas e promovidas fora deste fluxo.
- **Idioma**: PT-BR.
- **Rede**: não há requisito de funcionamento offline.

### Telas que ainda precisam de desenho

Têm tela de referência (páginas "MVP v2"; direção aprovada, tela a tela ainda sem revisão do
William, exceto Entrar): Boas-vindas, Criar conta, Confirmar celular e Entrar. As
demais seguem o padrão da casca de fluxo ou da casca do app e os componentes do sistema visual,
e precisam de uma passada de design antes de serem consideradas finais:

- "Confirme seu e-mail" (espera e reenvio) e a página aberta pelo link (confirmar, link inválido).
- Aceite dos termos para contas criadas com o Google.
- Informar ou corrigir o celular (inclui a saída "Agora não").
- Estados da confirmação do celular que a tela aprovada não mostra: erro, vencido, bloqueado,
  serviço indisponível.
- "Esqueci a senha", "Criar nova senha", link de recuperação inválido.
- Seção "Conta": lista, dados pessoais, celular, senha, aparência, privacidade e a confirmação de
  exclusão (claro e escuro).
- Páginas dos Termos e da Política de privacidade.

### Out of Scope

- MFA ou verificação em duas etapas (a arquitetura continua aberta a ela, como na `001-login`).
- Trocar o e-mail da conta (futuro).
- Entrar com o celular ou com outros provedores sociais.
- Pagamento, planos e limites (`TODO(BILLING_MODEL)`).
- Tudo sobre tags e pets: ativação, PIN, página de resgate, scans, modo perdido, painel admin e a
  "ativação pendente" (`003-tag-qr`).
- Base visual, componentes compartilhados, cascas e o mecanismo do tema escuro (`002-ui-zardui`).
- Aviso por e-mail de "seu celular foi alterado" e "sua conta foi excluída" (depende do provedor
  de e-mail transacional; ver pontos em aberto).
- Gestão de contas pelo admin (bloquear, promover).

### Pontos em aberto (não bloqueiam o plano)

- `TODO(SMS_PROVIDER)`: escolha do serviço de SMS. Critérios: custo por SMS no Brasil, taxa e
  tempo de entrega nas quatro grandes operadoras, tratamento de dados (LGPD, local de
  processamento, retenção do conteúdo), suporte a remetente identificado. **Decisão de
  2026-11-21**: será contratado numa conta Google, **ainda não ativado**; o produto exato do
  Google fica a confirmar na ativação.
- `TODO(EMAIL_PROVIDER)`: serviço de e-mail transacional (o mesmo ponto em aberto da `003-tag-qr`).
  **Decisão de 2026-11-21**: conta Google, **ainda não ativada**.
- `TODO(LEGAL_TEXTS)`: textos dos Termos e da Política de privacidade.
- `TODO(CAPTCHA)`: proteção contra automação no cadastro e na recuperação de senha. **Decisão de
  2026-11-21: adotar**, junto com as demais proteções contra ataque e automação. O desenho e as
  tarefas ficam no contrato de endurecimento desta spec; muda também a tela de entrada da `001-login`.
- `TODO(RETENCAO)`: prazo de guarda dos eventos de auditoria (em aberto na Constituição).
- Período de arrependimento na exclusão de conta.
- Página inicial pública do domínio: a `002-ui-zardui` a deixou provisória à espera desta feature.
  Aqui ela **não** é redesenhada; falta decidir se o botão dela leva à boas-vindas ou direto à
  tela de entrada (hoje, à tela de entrada).
- Foto da tela de boas-vindas: depende do material fotográfico do dono.

> Nenhum `[NEEDS CLARIFICATION]` restante: os pontos acima têm padrão definido ou não bloqueiam a
> implementação.
