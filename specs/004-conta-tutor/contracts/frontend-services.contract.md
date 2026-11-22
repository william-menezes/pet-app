# Contrato: frontend (rotas, guards, serviços, telas, textos)

Camadas: serviços e guards em `src/app/core/auth/` e `src/app/core/account/`; telas em
`src/app/features/auth/`, `src/app/features/account/` e `src/app/features/legal/`.
**Nenhuma tela chama o Supabase direto** nem lê `localStorage`/`sessionStorage`: só os serviços de
`core/` fazem isso (regra de lint da `001`).

UI: ZardUI + Tailwind v4, componentes e cascas da `002`. **Nunca PrimeNG.** Textos em PT-BR por
`i18n`/`$localize`. Sem emoji. Um botão principal por tela. Três larguras: base, `md`, `xl`.

---

## 0. O que vem da `002-ui-zardui` (usar, não recriar)

Fonte: `specs/002-ui-zardui/contracts/{shells,shared-components,design-tokens}.contract.md`
(lidos em 2026-11-21). `@/` aponta para `src/app/`. A API exata de cada componente ZardUI é a do
código copiado em `src/app/shared/components/<nome>/`: ler antes de usar.

| Papel nesta spec | Da `002` | Importar de |
|---|---|---|
| Casca de fluxo | `app-flow-shell` (`barTitle`, `back`, `backLink`, `backClick`, `step`, `headline: string[]`, `sub`; projeção padrão + `[footer]`) | `@/shared/shells/flow-shell/flow-shell` |
| Casca do app | `app-tutor-shell`, hospedada por `TutorApp` (`features/pets/tutor-app/tutor-app.ts`); item "Conta" → `/app/conta` em `TUTOR_NAV` | já montada pela rota `app` |
| Cabeçalho de tela interna | `app-screen-header` (`title`, `back`, `backLink`) | `@/shared/shells/screen-header/screen-header` |
| Tela-raiz com barra inferior | `data: { hub: true }` na rota | — |
| Tema | `ThemeService` (`preference()`, `resolved()`, `setPreference('light' \| 'dark' \| 'system')`) | `@/core/theme/theme.service` |
| Botão | `z-button` (`zType`: `default`, `outline`, `ghost`, `destructive`, `link`; `zSize`: `lg` na ação principal) | `@/shared/components/button` |
| Campo | `z-field` + `input[z-input]` | `@/shared/components/field`, `…/input` |
| Caixa de seleção | `z-checkbox` | `@/shared/components/checkbox` |
| Células do código | `input-otp` em modo **numérico** (6 posições) | `@/shared/components/input-otp` |
| Segmentado | `z-toggle-group` (seleção única) | `@/shared/components/toggle-group` |
| Cartão e linha de lista | `z-card`, `z-item` | `@/shared/components/card`, `…/item` |
| Selo | `z-badge` | `@/shared/components/badge` |
| Aviso na tela | `z-alert` (`danger`, `neutral`, `success`) | `@/shared/components/alert` |
| Aviso temporário | serviço do `sonner` (o `<z-toaster>` já está em `TutorApp`; **não** usar nos fluxos de `/auth`) | `@/shared/components/sonner` |
| Diálogo de decisão | `z-alert-dialog` (só dentro do app) | `@/shared/components/alert-dialog` |
| Carregando | `spinner` | `@/shared/components/spinner` |
| Logo, focinho, painel de marca, marca sobre foto | `app-logo`, `app-focinho`, `app-brand-panel`, `app-brand-mark` | `@/shared/components/faro/<nome>/<nome>` |
| "G" do Google | `app-google-glyph` (ícone oficial; única exceção de cor em hexadecimal) | `@/shared/components/faro/google-glyph/google-glyph` |
| Nota com ícone | `app-note` | `@/shared/components/faro/note/note` |
| Ícones | `<ng-icon name="…">` com os nomes de `faro-icons.ts` (`back`, `clock`, `eye`, `eyeOff`, `check`, `lock`, `user`, `chev`, `alert`, `checkCircle`) | `@/shared/icons/faro-icons` |

Regras herdadas da `002`: nenhuma cor em hexadecimal em `src/app/**`; sem `styles`/`styleUrl` com
cor; `ChangeDetectionStrategy.OnPush`; `data-testid` só onde um contrato pede; `.dark` só é
aplicada pela casca do tutor (as telas de `/auth` nunca ficam escuras).

Se algum item desta tabela não existir no repositório, **parar e relatar**. Não criar substituto.

---

## 1. Rotas (`src/app/app.routes.ts` e `app.routes.server.ts`)

Hoje `anonGuard` está no pai `auth` e expulsa qualquer sessão. Passa a ser aplicado **por rota**:

