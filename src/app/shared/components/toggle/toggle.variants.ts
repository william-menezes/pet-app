import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Chip (contrato §3.4): 38px de altura, área de toque de 44px pelo `after` (o inset conta a partir da caixa de preenchimento, que é 2px menor por causa da borda). Escolhido é tinta
 * (`bg-foreground text-background`), nunca lima. O tipo `segmented` é a opção do controle segmentado
 * (a trilha vem de `toggle-group.variants.ts`). O foco é o da regra global.
 */
export const toggleVariants = cva(
  "relative inline-flex h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-[''] disabled:pointer-events-none disabled:border-transparent disabled:bg-disabled disabled:text-disabled-foreground aria-invalid:border-destructive [&_ng-icon]:shrink-0",
  {
    variants: {
      zType: {
        default:
          'border-border bg-card text-foreground hover:not-data-[state=on]:bg-background data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background',
        outline:
          'border-input bg-card text-foreground hover:not-data-[state=on]:bg-background data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background',
        segmented:
          'h-10 border-0 bg-transparent px-3 text-sm text-foreground after:-inset-y-0.5 data-[state=on]:bg-foreground data-[state=on]:text-background',
      },
      zSize: {
        default: '',
      },
    },
    defaultVariants: {
      zType: 'default',
      zSize: 'default',
    },
  },
);
export type ZardToggleTypeVariants = NonNullable<VariantProps<typeof toggleVariants>['zType']>;
export type ZardToggleSizeVariants = NonNullable<VariantProps<typeof toggleVariants>['zSize']>;
