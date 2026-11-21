# Decisões do pivô — MVP = tag com QR Code

Registro das decisões tomadas em entrevista com o William em 2026-11-21. Complementa o
prompt do pivô (2026-11-17) e a constituição v2.0.0. Onde este arquivo e os artefatos de
design discordarem, **vale este arquivo**; onde ele for omisso, vale o prompt do pivô.

Ainda não propagado para `CLAUDE.md`, `docs/` e agentes. Isso acontece depois que o visual
das telas do MVP for aprovado.

## Escopo

- **MVP = só a tag**: página pública de resgate, ativação com PIN, app do tutor e painel admin.
- As funcionalidades do app de referência (Bramble) viram **roadmap**, não MVP.
- **Fase 2**: carteira de saúde (vacinas, remédios, consultas, documentos) + lembretes.
- Demais blocos do roadmap, sem ordem definida: emergência, família e cuidadores, peso,
  relatório para o veterinário, perfil e plano.
- **Checagem de sintomas por IA**: fica como ideia, sem compromisso, fora do roadmap.
- Itens da referência que não se aplicam a um web app: Face ID, cartão na tela de bloqueio,
  cobrança pela App Store, login com Apple.

## Constituição

- A v2.0.0 está **aprovada como base**.
- O aviso de scan ao tutor é **gratuito para sempre** (Princípio I mantido como escrito).
- Código inexistente e tag bloqueada/anulada mostram **a mesma mensagem** ao visitante; só o
  servidor registra a diferença. Ajustar o Princípio III e o mapa de navegação.
- **PWA**: remover o service worker; manter manifest e ícones. Fecha o `TODO(PWA)`.
- Tema escuro passa a existir no app do tutor (ver Marca); a página pública é sempre clara.

## Marca e visual

- **Ideia central e tagline**: "O caminho de volta para casa." Fecha o `TODO(TAGLINE)`.
- **Cor de marca**: navy `#25337A` (texto de marca, títulos, fundos escuros).
- **Cor de ação**: lima `#84C32E` com texto escuro `#13201E` nos botões principais.
- **Regra de cor**: lima age; tinta (`#13201E`) seleciona; navy é marca e fundo; âmbar só no
  modo perdido; vermelho só em perigo/exclusão.
- **`#3A4FD6` sai de vez**. Links em navy sublinhado. Fecha o `TODO(BRAND_INTERACTIVE_COLOR)`.
- **Âmbar do modo perdido** continua (`#C26A12`; faixa em `#A85A0E` para o texto branco passar
  em contraste).
- **Fonte de títulos**: **Outfit** (600 e 700), no lugar de Poppins. Inter continua no texto.
  Fecha o `TODO(BRAND_TYPE)`.
- **Ícones de terceiros**: botões de WhatsApp e de login com Google usam o ícone oficial da
  empresa, nunca um ícone genérico. O botão do WhatsApp é lima com o ícone em tinta; o do
  Google é branco com contorno e o "G" nas cores originais.
- **Página de resgate**: um botão principal (WhatsApp) e "Enviar onde estou" como link de
  texto. O botão de ligar saiu.
- **Etiquetas de temperamento**: brancas e neutras. Marcas pequenas sobre branco em tinta,
  não em lima.
- **Assinatura visual**: o focinho do logo em escala gigante, sangrando para fora da tela.
- **Do Bramble, trazer**: cor de marca em área grande, foto do pet como protagonista,
  ilustrações de traço nos estados, números e cartões de resumo, mais respiro e hierarquia,
  fluxos passo a passo, boas-vindas com fotos. Não trazer: telas, textos, nome, a linha de
  passaporte e o botão central de IA.
- **Fotografia**: geradas por IA pelo William a partir de descrições escritas pelo Claude.
- **Ilustrações**: conjunto de licença aberta, recolorido para o Faro.
- **Tema escuro**: claro e escuro no app do tutor já no MVP; página de resgate só clara.
- **Responsivo, mobile first**: os clientes também acessam pelo computador. Toda tela é
  desenhada em três larguras: celular (390), tablet (768) e desktop (1440). No celular a
  navegação é a barra inferior; no tablet, um trilho lateral; no desktop, um menu lateral
  com o logo.
