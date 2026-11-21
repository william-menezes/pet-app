# Contrato de integração: `003-tag-qr` com `002-ui-zardui` e `004-conta-tutor`

**Ordem de execução**: `002` → `004` → `003`. Quando a `003` começa, as duas outras já estão em
`develop`. Este arquivo diz o que a `003` usa das duas, o que entrega para a `004`, e o que herdou
de pendência. Conferido em 2026-11-21 contra `specs/002-ui-zardui/contracts/` e
`specs/004-conta-tutor/contracts/`.

> Se o código que você encontrar em `develop` divergir do que está aqui (nome de componente, de
> guard, de rota ou de coluna), **pare e relate**. Não adapte por conta própria.

---

## 1. Rotas desta spec

`src/app/app.routes.ts`. Rotas fixas vêm antes do `UrlMatcher` do código (research §15).

### 1.1 Página pública (SSR)

| Caminho | Tela | Render |
|---|---|---|
| `/<código>` (`UrlMatcher`) | resgate, modo perdido, visão do dono, não ativada, não encontrada | Server |

`/` (página inicial, `002`) e `/legal/*` (`004`) já existem e não são desta spec.

### 1.2 Fluxos (casca `app-flow-shell`, sempre claro, fora do pai `app`)

| Caminho | Tela | Referência | Guards (`canMatch`) | Render |
|---|---|---|---|---|
| `/ativar/:code` | ativação: escolher o pet → PIN → "Tag ativa!" | `V2-ativacao-pet`, `V2-ativacao-pin`, `V2-ativacao-sucesso` | guard da ativação (T042), `phoneConfirmedGuard` | Client |
| `/novo-pet` | novo pet, 2 passos | `V2-novo-pet-dados`, `V2-novo-pet-resgate` | os mesmos do pai `app` | Client |
| `/vincular/:petId` | vincular tag pelo app: código → PIN | `V2-vincular-codigo`, `V2-vincular-pin` | os mesmos do pai `app`, `phoneConfirmedGuard` | Client |

**Render**: em `src/app/app.routes.server.ts` a regra final (`**`) é `RenderMode.Server`. Por isso
esta spec acrescenta, **antes** dela, `ativar/**`, `novo-pet` e `vincular/**` em
`RenderMode.Client`. Sem isso, recarregar `/ativar/<código>` (é o que acontece na volta da
confirmação do e-mail) rodaria o guard no servidor, onde não há sessão, e mandaria o tutor de
volta ao cadastro. As filhas de `app` e de `admin` já são `Client` (`app/**` e `admin/**`, da
`002`). A rota do código troca `:codigo` pelo `UrlMatcher` e continua `Server`.

- Os passos de um fluxo são **estado da tela** (um signal), não endereços. O botão voltar da casca
  volta um passo; no primeiro passo, sai do fluxo.
- `/novo-pet` aceita `?returnUrl=`: a ativação manda para lá quando o tutor escolhe "Cadastrar
  novo pet" e recebe o pet criado de volta (`/ativar/<código>?pet=<id>`).
- "Os mesmos do pai `app`": use exatamente a lista de guards que a `004` deixou na rota `app`
  (hoje `authGuard`; a `004` acrescenta o do aceite dos termos). Não invente guard novo.

### 1.3 App do tutor (filhas de `app`, dentro de `TutorApp`, **antes** do `**`)

| Caminho | Tela | Referência | `data.hub` |
|---|---|---|---|
| `/app` | Painel | `V2-painel` | `true` |
| `/app/pets` | Seus pets | `V2-pets*.dc.html` (claro e escuro) | `true` |
| `/app/pets/:petId` | Página do pet | `V2-pet` | — |
| `/app/pets/:petId/editar` | Editar dados do pet | reutiliza os formulários de `/novo-pet` | — |
| `/app/pets/:petId/visibilidade` | O que estranhos veem | `V2-visibilidade` | — |
| `/app/pets/:petId/modo-perdido` | Ativar modo perdido | `V2-modo-perdido` | — |
| `/app/pets/:petId/tag` | Gerenciar tag | `V2-tag` | — |
| `/app/scans` | Histórico de scans (`?pet=<id>` filtra) | `V2-scans` | `true` |

