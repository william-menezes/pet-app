# Feature Specification: Login (acesso ao painel)

**Feature Branch**: `001-login`
**Created**: 2026-06-29
**Status**: Draft
**Input**: User description: "Página de login (autenticação de acesso ao painel) — e-mail+senha e Google; mesma porta para Tutor e Admin; manter conectado; segurança (anti-injeção, token seguro, rate-limit/anti-bruteforce, mensagens genéricas, auditoria, LGPD, transporte seguro). Cadastro e recuperação de senha ficam fora de escopo."

> **Nota de domínio**: esta é a primeira feature de produto do Faro (sucede o `000-bootstrap`).
> Faz parte do laço `auth-contas-tutor` do roadmap (`docs/README.md`), porém **deliberadamente
> restrita ao fluxo de login**. Cadastro (signup) e recuperação de senha são specs irmãs futuras.
> A spec é **agnóstica de stack** (Constituição, Princípio IV).

---

## Clarifications

### Session 2026-06-29

- Q: Confirmação de e-mail deve ser pré-requisito para o primeiro login? → A: **Exigir** para
  contas de **e-mail/senha** (recusa genérica + opção de reenviar a confirmação). Contas via
  **Google** chegam com e-mail já verificado pelo provedor e **dispensam** nova confirmação.
  (Refletido em FR-024 e no Edge Case de e-mail não confirmado.)
- Q: Quais parâmetros de rate-limit / proteção contra força-bruta adotar? → A: Bloqueio/backoff
  progressivo após **5 tentativas falhas** numa janela de **15 minutos**, contando por
  **identidade E por origem (IP)**. (Refletido em FR-018; calibragem fina e mecanismo ficam para o plano.)
- Q: Qual o tratamento de MFA (autenticação multifator) nesta fase? → A: **Fora de escopo no MVP**,
  porém a arquitetura de dados e o plano técnico DEVEM ser desenhados para **não impedir** um MFA
  futuro. (Refletido em Assumptions e Out of Scope.)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar com e-mail e senha e ser levado ao destino do meu papel (Priority: P1)

Como Tutor (ou Admin), quero entrar no Faro informando meu e-mail e senha para acessar a área
autenticada. Ao autenticar, o sistema reconhece meu papel e me leva ao destino correto: o Tutor
vai para o painel do tutor; o Admin vai para o backoffice. Quando informo credenciais erradas,
recebo uma mensagem clara, porém genérica, que não revela se a conta existe.

**Why this priority**: É o MVP absoluto da feature — sem login por e-mail/senha não há acesso ao
painel autenticado. Entrega valor sozinha (um usuário consegue entrar e usar o produto) e é a
base sobre a qual as demais histórias se apoiam. Cobre também o roteamento por papel, que é
requisito de produto (mesma porta para Tutor e Admin).

**Independent Test**: Pode ser totalmente testada criando-se uma conta de Tutor e uma de Admin
(pré-existentes ao teste), tentando entrar com credenciais corretas e incorretas, e verificando
(a) que o acesso é concedido apenas com credenciais válidas, (b) que cada papel chega ao seu
destino e (c) que erros são genéricos.

**Acceptance Scenarios**:

1. **Given** um Tutor com credenciais válidas e nenhuma sessão ativa, **When** ele informa e-mail
   e senha corretos e confirma, **Then** o sistema o autentica e o direciona ao painel do tutor.
2. **Given** um Admin com credenciais válidas, **When** ele entra pela mesma porta de login,
   **Then** o sistema o autentica e o direciona ao backoffice do Admin (e não ao painel do tutor).
3. **Given** um usuário existente, **When** ele informa a senha errada, **Then** o sistema recusa
   o acesso e exibe uma mensagem genérica de credenciais inválidas, **sem** indicar se foi o
   e-mail ou a senha que falhou, nem se a conta existe.