| Caminho | Componente (`features/…`) | Guards (`canMatch`) | Tema | Render |
|---|---|---|---|---|
| `/auth` | `auth/welcome/welcome.ts` | `anonGuard` | claro | Client |
| `/auth/login` | (existente, `001`/`002`) | `anonGuard` | claro | Client |
| `/auth/criar-conta` | `auth/signup/signup.ts` | `anonGuard` | claro | Client |
| `/auth/confirmar-email` | `auth/confirm-email/confirm-email.ts` | nenhum | claro | Client |
| `/auth/recuperar-senha` | `auth/forgot-password/forgot-password.ts` | `anonGuard` | claro | Client |
| `/auth/nova-senha` | `auth/reset-password/reset-password.ts` | nenhum | claro | Client |
| `/auth/callback` | (existente, `001`) | nenhum | claro | Client |
| `/auth/termos` | `auth/accept-terms/accept-terms.ts` | `authGuard` | claro | Client |
| `/auth/celular` | `auth/phone-entry/phone-entry.ts` | `authGuard`, `termsGuard` | claro | Client |
| `/auth/confirmar-celular` | `auth/confirm-phone/confirm-phone.ts` | `authGuard`, `termsGuard` | claro | Client |
| `/app/conta` | `account/account-home/account-home.ts` | herda de `/app` | do app | Client |
| `/app/conta/dados` | `account/personal-data/personal-data.ts` | herda | do app | Client |
| `/app/conta/celular` | `account/phone/phone.ts` | herda | do app | Client |
| `/app/conta/senha` | `account/password/password.ts` | herda | do app | Client |
| `/app/conta/aparencia` | `account/appearance/appearance.ts` | herda | do app | Client |
| `/app/conta/privacidade` | `account/privacy/privacy.ts` | herda | do app | Client |
| `/legal/termos` | `legal/terms/terms.ts` | nenhum | claro | Prerender |
| `/legal/privacidade` | `legal/privacy-policy/privacy-policy.ts` | nenhum | claro | Prerender |

Regras:

- `/app` passa a ter `canMatch: [authGuard, termsGuard]` (o `termsGuard` é acrescentado).
- As rotas de `/app/conta/*` são **filhas** da rota `app` criada pela `002` (hospedeiro `TutorApp`),
  declaradas em `src/app/features/account/account.routes.ts` e ligadas por
  `{ path: 'conta', loadChildren: … }` **antes** do `{ path: '**', … ShellFallback }`.
  `/app/conta` tem `data: { hub: true }` (tela-raiz, com barra inferior no celular); as cinco telas
  internas não têm e usam `app-screen-header` com `back="back"` e `backLink="/app/conta"`.
  Se a rota `app` não tiver `children`, parar e relatar.
- Na tela de login (migrada pela `002`): os links "Criar conta" e "Esqueci a senha" deixam de ser
  provisórios e passam a apontar para `/auth/criar-conta` e `/auth/recuperar-senha` (preservando
  `returnUrl`); saem os `aria-label` com "(em breve)"; entra o botão "Voltar" para `/auth` no espaço
  de 56 px que a `002` reservou; depois de entrar, a tela chama `PostAuthNavigator.go()` no lugar
  de `roleRedirect`; `?senha=alterada` mostra o aviso "Senha alterada. Entre com a nova senha."
  Os `data-testid` existentes (`login-*`) não mudam.
- Todas as rotas acima vêm **antes** da rota da tag (`/:code`). Não reordenar nem editar as rotas
  de outras specs. `/legal/*` tem dois segmentos de propósito (não colide com `/:code`).
- `app.routes.server.ts`: `auth/**` e `app/**` em `RenderMode.Client`; `legal/termos` e
  `legal/privacidade` em `RenderMode.Prerender`.
- O parâmetro `returnUrl` é aceito em **todas** as rotas `/auth/*`.

## 2. Guards

| Guard | Arquivo | Regra |
|---|---|---|
| `authGuard` (alterar) | `core/auth/auth.guard.ts` | Sem sessão: se `isReturning()` ⇒ `/auth/login?returnUrl=…&reason=session_expired` (como hoje); senão ⇒ `/auth?returnUrl=…` (boas-vindas) |
| `anonGuard` (manter como está) | `core/auth/anon.guard.ts` | Com sessão ⇒ `roleRedirect(role)`; sem sessão ⇒ `true`. O que muda é **onde** ele é aplicado (tabela acima) |
| `termsGuard` (novo) | `core/auth/terms.guard.ts` | `await accountService.ensureLoaded()`. Admin ⇒ `true`. Tutor sem aceite ⇒ `/auth/termos?returnUrl=<rota>`. Falha ao carregar a conta ⇒ `true` (a RLS protege os dados; não trancar o app por erro de rede) |
| `phoneConfirmedGuard` (novo, para a `003`) | `core/account/phone-confirmed.guard.ts` | `ensureLoaded()`. Confirmado ou admin ⇒ `true`. Senão ⇒ `/auth/celular?returnUrl=<rota>` |

Guards são experiência. A regra de verdade está no banco (`phone_is_confirmed`, privilégios, RLS).

## 3. Serviços e stores

### `core/auth/return-url.ts`

```ts
export function sanitizeReturnUrl(raw: unknown): string | null;

@Injectable({ providedIn: 'root' })
export class ReturnUrlService {
  capture(raw: unknown): void;       // sanitiza; se válido, grava em sessionStorage['faro.returnUrl']
  peek(): string | null;
  consume(): string | null;          // lê e apaga
  clear(): void;
}
```