`/app/conta/**` é da `004`. Os itens de `TUTOR_NAV` da `002` (`/app`, `/app/pets`, `/app/scans`,
`/app/conta`) ficam como estão: esta tabela os confirma.

### 1.4 Admin (filhas de `admin`, dentro de `AdminApp`, antes do `**`)

| Caminho | Tela | Referência |
|---|---|---|
| `/admin` | Lotes | `V2-admin-lotes` |
| `/admin/codigos` | Códigos | `V2-admin-codigos` |
| `/admin/codigos/:code` | Detalhe do código | `V2-admin-codigo` |
| `/admin/fila` | Fila: scans de tags sem vínculo, pedidos de 2ª via e tags travadas | `V2-admin-fila*.dc.html` |
| `/admin/auditoria` | Auditoria | `V2-admin-auditoria*.dc.html` |

Os itens de `ADMIN_NAV` da `002` ficam como estão.

### 1.5 Regra do Princípio VIII para rotas

**Nenhuma rota fixa de um segmento pode ter, depois de normalizada (maiúsculas, sem `-`, `O→0`,
`I→1`, `L→1`), exatamente 9 caracteres do alfabeto do código.** Ela esconderia uma tag que por
acaso tivesse esse código. Segmentos fixos hoje: `app`, `admin`, `auth`, `ativar`, `api`, `legal`,
`dev`, `novo-pet`, `vincular`. O teste de T024 confere essa regra sobre a lista de rotas.

---

## 2. O que a `003` usa da `002`

- **Cascas** em `src/app/shared/shells/`: `app-tutor-shell` (hospedada por `TutorApp`),
  `app-screen-header`, `app-flow-shell`, `app-admin-shell` (hospedada por `AdminApp`),
  `app-public-layout`, `app-public-footer`.
- **Componentes do Faro** em `src/app/shared/components/faro/`: `app-logo`, `app-focinho`,
  `app-brand-panel`, `app-brand-mark`, `app-icon-tile`, `app-info-card`, `app-note`,
  `app-stat-tile`, `app-steps`, `app-pet-hero`, `app-action-card`.
- **Componentes do ZardUI** em `src/app/shared/components/`: `button`, `field`, `input`,
  `textarea`, `checkbox`, `switch`, `badge`, `toggle`, `toggle-group`, `card`, `item`, `empty`,
  `alert`, `sonner`, `alert-dialog`, `spinner`, `skeleton`, `input-otp`.
- **Células do PIN**: `input-otp` no modo **alfanumérico** (`0-9`, `A-Z`). O componente não
  normaliza; a normalização (`O→0`, `I→1`, `L→1`) é de `core/tag-code` e é aplicada pela tela.
- **Tema**: `src/styles.css` e `ThemeService`. O escuro só existe dentro da casca do tutor.
- **Checagens**: `npm run check:ui` e `npm run check:bundle` continuam verdes ao fim de cada fase.

Antes de usar um componente, abra o arquivo dele: a API (seletor, nomes dos `input()`) é a do
código que está no repositório, não a deste documento.

**Página pública**: a regra de ESLint da `002` proíbe `features/public` de importar `core/auth`,
o app autenticado, o tema escuro e qualquer overlay. Essa regra não é afrouxada. Ver §5.

---

## 3. O que a `003` usa da `004`

| O quê | Onde | Uso na `003` |
|---|---|---|
| `public.phone_is_confirmed(uuid) returns boolean` | migration `0015` | `activate_tag` (erro `phone_not_confirmed`) e gatilho de `rescue_profiles` |
| `public.perfis.celular` (E.164; **só contém número confirmado**; pode ser nulo) | migration `0010` | `resolve_tag` monta o link do WhatsApp e o telefone |
| Primeiro nome: `split_part(btrim(perfis.nome), ' ', 1)` | — | `resolve_tag` |
| `?returnUrl=<caminho interno>` em toda tela de `/auth/*`; sobrevive à confirmação do e-mail em outro aparelho | `004`, contrato `frontend-services` | guard da ativação (T042) |
| `phoneConfirmedGuard` | `src/app/core/account/phone-confirmed.guard.ts` | rotas `/ativar/:code` e `/vincular/:petId` |
| `AccountStore.phoneConfirmed` (signal) | `src/app/core/account/account.store.ts` | tela de visibilidade: desabilita "Telefone" e "WhatsApp" |