4. **Given** um e-mail que não corresponde a nenhuma conta, **When** alguém tenta entrar com ele,
   **Then** o sistema exibe a **mesma** mensagem genérica do cenário 3 (anti-enumeração de contas).
5. **Given** o campo de e-mail ou senha vazio/ inválido em formato, **When** o usuário tenta
   confirmar, **Then** o sistema bloqueia a tentativa e sinaliza o(s) campo(s) a corrigir, sem
   enviar a tentativa adiante.
6. **Given** um usuário **já autenticado**, **When** ele acessa a tela de login, **Then** o
   sistema o redireciona ao destino do seu papel em vez de exibir o formulário novamente.

---

### User Story 2 - Entrar com a conta Google (Priority: P2)

Como Tutor (ou Admin), quero entrar usando minha conta Google para não precisar memorizar mais
uma senha. Ao escolher "entrar com Google", autorizo o acesso e sou levado ao destino do meu
papel, da mesma forma que no login por e-mail/senha.

**Why this priority**: Reduz atrito de entrada e é um diferencial de conveniência esperado, mas
não é pré-requisito para acessar o produto (o e-mail/senha já cobre o acesso). Por isso é P2.

**Independent Test**: Pode ser testada de forma independente acionando o fluxo "entrar com
Google", concluindo o consentimento e verificando que o acesso é concedido e o roteamento por
papel ocorre; e, separadamente, cancelando o consentimento e verificando o retorno seguro ao
login sem acesso concedido.

**Acceptance Scenarios**:

1. **Given** um usuário na tela de login, **When** ele escolhe "entrar com Google" e conclui o
   consentimento com uma conta Google válida, **Then** o sistema o autentica e o direciona ao
   destino do seu papel.
2. **Given** um usuário que iniciou o login com Google, **When** ele **cancela** ou nega o
   consentimento, **Then** o sistema o retorna à tela de login sem conceder acesso e exibe uma
   mensagem neutra de que o login não foi concluído.
3. **Given** uma indisponibilidade do provedor Google (falha externa), **When** o usuário tenta
   entrar por Google, **Then** o sistema informa que o login social está indisponível no momento
   e oferece o caminho de e-mail/senha como alternativa, sem expor detalhes técnicos do erro.
4. **Given** um usuário cuja identidade Google corresponde a uma conta já existente no Faro,
   **When** ele entra por Google, **Then** o sistema o reconhece como a mesma Conta (não cria
   duplicidade) e aplica o roteamento por papel correspondente. *(Ver Assumption sobre vínculo
   entre identidades.)*

---

### User Story 3 - Manter-me conectado e sair com segurança (Priority: P3)

Como Tutor (ou Admin), quero a opção de "manter conectado" para não precisar autenticar a cada
reabertura do navegador, e quero poder **sair** (encerrar a sessão) quando desejar. Quando não
escolho "manter conectado", minha sessão é mais curta e termina mais cedo.

**Why this priority**: Melhora a experiência recorrente, mas o produto já é utilizável sem ela
(o usuário simplesmente entra novamente). Depende de US1/US2 já existirem. Por isso é P3.

**Independent Test**: Pode ser testada de forma independente entrando com "manter conectado"
marcado e desmarcado, reabrindo o navegador em cada caso e verificando a permanência/expiração da
sessão; e acionando "sair" e verificando que o acesso ao painel deixa de ser permitido.

**Acceptance Scenarios**:

1. **Given** um usuário que entrou com a opção "manter conectado" marcada, **When** ele fecha e
   reabre o navegador dentro do período de sessão persistente, **Then** ele continua autenticado
   e acessa o painel sem reinformar credenciais.
2. **Given** um usuário que entrou **sem** "manter conectado", **When** o período de sessão curta
   expira ou ele reabre o navegador após o fim dessa sessão, **Then** o sistema exige nova
   autenticação.
3. **Given** um usuário autenticado, **When** ele aciona "sair", **Then** o sistema encerra a
   sessão e o impede de acessar o painel até autenticar novamente.