`sanitizeReturnUrl` devolve o valor só se **todas** valerem; senão `null`:

1. é string, 1 a 200 caracteres;
2. começa com `/` e o segundo caractere não é `/` nem `\`;
3. não contém `://`, `\`, `@` antes da primeira `/` seguinte, nem caracteres de controle (`< 0x20`, `0x7F`);
4. `new URL(valor, 'https://tagfaro.com.br').origin === 'https://tagfaro.com.br'`;
5. o caminho não é `/auth` nem começa com `/auth/`.

| Entrada | Saída |
|---|---|
| `/ativar/7K3M-Q9XA-C` | igual |
| `/app/conta/celular` | igual |
| `/app?x=1#y` | igual |
| `//evil.com` | `null` |
| `/\evil.com` | `null` |
| `https://evil.com/app` | `null` |
| `javascript:alert(1)` | `null` |
| `/auth/login` | `null` |
| `app` | `null` |
| `''`, `null`, `42`, string com 201 caracteres | `null` |

### `core/auth/returning-visitor.ts`

`markReturning(): void` grava `localStorage['faro.returning'] = '1'`; `isReturning(): boolean`.
Chamado por `PostAuthNavigator` depois de qualquer autenticação bem-sucedida. Protegido por
`isPlatformBrowser` e `try/catch` (armazenamento bloqueado ⇒ `false`).

### `core/account/terms.ts`

`export const TERMS_VERSION = '2026-11';`

### `core/account/phone.ts`

`normalizeBrPhone(input: unknown): string | null` — **mesmas regras e mesma tabela de casos** de
`shared-edge.contract.md`.
`formatBrPhone('+5511987654421')` ⇒ `'(11) 98765-4421'`.
`maskBrPhoneInput(digitado: string)` ⇒ aplica a máscara `(DD) 9XXXX-XXXX` enquanto a pessoa digita.

### `core/account/account.store.ts`

```ts
export interface Account {
  id: string; nome: string; email: string; papel: 'tutor' | 'admin';
  celular: string | null; celularConfirmadoEm: string | null; celularPendente: string | null;
  termosAceitosEm: string | null; termosVersao: string | null;
  temSenha: boolean; provedores: string[]; criadoEm: string;
}

@Injectable({ providedIn: 'root' })
export class AccountStore {
  readonly account: Signal<Account | null>;
  readonly loaded: Signal<boolean>;
  readonly termsAccepted: Signal<boolean>;   // termosAceitosEm !== null
  readonly phoneConfirmed: Signal<boolean>;  // celular !== null && celularConfirmadoEm !== null
  readonly hasPassword: Signal<boolean>;
  readonly isGoogleOnly: Signal<boolean>;    // !temSenha && provedores.includes('google')
}
```

Mutações só por `AccountService`. Zerado quando a sessão termina.

### `core/account/account.service.ts`

| Método | Faz | Erros |
|---|---|---|
| `load(force = false): Promise<Account \| null>` | `rpc('my_account')` → `AccountStore` | falha ⇒ `null`, `loaded` continua `false` |
| `ensureLoaded(): Promise<Account \| null>` | `load()` se ainda não carregou | — |
| `updateName(nome: string): Promise<{ ok: boolean; reason?: 'invalid' \| 'network' }>` | valida 2–80 após `trim`; `from('perfis').update({ nome }).eq('id', uid)`; recarrega | |
| `acceptTerms(): Promise<{ ok: boolean; reason?: 'network' }>` | `rpc('accept_terms', { p_versao: TERMS_VERSION })`; recarrega | |
| `logout(): Promise<void>` | `rpc('log_logout')` (ignora erro) e depois `AuthService.signOut()` | nunca lança |

### `core/auth/registration.service.ts`

```ts
export interface SignUpInput { nome: string; email: string; celular: string; senha: string; aceite: boolean; captchaToken?: string; }
export type SignUpResult = { ok: true } | { ok: false; reason: 'invalid' | 'weak_password' | 'rate_limited' | 'network' };

signUp(input: SignUpInput): Promise<SignUpResult>;
resendConfirmation(email: string): Promise<void>;                       // delega em AuthService.resendConfirmation; resposta uniforme
confirmEmail(tokenHash: string): Promise<{ ok: true } | { ok: false; reason: 'invalid_link' | 'network' }>;
```

`signUp`:

1. Validar: `nome` 2–80; `email` com formato; `normalizeBrPhone(celular)` não nulo; `senha` 8–72;
   `aceite === true`. Falhou ⇒ `{ ok: false, reason: 'invalid' }` (a tela já mostra o erro por campo).
2. `inicio = performance.now()`.
3. `auth.signUp({ email, password: senha, options: { data: { name: nome.trim(), phone: <E.164>,
   terms_version: TERMS_VERSION, return_to: <ReturnUrlService.peek() ou ausente>,
   return_to_at: <ISO agora, se houver return_to> } } })`.
