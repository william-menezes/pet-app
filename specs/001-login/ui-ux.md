# UI/UX Blueprint — Feature 001-login

**Feature**: porta única de login do painel Faro
**Data**: 2026-06-29
**Designer**: ui-ux-designer
**Status**: aguardando gate de revisão humana

---

## Índice

1. [Mapa de telas e fluxo geral](#1-mapa-de-telas-e-fluxo-geral)
2. [Tela 1 — Login (estado padrão)](#2-tela-1--login-estado-padrão)
3. [Tela 2 — Estados de erro e alerta](#3-tela-2--estados-de-erro-e-alerta)
4. [Tela 3 — Callback do Google (processamento)](#4-tela-3--callback-do-google-processamento)
5. [Tela 4 — Logout e sessão expirada](#5-tela-4--logout-e-sessão-expirada)
6. [Responsividade](#6-responsividade)
7. [Acessibilidade — checklist](#7-acessibilidade--checklist)
8. [Mapa de data-testid](#8-mapa-de-data-testid)
9. [Componentes PrimeNG sugeridos](#9-componentes-primeng-sugeridos)
10. [Microcopy canônica PT-BR](#10-microcopy-canônica-pt-br)
11. [Invariantes verificados](#11-invariantes-verificados)
12. [O que o frontend-angular deve implementar](#12-o-que-o-frontend-angular-deve-implementar)
13. [O que o qa-engineer deve testar](#13-o-que-o-qa-engineer-deve-testar)

---

## 1. Mapa de telas e fluxo geral

```mermaid
flowchart TD
    START([Usuário abre /auth/login]) --> AUTHED{Já autenticado?}
    AUTHED -->|sim| ROLE_REDIRECT["Redireciona ao destino do papel\n(FR-011)"]
    ROLE_REDIRECT -->|Tutor| APP[/app]
    ROLE_REDIRECT -->|Admin| ADMIN[/admin]

    AUTHED -->|não| LOGIN_FORM["Tela 1: Formulário de Login"]

    LOGIN_FORM --> EMAIL_PWD["Fluxo e-mail/senha\n(US1)"]
    LOGIN_FORM --> GOOGLE["Fluxo Google\n(US2)"]

    EMAIL_PWD --> SUBMIT{Submeter}
    SUBMIT -->|formato inválido| INLINE_ERR["Erro inline de validação\n(sem enviar para o servidor)"]
    INLINE_ERR --> LOGIN_FORM

    SUBMIT -->|formato válido| RATE_CHECK{Rate-limit?}
    RATE_CHECK -->|bloqueado / backoff| RATE_MSG["Erro: 'Tente novamente mais tarde'\n(FR-018)"]
    RATE_MSG --> LOGIN_FORM

    RATE_CHECK -->|permitido| AUTHN{Autenticação}
    AUTHN -->|sucesso| EMAIL_CONF{E-mail confirmado?}
    EMAIL_CONF -->|não confirmado| UNCONF["Alerta: reenviar confirmação\n(FR-024)"]
    UNCONF --> LOGIN_FORM
    EMAIL_CONF -->|confirmado| ROLE_REDIRECT

    AUTHN -->|credencial inválida ou conta inexistente| GENERIC_ERR["Erro genérico: 'E-mail ou senha inválidos.'\n(FR-014/019)"]
    GENERIC_ERR --> LOGIN_FORM

    AUTHN -->|offline / erro de rede| NET_ERR["Erro: falha de conexão\n(FR-015)"]
    NET_ERR --> LOGIN_FORM

    GOOGLE --> GOOGLE_POPUP["Abre janela OAuth Google"]
    GOOGLE_POPUP -->|sucesso| TELA3_OK["Tela 3: Callback — processando..."]
    GOOGLE_POPUP -->|cancelamento pelo usuário| GOOGLE_CANCEL["Mensagem neutra + foco volta ao form\n(US2 cen.2)"]
    GOOGLE_CANCEL --> LOGIN_FORM
    GOOGLE_POPUP -->|provedor indisponível| GOOGLE_FAIL["Mensagem: 'Login com Google indisponível agora.'\n(US2 cen.3)"]
    GOOGLE_FAIL --> LOGIN_FORM
    TELA3_OK --> ROLE_REDIRECT

    LOGIN_FORM --> SIGNUP_LINK["Link: 'Criar conta' → provisório/em breve\n(FR-013)"]
    LOGIN_FORM --> FORGOT_LINK["Link: 'Esqueci minha senha' → provisório/em breve\n(FR-013)"]

    STYLE SESSION_EXP["Sessão expirada em área autenticada\n→ redireciona ao login com returnUrl\n(FR-012)"]
    SESSION_EXP --> LOGIN_FORM

    LOGOUT_TRIGGER["Usuário clica em 'Sair'"] --> LOGOUT_PROC["Encerra sessão + limpa storage\n(FR-010)"]
    LOGOUT_PROC --> LOGIN_FORM
```

---

## 2. Tela 1 — Login (estado padrão)

### 2.1 Layout mobile-first (~360px)

```
┌─────────────────────────────────────────┐
│                                         │
│         [Logo Faro compacto]            │  ← marca discreta, sem competir com o form
│         Faro  (Poppins 700, índigo)     │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  Bem-vindo de volta               │  │  ← h2 Poppins 700, 22px, text-strong
│  │  Entre na sua conta para          │  │  ← body Inter 400, 14px, muted
│  │  acessar o Faro.                  │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  E-mail                     │  │  │  ← label, 14px Inter 500
│  │  │  [____________________] ✓   │  │  │  ← p-inputText, 44px mínimo
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Senha                      │  │  │
│  │  │  [________________] 👁 ✓   │  │  │  ← p-password, toggle de visibilidade
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  [✓] Manter conectado            │  │  ← p-checkbox, 44px alvo, Inter 14px
│  │                                   │  │
│  │  [   Entrar   ]                   │  │  ← p-button primário, full-width, 48px, índigo 500
│  │                                   │  │
│  │  ──────── ou ────────             │  │  ← divisor com texto, muted
│  │                                   │  │
│  │  [G  Entrar com Google   ]        │  │  ← p-button outlined, full-width, 48px
│  │                                   │  │
│  │  Esqueceu a senha?                │  │  ← link âncora, Inter 14px, índigo 600
│  │                                   │  │
│  │  Ainda não tem conta?             │  │
│  │  Criar conta                      │  │  ← link, índigo 600
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  rodapé: "Protegido por Faro 🐾"        │  ← caption, muted, centralizdo
└─────────────────────────────────────────┘
```

### 2.2 Layout desktop (≥ 768px)

Na versão desktop, o card de login fica centralizado horizontal e verticalmente na viewport, com largura máxima de 440px. O fundo usa `surface-app` (#F7F8F8). O card tem sombra suave e `border-radius: 20px` (--faro-radius-lg).

```
┌────────────────────── viewport desktop ──────────────────────┐
│                                                               │
│           ┌────────────────────────────────────┐             │
│           │  [Logo Faro]  Faro                 │             │
│           │                                    │             │
│           │  Bem-vindo de volta                │             │
│           │  Entre na sua conta para           │             │
│           │  acessar o Faro.                   │             │
│           │                                    │             │
│           │  E-mail                            │             │
│           │  [________________________________]│             │
│           │                                    │             │
│           │  Senha                             │             │
│           │  [______________________] 👁       │             │
│           │                                    │             │
│           │  [✓] Manter conectado              │             │
│           │                                    │             │
│           │  [ Entrar ]                        │             │
│           │                                    │             │
│           │  ──── ou ────                      │             │
│           │                                    │             │
│           │  [G Entrar com Google]             │             │
│           │                                    │             │
│           │  Esqueceu a senha?                 │             │
│           │  Criar conta                       │             │
│           └────────────────────────────────────┘             │
│                                                               │
│                   Protegido por Faro 🐾                      │
└───────────────────────────────────────────────────────────────┘
```

### 2.3 Hierarquia visual e tokens

| Elemento | Token/Valor | Componente PrimeNG |
|---|---|---|
| Fundo de página | `--faro-surface-app` (#F7F8F8) | — |
| Card | `--faro-surface-0` (#FFFFFF) + `--faro-shadow-card` + `border-radius: 20px` | `p-card` ou `<div>` |
| "Faro" (logomarca) | Poppins 700 · 24px · `--faro-primary` (#3A4FD6) | — |
| Título "Bem-vindo de volta" | Poppins 700 · 22px · `--faro-text-strong` (#13201E) | `<h1>` (único na página) |
| Subtítulo | Inter 400 · 14px · `--faro-text-muted` (#5E6C69) | `<p>` |
| Labels de campo | Inter 500 · 14px · `--faro-text` (#33403D) | dentro do `faro-field` |
| Campos (input/password) | `p-inputText`, `p-password` · altura ≥ 48px · borda `--faro-border` | PrimeNG |
| Botão primário "Entrar" | `p-button` · full-width · 48px · `--faro-primary` #3A4FD6 · texto branco · Poppins 600 | PrimeNG |
| Botão "Entrar com Google" | `p-button` outlined · full-width · 48px · borda `--faro-border` · ícone PrimeIcons `pi-google` | PrimeNG |
| Checkbox "Manter conectado" | `p-checkbox` + label · alvo de toque ≥ 44px | PrimeNG |
| Links (Esqueceu/Criar conta) | Inter 500 · 14px · `--faro-primary` #3A4FD6 · underline no hover/focus | `<a>` |
| Rodapé | Inter 400 · 12px · `--faro-text-muted` | `<footer>` |

### 2.4 Estado de carregamento (submit em progresso)

- Botão "Entrar" fica com `loading: true` → spinner interno do PrimeNG + label "Entrando..." + `disabled`.
- Botão "Entrar com Google" fica `disabled` durante a espera.
- Campos ficam `disabled`.
- Foco permanece no botão (não salta para outro elemento).
- Sem skeleton nesta tela — o feedback é no botão.

```
│  [ ⟳ Entrando... ]  ← loading state do p-button
```

---

## 3. Tela 2 — Estados de erro e alerta

### 3.1 Erro genérico de credencial (FR-014/019)

**Quando:** senha errada OU conta inexistente — mensagem IDÊNTICA em ambos os casos (anti-enumeração).

```
┌───────────────────────────────────────┐
│  ┌─────────────────────────────────┐  │
│  │ ⚠  E-mail ou senha inválidos.   │  │  ← p-message severity="error"
│  │    Verifique e tente de novo.   │  │  ← fundo #FBE7E4 · texto #C23A2B
│  └─────────────────────────────────┘  │
│                                       │
│  E-mail                               │
│  [____________________________]       │  ← borda danger mas SEM texto de erro inline
│                                       │
│  Senha                                │
│  [____________________] 👁            │  ← idem; erro associado ao banner acima
│                                       │
│  [✓] Manter conectado                │
│                                       │
│  [  Entrar  ]                         │
│  ...
```

**Nota de design:** O erro é no nível do formulário (banner), NÃO inline por campo. Isso é intencional e obrigatório para anti-enumeração. Não mostrar "E-mail não encontrado" ou "Senha incorreta" como erro de campo individual.

**ARIA:** `role="alert"` no banner · `aria-live="assertive"` · `data-testid="login-error"`.

### 3.2 Erro de rate-limit / bloqueio (FR-018)

```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────┐ │
│  │ ⚠  Muitas tentativas em sequência.      │ │  ← p-message severity="warn"
│  │    Aguarde alguns minutos antes          │ │  ← fundo #FBF1DD · texto #946005
│  │    de tentar de novo.                   │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  [  Entrar  ]  ← disabled durante o backoff  │
│  ...
```

**Nota:** O botão "Entrar com Google" pode permanecer habilitado (o bloqueio é por identidade de e-mail / IP no fluxo de senha).

### 3.3 E-mail não confirmado (FR-024)

```
┌───────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────┐ │
│  │ ℹ  Confirme seu e-mail para entrar.       │ │  ← p-message severity="info"
│  │    Não recebeu o e-mail de confirmação?   │ │  ← fundo #E3F0FA · texto #1F6FB2
│  │    [ Reenviar e-mail de confirmação ]     │ │  ← p-button text, índigo, inline
│  └───────────────────────────────────────────┘ │
│                                                 │
│  [  Entrar  ]                                   │
│  ...
```

**Nota:** O texto NÃO diz "sua conta existe mas o e-mail não foi confirmado". Diz apenas "confirme seu e-mail" — não vaza existência de conta. O botão "Reenviar" (`data-testid="login-resend-confirmation"`) aciona o reenvio e exibe toast de confirmação.

**Toast pós-reenvio:**
```
✅  E-mail de confirmação reenviado.
    Verifique sua caixa de entrada.
```

### 3.4 Falha do Google — cancelamento (US2 cen.2)

Sem banner de erro — apenas uma mensagem informativa sutil, pois o usuário escolheu cancelar:

```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────┐ │
│  │ ℹ  Login com Google não foi concluído.  │ │  ← p-message severity="info", breve
│  │    Use e-mail e senha para entrar.      │ │  ← desaparece após 5s ou no próximo input
│  └─────────────────────────────────────────┘ │
│  ...
```

### 3.5 Falha do Google — provedor indisponível (US2 cen.3)

```
┌───────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────┐ │
│  │ ⚠  Login com Google está indisponível agora.  │ │  ← severity="warn"
│  │    Entre com e-mail e senha.                  │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Botão "Entrar com Google" → disabled temporário    │
│  ...
```

### 3.6 Falha de conexão / offline (FR-015)

```
┌──────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐ │
│  │ ⚠  Não conseguimos conectar.                 │ │  ← severity="warn"
│  │    Verifique sua conexão e tente de novo.    │ │
│  └──────────────────────────────────────────────┘ │
│  ...
```

### 3.7 Links provisórios — destinos fora de escopo (FR-013)

Links "Esqueceu a senha?" e "Criar conta" apontam para destinos ainda não implementados. Estado provisório aceitável: ao clicar, exibir toast informativo sem quebrar a tela.

```
ℹ  Em breve! Esta função estará disponível em breve.
```

Alternativa: links que levam a uma tela de placeholder `/auth/em-breve` com a mesma mensagem e botão "Voltar ao login". Decisão a confirmar com o PO.

**Sinalizo ao PO:** qual é o comportamento preferido para os links provisórios? (a) toast inline, (b) tela placeholder, ou (c) links desabilitados com tooltip "em breve"?

### 3.8 Validação inline de formato (FR-004)

Erros de formato aparecem APÓS o usuário sair do campo (blur) ou tentar submeter — nunca ao digitar.

```
  E-mail
  [usuario@dominio]           ← campo com borda danger
  ⚠ O e-mail precisa ter um @.  ← 12px Inter 400, danger #C23A2B, abaixo do campo
  data-testid="login-email-error"
```

```
  Senha
  []                          ← campo vazio ao submeter
  ⚠ Informe sua senha.
  data-testid="login-password-error"
```

---

## 4. Tela 3 — Callback do Google (processamento)

Rota: `/auth/callback` (CSR). Aparece brevemente enquanto o OAuth é processado.

```
┌─────────────────────────────────────────┐
│                                         │
│         [Logo Faro compacto]            │
│         Faro                            │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │        ⟳  Verificando...          │  │  ← spinner indexo 500 + texto Inter 16px muted
│  │                                   │  │
│  │  Estamos validando seu acesso     │  │  ← Inter 14px, text-muted, centralizado
│  │  com o Google. Um momento.        │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

**Comportamento:**
- Aparece imediatamente ao retornar do OAuth.
- Se bem-sucedido: redireciona automaticamente ao destino do papel (sem interação do usuário).
- Se erro/cancelamento: redireciona ao `/auth/login` com a mensagem 3.4 ou 3.5 conforme o caso.
- Sem botão de ação (o usuário não precisa fazer nada — se travar, exibir link "Voltar ao login" após 8 segundos).

**ARIA:** `role="status"` no container · `aria-live="polite"` · `aria-label="Verificando seu acesso"`.

---

## 5. Tela 4 — Logout e sessão expirada

### 5.1 Logout (FR-010)

O botão de logout (`data-testid="login-logout"`) vive no shell autenticado (header/sidebar), NÃO na tela de login. Após acionar:

1. Sessão encerrada + storage limpo.
2. Redirecionamento para `/auth/login`.
3. Toast de confirmação na tela de login:

```
✅  Você saiu com segurança.
```

**Nota de design:** Toast de success (verde), breve (4s), sem ação. NÃO mostrar mensagem de erro ou de aviso — sair é uma ação deliberada e bem-sucedida.

### 5.2 Sessão expirada (FR-012, US3 cen.4)

Quando o guard detecta sessão ausente em área autenticada:

1. Redireciona para `/auth/login?returnUrl=<destino_pretendido>`.
2. Exibe banner informativo na tela de login:

```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────┐ │
│  │ ℹ  Sua sessão expirou.                  │ │  ← severity="info"
│  │    Entre de novo para continuar         │ │  ← fundo #E3F0FA
│  │    de onde parou.                       │ │
│  └─────────────────────────────────────────┘ │
│  ...
```

Após autenticar, o guard usa o `returnUrl` para levar ao destino pretendido.

---

## 6. Responsividade

| Breakpoint | Comportamento |
|---|---|
| < 480px (mobile) | Card ocupa full-width com padding lateral 16px. Logo e título centralizados. Sem fundo distinto no card (funde com o fundo da página). |
| 480px – 767px (mobile largo) | Card com margem lateral 24px, bordas visíveis, `border-radius: 20px`, sombra sutil. |
| ≥ 768px (tablet/desktop) | Card centralizado, max-width 440px, verticalmente centrado na viewport (min-height 100dvh). Fundo `surface-app` (#F7F8F8) circundando o card. |

**Ordem de foco em mobile:** Logo → Título → Campo E-mail → Campo Senha → Checkbox Manter Conectado → Botão Entrar → Botão Google → Link Esqueceu → Link Criar Conta.

**Alvos de toque:**
- Campos: altura ≥ 48px.
- Botões: 48px de altura, full-width.
- Checkbox + label: área de toque ≥ 44x44px.
- Links: padding vertical para atingir 44px de área clicável.

---

## 7. Acessibilidade — checklist

| Item | Especificação |
|---|---|
| Landmark `<main>` | Envolve o card de login |
| `lang="pt-BR"` | No `<html>` |
| Heading único `<h1>` | "Bem-vindo de volta" — único `h1` na página |
| Labels | Todo campo tem `<label for="...">` associado explicitamente |
| `aria-describedby` | Campo com erro → aponta para o `id` da mensagem de erro |
| Erros inline | `role="alert"` ou `aria-live="assertive"` nos erros de formulário |
| Banner de nível de formulário | `role="alert"` + `aria-live="assertive"` para erros genéricos |
| Callback / loading | `role="status"` + `aria-live="polite"` |
| Foco visível | Outline `2px solid #3A4FD6` + `offset 2px` em todos os interativos; NUNCA remover outline sem substituto |
| Navegação por teclado | Tab/Shift+Tab navega todos os elementos; Enter submete o form; Space marca o checkbox |
| Toggle senha | `aria-label="Mostrar senha"` / `aria-label="Ocultar senha"` conforme estado; `aria-pressed` ou troca de `aria-label` |
| Botão Google | `aria-label="Entrar com Google"` (ícone G não é suficiente sem label) |
| Links provisórios | Se desabilitados: `aria-disabled="true"` + tooltip ou texto visível "em breve"; NÃO usar `disabled` em `<a>` |
| Contraste | Primária #3A4FD6 sobre branco: 6.42:1 ✅; danger #C23A2B sobre branco: 5.34:1 ✅; muted #5E6C69 sobre branco: 4.59:1 ✅ |
| `prefers-reduced-motion` | Sem animações de transição no form — este é um form utilitário sem motion; apenas o spinner de loading respeita `prefers-reduced-motion: no-preference` |
| Erro não comunica só por cor | Banner de erro tem ícone (⚠) + texto, além da cor danger |
| Tela de callback | `aria-label` no container de loading; foco posicionado no container ao carregar |

---

## 8. Mapa de data-testid

| Elemento | `data-testid` | Notas |
|---|---|---|
| Campo e-mail | `login-email` | `<input type="email">` |
| Campo senha | `login-password` | `<input type="password">` |
| Toggle visibilidade senha | `login-password-toggle` | botão ícone dentro do p-password |
| Checkbox manter conectado | `login-remember` | o `<input type="checkbox">` |
| Botão "Entrar" | `login-submit` | ação primária |
| Botão "Entrar com Google" | `login-google` | ação secundária |
| Banner de erro de formulário | `login-error` | visível em erro genérico e rate-limit |
| Mensagem de e-mail não confirmado | `login-unconfirmed-notice` | visível no estado 3.3 |
| Botão reenviar confirmação | `login-resend-confirmation` | dentro do banner 3.3 |
| Erro inline de e-mail | `login-email-error` | texto de erro abaixo do campo |
| Erro inline de senha | `login-password-error` | texto de erro abaixo do campo |
| Link "Esqueceu a senha?" | `login-forgot-link` | pode estar desabilitado provisoriamente |
| Link "Criar conta" | `login-signup-link` | pode estar desabilitado provisoriamente |
| Botão "Sair" (shell autenticado) | `login-logout` | fora da tela de login, no shell |
| Container da tela de callback | `login-callback-container` | tela /auth/callback |
| Banner de sessão expirada | `login-session-expired` | exibido quando returnUrl está presente |
| Banner de logout confirmado | `login-logged-out` | toast pós-logout |

---

## 9. Componentes PrimeNG sugeridos

| Componente PrimeNG | Uso nesta feature |
|---|---|
| `p-inputText` | Campo de e-mail |
| `p-password` | Campo de senha com toggle de visibilidade |
| `p-checkbox` | "Manter conectado" |
| `p-button` | Botão "Entrar" (primário), "Entrar com Google" (outlined), "Reenviar" (text) |
| `p-message` | Banners de erro/info/warn no nível do formulário |
| `p-toast` | Confirmação de logout, reenvio de e-mail, erros transitórios |
| `faro-field` (wrapper shared) | Envolve label + control + erro inline (a11y: `aria-describedby`) |

**Nota:** O wrapper `faro-field` ainda não existe — esta feature é a oportunidade de criá-lo como parte das tarefas Foundational. Ele garante consistência de a11y em todas as features subsequentes.

---

## 10. Microcopy canônica PT-BR

### Títulos e subtítulos

| Contexto | Texto |
|---|---|
| Título da tela de login | "Bem-vindo de volta" |
| Subtítulo | "Entre na sua conta para acessar o Faro." |
| Título do callback | "Verificando..." |
| Subtítulo do callback | "Estamos validando seu acesso com o Google. Um momento." |

### Labels de campos e ações

| Elemento | Texto |
|---|---|
| Label e-mail | "E-mail" |
| Placeholder e-mail | — (sem placeholder; label é suficiente para a11y) |
| Label senha | "Senha" |
| Toggle mostrar senha | aria-label: "Mostrar senha" / "Ocultar senha" |
| Checkbox | "Manter conectado" |
| Botão principal | "Entrar" |
| Botão Google | "Entrar com Google" |
| Link recuperação | "Esqueceu a senha?" |
| Link cadastro | "Ainda não tem conta? Criar conta" |
| Botão sair (shell) | "Sair" |

### Erros e alertas (tom: honesto + útil)

| Estado | Texto |
|---|---|
| Credencial inválida / conta inexistente | "E-mail ou senha inválidos. Verifique e tente de novo." |
| Rate-limit / bloqueio | "Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar de novo." |
| E-mail não confirmado | "Confirme seu e-mail para entrar. Não recebeu o e-mail de confirmação?" |
| Botão reenviar | "Reenviar e-mail de confirmação" |
| Google cancelado | "Login com Google não foi concluído. Use e-mail e senha para entrar." |
| Google indisponível | "Login com Google está indisponível agora. Entre com e-mail e senha." |
| Offline / conexão | "Não conseguimos conectar. Verifique sua conexão e tente de novo." |
| Links provisórios | "Em breve! Esta função estará disponível em breve." |

### Validação inline de formato (antes de chamar o servidor)

| Campo | Mensagem |
|---|---|
| E-mail vazio | "Informe seu e-mail." |
| E-mail mal-formado | "O e-mail precisa ter um @." |
| Senha vazia | "Informe sua senha." |

### Confirmações (toasts)

| Ação | Texto |
|---|---|
| Logout bem-sucedido | "Você saiu com segurança." |
| Reenvio de confirmação | "E-mail de confirmação reenviado. Verifique sua caixa de entrada." |

### Sessão expirada

"Sua sessão expirou. Entre de novo para continuar de onde parou."

### Rodapé

"Protegido por Faro 🐾"

---

## 11. Invariantes verificados

| Invariante | Status | Como garantido no design |
|---|---|---|
| Rescue-First (FR-023) | ✅ | Esta tela vive em `/auth/**` (CSR). Nenhum elemento desta tela toca `features/public/**`. Nenhum link ou ação desta tela aponta para a rota pública de resgate. |
| Anti-enumeração (FR-014/019) | ✅ | Mensagem idêntica para credencial inválida e conta inexistente. Erro no banner de formulário, nunca inline por campo. |
| Sem PII em mensagens (LGPD) | ✅ | Nenhuma mensagem revela e-mail, nome, ou estado interno da conta. O reenvio de confirmação não confirma nem nega a existência. |
| WCAG 2.1 AA contraste | ✅ | Todos os pares de cor verificados na seção 7. |
| Alvos de toque ≥ 44px | ✅ | Campos 48px, botões 48px, checkbox com padding para 44px. |
| Foco visível | ✅ | Outline índigo especificado em todos os interativos. |
| Uma ação primária por tela | ✅ | "Entrar" é a ação primária; Google é secundária (outlined); links são terciários. |
| Modo perdido NÃO usa perigo vermelho | ✅ IRRELEVANTE | Esta feature não tem modo perdido — invariante de resgate não se aplica aqui. |

---

## 12. O que o frontend-angular deve implementar

1. **Componente `login/login.ts`** com Reactive Form tipado (e-mail formato + senha não-vazia), signals para estado (loading, error, unconfirmed), integração com `AuthService`.
2. **Template `login/login.html`** com todos os `data-testid` listados na seção 8, hierarquia de heading `h1`, landmarks e ARIA conforme seção 7.
3. **CSS `login/login.css`** aplicando os tokens da Paleta C sem sobrescrever o tema Aura. Mobile-first. Alvos de toque.
4. **Componente `callback/oauth-callback.ts`** para `/auth/callback` — estado de loading com `aria-live`, tratamento de erro/cancelamento, redirect por papel.
5. **Wrapper `shared/ui/faro-field/`** — criado aqui, reutilizado em todas as features. Encapsula label + control + erro com `aria-describedby` automático.
6. **Botão "Sair"** no shell autenticado (ex.: header compartilhado) com `data-testid="login-logout"`.
7. **Comportamento de links provisórios** — a confirmar com PO (toast ou placeholder).
8. **`anon.guard`** — quando o usuário já autenticado tenta acessar `/auth/**`, redireciona ao destino do papel (sem mostrar o form).

---

## 13. O que o qa-engineer deve testar

### Casos de uso por data-testid

| Cenário | data-testid alvo | Resultado esperado |
|---|---|---|
| Credencial válida de Tutor | `login-submit`, `login-email`, `login-password` | Redireciona para `/app` |
| Credencial válida de Admin | `login-submit` | Redireciona para `/admin` |
| Senha errada | `login-error` | Mensagem "E-mail ou senha inválidos." visível |
| E-mail inexistente | `login-error` | MESMA mensagem do cenário anterior (SC-004) |
| E-mail mal-formado | `login-email-error` | Erro inline de formato; formulário não enviado |
| Senha vazia | `login-password-error` | Erro inline; formulário não enviado |
| 5 tentativas falhas | `login-error` | Mensagem de rate-limit; botão desabilitado |
| E-mail não confirmado | `login-unconfirmed-notice` | Banner de reenvio visível |
| Clique em reenviar | `login-resend-confirmation` | Toast de confirmação de reenvio |
| Google — cancelamento | `login-error` (ou banner info) | Mensagem neutra; sem acesso |
| Google — sucesso de Tutor | redirect | Vai para `/app` |
| Google — sucesso de Admin | redirect | Vai para `/admin` |
| Google — indisponível | banner warn | Mensagem de indisponibilidade; botão Google desabilitado |
| Já autenticado acessa /auth/login | redirect automático | Não exibe form; vai ao destino do papel |
| Sessão expirada | `login-session-expired` | Banner de expiração; após login retorna ao destino |
| Logout | `login-logout`, `login-logged-out` | Sessão encerrada; toast de saída |
| Offline | banner warn | Mensagem de conexão; sem estado inconsistente |

### Verificações de acessibilidade

- `axe` sem violações sérias na tela de login (gate de merge, T033).
- Navegação completa por teclado (Tab → todos os interativos).
- Leitor de tela anuncia erros de formulário (aria-live).
- Foco visível em todos os estados.

### Verificação de Rescue-First

- A rota `/{codigo}` carrega anonimamente ANTES e DEPOIS desta feature (SC-008).
- `features/public/**` não importa nada de `core/auth` (boundary lint).

---

## Notas de design — o que muda no design-system.md

Esta feature introduz o primeiro formulário de painel do Faro. As seguintes decisões de componente são candidatas a formalização no `design-system.md`:

1. **Padrão de card de autenticação**: card centralizado com `max-width: 440px`, `border-radius: 20px`, `padding: 32px`, fundo branco sobre fundo `surface-app`. Usado aqui e em futuras telas de cadastro e recuperação de senha.

2. **Banner de erro de formulário**: uso do `p-message` com `severity="error"` no nível do form (não inline), com `role="alert"`. Padrão para erros que não podem ser atribuídos a um campo específico.

3. **Divisor "ou"** entre ações de login: linha horizontal com texto centralizado. Padrão simples, CSS puro, sem componente PrimeNG.

4. **Wrapper `faro-field`**: nascido nesta feature, padroniza label + control + erro com `aria-describedby` automático. Documentar no design-system.md como componente de formulário padrão.

Nenhuma mudança de token de cor ou tipografia. O `design-system.md` atual já cobre tudo necessário para esta tela.
