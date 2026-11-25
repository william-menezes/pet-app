# Faro on ZardUI

The Angular app builds its UI with **ZardUI** (zardui.com: shadcn/ui for Angular, Tailwind CSS v4, signals, SSR-ready) and draws every icon from **Boxicons v3** (boxicons.com, free set). PrimeNG and PrimeIcons are retired. This section is how the tokens, components and icons of this system land in that stack. ZardUI copies each component's source into the project (`src/app/shared/components/`), so Faro's rules are applied by editing those files, not by overriding a theme from outside.

> **Revised 2026-11-21 for the tag MVP.** Four colour rules now drive every component: **lime acts** (`bg-primary`, dark text), **ink selects** (`bg-foreground text-background` on the chosen chip, segment, nav item, checkbox and switch), **navy is the brand** (panels, footer, links) and **amber is only lost mode**. Headings and button labels are **Outfit**. WhatsApp and Google buttons carry the companies' own glyphs.

## 1. Theme: `src/styles.css`

ZardUI reads shadcn's CSS variables. Faro fills them with its own tokens, adds the colors shadcn has no slot for, and replaces Tailwind's indigo scale with Faro's navy (regenerated from `#25337A`) so `bg-indigo-700` means Faro's navy. The tutor app has a dark theme (section 5); the public rescue page, the account and activation flows and the admin never get `.dark`.

```css
@layer ng-icon, theme, base, components, utilities;
@import 'tailwindcss';
@plugin 'tailwindcss-animate';
@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.75rem;                                  /* 12px: buttons, inputs */
  --background: #F7F8F8;  --foreground: #13201E;     /* app / text-strong */
  --card: #FFFFFF;        --card-foreground: #13201E;
  --popover: #FFFFFF;     --popover-foreground: #13201E;
  --primary: #84C32E;     --primary-foreground: #13201E;   /* lime acts, 7.8:1 */
  --primary-hover: #76B027; --primary-press: #689B22;
  --secondary: #EEF0F8;   --secondary-foreground: #25337A; /* 9.8:1 */
  --muted: #EEF0F1;       --muted-foreground: #5E6C69;     /* 4.8:1 on muted, 5.5:1 on white */
  --accent: #EEF0F8;      --accent-foreground: #25337A;    /* shadcn "accent" = hover fill, NOT Faro's lime */
  --destructive: #C23A2B; --destructive-foreground: #FFFFFF; --destructive-hover: #A52E22;
  --border: #E2E5E7;      /* decorative: cards, dividers */
  --input: #7F8B88;       /* border-control: input, checkbox, switch edges, 3.5:1 */
  --ring: #13201E;
  --chart-1: #25337A; --chart-2: #557F29; --chart-3: #C26A12; --chart-4: #1F6FB2; --chart-5: #8E9ACF;
  --sidebar: #FFFFFF; --sidebar-foreground: #13201E; --sidebar-primary: #13201E; --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #EEF0F8; --sidebar-accent-foreground: #25337A; --sidebar-border: #E2E5E7; --sidebar-ring: #13201E;

  /* Faro colors with no shadcn slot */
  --text: #33403D;                                     /* body copy, 10:1 */
  --lime: #84C32E; --lime-hover: #76B027; --lime-press: #689B22; --lime-foreground: #13201E;
  --success: #157A3F; --success-soft: #E4F4EA;
  --info: #1F6FB2;    --info-soft: #E3F0FA;
  --warning: #946005; --warning-soft: #FBF1DD;
  --danger-soft: #FBE7E4;
  --amber: #C26A12;                                    /* modo perdido: icons, pins */
  --lost: #A85A0E; --lost-foreground: #FFFFFF;         /* the lost band, 5.1:1 */
  --whatsapp: #16793D; --whatsapp-hover: #126633; --whatsapp-press: #0E5229; --whatsapp-foreground: #FFFFFF;
}

@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover); --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-primary-hover: var(--primary-hover); --color-primary-press: var(--primary-press);
  --color-secondary: var(--secondary); --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent); --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive); --color-destructive-foreground: var(--destructive-foreground);
  --color-destructive-hover: var(--destructive-hover);
  --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring);
  --color-chart-1: var(--chart-1); --color-chart-2: var(--chart-2); --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4); --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar); --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary); --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent); --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border); --color-sidebar-ring: var(--sidebar-ring);
  --color-text: var(--text);
  --color-lime: var(--lime); --color-lime-hover: var(--lime-hover); --color-lime-press: var(--lime-press);
  --color-lime-foreground: var(--lime-foreground);
  --color-success: var(--success); --color-success-soft: var(--success-soft);
  --color-info: var(--info); --color-info-soft: var(--info-soft);
  --color-warning: var(--warning); --color-warning-soft: var(--warning-soft); --color-danger-soft: var(--danger-soft);
  --color-amber: var(--amber); --color-lost: var(--lost); --color-lost-foreground: var(--lost-foreground);
  --color-whatsapp: var(--whatsapp); --color-whatsapp-hover: var(--whatsapp-hover);
  --color-whatsapp-press: var(--whatsapp-press); --color-whatsapp-foreground: var(--whatsapp-foreground);

  /* Faro's indigo replaces Tailwind's */
  --color-indigo-50: #EEF0F8; --color-indigo-100: #DADFF0; --color-indigo-200: #B8C0E2;
  --color-indigo-300: #8E9ACF; --color-indigo-400: #6574B8; --color-indigo-500: #44549F;
  --color-indigo-600: #32418C; --color-indigo-700: #25337A; --color-indigo-800: #1A2459;
  --color-indigo-900: #0E1336; --color-indigo-950: #080B20;

  /* Faro radii: 8 / 12 / 20 */
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 12px; --radius-xl: 20px;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-display: 'Outfit', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  --shadow-card: 0 1px 2px rgba(19,32,30,.05), 0 6px 20px rgba(19,32,30,.06);
  --shadow-pop: 0 12px 34px rgba(19,32,30,.14), 0 3px 10px rgba(19,32,30,.06);
}

@layer base {
  * { @apply border-border; }                /* ZardUI's outline-ring/50 removed: see §2 */
  body { @apply bg-background text-text font-sans antialiased; }
  h1, h2, h3 { @apply font-display text-foreground tracking-[-0.01em]; }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }   /* --ring is ink, not lime: lime on white is 2.1:1 */
}
```