4. Esperar até `inicio + 1200 ms` (tempo mínimo de resposta, igual para todo resultado).
5. Erro de senha fraca ⇒ `weak_password`; erro com status 429 ⇒ `rate_limited`; erro de rede ⇒
   `network`. **Qualquer outro resultado, inclusive "e-mail já cadastrado", ⇒ `{ ok: true }`.**
6. Nunca guardar a senha em store, storage ou log.

`confirmEmail(tokenHash)`: `auth.verifyOtp({ token_hash: tokenHash, type: 'email' })`. Sucesso ⇒
a sessão fica ativa; `{ ok: true }`. Erro ⇒ `invalid_link` (vencido, usado ou adulterado: mesma resposta).

### `core/auth/password.service.ts`

`requestRecovery(email, captchaToken?)`, `resetPassword(tokenHash, newPassword)`,
`changePassword(current, next)` — ver `password-recovery.edge.md`.

`requestRecovery` chama `functions.invoke('password-recovery', { body: { email } })` e **sempre**
resolve sem erro visível (falha de rede inclusive: a tela mostra a mesma mensagem).

### `core/account/phone-verification.service.ts`

```ts
export interface PhoneStatus { phoneConfirmed: boolean; phone: string | null; pendingPhone: string | null;
  active: { expiresAt: string; attemptsLeft: number } | null; resendAvailableAt: string | null; }
export type StartResult =
  | { ok: true; phone: string; expiresAt: string; resendAvailableAt: string; attemptsLeft: number }
  | { ok: false; error: 'email_not_confirmed' | 'terms_required' | 'invalid_phone' | 'same_number'
        | 'reauth_required' | 'invalid_password' | 'cooldown' | 'rate_limited'
        | 'sms_unavailable' | 'sms_send_failed' | 'network';
      retryAfterSeconds?: number; method?: 'password' | 'google' };
export type ConfirmResult =
  | { ok: true; phone: string }
  | { ok: false; error: 'invalid_format' | 'invalid_code' | 'locked' | 'expired' | 'no_active' | 'network'; attemptsLeft?: number };

status(): Promise<PhoneStatus | null>;                               // rpc('phone_verification_status')
start(input?: { phone?: string; password?: string }): Promise<StartResult>;   // functions.invoke('phone-verify-start')
confirm(code: string): Promise<ConfirmResult>;                        // functions.invoke('phone-verify-confirm'); em sucesso, AccountService.load(true)
```

Qualquer resposta que não seja HTTP 200 com corpo JSON ⇒ `{ ok: false, error: 'network' }`.
O serviço **não** decide nada sobre o código: só repassa a resposta do servidor.

### `core/account/privacy.service.ts`

```ts
exportData(): Promise<{ ok: true } | { ok: false; reason: 'rate_limited' | 'network'; retryAfterSeconds?: number }>;
deleteAccount(input: { password?: string }): Promise<
  { ok: true } | { ok: false; error: 'confirmation_required' | 'reauth_required' | 'invalid_password'
    | 'rate_limited' | 'deletion_unavailable' | 'deletion_incomplete' | 'network';
    retryAfterSeconds?: number; method?: 'password' | 'google' }>;
```

`deleteAccount` envia `{ confirm: 'EXCLUIR', password }`. Em sucesso: `auth.signOut({ scope: 'local' })`,
zera `AuthStore` e `AccountStore`, apaga `faro.returning` e `faro.returnUrl`.

### `core/auth/post-auth-navigation.ts`

```ts
export interface NextStepInput {
  role: 'tutor' | 'admin' | null; termsAccepted: boolean; phoneConfirmed: boolean;
  returnUrl: string | null; skipPhone: boolean;
}
export function nextStep(i: NextStepInput): string;     // função pura

@Injectable({ providedIn: 'root' })
export class PostAuthNavigator {
  go(opts?: { skipPhone?: boolean }): Promise<boolean>;
}
```

`nextStep` (testada com tabela de casos):

| `role` | aceite | celular | `skipPhone` | `returnUrl` | Resultado |
|---|---|---|---|---|---|
| `admin` | qualquer | qualquer | qualquer | `/admin/lotes` | `/admin/lotes` |
| `admin` | qualquer | qualquer | qualquer | `/app` ou nulo | `/admin` |
| `tutor` ou `null` | não | qualquer | qualquer | X | `/auth/termos?returnUrl=X` (sem query se X nulo) |
| `tutor` ou `null` | sim | não | `false` | X | `/auth/celular?returnUrl=X` |
| `tutor` ou `null` | sim | não | `true` | X | X ou `/app` |
| `tutor` ou `null` | sim | sim | qualquer | X | X ou `/app` |
| `tutor` ou `null` | sim | sim | qualquer | `/admin` | `/app` |

`PostAuthNavigator.go`:

1. `account = await accountService.load(true)`; `role = authStore.role()`.
2. `returnUrl = returnUrlService.peek()`; se nulo, ler `user.user_metadata.return_to` (via
   `AuthStore.user()`), aceitar só se `sanitizeReturnUrl` aprovar **e** `return_to_at` tiver menos
   de 7 dias.