Regras:

- Sem sessão em `/ativar/<código>`: redirecionar para **`/auth/criar-conta?returnUrl=/ativar/<código>`**.
- Ao receber `phone_not_confirmed` de uma RPC: navegar para **`/auth/celular?returnUrl=<rota atual>`**.
- A `003` **nunca** lê `perfis.celular_pendente` nem `celular_confirmado_em`, e não atualiza
  `perfis` pelo cliente.
- O destino de retorno não autoriza nada: ao chegar, a `003` valida o código de novo.

---

## 4. O que a `003` entrega para a `004`

As duas funções ficam em `0027_funcoes_tag.sql` e são criadas na **Phase 2** (T019A), junto
com as tabelas. Motivo: a exclusão de conta da `004` recusa o pedido (`deletion_hook_missing`)
enquanto existir `tag_assignments` sem a função. Se ela só chegasse na última fase, excluir conta
ficaria quebrado durante todo o desenvolvimento da `003`.

### 4.1 `end_assignments_for_account(p_tutor uuid) returns int`

Só `service_role`. `security definer`, `SET search_path = public, pg_temp`. Na ordem:

1. Para cada vínculo ativo do tutor: encerra com `end_reason = 'account_deleted'`; devolve a tag
   a `available` **mantendo o PIN vigente** (`activation_pin_hash` não muda; decisão do William em
   2026-11-21, constituição v2.1.0): quem receber a tag com o cartão ativa sozinho. Zera tentativas.
   **Tag `blocked` continua `blocked`**: só o vínculo é encerrado.
2. Desliga o modo perdido dos pets do tutor.
3. Em `scan_events` de **todos** os vínculos do tutor (ativos e encerrados): põe `lat`, `lng`,
   `accuracy_m`, `city` e `region` em nulo e `geo_method` em `'none'`. Mantém a linha e a hora.
4. Apaga `pending_activations` e `tag_pin_attempts` do tutor.
5. Fecha `tag_replacement_requests` abertos do tutor com `status = 'cancelled'`.
6. Registra `account_tags_released` na auditoria, com `actor_id` nulo e só a contagem no detalhe.
7. Devolve quantos vínculos encerrou.

Exigências:

- **Idempotente**: a segunda chamada para a mesma conta devolve `0` e não lança erro.
- **Transacional**: roda na transação de quem chama; não faz `COMMIT` nem captura erro para seguir.
- **Não usa `auth.uid()`**.
- **Nunca** altera `tag_codes.code` nem apaga linha de `tag_codes`.

### 4.2 `export_tutor_tag_data(p_tutor uuid) returns jsonb`

Só `service_role`. Devolve, para a exportação de dados da `004`:

```json
{
  "pets": [ { "nome": "...", "especie": "...", "raca": "...", "sexo": "...", "porte": "...",
              "temperamento": "...", "cuidados": "...", "tem_foto": true, "criado_em": "..." } ],
  "perfis_de_resgate": [ { "pet": "...", "campos_visiveis": ["..."], "modo_perdido": false } ],
  "vinculos": [ { "codigo": "7K3M-Q9XA-C", "pet": "...", "inicio": "...", "fim": null, "motivo_fim": null } ],
  "scans": [ { "codigo": "...", "quando": "...", "metodo": "ip", "cidade": "...", "regiao": "...",
               "lat": null, "lng": null, "precisao_m": null } ]
}
```

- Só dados **da própria conta**: pets do tutor, vínculos em que ele é o tutor (atuais e
  encerrados) e scans desses vínculos.
- **Nunca** inclui: `ip_hash`, tokens, hash de PIN, identificador de outro tutor, linhas de
  auditoria.
- Conta sem nada devolve as quatro listas vazias (nunca `null`).

### 4.3 O que acontece com o resto quando a conta é apagada

