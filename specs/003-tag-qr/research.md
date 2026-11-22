# Research: Tag com QR Code

Decisões técnicas, com motivo e alternativas. Onde há risco de segurança, o risco residual e a
opção mais rígida estão explícitos.

## 1. Uma só implementação do código da tag

**Decisão**: o módulo vive em `src/app/core/tag-code/tag-code.ts`, sem dependência de Angular nem
de Node. As Edge Functions usam a mesma fonte por cópia verificada: `supabase/functions/_shared/tag-code.ts`
é um arquivo idêntico, e um teste (`tag-code.sync.spec.ts`) falha se os dois diferirem em um byte.
No Postgres, as funções `tag_normalize(text)` e `tag_is_valid(text)` reimplementam a mesma regra em
plpgsql e são testadas com as mesmas fixtures.

**Motivo**: Deno e o build do Angular não compartilham resolução de módulos sem configuração extra;
uma cópia travada por teste é mais simples do que um pacote interno.

**Alternativas**: pacote npm interno (peso de configuração); importar por caminho relativo a partir
de `supabase/functions` (quebra o deploy das funções, que empacota só a pasta da função).

**Fixtures** (decisão de 2026-11-21): o repositório do GitHub é **público**, e a lista dos códigos
reais deixaria qualquer pessoa gastar o limite de 20 erros de PIN em 24 h de cada tag. Por isso:
- `src/app/core/tag-code/fixtures/tag-code.vectors.json` (versionado): vetores **sintéticos**,
  gerados com a regra confirmada no §2. A origem é `contracts/tag-code.vectors.json`. Nenhum é
  código real.
- `tools/tag-generator/lote-001/codes.txt` (**fora do git**): os 54 códigos reais, um por linha,
  sem PINs. O teste do lote-001 roda quando o arquivo existe e é **pulado com aviso** quando não
  existe.
PINs nunca entram em fixture, seed, spec ou mensagem de commit.

## 2. Luhn mod 32 sobre Crockford Base32

**Decisão (confirmada em 2026-11-21)**: Luhn mod N com N = 32, usando o índice de cada caractere
no alfabeto `0123456789ABCDEFGHJKMNPQRSTVWXYZ`. A variante é a de `luhn_mod_n_check` em
`tools/tag-generator/gerar_tags.py`:

1. percorre o corpo de 8 caracteres **da direita para a esquerda**;
2. o fator começa em **2** no caractere mais à direita e alterna 2, 1, 2, 1…;
3. para cada caractere, `addend = fator × índice`; soma-se `floor(addend / 32) + addend mod 32`;
4. o dígito é `ALFABETO[(32 − total mod 32) mod 32]`.

**Como foi confirmada**: um porte literal dessa função validou os 54 códigos do lote-001 (54 de
54), recusou as 279 trocas de um caractere do primeiro código e confirmou que o exemplo das telas,
`7K3M-Q9XA-C`, é **válido** (o dígito de `7K3MQ9XA` é `C`). A URL de cada código tem 32
caracteres, dentro da capacidade alfanumérica do QR versão 3 com correção H (35).

Consequências, que valem como regra:
- TypeScript e SQL implementam exatamente os quatro passos acima.
- Os outros códigos que aparecem em telas e textos podem não ser válidos. Em teste e em seed,
  usam-se os vetores de `contracts/tag-code.vectors.json` e os códigos gerados em T020.
- **Nada que gere ou valide códigos reais vai para produção antes de T011 passar.**
- Se um teste cruzado divergir, corrige-se o TypeScript e o SQL. Nunca o lote.

## 3. Custo do hash do PIN

**Decisão**: `crypt(pin, gen_salt('bf', 12))`. O padrão do `pgcrypto` (`gen_salt('bf')` = custo 6)
não é usado.

**Motivo**: o PIN tem 6 caracteres Crockford (32^6 ≈ 1,07 bilhão, 30 bits). O ataque que importa é
offline, com o banco vazado. Os números a seguir são estimativas de ordem de grandeza, não medidas:
com custo 6, uma GPU testa dezenas de milhares de PINs por segundo e esgota o espaço de uma tag em
horas; com custo 12 são centenas por segundo, o que leva semanas por tag. A verificação online fica
na casa de décimos de segundo, aceitável numa ativação. A tarefa de backend mede o tempo real.

**Risco residual**: semanas por tag não é "inviável". O que protege de fato é o banco não vazar e o
PIN valer uma vez só (tags já ativadas não têm PIN útil).

**Opção mais rígida, não adotada**: PIN de 8 caracteres (40 bits). Mudaria o cartão já impresso do
lote-001, então fica registrado para lotes futuros: `TODO(PIN_LENGTH)` para decisão do William.

## 4. Limites de tentativa de PIN

**Decisão**: duas camadas, ambas no banco, dentro de `activate_tag`.
- `tag_pin_attempts(tag_code, tutor_id)`: 5 erros em 15 min travam aquela conta naquela tag por 15 min.
- `tag_codes.pin_fail_count_24h` e `pin_locked_until`: 20 erros em 24 h travam a tag por 24 h e
  gravam um evento de auditoria que aparece na fila do admin.