- **Logo na tela de login**: o wordmark aparece em todas as larguras.
- **Mascote das telas**: o Paçoca, vira-lata caramelo (foto fornecida pelo William em
  2026-11-21).

### Tokens fechados na revisão do design system (2026-11-21)

- **Escala navy** regenerada a partir de `#25337A` (passo 700): 50 `#EEF0F8`, 100 `#DADFF0`,
  200 `#B8C0E2`, 300 `#8E9ACF`, 400 `#6574B8`, 500 `#44549F`, 600 `#32418C`, 700 `#25337A`,
  800 `#1A2459`, 900 `#0E1336`, 950 `#080B20`. Os nomes `indigo-*` continuam existindo como
  apelidos, para não quebrar o CSS dos componentes.
- **Anel de foco**: tinta `#13201E` com folga branca de 2 px. Lima não serve (2,1:1 no branco).
- **Tema escuro** (base no Noturno): fundo `#0B0F2A`, cartão `#161C4A`, texto `#F3F5FC`,
  texto secundário `#A6ADD0`, links `#B8C0E2`. A seleção inverte: pílula clara com texto escuro.
- **Onde o escuro vale**: só nas telas autenticadas do tutor, desenhado em celular e desktop
  (o tablet herda). Página de resgate, conta, ativação e admin ficam sempre claros.
- **Códigos da tag** são escritos em Outfit, não em monoespaçada.
- Contraste de todos os pares de texto conferido por script nos dois temas (mínimo 4,5:1).

## Telas do MVP v2

87 telas no canvas *Faro · Telas do MVP*, páginas "MVP v2": 25 telas em celular, tablet e
desktop, mais 12 versões escuras do app do tutor. O gerador está em
`design/telas-v2-gerador/` (a pasta `design/` não é versionada).

- **Telas novas, que não existiam**: "Tag não encontrada" (serve também para tag bloqueada ou
  anulada) e "Ativar modo perdido" (recado, tempo desde o sumiço e selo de recompensa).
- **Confirmação do celular**: só SMS; a opção "Enviar pelo WhatsApp" saiu.
- **Admin**: a ação "Bloquear código" diz que quem escanear vê "tag não encontrada"; entrou a
  ação "Trocar código (2ª via)", que estava no mapa de navegação e faltava na tela.
- **Dados de exemplo unificados**: a Mel não tem tag em nenhuma tela; o código `2FX8-CN73-F`
  é "Disponível". Com isso saiu da tela de ativação o aviso "Escolher troca a tag atual da
  Mel". Esse estado (pet que já tem tag) precisa voltar na spec 003.

## Página de resgate

- Foto grande do pet como capa.
- Texto na voz do pet, em primeira pessoa.
- Uma linha de confiança para quem achou (o que é o Faro, que é seguro).
- Modo perdido bem diferente do normal. Itens opcionais, ligados pelo tutor: há quanto tempo
  sumiu, selo de recompensa (sem valor), recado do tutor. "Onde foi visto por último" **não**
  entra.

## Produto e técnica

- **Confirmação do telefone**: por SMS.
- **Specs**: `001-login` continua; `002` = migração PrimeNG → ZardUI; `003` = tag com QR.
- **Agentes**: manter e reescrever `backend-supabase`, `qa-engineer` e `frontend-angular`;
  remover `product-owner`, `tech-lead-planner` e `ui-ux-designer` com suas memórias.
- **impeccable**: gerar `PRODUCT.md` e `DESIGN.md` a partir do design system aprovado.

## Ordem de trabalho

1. Atualizar o design system e redesenhar as telas do MVP numa página nova **"MVP v2"** do
   canvas, mantendo as atuais para comparação. **Feito em 2026-11-21.**
2. `CLAUDE.md`, `DESIGN.md`, `PRODUCT.md`, agentes e specs. **Feito em 2026-11-21** (ver abaixo).
3. Implementação, por agente Sonnet, **só depois da aprovação do William**.

## Specs do MVP (2026-11-21)

- **Três specs novas**, e não duas: `002-ui-zardui`, `003-tag-qr` e `004-conta-tutor`. A 004
  nasceu porque o login (`001`) não cobre cadastro, confirmação do celular, recuperação de senha
  nem a tela de conta, e o MVP precisa disso.