4. **Given** uma sessão **expirada**, **When** o usuário tenta acessar uma área autenticada,
   **Then** o sistema o redireciona ao login e, após autenticar, o leva ao destino pretendido.

---

### Edge Cases

- **Credenciais inválidas / conta inexistente**: a resposta é idêntica e genérica em ambos os
  casos (anti-enumeração). Nenhuma diferença de texto, código ou tempo de resposta perceptível
  deve permitir inferir a existência da conta.
- **Muitas tentativas falhas (força-bruta)**: após N tentativas falhas dentro de uma janela de
  tempo, novas tentativas para aquela identidade e/ou origem são desaceleradas (backoff
  progressivo) e/ou temporariamente bloqueadas; o usuário recebe uma mensagem genérica de
  "tente novamente mais tarde", sem revelar o motivo exato nem se a conta existe.
- **Usuário já autenticado acessando o login**: redirecionado ao destino do seu papel (não vê o
  formulário). Ver US1, cenário 6.
- **Sessão expirada durante o uso**: ao tentar uma ação autenticada, é levado ao login e, após
  entrar, retornado ao destino pretendido. Ver US3, cenário 4.
- **Falha do provedor Google / cancelamento do consentimento**: retorno seguro ao login com
  mensagem neutra; e-mail/senha permanece disponível. Ver US2, cenários 2 e 3.
- **E-mail não confirmado** (contas de **e-mail/senha**): o login é recusado com orientação
  genérica para concluir a confirmação, oferecendo **reenviar** o e-mail de confirmação; o detalhe
  do fluxo de confirmação pertence à spec de cadastro. Contas autenticadas via **Google** chegam
  já verificadas pelo provedor e não exigem confirmação adicional. Ver FR-024.
- **Perda de conexão durante o login**: a tentativa não autentica parcialmente; o sistema informa
  falha de conexão e permite nova tentativa sem deixar a sessão em estado inconsistente.
- **Conta desativada/bloqueada administrativamente**: o login é recusado com mensagem genérica,
  sem revelar o estado interno da conta.
- **Acesso à tela de login sem rede/JS limitado**: a tela de login é parte do painel autenticado
  (não da rota pública de resgate); não há requisito de funcionamento offline, mas a tela deve
  degradar de forma compreensível (mensagem de erro amigável) em conexões instáveis.
- **Invariante Rescue-First**: nenhum caminho desta feature pode introduzir dependência de login
  na rota pública de resgate ou na resolução do QR (ver FR-018 / SC-008).

## Requirements *(mandatory)*

### Functional Requirements

**Autenticação e métodos**

- **FR-001**: O sistema DEVE permitir que um usuário (Tutor ou Admin) se autentique informando
  e-mail e senha por meio de uma única porta de login.
- **FR-002**: O sistema DEVE permitir que um usuário se autentique usando login social com Google.
- **FR-003**: O sistema DEVE recusar o acesso quando as credenciais não forem válidas e conceder
  acesso somente quando forem válidas.
- **FR-004**: O sistema DEVE validar o formato dos dados de entrada (ex.: e-mail bem formado,
  senha não vazia) antes de processar a tentativa, sem revelar regras internas de senha.
- **FR-024**: O sistema DEVE recusar o login de contas de **e-mail/senha** cujo e-mail ainda não
  foi confirmado, exibindo orientação genérica e oferecendo **reenviar** a confirmação. Contas
  autenticadas via **Google** chegam com e-mail já verificado pelo provedor e NÃO exigem
  confirmação adicional. (O fluxo de confirmação em si pertence à spec de cadastro.)

**Roteamento por papel**

- **FR-005**: Após autenticação bem-sucedida, o sistema DEVE identificar o **Papel** do usuário
  (Tutor ou Admin) e direcioná-lo ao destino correspondente (painel do Tutor ou backoffice do
  Admin).