3. `destino = nextStep(…)`. Se a conta **não carregou** (falha de rede), não aplicar as etapas de
   aceite e de celular: `destino = returnUrl ?? roleRedirect(role)`. O `termsGuard` de `/app`
   volta a conferir quando a conta carregar.
4. `markReturning()`.
5. Se `destino` é o destino final (não é `/auth/termos` nem `/auth/celular`):
   `returnUrlService.clear()` e, se havia `return_to` nos metadados,
   `auth.updateUser({ data: { return_to: null, return_to_at: null } })` (sem aguardar; erro só em log).
6. `router.navigateByUrl(destino, { replaceUrl: true })`.

Quem chama `PostAuthNavigator.go()`: a tela de login depois de entrar (no lugar de
`roleRedirect`), o `oauth-callback`, `confirm-email` depois de confirmar, `accept-terms` depois de
aceitar, `confirm-phone` depois de confirmar, `phone-entry` em "Agora não" (`skipPhone: true`).

## 4. Telas

Casca de **fluxo** (`app-flow-shell`): barra com voltar ou fechar; no `md`, logo no topo e coluna
de 480 px centralizada; no `xl`, painel de marca navy à esquerda com a frase (`headline`) e o
apoio (`sub`) e coluna de 440 px à direita; no celular, ações (`[footer]`) ancoradas embaixo.
Sempre clara. A coluna "`side` (xl)" abaixo dá `headline` / `sub`; quebras de linha da frase viram
itens do array (`['Só o', 'necessário.']`).
Casca do **app** (`app-tutor-shell`): barra inferior no celular, trilho no `md`, menu lateral no
`xl`, item "Conta" ativo; telas internas com `app-screen-header` e voltar para `/app/conta`.

| Tela | Referência | Casca | Título / subtítulo | `side` (xl) |
|---|---|---|---|---|
| Boas-vindas | `design/telas-v2/V2-boas-vindas*.dc.html` | própria (foto + folha; no `xl`, foto à esquerda) | "O caminho de volta para casa." / "Uma tag com QR na coleira. Quem encontrar o seu pet fala com você na hora, sem precisar de app." | — |
| Criar conta | `V2-criar-conta*.dc.html` | fluxo, voltar → `/auth` | "Crie sua conta" / "Só o necessário para quem encontrar seu pet falar com você." | "Só o necessário." / "Nome, e-mail e celular. Nada de CPF ou endereço para ativar a sua tag." |
| Confirme seu e-mail | `V2-confirmar-email*.dc.html` | fluxo, voltar → `/auth/criar-conta` | "Confirme seu e-mail" / "Enviamos um link para {email}. Abra o e-mail e toque em 'Confirmar meu e-mail'. O link vale por 1 hora." | "Falta um passo." / "Confirmar o e-mail protege a sua conta e as suas tags." |
| Confirmar e-mail (link) | `V2-confirmar-email-link*.dc.html`; link inválido: `V2-confirmar-email-invalido*.dc.html` | fluxo, sem barra | "Confirmar seu e-mail" / "Toque no botão para ativar sua conta." | igual à anterior |
| Aceitar termos | `V2-aceite-termos*.dc.html` | fluxo, sem voltar | "Antes de continuar" / "Para usar o Faro, você precisa aceitar os Termos e a Política de privacidade." | "Só o necessário." / … |
| Informar celular | `V2-informar-celular*.dc.html`; modo troca: `V2-trocar-celular*.dc.html` | fluxo | "Qual é o seu celular?" (troca: "Novo celular") / "É por ele que quem achou o seu pet fala com você. Vamos confirmar por SMS." | "Um número que atende." / "É por ele que quem achou o seu pet fala com você. Por isso confirmamos antes." |
| Confirmar celular | `V2-confirmar-celular*.dc.html`; estados: `V2-confirmar-celular-erro*`, `-vencido*` (vale também para bloqueado) e `-indisponivel*` | fluxo, voltar → `/auth/celular` | "Confirme seu celular" / "Enviamos um código de 6 dígitos por SMS para {celular}. É esse número que aparece para quem encontrar seu pet." | igual à anterior |
| Esqueci a senha | `V2-recuperar-senha*.dc.html`; depois do envio: `V2-recuperar-senha-enviado*.dc.html` | fluxo, voltar → `/auth/login` | "Esqueceu a senha?" / "Informe seu e-mail. Enviamos um link para você criar uma nova." | "De volta em um minuto." / "Você cria uma senha nova e continua de onde parou." |
| Nova senha | `V2-nova-senha*.dc.html`; link inválido: `V2-nova-senha-invalido*.dc.html` | fluxo, sem voltar | "Crie uma nova senha" / "Use pelo menos 8 caracteres." | igual à anterior |
| Conta (lista e 5 telas) | `V2-conta*.dc.html`: lista, `-dados`, `-celular`, `-celular-pendente`, `-senha`, `-aparencia`, `-privacidade` e `-excluir` (diálogo), em claro e escuro | app | "Conta" | — |
| Termos / Política | `V2-legal-termos*.dc.html` (modelo de página; o texto é `TODO(LEGAL_TEXTS)`) | página simples clara, coluna de leitura de 680 px | "Termos de uso" / "Política de privacidade" | — |