- **Ordem de execução**: 002 → 004 → 003. O backend da 003 pode andar em paralelo com a 002.
- **Quem implementa**: subagentes `backend-supabase`, `frontend-angular` e `qa-engineer`, em Sonnet.
- **CLI do ZardUI**: é a `zard-cli` (1.12.0, estável), não a `@ngzard/ui` (beta) citada antes.

### Decisões técnicas tomadas na spec 003 (para revisão do William)

Estão em `specs/003-tag-qr/checklists/requirements.md`, itens REV001 a REV013. As principais:

- O scan é registrado quando a página abre num navegador, e não no carregamento pelo servidor.
  Evita aviso falso quando alguém cola o endereço numa conversa; quem fecha a página rápido
  demais pode não gerar aviso.
- Limites do PIN: 5 erros em 15 minutos por conta e tag; 20 erros em 24 horas por tag.
- Hash do PIN em bcrypt com custo 12 (o padrão do banco é 6, fraco para um PIN de 6 caracteres).
- Segunda via por perda anula o código antigo na hora.
- Foto do pet em armazenamento privado, com endereço temporário.
- Sem tabela de direitos de vínculo por enquanto: só a função `can_link_tag`, que sempre permite.
- A página pública não fala direto com o banco: passa pelo servidor do app, que usa uma chave.
- Geolocalização aproximada vem dos cabeçalhos da Vercel, sem contratar provedor.
- Na ativação, a opção de liberar o WhatsApp começa **marcada**, com aviso ao lado (mudado pelo
  William em 2026-11-21; a proposta inicial era começar desmarcada).
- Novo pet e vincular tag ficam em `/novo-pet` e `/vincular/<pet>`, fora de `/app`.
- Ao excluir a conta, a localização dos scans daquele tutor é apagada e a tag volta a "não
  ativada" **com o mesmo PIN do cartão** (mudado pelo William em 2026-11-21; a proposta inicial
  gerava um PIN que ninguém recebia).

### Decisões tomadas nas specs 002 e 004 (para revisão do William)

- **002**: tema padrão do app do tutor é "sistema" (segue o aparelho até o tutor escolher); ícone
  do app é o focinho lima sobre navy; a página inicial `/` fica provisória (painel de marca,
  tagline e "Entrar"); o CSS crítico embutido é desligado em produção, porque a política de
  segurança do site o bloqueava e as telas sairiam sem estilo.
- **004**: entra a etapa "Confirme seu e-mail" entre "Criar conta" e "Confirmar celular"; a tela
  de informar celular tem a saída "Agora não"; **confirmar o celular não bloqueia o app**, só a
  ativação da tag e a exibição do telefone na página pública.
- **004, telas sem desenho de referência**: confirmar e-mail, aceite dos termos (conta Google),
  informar celular, estados de erro da confirmação, recuperar senha, toda a seção "Conta" e as
  páginas de Termos e Privacidade.
- Pendências novas: `TODO(LEGAL_TEXTS)` (textos dos Termos e da Política de privacidade),
  `TODO(CAPTCHA)` (proteção contra automação no cadastro; recomendado ligar antes de abrir),
  `TODO(RETENCAO)` (prazo de guarda da auditoria e dos scans).

### Conferência entre as três specs (2026-11-21)

As specs 002 e 004 foram escritas por subagentes e a 003 pela sessão principal. A conferência
cruzada achou e corrigiu, na 003:

- **Seed**: a 003 reescrevia `supabase/seed.sql` e apagaria os usuários de teste de que a 004
  depende. Agora ela só acrescenta um trecho marcado.
- **Exclusão de conta**: a função que a 004 chama para encerrar os vínculos só seria criada na
  última fase da 003; nesse intervalo excluir conta ficaria quebrado. Foi para a fase de fundação
  (T019A), junto com a função de exportação dos dados de tags e pets, que a 003 não previa.
- **Rotas**: a 003 não fixava os endereços das telas do app e do admin. Há agora uma tabela
  única, compatível com a navegação da 002 e com as rotas da 004.