- **FR-006**: O sistema DEVE garantir que um Tutor não seja direcionado ao backoffice do Admin e
  que um Admin não seja restringido ao painel do Tutor por engano de roteamento.

**Sessão e persistência**

- **FR-007**: O sistema DEVE oferecer uma opção explícita de "manter conectado" no momento do
  login.
- **FR-008**: Quando "manter conectado" estiver ativo, o sistema DEVE manter a Sessão persistente
  entre reaberturas do navegador, renovando-a automaticamente enquanto válida.
- **FR-009**: Quando "manter conectado" estiver inativo, o sistema DEVE usar uma Sessão de
  duração mais curta, que termina ao fim do período definido ou ao encerrar o contexto do
  navegador.
- **FR-010**: O sistema DEVE permitir que o usuário autenticado **encerre a sessão** (sair),
  invalidando o acesso até nova autenticação.
- **FR-011**: O sistema DEVE redirecionar um usuário **já autenticado** que acesse a tela de login
  diretamente ao destino do seu papel, sem reexibir o formulário.
- **FR-012**: Ao detectar uma Sessão expirada em uma área autenticada, o sistema DEVE encaminhar
  o usuário ao login e, após autenticar, levá-lo ao destino originalmente pretendido.

**Encaminhamento para fluxos fora de escopo**

- **FR-013**: A tela de login DEVE exibir um encaminhamento (link/ação) para o fluxo de
  **cadastro (signup)** e outro para **recuperação de senha** ("esqueci minha senha"). Esses
  destinos pertencem a specs futuras; até existirem, o encaminhamento PODE apontar para um estado
  provisório (ex.: indisponível em breve) sem quebrar a tela de login.

**Mensagens e tratamento de erro**

- **FR-014**: O sistema DEVE exibir mensagens de erro **genéricas** em falhas de autenticação,
  idênticas para "credenciais inválidas" e "conta inexistente", sem revelar qual campo falhou,
  se a conta existe, ou qualquer detalhe técnico interno.
- **FR-015**: O sistema DEVE tratar falhas (provedor social indisponível, perda de conexão, erro
  inesperado) com mensagens amigáveis e fallback, sem deixar a tela ou a sessão em estado
  inconsistente.

**Segurança (requisitos agnósticos de stack — o QUÊ, não o COMO)**

- **FR-016**: O sistema DEVE tratar todas as entradas de credenciais como **dados**, jamais como
  comando/consulta executável, de modo que nenhuma entrada do usuário possa alterar a lógica de
  autenticação no servidor (proteção contra injeção, incluindo SQL injection).
- **FR-017**: O sistema DEVE armazenar o token/credencial de Sessão de forma protegida contra
  roubo por scripts maliciosos (XSS), não o expondo de forma legível a terceiros no cliente;
  o mecanismo concreto fica a cargo do plano técnico.
- **FR-018**: O sistema DEVE limitar tentativas de login por **identidade E por origem (IP)**,
  aplicando bloqueio e/ou backoff progressivo após **5 tentativas falhas dentro de uma janela de
  15 minutos**, de forma a frustrar ataques de força-bruta — sem revelar, nas mensagens, se a
  conta existe. (Parâmetros definidos no clarify de 2026-06-29; a calibragem fina e o mecanismo
  concreto ficam para o plano técnico.)
- **FR-019**: O sistema NÃO DEVE vazar informação sensível (existência de conta, detalhes de
  exceção, segredos, dados pessoais de terceiros) em mensagens, respostas ou comportamento
  observável (incluindo diferenças perceptíveis de tempo de resposta entre conta existente e
  inexistente).
- **FR-020**: O sistema DEVE registrar, em log estruturado e auditável, os eventos sensíveis de
  autenticação — login bem-sucedido, falha de login, bloqueio por excesso de tentativas
  (rate-limit) e logout — de forma a permitir auditoria (Constituição, Princípio VII).