**Motivo**: travar só por tag permitiria a qualquer pessoa com uma foto da tag impedir o dono de
ativar. Travar só por conta permitiria força bruta com muitas contas.

**Alternativa**: CAPTCHA no PIN. Rejeitado, e a decisão foi mantida em 2026-11-21 (`contracts/security-hardening.contract.md` §4): o desafio entra no cadastro e na entrada, não aqui. Motivo original: atrito para o tutor legítimo e mais uma dependência.

## 5. Como a página pública obtém os dados

**Decisão**: o servidor SSR (Express em `src/server.ts`, rodando na Vercel) chama a Edge Function
`resolve-tag` com o cabeçalho `x-faro-ssr-key`. A função valida a chave, normaliza e valida o código,
aplica o limite por `ip_hash`, chama a RPC `resolve_tag` com a role de serviço, gera a URL assinada
da foto e devolve a projeção. O resultado vai para o `TransferState`; o navegador não repete a chamada.

**Motivo**: ver Complexity Tracking do plano. Também mantém a chave de serviço fora da Vercel: lá
ficam só `FARO_SSR_KEY` e `IP_HASH_SECRET`.

**Falha**: tempo limite de 2,5 s. Em erro ou estouro, a rota renderiza a página de contingência com
status 200 e `Cache-Control: no-store`.

## 6. Registro de scan

**Decisão**: depois de hidratar, a página de resgate faz `POST /api/scan` (mesma origem). A rota
Express lê o IP e os cabeçalhos de geolocalização da Vercel (`x-vercel-ip-city`,
`x-vercel-ip-country-region`, `x-vercel-ip-latitude`, `x-vercel-ip-longitude`), calcula o `ip_hash`
e chama `register-scan`. Se o navegador tiver sessão, envia o token; a função descobre se é o dono e,
nesse caso, não grava nada e responde `owner: true`, o que faz a página trocar para a visão do dono.

**Motivo**: geolocalização por IP sem contratar provedor e sem chave. Robôs não executam o `POST`.

**Risco**: quem fechar a página antes da hidratação não gera scan. Aceito: o caminho de contato
(WhatsApp) não depende disso. **Opção mais rígida**: gravar também no SSR e deduplicar; rejeitada
porque reintroduz os avisos por pré-visualização de link.

**Fora da Vercel** (desenvolvimento local): sem os cabeçalhos, o scan é gravado com método `none`.

**Deduplicação**: mesmo `tag_code` + `ip_hash` em 10 minutos atualiza o scan existente.

**Localização precisa**: `POST /api/scan/location` com `scan_token` (devolvido pelo primeiro POST),
latitude, longitude e precisão. O token é aleatório, vale 30 minutos e só atualiza aquele scan.

## 7. Aviso por e-mail

**Decisão**: `register-scan` envia o e-mail na própria execução, depois de gravar o scan, e grava
`notified_at`. Se o envio falhar, `notified_at` fica nulo e um job `pg_cron` a cada 5 minutos chama a
função em modo de reenvio para scans das últimas 24 h sem aviso (no máximo 3 tentativas).

**Provedor**: `TODO(EMAIL_PROVIDER)`. A função fala com uma interface `sendEmail(to, subject, html)`;
a implementação inicial usa a API HTTP do provedor escolhido. Critérios: entrega no Brasil, domínio
próprio (`tagfaro.com.br`) com SPF/DKIM, custo por mensagem.

**Conteúdo**: nome do pet, hora, cidade aproximada (ou "localização enviada por quem achou"), link
para o histórico. Sem dados de quem escaneou.

## 8. Ativação pendente

**Decisão**: tabela `pending_activations (tutor_id PK, tag_code, created_at, expires_at)`.
- Visitante toca em "Ativar minha tag": vai para `/ativar/<código>`. Sem sessão, o guard manda para
  `/auth/criar-conta?returnUrl=/ativar/<código>` (`004`).
- Ao chegar autenticado em `/ativar/<código>`, o app chama `set_pending_activation(code)`.
- Para o caso de confirmar o e-mail em outro aparelho: o cadastro de `004` guarda o destino de
  retorno nos metadados do usuário; no primeiro login, se o destino for `/ativar/<código>`, o app
  navega para lá. **Dependência de `004`**: o destino de retorno precisa sobreviver à confirmação
  de e-mail feita em outro aparelho.
- O painel chama `get_pending_activation()` e mostra o cartão "Você tem uma tag para ativar".

## 9. Leitura do QR pela câmera

**Decisão**: `BarcodeDetector` quando existir; senão `jsQR` importado dinamicamente sobre quadros de
um `<video>`. A aba "Digitar código" é sempre a alternativa e é a padrão quando a câmera falha.

**Motivo**: iOS Safari não tem `BarcodeDetector`. Carregar sob demanda mantém o bundle inicial pequeno.