Self-host Inter and Outfit (latin + latin-ext woff2) for the SSR rescue routes; this system loads them from Google Fonts only for its previews.

## 2. Edits to the copied ZardUI components

Out of the box ZardUI is a dense desktop kit. Four of its defaults break Faro rules, so change them once in `src/app/shared/components/` right after `npx zard-cli@latest add …`:

- **Focus.** ZardUI draws a 3px ring at 50% opacity (`focus-visible:ring-3 focus-visible:ring-ring/50`), about 1.9:1 on white. Replace it in every `*.variants.ts` with Faro's solid ring: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`. Same for `aria-invalid:ring-destructive/20` → `aria-invalid:ring-2 aria-invalid:ring-destructive`.
- **Touch targets.** Buttons are 28–36px and inputs 32px; Faro needs 44px (`--tap`). Inputs: `h-8` → `h-11`, `border` → `border-[1.5px]`, `px-2.5` → `px-3.5`, and keep `text-base` (16px, which also stops iOS zooming into the field).
- **Destructive.** ZardUI's destructive button is a pale red tint; Faro's is solid red with white text.
- **Selected chip on hover (2026-11-25).** `toggle.variants.ts`: `hover:bg-background` beat `data-[state=on]:bg-foreground`, so a selected chip turned pale grey under the mouse. Both chip types now use `hover:not-data-[state=on]:bg-background`.
- **Missing variants.** Faro needs `accent` (lime) and `whatsapp`, and a 60px `rescue` size for the rescue page.

`button.variants.ts`, the parts that change:

```ts
// base: replace `rounded-lg … text-sm font-medium … focus-visible:ring-3 focus-visible:ring-ring/50`
'… rounded-full border-[1.5px] border-transparent font-display text-base font-semibold … focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background …'

zType: {
  default:     'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-press',
  outline:     'bg-card border-foreground text-foreground hover:bg-background active:bg-muted',                               // Faro "secondary": ink outline
  secondary:   'bg-secondary text-secondary-foreground hover:bg-indigo-100',
  accent:      'bg-lime text-lime-foreground hover:bg-lime-hover active:bg-lime-press',   // same as default since 2026-11-21; kept for older screens
  whatsapp:    'bg-lime text-lime-foreground hover:bg-lime-hover active:bg-lime-press',   // lime, with the official WhatsApp glyph in ink
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
  ghost:       'text-foreground hover:bg-foreground/5',                                                               // Faro "text"
  link:        'text-indigo-700 underline underline-offset-4',
},
zSize: {
  default: 'h-12 gap-2 px-5.5',                         // 48px
  sm:      'h-9 gap-1.5 px-3.5 text-sm',                // 36px: dense rows only, never the primary action
  lg:      'h-14 gap-2 px-7 text-[17px]',               // 56px: bottom actions of a screen
  rescue:  'h-15 w-full gap-2.5 px-6 text-lg',          // new: the rescue page CTA
  icon:    'size-10 rounded-full',                      // 40px circle; add before:absolute before:-inset-0.5 for a 44px hit area
},
```