**Todas as telas têm desenho de referência desde 2026-11-21.** As que não tinham foram desenhadas a
pedido do William e renderizadas em navegador, mas ele ainda não as revisou uma a uma. Siga o
desenho; **onde a tela e este contrato divergirem em texto ou comportamento, vale este contrato**, e
a divergência vai para o relatório final. Não invente padrão visual novo.

### Comportamento por tela

**Boas-vindas** — botões "Criar conta" (principal, lima) → `/auth/criar-conta` e "Já tenho conta"
(contorno) → `/auth/login`, ambos preservando `returnUrl`. `?conta=excluida` mostra o aviso "Sua
conta foi excluída." No `init`: `returnUrlService.capture(query.returnUrl)`.
Layout (medidas da referência): celular, foto de 470 px no topo com `app-brand-mark` no canto e
folha `rounded-t-[28px] bg-background` subindo 28 px, título de 38 px; `md`, foto de 560 px, folha
subindo 32 px, coluna de 560 px, título de 56 px; `xl`, foto na metade esquerda e, na direita,
`app-logo` de 64 px, título de 64 px e os dois botões, centralizados na vertical. A foto é
`public/photos/boas-vindas.jpg` (`<img>` com `width`/`height`, `alt` descritivo, `object-cover`);
**se o arquivo não existir**, mostrar só o fundo `bg-photo` e registrar no relatório que a foto
está pendente (as fotos são fornecidas pelo dono). Não usar `app-public-layout` (as alturas são
outras) nem editar componentes da `002`.

Todas as telas de `/auth/*` fazem `returnUrlService.capture(query.returnUrl)` no `init`.

**Criar conta** — campos: Nome; E-mail (`type=email`, `autocomplete=email`); Celular (`type=tel`,
`inputmode=numeric`, `autocomplete=tel-national`, ajuda "Vamos confirmar este número por SMS.");
Senha (`autocomplete=new-password`, dica "Pelo menos 8 caracteres", botão de mostrar);
caixa "Li e aceito os Termos e a Política de privacidade." com links para `/legal/termos` e
`/legal/privacidade` (abrem em nova aba). Botão "Criar conta"; linha "ou"; botão de contorno
"Continuar com o Google" com o **ícone oficial**; "Já tem conta? Entrar". Sucesso ⇒ navegar para
`/auth/confirmar-email` passando o e-mail por **estado do roteador** (não na URL).

**Confirme seu e-mail** (`/auth/confirmar-email` **sem** `token_hash`) — mostra o e-mail (se veio
no estado), botão de contorno "Reenviar e-mail" com contagem de 60 s (inicia em 60 ao chegar),
"E-mail errado? Voltar" → `/auth/criar-conta`, "Já confirmei. Entrar" → `/auth/login`. Sem e-mail
no estado (recarregou a página): campo de e-mail + "Reenviar e-mail". Depois de reenviar, sempre:
"Se houver um cadastro pendente para este e-mail, enviamos um novo link." Se a sessão aparecer
(confirmou em outra aba do mesmo navegador), chamar `PostAuthNavigator.go()`.

**Confirmar e-mail (link)** (`/auth/confirmar-email?token_hash=…&type=email`) — **não** chama nada
ao carregar. Botão principal "Confirmar meu e-mail" ⇒ `confirmEmail(tokenHash)`.
Sucesso ⇒ se a conta tem `celularPendente`, chamar `phoneVerification.start()`:
`ok` ⇒ `/auth/confirmar-celular` (com `returnUrl`); qualquer falha ⇒ `/auth/celular` (com
`returnUrl`). Sem `celularPendente` ⇒ `PostAuthNavigator.go()`.
`invalid_link` ⇒ estado "Este link não vale mais" + "Pedir novo link" (leva ao estado de espera) +
"Entrar".

**Aceitar termos** — caixa de aceite com os dois links; botão "Aceitar e continuar" (desabilitado
sem a caixa) ⇒ `acceptTerms()` ⇒ `PostAuthNavigator.go()`. Botão de texto "Sair" ⇒ `logout()`.

**Informar celular** — campo Celular pré-preenchido com `celularPendente` formatado. Botão "Enviar
código por SMS" ⇒ `start({ phone })` ⇒ `ok`: `/auth/confirmar-celular`. Botão de texto "Agora não"
⇒ `PostAuthNavigator.go({ skipPhone: true })`. `cooldown` (acontece quando a pessoa corrige o
número menos de 60 s depois de um envio): mostrar "Você poderá enviar em m:ss" com
`retryAfterSeconds` e reabilitar o botão ao zerar. `rate_limited`, `sms_unavailable` e
`sms_send_failed`: o texto do contrato da função, com o "Agora não" como saída. **Modo troca** (`phoneConfirmed()` verdadeiro):
título "Novo celular", mostra "Seu celular atual: {celular}. Ele continua valendo até você
confirmar o novo.", "Agora não" vira "Cancelar" (→ `returnUrl` ou `/app/conta/celular`). Em
`reauth_required` com `method = 'password'`: mostrar o campo "Senha atual" e reenviar com
`password`; com `method = 'google'`: botão "Entrar de novo com o Google" (antes,
`returnUrlService.capture('/app/conta/celular')`).