- **FR-021**: O registro de auditoria e o tratamento de dados na autenticação DEVEM observar
  **minimização de dados** (apenas o necessário) e o tratamento adequado de dados pessoais
  (ex.: e-mail do titular), em conformidade com a LGPD (Constituição, Princípio II); dados
  pessoais não devem ser registrados em logs além do estritamente necessário.
- **FR-022**: Toda transmissão de credenciais e de tokens de Sessão DEVE ocorrer por canal
  seguro (transporte criptografado), e a expiração/renovação da Sessão DEVE ser coerente com a
  escolha de "manter conectado".
- **FR-023 (invariante Rescue-First)**: Esta feature NÃO DEVE introduzir qualquer dependência de
  autenticação, sessão ou login na **rota pública de resgate** nem na **resolução do QR Code** —
  estas permanecem acessíveis a usuários anônimos, independentemente de status de assinatura
  (Constituição, Princípio I).

### Key Entities *(include if feature involves data)*

> Sem detalhes de implementação. Alinhadas ao glossário canônico do `CLAUDE.md`; onde um conceito
> não existe explicitamente no glossário, isto é sinalizado.

- **Conta / Usuário**: identidade autenticável no Faro, titular dos dados (LGPD). Pode ser um
  **Tutor** ou um **Admin** (papéis canônicos do glossário). Atributos relevantes ao login:
  identificador de e-mail, credencial de senha (quando aplicável) e vínculo a uma ou mais
  identidades externas (ex.: Google). *(O glossário define os papéis Tutor e Admin, mas não nomeia
  explicitamente a entidade "Conta"/"Usuário"; usa-se aqui de forma descritiva, sem criar nome
  conflitante.)*
- **Papel (Role)**: classificação do usuário que determina o destino pós-login (Tutor → painel
  do tutor; Admin → backoffice). Conceito presente no glossário (Tutor, Admin).
- **Sessão**: vínculo temporário de acesso autenticado entre o usuário e o painel, com estado
  (ativa/expirada/encerrada), duração (curta vs. persistente conforme "manter conectado") e
  renovação automática quando persistente. *(Não consta explicitamente no glossário; é introduzida
  por esta feature de autenticação.)*
- **Identidade externa (Google)**: vínculo entre a Conta do Faro e uma conta de provedor social,
  usado como método de autenticação alternativo. *(Conceito novo desta feature.)*
- **Evento de Auditoria de Autenticação**: registro estruturado de um evento sensível de login
  (sucesso, falha, bloqueio por rate-limit, logout), com carimbo de tempo e contexto mínimo
  necessário para auditoria, respeitando minimização (LGPD). Alinha-se ao requisito de
  **Auditoria** do Princípio VII (o glossário menciona auditoria de eventos sensíveis, sem nomear
  esta entidade específica).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário com credenciais válidas consegue concluir o login por e-mail/senha em
  até **20 segundos** desde a abertura da tela até chegar ao destino do seu papel, em condições
  normais.
- **SC-002**: Pelo menos **95%** dos logins com credenciais válidas são bem-sucedidos na primeira
  tentativa (excluindo erros de digitação do usuário).
- **SC-003**: Em rede móvel típica (ex.: 4G), a tela de login fica interativa em até **3 segundos**
  e a confirmação do login responde (sucesso ou erro) em tempo percebido como imediato pelo
  usuário (resposta visível em até **2 segundos** após a confirmação, descontada a latência do
  provedor externo no caso do Google).
- **SC-004**: **100%** das respostas de falha por "credenciais inválidas" e por "conta
  inexistente" são indistinguíveis entre si em conteúdo, formato e tempo de resposta perceptível
  (anti-enumeração comprovada).
- **SC-005**: O mecanismo de proteção contra força-bruta bloqueia/desacelera tentativas após o
  limite definido, de modo que **nenhum** ataque automatizado consiga exceder o número de
  tentativas permitido por identidade na janela configurada (eficácia verificável por teste).