Then extend `ZardButtonTypeVariants` / `ZardButtonSizeVariants` (they derive from the cva, so nothing else changes). Microcopy stays verb + object ("Adicionar vacina"), never "OK".

## 3. Which ZardUI component for which Faro component

| Faro (this system) | In the app | Notes |
| --- | --- | --- |
| Button | `z-button` | variants from §2: default, outline, accent, whatsapp, destructive, ghost |
| IconButton | `z-button zSize="icon"` | 40px circle (white `bg-card` on the app background, `bg-primary` for the add action); always `aria-label` |
| TextField | `z-field` + `input[z-input]` | label above, help/error below; error text in `destructive` |
| Select | `z-select` (`native-select` on the rescue page) | |
| Switch · Checkbox | `z-switch` · `z-checkbox` · `z-radio-group` | edges use `--input` |
| Card · ListItem | `z-card` · `z-item` | flat: `rounded-xl` white on `bg-background`, no border or shadow; rows with an icon tile, title, subtitle and one trailing value/badge/control |
| Badge · PlanTier · Chip | `z-badge` · `z-toggle` | soft-tint status pills without borders; chips white with a hairline, `bg-foreground text-white` when selected |
| Alert · Banner | `z-alert` | soft backgrounds (`bg-info-soft text-info`…) |
| Toast | `z-sonner` (`z-toast`) | dark `bg-indigo-950` bar, white text, lime action ("Desfazer") |
| Tabs (segmented) | `z-toggle-group` (single) · `z-tabs` | pill track on `bg-card`, selected item `bg-foreground text-white` |
| Dialog | `z-alert-dialog` (centered decision card) · `z-sheet` side="bottom" (short tasks) | never on the rescue page |
| Skeleton | `z-skeleton` | shimmer off under reduced motion |
| EmptyState | `z-empty` + the farol beam | keep Faro's dark tone for brand moments |
| AppBar · BottomNav · LostBand · PetCard · Beam · Logo | Faro's own (Tailwind + these tokens) | no ZardUI equivalent; build them as Faro components |

## 4. Icons: Boxicons v3 through ng-icons

ZardUI renders icons with `@ng-icons/core` (`<ng-icon name="…">`). ng-icons accepts any SVG string, so Faro registers Boxicons v3 glyphs from `@boxicons/js` (MIT, free set) under Faro's icon names and uses them everywhere: in Faro's own components and in ZardUI's.

```bash
npm i @boxicons/js
# @ng-icons/core comes with ZardUI. Its 35+ releases need Angular 22; on Angular 21 stay on 34.x.
```

`src/app/shared/icons/faro-icons.ts`:

```ts
import { createSvgString, AlertCircle, AlertTriangle, Bell, Calendar, ChartLine, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Cog, DotsHorizontal, Edit, Eye, EyeSlash, Heart, Home, InfoCircle, Location, Lock, Menu, PawPrint, Phone, Plus, Qr, RefreshCw, Search, Share, Shield, Sparkles, Star, Syringe, Tag, User, Whatsapp, X } from '@boxicons/js';

const svg = (icon: Parameters<typeof createSvgString>[0], o: Parameters<typeof createSvgString>[1] = {}) =>
  createSvgString(icon, o).replace(/ width="\d+" height="\d+"/, '');   // ng-icon sizes it

/** Faro name → Boxicons v3 glyph (basic pack unless noted). Same table as the Icon card. */
export const faroIcons = {
  pet: svg(Heart), // bx heart
  paw: svg(PawPrint), // bx paw-print
  vacina: svg(Syringe), // bx syringe
  consulta: svg(Calendar), // bx calendar
  peso: svg(ChartLine), // bx chart-line
  qr: svg(Qr), // bx qr
  local: svg(Location), // bx location
  perdido: svg(AlertTriangle), // bx alert-triangle
  whats: svg(Whatsapp, { pack: "brands" }), // bx whatsapp
  shield: svg(Shield), // bx shield
  tag: svg(Tag), // bx tag
  plus: svg(Plus), // bx plus
  check: svg(Check), // bx check
  x: svg(X), // bx x
  info: svg(InfoCircle), // bx info-circle
  alert: svg(AlertCircle), // bx alert-circle
  menu: svg(Menu), // bx menu
  chevron: svg(ChevronRight), // bx chevron-right
  search: svg(Search), // bx search
  user: svg(User), // bx user
  gear: svg(Cog), // bx cog
  share: svg(Share), // bx share
  edit: svg(Edit), // bx edit
  refresh: svg(RefreshCw), // bx refresh-cw
  clock: svg(Clock), // bx clock
  bell: svg(Bell), // bx bell
  home: svg(Home), // bx home
  eye: svg(Eye), // bx eye
  eyeoff: svg(EyeSlash), // bx eye-slash
  lock: svg(Lock), // bx lock
  phone: svg(Phone), // bx phone
  back: svg(ChevronLeft), // bx chevron-left
  down: svg(ChevronDown), // bx chevron-down
  more: svg(DotsHorizontal), // bx dots-horizontal
  ai: svg(Sparkles), // bx sparkles
  star: svg(Star), // bx star
};
```

```ts
// app.config.ts
import { provideIcons } from '@ng-icons/core';
import { faroIcons } from '@/shared/icons/faro-icons';
providers: [provideZard(), provideIcons(faroIcons)]
```

```html
<ng-icon name="vacina" size="24" aria-hidden="true" />
<button z-button zSize="icon" aria-label="Lembretes"><ng-icon name="bell" /></button>
```

- **Style.** `basic` (outline look) everywhere; register a `filled` copy (`createSvgString(Home, { pack: 'filled' })` as `homeFilled`) only for active states such as the current bottom-nav tab.
- **ZardUI's own glyphs.** Its components import a few Lucide icons (`lucideCheck`, `lucideChevronDown`, `lucideX`…). Swap them for Boxicons when you copy each component (`check`, `x` and `down` from the table), then drop `@ng-icons/lucide`, so one stroke style runs through the whole app.
- **New icons.** Pick from boxicons.com with the Free filter and the Basic style, add the import and a Faro name to `faro-icons.ts`, and add the same glyph to this system's `Icon` component so design and app stay in step.
- Decorative icons get `aria-hidden="true"`; an icon that is the whole control gets `aria-label` on the control.

## 5. Dark theme and breakpoints

Only the authenticated tutor app gets the dark theme. Add the class on the tutor shell, never on `:root`, so the public and account routes stay light.

```css
.dark {
  --background: #0B0F2A;  --foreground: #F3F5FC;
  --card: #161C4A;        --card-foreground: #F3F5FC;
  --popover: #161C4A;     --popover-foreground: #F3F5FC;
  --secondary: #1F2760;   --secondary-foreground: #F3F5FC;
  --muted: #1F2760;       --muted-foreground: #A6ADD0;   /* 7.3:1 on card */
  --accent: #1F2760;      --accent-foreground: #F3F5FC;
  --border: #2B3470;      --input: #7C87C4;              /* 3:1 or better on card and background */
  --ring: #F3F5FC;
  --text: #D8DCF0;
  --success-soft: #12392A; --warning-soft: #3B2A10; --danger-soft: #4A1C17;
  /* --primary (lime), --lost and the navy scale do not change */
}
```

Selection flips with the theme because it is written as `bg-foreground text-background`: an ink pill on light, a light pill on dark. Links use `text-indigo-700` on light and `dark:text-indigo-200`. Use the white-letter wordmark on dark grounds.

Breakpoints, mobile first: the base styles are the 390px phone layout; `md:` (768px) swaps the bottom nav for the icon rail and centres forms in one 480px column; `xl:` (1280px) brings the sidebar with the wordmark and puts the photo or the navy brand panel on the left half. Screens are drawn at 390, 768 and 1440.

The Google "G" is the official four-colour SVG, inlined in the button; it is not a Boxicons glyph.