- **Página pública**: dois achados da 002 (scripts embutidos bloqueados pela política de segurança
  e a biblioteca de autenticação dentro do pacote da página de resgate) viraram tarefas da 003
  (T034A e T034B), com uma conferência no ambiente de preview (T037A).

Tudo isso está em `specs/003-tag-qr/contracts/integration-002-004.contract.md`. Totais: 70
tarefas na 002, 96 na 004 e 105 na 003.

## Decisões do William na retomada (2026-11-21)

- **Confirmadas** as decisões das três specs (REV001 a REV013 da 003 e as da 002 e da 004), com
  duas mudanças:
  - **WhatsApp na ativação começa marcado.** A tela do PIN mostra, junto da opção, o aviso de que
    o número ficará disponível para quem escanear a tag e de onde desligar. A tela "Tag ativa"
    repete se ficou ligado. No servidor o padrão continua "desligado": a tela envia a escolha de
    forma explícita.
  - **Excluir a conta não troca o PIN.** A tag volta a "não ativada" com o PIN do cartão, e quem
    receber a tag com o cartão ativa sozinho. A mesma regra passa a valer quando o tutor troca a
    tag de um pet durante uma ativação (a tag antiga fica disponível com o PIN que já tinha).
    PIN novo só é gerado quando há alguém na tela para recebê-lo: passar adiante, desvincular e
    as ações do admin. **Risco aceito**: o antigo dono continua conhecendo um PIN válido até a
    próxima ativação. A mudança exigiu emendar a constituição para a **v2.1.0** (Princípio III).
- **Logo em Outfit entregue.** Três arquivos em `public/logos/`, com os mesmos nomes de antes:
  `logo-full-light.svg` (letras navy, focinho lima, para fundo claro), `logo-full-dark.svg`
  (letras brancas, focinho lima, para fundo navy ou escuro) e `logo-full-light2.svg` (letras
  brancas, focinho navy, para fundo lima). O focinho (`logo-compact.svg`) não mudou.
- **Gerador de tags e lote-001 entregues.** `tools/tag-generator/gerar_tags.py` entrou no
  repositório sem nenhuma alteração. A regra do dígito verificador foi conferida: os 54 códigos do
  lote são válidos, e o exemplo das telas (`7K3M-Q9XA-C`) também.
- **O repositório do GitHub é público.** Por isso `lote.csv` (PINs), a lista de códigos e a folha
  de etiquetas ficam em `tools/tag-generator/lote-001/`, **fora do git**. Com a lista de códigos
  pública, qualquer pessoa poderia gastar o limite de erros de PIN de cada tag. O teste cruzado
  versionado usa vetores sintéticos; o teste com os 54 códigos reais roda só onde o arquivo existe.
- **E-mail e SMS**: serão contratados numa conta Google, **ainda não ativados**. Até lá:
  desenvolvimento e homologação usam o envio simulado (código de SMS fixo; e-mails na caixa local
  do Supabase), e **produção não abre**, porque ativar uma tag exige celular confirmado. O aviso
  de scan continua aparecendo no histórico do app mesmo sem e-mail. Ponto a conferir na ativação:
  a verificação de telefone do Google gera e confere o código do lado dela, o que pode pedir um
  ajuste no contrato da 004 (`specs/004-conta-tutor/research.md`, `TODO(SMS_PROVIDER)`).
- **Termos e Política de privacidade**: o William envia depois. `TODO(LEGAL_TEXTS)` continua.
- **Proteção contra ataque e automação: adotar tudo.** `TODO(CAPTCHA)` deixa de ser pergunta. O
  desenho está em dois contratos (`specs/004-conta-tutor/contracts/security-hardening.contract.md`
  e o equivalente da 003), com 12 tarefas novas na 004 e 7 na 003. Em resumo:
  - desafio anti-robô (Cloudflare Turnstile) em entrar, criar conta, reenviar confirmação,
    recuperar senha e nas confirmações de identidade; **nunca** na página da tag;
  - limites de taxa onde faltavam: chamadas ao guarda de login, confirmação do código SMS,
    exclusão de conta, recuperação, ativação, operações do tutor, registro de scan, admin; e tetos
    globais para o caso de a chave do servidor vazar;
  - cabeçalhos: HSTS, política própria e mais estrita para a página da tag, câmera liberada só
    onde o QR é lido;
  - banco: função nova só é chamável com permissão explícita, e um teste que varre o catálogo
    reprova tabela sem RLS;
  - repositório: varredura de segredos com gancho de commit, auditoria de dependências e CI no
    GitHub, que passa a ser o lugar onde os testes de banco rodam;
  - o que depende de painel está em `docs/seguranca-producao.md`.
  **Não incluído, por ser funcionalidade nova**: segundo fator para o admin (recomendado).