## 10. Mapa do histórico

**Decisão**: Leaflet + OpenStreetMap, carregados sob demanda só na tela de scans. A área aproximada
é um círculo; a precisa, um pino com o raio de erro. Decisão herdada dos docs anteriores e mantida.

**CSP**: liberar `img-src` para os tiles do OSM só nessa rota.

## 11. Renderização da etiqueta

**Decisão**: Edge Function `admin-labels` gera SVG por etiqueta e PDF A4 (6 colunas, 54 por folha)
com `pdf-lib`. O QR é montado com versão 3, correção H e a máscara gravada em `qr_mask`. O texto do
código entra como contornos (curvas), a partir da fonte JetBrains Mono Bold lida com `opentype.js`.

**Máscara**: ao criar um lote **novo**, a função calcula a máscara pela regra de penalidade do
padrão QR (a mesma que o `segno` usa) e grava. **Para o lote-001 o porte não escolhe a máscara**:
o `lote.csv` não a traz, e duas implementações podem desempatar de forma diferente. A máscara de
cada código do lote-001 é **lida do que foi impresso** (os bits de formato do QR de cada etiqueta,
ou `qr.mask` rodando o script de referência) e gravada na importação. O teste cruzado compara
matriz e máscara com as do lote-001.

**O que o script fixa e os documentos não diziam** (vale o script):
- módulos do QR e texto do código em `#0E1336` (navy 900), não no navy de marca `#25337A`;
- o script aceita até a versão 6 e aborta acima disso; com o domínio fixo a URL tem 32 caracteres,
  o que dá sempre **versão 3** com correção H. O sistema grava e exige 3;
- pontos com 0,86 do módulo, olhos arredondados, logo de 8 módulos com folga de 0,6 módulo;
- texto em JetBrains Mono Bold convertido em curvas; etiqueta de 21,6 mm (rebaixo de 22 mm menos
  0,4 mm de folga), topo reto a 8,7 mm do centro; 54 etiquetas por folha A4, em 6 colunas.

**Idêntico ao script**: o critério de teste é (a) matriz de módulos e máscara iguais, (b) geometria
do SVG igual com tolerância de 0,01 mm, (c) leitura do PDF impresso em escala 100%.

**Bloqueio restante** (o script chegou em 2026-11-21): faltam o arquivo da fonte
`JetBrainsMono-Bold.ttf` usado na impressão e as máscaras do lote-001. Nesta máquina não há Python
instalado, então o script não foi executado. **Contingência**: até o porte existir, o admin exporta
a lista de códigos do lote e roda o script local.

## 12. Importação do lote-001

**Decisão**: procedimento manual, único, fora das migrations, descrito em `docs/importar-lote-001.md`:
CSV para tabela temporária → `insert … select crypt(activation_pin, gen_salt('bf', 12))` com
`qr_version = 3` e a máscara **lida das etiquetas impressas** (ver §11) → `drop` da temporária → conferência de 54 linhas →
apagar o CSV da máquina. `lote.csv` e `lote-*/` entram no `.gitignore`.

## 13. Regra de direito a vínculo

**Decisão**: `can_link_tag(p_tutor uuid) returns boolean` que retorna `true`, com comentário
apontando `TODO(BILLING_MODEL)`. Chamada só em `activate_tag`. Sem tabela.

## 14. Foto do pet

**Decisão**: upload pelo app autenticado para `pet-photos/<tutor_id>/<pet_id>/<uuid>.webp`, depois
de redimensionar no navegador para no máximo 1600 px e converter para WebP. Políticas de Storage:
o tutor lê e grava só na sua pasta. A página pública recebe URL assinada de 1 hora.

## 15. Rotas

**Decisão**: rotas fixas (`/app`, `/admin`, `/auth`, `/ativar`, `/novo-pet`, `/vincular`, `/legal`,
`/api`) vêm antes (tabela completa em `contracts/integration-002-004.contract.md` §1); `/:code` usa um
`UrlMatcher` que só casa quando o segmento, normalizado, tem 9 caracteres do alfabeto. Qualquer
outro caminho de um segmento cai na página "não encontrada" do app. A rota antiga
`/:codigo/perdido` é removida: modo perdido é estado, não endereço.

## Pendências registradas

- `TODO(EMAIL_PROVIDER)`: provedor de e-mail transacional.
- `TODO(PIN_LENGTH)`: PIN de 8 caracteres em lotes futuros.
- `TODO(BILLING_MODEL)`: herdado.
- Retenção de `scan_events` e `audit_log` (LGPD): sem janela definida.
- `tools/tag-generator/`: script entregue em 2026-11-21. Faltam a fonte `JetBrainsMono-Bold.ttf`
  e as máscaras do lote-001 (ou um ambiente Python para extraí-las).
- `TODO(EMAIL_PROVIDER)`: será uma conta Google, ainda não ativada (ver `docs/decisoes-pivo.md`).
- Página de contingência em `tagfaro.com.br` antes de qualquer tag sair: tarefa operacional.