**Confirmar celular** — no `init`: `status()`. Sem `pendingPhone` ⇒ redirecionar para
`/auth/celular`. Sem `active` e com `pendingPhone` ⇒ estado "Peça um código" com o botão "Enviar
código por SMS". Seis células (componente de células da `002`), `inputmode=numeric`,
`autocomplete=one-time-code` na primeira, colar distribui os 6 dígitos, avanço e retorno
automáticos. Botão "Confirmar" desabilitado até haver 6 dígitos. Linha "Reenviar em m:ss" (ícone de
relógio) que vira o botão de texto "Reenviar código" quando zera. "Número errado? Corrigir" →
`/auth/celular`. Estados:

| Estado | Mostra | Próximo passo |
|---|---|---|
| `invalid_code` | "Código incorreto. Você tem mais {n} tentativa(s)." (limpa as células, foca a primeira) | digitar de novo |
| `locked` | "Muitas tentativas. Peça um novo código." | "Reenviar código" (respeita a contagem) |
| `expired` / `no_active` | "Este código venceu. Peça um novo." | "Reenviar código" |
| `cooldown` | contagem com `retryAfterSeconds` | aguardar |
| `rate_limited` | "Muitos pedidos de código. Tente de novo em {tempo}." | "Continuar sem confirmar" + "Corrigir" |
| `sms_unavailable` / `sms_send_failed` | "Não conseguimos enviar o SMS agora." | "Tentar de novo" + "Continuar sem confirmar" |
| sucesso | — | `PostAuthNavigator.go()` |

"Continuar sem confirmar" ⇒ `PostAuthNavigator.go({ skipPhone: true })`. Só aparece nos estados
indicados (a tela aprovada não tem essa saída no estado normal).
Erros são anunciados em região `aria-live="polite"`; o campo com erro recebe `aria-invalid`.

**Esqueci a senha** — campo E-mail; botão "Enviar link". Depois do envio, sempre a mesma tela de
confirmação (texto em `password-recovery.edge.md`) com "Voltar para entrar". O botão fica
desabilitado por 60 s depois de cada envio.

**Nova senha** — sem `token_hash` na URL ⇒ estado "Este link não vale mais". Campo "Nova senha"
(com mostrar, `autocomplete=new-password`); botão "Salvar nova senha" ⇒ `resetPassword`. Sucesso ⇒
`/auth/login?senha=alterada` (a tela de login mostra "Senha alterada. Entre com a nova senha.").
`invalid_link` ⇒ "Este link não vale mais. Peça um novo." + botão "Pedir novo link" →
`/auth/recuperar-senha`.

**Conta (lista)** — cabeçalho com nome e e-mail. Linhas (cartão + linha de lista, uma seta à
direita): "Dados pessoais"; "Celular" (subtítulo: número formatado + selo verde "Confirmado", ou
selo neutro "Não confirmado"); "Senha"; "Aparência" (subtítulo: Clara / Escura / Igual ao
sistema); "Privacidade"; e o botão de texto "Sair" ⇒ `accountService.logout()`.

**Dados pessoais** — campo Nome (2–80), E-mail somente leitura com a ajuda "O e-mail não pode ser
alterado por aqui.", botão "Salvar alterações" (desabilitado sem mudança). Sucesso: aviso "Dados
salvos."

**Celular** — com número confirmado: número, selo "Confirmado", data, botão de contorno "Trocar
celular" → `/auth/celular?returnUrl=/app/conta/celular`. Sem número confirmado: texto "Seu celular
ainda não foi confirmado. Sem isso, não dá para ativar uma tag." e botão principal "Confirmar
celular" → mesma rota. Com troca pendente: "Aguardando confirmação de {pendente}" + "Continuar" →
`/auth/confirmar-celular?returnUrl=/app/conta/celular`.

**Senha** — `hasPassword()`: campos "Senha atual" e "Nova senha", botão "Trocar senha" ⇒
`changePassword`; sucesso: "Senha alterada. As outras sessões foram encerradas." `isGoogleOnly()`:
só o texto de `no_password`, sem formulário.

**Aparência** — segmentado com três opções: "Clara", "Escura", "Igual ao sistema". Chama o serviço
de tema da `002` e reflete o valor atual. Sem botão de salvar.