- **SC-006**: **100%** dos eventos sensíveis de autenticação (login, falha, bloqueio, logout) são
  registrados de forma auditável e recuperável, sem conter dados pessoais além do mínimo
  necessário.
- **SC-007**: Um usuário que escolhe "manter conectado" permanece autenticado ao reabrir o
  navegador dentro do período definido em **100%** dos casos; quem não escolhe é solicitado a
  reautenticar após o fim da sessão curta em **100%** dos casos.
- **SC-008**: A rota pública de resgate e a resolução do QR permanecem **100%** acessíveis a
  usuários anônimos antes e depois desta feature (zero regressão de Rescue-First, verificável por
  teste).
- **SC-009**: O login social com Google conclui com sucesso para contas Google válidas e, em caso
  de cancelamento ou indisponibilidade do provedor, **100%** dos casos retornam o usuário ao
  login com mensagem neutra e sem conceder acesso.

## Assumptions

- **Escopo restrito ao login**: esta spec cobre **apenas** a tela e o fluxo de login. **Cadastro
  (signup)** e **recuperação de senha** ("esqueci minha senha") são **fora de escopo** e serão
  specs separadas; a tela de login apenas **encaminha** (links/ações) para esses fluxos, que
  podem ainda não estar implementados (estado provisório aceitável). Ver "Out of Scope".
- **Métodos de autenticação**: apenas **e-mail+senha** e **Google**. Quaisquer outros provedores
  sociais ou métodos (ex.: link mágico, telefone) estão fora de escopo.
- **Mesma porta para Tutor e Admin**: existe uma única tela de login; o **Papel** do usuário, já
  associado à sua Conta, determina o destino após autenticar. A atribuição de papel não faz parte
  desta feature (assume-se que já está definida na Conta).
- **Existência de contas para teste**: assume-se que contas de Tutor e Admin já podem existir
  (criadas por outro fluxo/seed) para validar o login; a criação delas é do escopo de cadastro/
  backoffice.
- **Vínculo de identidades**: assume-se que, quando a identidade Google corresponder ao e-mail de
  uma Conta existente, o sistema reconhece a mesma Conta (sem duplicar). A política exata de
  vinculação/conflito de identidades, se mais complexa, será detalhada na spec de cadastro.
- **MFA (autenticação multifator)**: **fora de escopo** nesta feature (MVP), porém a arquitetura
  de dados e o plano técnico DEVEM ser desenhados de modo a **não impedir** a adição futura de MFA.
  Ver "Out of Scope".
- **Defaults de rate-limit**: adotados os valores propostos no FR-018 (N=5 / janela de 15 min /
  backoff progressivo) como ponto de partida razoável, sujeitos a ajuste no clarify/plano.
- **Conexão estável presumida**: assume-se que o usuário tem conectividade ao usar o painel; não
  há requisito de login offline (a tela é parte do painel CSR, não da rota pública SSR de resgate).
- **Idioma**: textos de UI em **PT-BR** no MVP (arquitetura pronta para EN/ES).

### Out of Scope (dependências futuras)

- **Cadastro de conta (signup)** — spec separada (família `auth-contas-tutor`). A tela de login
  apenas encaminha para ele.
- **Recuperação de senha / redefinição** ("esqueci minha senha") — spec separada. A tela de login
  apenas encaminha para ele.
- **MFA / verificação em duas etapas** — fase futura; não implementado no MVP, mas a arquitetura
  deve permanecer aberta a ele (ver Clarifications, Sessão 2026-06-29).
- **Gerenciamento de papéis/permissões** (atribuir Tutor/Admin) — assumido como pré-existente.
- **Fluxo de confirmação de e-mail** — pertence ao cadastro; o login apenas trata o caso de
  e-mail não confirmado de forma genérica, recusando o acesso (ver FR-024).

> ✅ **Todas as pendências `[NEEDS CLARIFICATION]` foram resolvidas** no clarify de 2026-06-29
> (ver a seção **Clarifications**). A spec está pronta para o `/speckit.plan`.
