# Data Model: Migração de UI para ZardUI + Tailwind v4

**Feature**: `002-ui-zardui` · **Data**: 2026-11-21 · **Plan**: [plan.md](./plan.md)

## Banco de dados

**Esta feature não muda o banco.** Nenhuma tabela, coluna, política de RLS, RPC, Edge Function,
bucket ou migration é criada ou alterada. A pasta `supabase/` não é tocada. O glossário de domínio
do `CLAUDE.md` (Tutor, Pet, TagCode, TagAssignment, ScanEvent…) não ganha nem perde termos.

O único dado que esta feature grava fica **no navegador**:

| Dado | Onde | Chave | Valores | Dono |
|---|---|---|---|---|
| Preferência de tema | `localStorage` do aparelho | `faro.theme` | `light` \| `dark` \| `system` (ausente ou inválido vale `system`) | `ThemeService` (`src/app/core/theme/`) |

Não é dado pessoal, não vai para o servidor, não entra em exportação nem em exclusão de conta.
Some quando o tutor limpa os dados do site.

## "Entidades" de interface

O que esta feature cria é um vocabulário de interface. Cada item tem um contrato.

### 1. Token

Um valor nomeado de cor, raio, fonte ou sombra. Existe em **um** lugar (`src/styles.css`).

| Atributo | Descrição |
|---|---|
| nome | variável CSS (`--primary`) e a classe que ela gera (`bg-primary`) |
| valor claro | obrigatório |
| valor escuro | opcional; se ausente, é igual ao claro |
| papel | para que serve, e o que **não** pode fazer (as quatro regras de cor) |

Regras: nenhum componente usa valor solto; todo par texto/fundo usado tem contraste mínimo
conferido por script. Contrato: [design-tokens.contract.md](./contracts/design-tokens.contract.md).

### 2. Tema

O conjunto de valores dos tokens em vigor numa área da tela.

| Tema | Onde vale | Como é ligado |
|---|---|---|
| claro | em todo o produto, por padrão | `:root` |
| escuro | só dentro da casca do app do tutor | classe `dark` no hospedeiro de `app-tutor-shell` |

Estados da **preferência**: `system` (padrão) → `light` ou `dark` por escolha do tutor → de volta
a `system`. O **tema resolvido** é sempre `light` ou `dark`.
Contrato: [shells.contract.md](./contracts/shells.contract.md) §6.

### 3. Ícone

| Atributo | Descrição |
|---|---|
| nome do Faro | `pin`, `warn`, `home`… (32 nomes) |
| glifo | export do `@boxicons/js` |

Um registro só (`src/app/shared/icons/faro-icons.ts`). Contrato:
[shared-components.contract.md](./contracts/shared-components.contract.md) §2.

### 4. Componente compartilhado

| Tipo | Onde | Quantos | Exemplos |
|---|---|---|---|
| ZardUI copiado e editado | `src/app/shared/components/<nome>/` | 18 (+ dependências que o CLI traz) | botão, campo, caixa, interruptor, selo, chip, segmentado, cartão, linha, aviso, diálogo, células de código |
| Próprio do Faro | `src/app/shared/components/faro/<nome>/` | 12 | logo, focinho, painel de marca, marca circular, "G" do Google, quadrado de ícone, cartão de informação, nota, cartão de número, passos, capa do pet, cartão de ação |

Atributos de um componente: seletor, entradas, projeções de conteúdo, estados (normal,
desativado, inválido, carregando, selecionado), regras de acessibilidade. Contrato:
[shared-components.contract.md](./contracts/shared-components.contract.md).

**Arquivos de marca**: `brand-assets.ts` é a única ligação entre o código e os arquivos do logo
em `public/logos/`.

### 5. Casca

A estrutura fixa de uma área. Recebe a tela por projeção.

| Casca | Área | Tema | Navegação |
|---|---|---|---|
| `app-tutor-shell` | app autenticado do tutor | claro ou escuro | barra inferior (celular, só telas-raiz), trilho (tablet), menu lateral (desktop) |
| `app-flow-shell` | conta, ativação, cadastro | sempre claro | voltar ou fechar; passos |
| `app-admin-shell` | admin | sempre claro | abas roláveis no topo (celular e tablet), menu lateral (desktop) |
| `app-public-layout` + `app-public-footer` | página da tag e página inicial | sempre claro | nenhuma |

Auxiliares: `app-screen-header` (topo das telas internas do tutor) e `ShellFallback` (tela "em
construção"). Contrato: [shells.contract.md](./contracts/shells.contract.md).

### 6. Item de navegação

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | identifica o item nos testes |
| `label` | texto | rótulo em PT-BR |
| `icon` | nome de ícone do Faro | |
| `link` | caminho | destino |
| `exact` | booleano | ativo só no caminho exato |

Listas iniciais: `TUTOR_NAV` (Início, Pets, Scans, Conta) e `ADMIN_NAV` (Lotes, Códigos, Fila de
scans, Auditoria). Os caminhos são provisórios; as specs 003 e 004 confirmam.

## Relações

```text
Token ──usado por──▶ Componente compartilhado ──usado por──▶ Casca ──hospeda──▶ Tela (specs 001, 003, 004)
  ▲                         ▲
  └── Tema define o valor   └── Ícone
```

Uma tela nunca fala com um token por valor solto, nunca cria um segundo tema e nunca desenha a
própria navegação.
