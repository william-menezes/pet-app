# Brief para o Claude Design — Design System do Faro

> **Objetivo:** gerar no **Claude Design** (Anthropic Labs, no claude.ai) o **design system visual** do Faro
> com todos os componentes base, já alinhado às decisões do projeto (Paleta C, Poppins+Inter, tokens, tom de voz).
>
> **Fonte:** este brief deriva de [`design-system.md`](design-system.md) e da [constituição](../.specify/memory/constitution.md). Em conflito, a constituição vence.

## Como usar
1. No **claude.ai → Claude Design**, crie um **projeto** novo.
2. (Recomendado) **anexe `design-system.md`** (e, se possível, **conecte o repositório**) para ele herdar os tokens.
3. **Cole o prompt** da seção abaixo.
4. Peça **2–3 variações**; itere por chat e comentários inline; rode a **revisão de acessibilidade**.
5. **Exporte** (HTML/ZIP/PDF) ou use **"entregar para o Claude Code"** → aqui o agente **`frontend-angular`** reimplementa na nossa stack.

> ⚠️ **Importante:** o Claude Design exporta **HTML standalone**, não Angular + PrimeNG Aura. Use o resultado como
> **referência visual de alta fidelidade**; a implementação de produção é feita pelo `frontend-angular` em PrimeNG/Angular
> (precedência: constituição > docs > ferramenta).

---

## Prompt para colar no Claude Design

```
Gere uma página de DESIGN SYSTEM / style guide para o app "Faro" — cuidado de saúde + tag QR de resgate para pets (mercado Brasil, PT-BR). Público: tutores de cães e gatos (mobile-first) + time de produto. A saída será referência visual para implementação em Angular 21 + PrimeNG (tema Aura) — use padrões de componente convencionais.

MARCA & PERSONALIDADE: acolhedor, confiável, calmo, claro (arquétipos Cuidador + Companheiro). NÃO infantil, NÃO alarmista, NÃO corporativo-frio. Geometria arredondada. Tagline: "Faro: o caminho de volta para casa."

TEMA: claro (light) como padrão. Mobile-first (~360px) expandindo para desktop. Acessibilidade WCAG 2.1 AA obrigatória.

CORES (use exatamente estes tokens):
- Primária Índigo: 50 #EAEDFB · 100 #CBD3F5 · 200 #A6B3EE · 300 #7B8CE4 · 400 #566DDD · 500 #3A4FD6 (primária; texto branco passa AA) · 600 #2D3CAC (hover) · 700 #212C80 (títulos/pressed) · 800 #171E58 · 900 #0E1336 · 950 #080B20.
- Accent Verde-Lima #7FBF3F — CTA secundário e selo de recompensa; SEMPRE texto escuro sobre a lima.
- Modo perdido (faixa) âmbar #C26A12 — "urgência calma"; NUNCA usar vermelho/danger em tela cheia no modo perdido.
- Semânticas (texto sobre branco): success #157A3F · info #1F6FB2 · warn #946005 · danger #C23A2B. Fundos claros: success #E4F4EA · info #E3F0FA · warn #FBF1DD · danger #FBE7E4.
- Superfícies/texto: surface-0 #FFFFFF · app #F7F8F8 · divisor #EEF0F1 · borda #E2E5E7 · texto-forte #13201E · texto #33403D · muted #5E6C69.
- Regra de contraste: texto normal sobre cor de ação usa o tom 600 (exceção: índigo 500 já passa AA).

TIPOGRAFIA:
- Títulos/Display: Poppins (600/700). Texto/UI: Inter (400/500/600). Datas e valores em R$ usam Inter com tabular-nums.
- Escala (base 16px, Major Third): display 32→40px/700 · h1 28/700 · h2 22/600 · h3 18/600 · body-lg 18/400 · body 16/400 · body-sm 14/400 · caption 12/500 · button 16/600. Corpo nunca < 16px em fluxos críticos.

FORMA/ESPAÇO: raio 8/12/20px (cards e dialogs usam 20) · escala de espaço 4/8/12/16/24/32 · sombra de card suave · alvo de toque ≥ 44px.

GERE OS COMPONENTES ABAIXO, cada um mostrando os estados: default, hover, focus, active, disabled, loading e error.
1. Capa/header da marca: "Faro 🐾" + tagline + resumo da paleta.
2. Swatches de cor: escala primária completa, accent, âmbar do modo perdido, semânticas e neutros/superfícies — com hex e uso.
3. Specimen tipográfico: todos os níveis da escala, com exemplo de data "03/06/2026" e "R$ 19,90" (tabular-nums).
4. Botões: primário, secundário, accent (lima), texto/link e danger; tamanhos sm/md/lg; com ícone; estado loading; variante full-width (mobile). Inclua o "CTA de resgate" gigante.
5. Campos de formulário: input de texto, select, data, textarea, switch/toggle, checkbox e radio — com label, texto de ajuda e erro inline. Inclua o TOGGLE DE VISIBILIDADE DE CAMPO com preview "como estranhos verão" (default privado).
6. Cards: (a) perfil do pet (foto, nome, espécie/porte, temperamento, badges); (b) item de registro de saúde (ícone + tipo + data + "próxima dose"); (c) lembrete; (d) plano (Grátis / Pro / Família com preço).
7. Badges/Tags/Chips: status (vacina em dia=success, carência=warn, inativo=muted), selo "Recompensa oferecida" (âmbar), tier do plano.
8. Alertas/Banners/Toasts: success/info/warn/danger; banner não-bloqueante de carência ("A página de resgate continua ativa 🐾"); BANNER DE MODO PERDIDO em âmbar com urgência calma ("Este pet está perdido. Sua ajuda pode levá-lo para casa.").
9. Navegação: top app bar + bottom navigation (mobile) + tabs.
10. Telas-âncora em alta fidelidade:
   a. PÁGINA PÚBLICA DE RESGATE (a tela mais importante): foto grande do pet (elemento principal), título "Você encontrou o Thor? 🐾", UMA ação enorme "Avisar o tutor no WhatsApp", bloco só com campos consentidos (nome, espécie/porte, temperamento "dócil", observação de saúde) e rodapé discreto "Protegido por Faro". Mostre também a VARIANTE modo perdido (faixa âmbar no topo + selo de recompensa). Sem login, sem popup.
   b. DASHBOARD DO TUTOR: lista de pets, próximos lembretes e atalhos.
11. Estados: vazio (sem pets / sem registros), carregando (skeleton) e erro (com saída/ação).
12. Iconografia (estilo de linha, como PrimeIcons): pet (coração), vacina (escudo), consulta (calendário), peso (gráfico de linha), QR (qrcode), localização (pin de mapa), modo perdido (triângulo de atenção em âmbar, não vermelho), WhatsApp, privacidade (olho / olho cortado).

MICROCOPY: PT-BR, 2ª pessoa ("você"), rótulo de botão = verbo + objeto ("Adicionar vacina", "Ativar modo perdido"). Tom: tranquilizador no cotidiano; muito empático + objetivo no resgate; honesto + útil em erros. Emojis com parcimônia (um 🐾 leve é ok; nunca 😱 no modo perdido).

Entregue 2–3 variações de layout do style guide e faça uma revisão de acessibilidade (contraste, foco visível, ordem de leitura).
```
