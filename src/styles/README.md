# Faro — Design System (estilos)

Fundação visual do Faro, implementada a partir do handoff do **Claude Design**
(pacote-fonte em [`../../design/faro-claude-design/`](../../design/faro-claude-design/)) e alinhada a
[`../../docs/design-system.md`](../../docs/design-system.md). Tokens da **Paleta C "Faro Noturno"**
(Índigo `#3A4FD6` + Verde-Lima `#7FBF3F` + âmbar do modo perdido), Poppins + Inter, tema claro, WCAG AA.

## Arquivos
- **`faro-ds.css`** — tokens (`:root` com cores, raio, espaço, sombra, `--ring`, `--tap`), helpers de tipografia
  (`.t-display`, `.t-h1`…) e as classes de componente de marca: `.f-btn` (variantes primary/secondary/accent/text/danger/whats + `--sm/--lg/--block`, estados hover/active/focus/disabled/loading, `.f-cta-rescue`), `.f-field`/`.f-control`/`.f-switch`/`.f-check`, preview de visibilidade (`.f-preview`), `.f-badge`/`.f-tier`/`.f-chip`, `.f-alert`/`.f-banner`/`.f-lost-band`/`.f-toast`, `.f-appbar`/`.f-bottomnav`/`.f-tabs`, `.f-skel`, `.f-state`, swatches e bits de a11y.
- **`faro-shells.css`** — "cascas" do guia de estilo (Editorial/Console/Showcase). Necessário só se formos
  recriar a página de **console do design system** como rota `/design-system`. Não é preciso para o app em si.
- **`../theme/faro-preset.ts`** — `FaroPreset` do PrimeNG (Aura) com a escala Índigo.

## Como integrar (quando o app Angular estiver scaffoldado)
1. **Fontes** — em `index.html` (ou self-host com `font-display: swap`):
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
   ```
2. **Estilos globais** — em `angular.json` (`styles`) ou via `@import` no `styles.css`:
   `src/styles/faro-ds.css` (e `faro-shells.css` apenas para a rota `/design-system`).
3. **PrimeNG** — em `app.config.ts`:
   ```ts
   import { providePrimeNG } from 'primeng/config';
   import { FaroPreset } from './theme/faro-preset';
   providePrimeNG({ theme: { preset: FaroPreset, options: { darkModeSelector: '.faro-dark' } } });
   ```

## Como usar
- **Componentes PrimeNG** herdam a cor primária (índigo) via `FaroPreset` — use-os normalmente.
- **Classes `.f-*`** cobrem o que é específico da marca e que o PrimeNG não entrega pronto
  (CTA gigante de resgate, faixa âmbar do modo perdido, preview de visibilidade, badges de tier do plano).
- **Tokens** (`var(--primary)`, `var(--lime)`, `var(--amber)`, `var(--r-lg)`, `var(--tap)`…) para estilos sob medida.
- **Regra de contraste:** texto sobre cor de ação usa o tom 600 (exceção: índigo 500 já passa AA).
  Modo perdido usa **âmbar** (`--amber`), nunca vermelho/danger em tela cheia (Rescue-First/empatia).

> Proveniência: gerado via Claude Design e processado pelo handoff. A reimplementação de telas (rotas, componentes Angular)
> é feita pelo agente `frontend-angular`, usando estes tokens/classes como fonte visual.