| Tabela | Coluna | `ON DELETE` | Efeito |
|---|---|---|---|
| `pets` | `tutor_id` | `cascade` | pets e `rescue_profiles` somem |
| `tag_assignments` | `tutor_id`, `pet_id` | `set null` | o histórico da tag sobrevive sem dono |
| `pending_activations` | `tutor_id` | `cascade` | some (já apagado em 4.1) |
| `tag_pin_attempts` | `tutor_id` | `cascade` | some (já apagado em 4.1) |
| `tag_replacement_requests` | `tutor_id`, `pet_id` | `set null` | o pedido fica, fechado, sem dono |
| `scan_events` | não tem coluna de tutor | — | fica sem localização (4.1) |
| `audit_log` | `actor_id` (sem FK) | — | fica o identificador, que não aponta mais para ninguém; `detail` nunca tem nome, e-mail, telefone ou IP |

Fotos: a `004` apaga os arquivos sob `pet-photos/<uid>/`. O bucket e o prefixo são os de `0032`.

### 4.4 Testes de contrato

Em `supabase/tests/account_tags.test.sql` (criado em T019A; só usa tabelas, não depende das RPCs
das fases seguintes):

- Chamar duas vezes: a segunda devolve `0`.
- Depois da chamada: o código continua em `tag_codes`, com `status = 'available'`; não há vínculo
  ativo para ele; o vínculo antigo tem `end_reason = 'account_deleted'`; nenhum scan dos vínculos
  do tutor tem coordenada, cidade ou região.
- Tag bloqueada continua bloqueada.
- `authenticated` e `anon` não executam nenhuma das duas funções.
- `export_tutor_tag_data(A)` não contém nenhum dado do tutor B nem as chaves proibidas.

Em `supabase/tests/rpc_resolve_tag.test.sql` (T036, quando `resolve_tag` já existe): depois de
`end_assignments_for_account`, `resolve_tag` do código responde "não ativada".

**Testes da `004` que usam objetos de mentira.** `supabase/tests/conta_privacidade.test.sql` (da
`004`) cria dentro do teste uma `tag_assignments` e funções de mentira. Ele foi escrito para
funcionar com ou sem os objetos de verdade (cada caso prepara o que precisa dentro de um
`SAVEPOINT`). Se mesmo assim ele quebrar quando as tabelas da `003` existirem, **corrija o arquivo
de teste** seguindo esse mesmo padrão (`DROP … IF EXISTS` e `CREATE` dentro do `SAVEPOINT`, depois
`ROLLBACK TO`), sem mudar o que cada caso verifica, e relate. Não mexa em `delete_account_data`
nem em `export_my_data`.

---

## 5. Pendências que a `002` deixou para esta spec

A `002` achou dois problemas na página pública e os registrou como dívida da `003`
(`specs/002-ui-zardui/research.md` R9 e R15). Os dois tocam a meta de **100 KB** de JavaScript e o
registro de scan.

### 5.1 Scripts embutidos bloqueados pela CSP (R9)

A repetição de eventos (*event replay*) do Angular põe dois `<script>` embutidos no HTML. A CSP do
projeto (`script-src 'self'`) os bloqueia. Hoje `src/app/app.config.ts` tem
`provideClientHydration(withIncrementalHydration(), withEventReplay())`.

**Decisão**: ficar com `provideClientHydration()` puro, sem as duas opções.
`withIncrementalHydration()` também sai porque, segundo a documentação do Angular, ela liga a
repetição de eventos por conta própria; e o projeto não usa `@defer (hydrate …)` em lugar nenhum.
O botão principal da página de resgate é um link e funciona sem JavaScript; não há clique a
repetir. A CSP **não** é afrouxada (nada de `'unsafe-inline'` nem `'unsafe-hashes'`).

**Se, depois disso, o HTML gerado ainda tiver `<script>` executável embutido, PARE e relate**, com
a alternativa: CSP por hash gerada no build (`security.autoCsp` em `angular.json`), que exige
tirar a CSP estática de `vercel.json`. Essa troca é decisão do William. Tarefa T034A.

### 5.2 Autenticação no pacote da página pública (R15)

Hoje `app.routes.ts` importa os guards de forma estática; com isso `core/auth` e o
`@supabase/supabase-js` entram no pacote que a página pública baixa. **Decisão**:

- Em `app.routes.ts`, **todos** os guards (`authGuard`, `adminGuard`, `anonGuard` e os dois da
  `004`: o do aceite dos termos e `phoneConfirmedGuard`) passam a ser carregados sob demanda, por
  um auxiliar único em `src/app/core/routing/lazy-guard.ts`:

  ```ts
  export function lazyCanMatch(load: () => Promise<CanMatchFn>): CanMatchFn {
    return (route, segments) => {
      const injector = inject(EnvironmentInjector);   // capturado antes do await
      return load().then((guard) => {
        const result = runInInjectionContext(injector, () => guard(route, segments));
        return isObservable(result) ? firstValueFrom(result) : result;
      });
    };
  }
  // uso: canMatch: [lazyCanMatch(() => import('./core/auth/auth.guard').then((m) => m.authGuard))]
  ```

  O injetor é capturado de forma síncrona porque, depois do `import()`, não há mais contexto de
  injeção. O comportamento do login não muda; os testes de guard da `001` e da `004` e o e2e de
  login continuam verdes. `app.routes.ts` não pode ter mais nenhum `import` estático de
  `core/auth` nem de `core/account`.
- Se o `check:bundle` ainda acusar `core/auth` ou `@supabase/supabase-js` por outro caminho (um
  provedor em `app.config.ts`, o tratador de erros global), aplique a mesma técnica nesse caminho.
  **Se isso exigir mudar o comportamento do login, PARE e relate.**
- **Visão do dono** (T048): a página pública não importa `core/auth`. O serviço
  `core/tags/owner-probe.service.ts` só roda no navegador, depois da hidratação, e faz isto:
  1. procura uma chave de sessão do Supabase (`sb-…-auth-token`) no **`localStorage` e no
     `sessionStorage`** (a `001` guarda a sessão num ou no outro, conforme "manter conectado");
  2. **se não houver em nenhum dos dois, não importa nada** e chama `POST /api/scan` sem
     `Authorization`;
  3. se houver, importa `core/supabase/supabase.service` **dinamicamente**, lê o token de acesso
     e o manda em `Authorization: Bearer`.

  Antes de escrever, abra `src/app/core/supabase/supabase.service.ts` e
  `src/app/core/auth/session-persistence.ts` e confirme onde a sessão fica e com que chave. **Se
  não for como descrito aqui, PARE e relate**: se a sonda não achar a sessão, o tutor recebe
  e-mail de aviso a cada vez que abre a própria tag.
- `npm run check:bundle` (script da `002`) passa a **reprovar** (e não só avisar) se `core/auth`
  ou `@supabase/supabase-js` forem alcançáveis por import estático a partir do pacote inicial.

Tarefa T034B. Conferência no ambiente de preview: T037A.

---

## 6. Seed compartilhado

`supabase/seed.sql` já existe (`001`) e a `004` o ajusta. **A `003` não reescreve esse arquivo.**

- O script `supabase/scripts/make-seed.ts` escreve **só o trecho entre dois marcadores** no fim
  de `supabase/seed.sql`: `-- >>> 003-tag-qr (gerado; não edite à mão)` e `-- <<< 003-tag-qr`.
  Se os marcadores não existirem, ele os acrescenta no fim do arquivo. Tudo o que está fora deles
  fica byte a byte como estava. Rodar o script duas vezes dá o mesmo arquivo.
- A tutora "Ana" dos documentos e das telas é o **tutor A** do seed
  (`tutor.a@faro.test`, `00000000-0000-0000-0000-000000000001`), que a `004` deixa com termos
  aceitos e celular confirmado. Não renomeie nem recrie o usuário; os testes leem o primeiro nome
  de `perfis.nome`.
- O **tutor B** (`tutor.b@faro.test`, `…0002`) continua sem celular confirmado: é a conta dos
  testes de `phone_not_confirmed`. Não dê pets nem tags a ele no seed.
- A "outra conta" dos testes de troca de dono é criada **pelo próprio teste** (pgTAP: dentro da
  transação; e2e: pela API de admin, com celular confirmado gravado por SQL de serviço).
- O trecho gerado não cria usuário nenhum e não altera `perfis`.