**Privacidade** — dois blocos. "Exportar meus dados": texto do que vem no arquivo + botão de
contorno "Baixar meus dados". "Excluir minha conta": texto das consequências (tags desvinculadas e
liberadas para nova ativação; a página de resgate deixa de mostrar seus dados; não dá para
desfazer) + botão de texto **vermelho** "Excluir minha conta" que abre um diálogo de decisão
(componente de diálogo da `002`): campo "Digite EXCLUIR", campo "Senha atual" (contas com senha) ou
o aviso de entrar de novo com o Google, botão destrutivo "Excluir definitivamente" (desabilitado
até o texto conferir) e "Cancelar". Sucesso ⇒ `/auth?conta=excluida`.

## 5. `data-testid`

Formato `<feature>-<elemento>`:

| Tela | IDs |
|---|---|
| Boas-vindas | `welcome-create-account`, `welcome-login`, `welcome-deleted-notice` |
| Criar conta | `signup-name`, `signup-email`, `signup-phone`, `signup-password`, `signup-password-toggle`, `signup-terms`, `signup-submit`, `signup-google`, `signup-login-link`, `signup-error` |
| Confirmar e-mail | `confirm-email-address`, `confirm-email-input`, `confirm-email-resend`, `confirm-email-countdown`, `confirm-email-resent-notice`, `confirm-email-confirm`, `confirm-email-invalid`, `confirm-email-new-link`, `confirm-email-login` |
| Termos (aceite) | `terms-checkbox`, `terms-accept`, `terms-logout` |
| Informar celular | `phone-input`, `phone-current`, `phone-password`, `phone-google-reauth`, `phone-send`, `phone-skip`, `phone-error` |
| Confirmar celular | `confirm-phone-number`, `confirm-phone-cell-1` … `confirm-phone-cell-6`, `confirm-phone-submit`, `confirm-phone-countdown`, `confirm-phone-resend`, `confirm-phone-fix`, `confirm-phone-error`, `confirm-phone-continue-without` |
| Esqueci a senha | `forgot-password-email`, `forgot-password-submit`, `forgot-password-sent`, `forgot-password-back` |
| Nova senha | `reset-password-input`, `reset-password-toggle`, `reset-password-submit`, `reset-password-invalid`, `reset-password-new-link`, `reset-password-error` |
| Conta | `account-name`, `account-email`, `account-row-personal`, `account-row-phone`, `account-phone-badge`, `account-row-password`, `account-row-appearance`, `account-row-privacy`, `account-logout` |
| Dados pessoais | `account-personal-name`, `account-personal-email`, `account-personal-save`, `account-personal-saved` |
| Celular | `account-phone-number`, `account-phone-status`, `account-phone-change`, `account-phone-confirm`, `account-phone-pending` |
| Senha | `account-password-current`, `account-password-new`, `account-password-submit`, `account-password-success`, `account-password-error`, `account-password-google-note` |
| Aparência | `account-appearance-light`, `account-appearance-dark`, `account-appearance-system` |
| Privacidade | `account-privacy-export`, `account-privacy-export-error`, `account-privacy-delete`, `account-delete-confirm-text`, `account-delete-password`, `account-delete-google-reauth`, `account-delete-submit`, `account-delete-cancel`, `account-delete-error` |

## 6. Regras de segurança do frontend

- Senha e código SMS vivem só no formulário; nunca em store, storage, URL ou log.
- E-mail nunca vai na URL (usar estado do roteador).
- Nenhum `innerHTML`, `bypassSecurityTrust*` ou leitura de storage em `features/` (lint da `001`).
- Mensagens vêm das tabelas dos contratos; **nunca** exibir `error.message` do Supabase.
- `features/public/**` não importa nada de `core/auth` nem de `core/account` (fronteira de lint).
- Nenhum segredo em `environment*.ts`.

## 7. Testes (Vitest)

| Arquivo | Cobre |
|---|---|
| `core/auth/return-url.spec.ts` | a tabela de `sanitizeReturnUrl`; `capture`/`consume` |
| `core/auth/post-auth-navigation.spec.ts` | a tabela de `nextStep`; `go()` com serviços falsos (limpa o destino só no passo final; ignora `return_to` com mais de 7 dias) |
| `core/auth/registration.service.spec.ts` | validação; metadados enviados; "já cadastrado" ⇒ `ok`; tempo mínimo (relógio falso) |
| `core/auth/password.service.spec.ts` | ver `password-recovery.edge.md` |
| `core/auth/terms.guard.spec.ts`, `core/account/phone-confirmed.guard.spec.ts` | cada ramo |
| `core/auth/guards.spec.ts` (existente) | acrescentar: `authGuard` sem marca ⇒ `/auth`; com marca ⇒ `/auth/login` |
| `core/account/phone.spec.ts` | a tabela de `normalizeBrPhone`; `formatBrPhone`; máscara |
| `core/account/account.service.spec.ts` | `load`, `updateName` (limites 1, 2, 80, 81), `acceptTerms`, `logout` chama `log_logout` antes de `signOut` |
| `core/account/phone-verification.service.spec.ts` | mapeamento de cada resposta; não-200 ⇒ `network` |
| `core/account/privacy.service.spec.ts` | download; `rate_limited`; limpeza local após excluir |
| um `*.spec.ts` por tela | validação de formulário, estados e presença dos `data-testid` |