- **Telas que faltavam: desenhadas.** 31 telas novas, cada uma em celular, tablet e desktop (as do
  app também no tema escuro), num total de 93 arquivos em `design/telas-v2/`:
  - conta e acesso (004): confirme seu e-mail, confirmação pelo link, link inválido, aceite dos
    termos, informar celular, trocar celular, três estados de erro da confirmação do celular,
    esqueci a senha, link enviado, nova senha, link de recuperação inválido;
  - seção Conta (004): lista, dados pessoais, celular (confirmado e não confirmado), senha,
    aparência, privacidade e o diálogo de exclusão;
  - tag (003): "Seus pets", fila do admin e auditoria do admin;
  - página de Termos e Política (modelo; o texto final é `TODO(LEGAL_TEXTS)`).
  As duas telas do PIN foram redesenhadas com a opção do WhatsApp marcada e o aviso. O logo novo
  entrou em todas as telas. **As 180 telas foram renderizadas em navegador**: todas cabem na altura
  e na largura declaradas, e uma amostra foi conferida por captura.
- **Um código real estava nas telas.** Um código do lote-001 (o último da folha) aparecia como exemplo na tela de
  códigos do admin e em dois documentos da 003, e foi publicado no GitHub no merge de 2026-11-21.
  Foi trocado por um código sintético. O código continua no histórico do git: sem o PIN ele não
  ativa nada, mas vale tratar essa tag como de teste, ou reescrever o histórico se preferir.
- **Implementação liberada**, pelos subagentes em Sonnet, começando pela 002. A sessão principal
  não implementa: planeja, confere cada checkpoint e resolve o que for ambíguo.

## Em aberto

- **Design system, partes ainda antigas**: componentes de saúde, `PlanTier`, o kit de telas,
  a capa e os cartões de marca. O CSS dos componentes ainda não tem estilos do tema escuro.
- **Telas**: renderizadas e medidas em 2026-11-21; falta a revisão do William tela a tela.

- `TODO(BILLING_MODEL)`: assinatura vs. tag comprada.
- `TODO(EMAIL_PROVIDER)` e `TODO(SMS_PROVIDER)`: conta Google, ainda não ativada; produto de SMS
  a confirmar. **Bloqueiam produção.**
- `TODO(LEGAL_TEXTS)`: o William envia. `TODO(RETENCAO)`: prazo de guarda de scans e auditoria.
- **Ambiente de backend**: nesta máquina não há Docker nem a CLI do Supabase, e o conector do
  Supabase não está autorizado. Sem um deles, as tarefas de banco da 004 e da 003 não têm como
  ser verificadas ("Feito quando" exige rodar os testes do banco).
- **Repositório público**: avaliar torná-lo privado antes de o produto abrir.
- `TODO(PIN_LENGTH)`: PIN de 8 caracteres em lotes futuros.
- **`tools/tag-generator/`**: faltam a fonte `JetBrainsMono-Bold.ttf` usada na impressão e a
  máscara do QR de cada código do lote-001 (o `lote.csv` não traz). Sem isso fica bloqueada só a
  etiqueta gerada pelo sistema (reimpressão idêntica); o resto segue.
- **Página de contingência em `tagfaro.com.br`** precisa estar no ar antes de qualquer tag sair.
- A conversa compartilhada (`claude.ai/share/...`) não pôde ser lida; decisões que só
  existam nela não estão aqui.
- Compatibilidade do ZardUI com Angular 21: primeira tarefa da spec 002, com parada se falhar.
- Documentos antigos em `docs/` receberam aviso de desatualizado; `docs/primeng.md` (2,4 MB) é
  candidato a remoção depois da spec 002.
