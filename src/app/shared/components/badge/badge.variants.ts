import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Selo (contrato §3.4): pílula sem borda, `font-semibold`. Âmbar só aparece no tipo `warning`, que é
 * do modo perdido e do selo "Bloqueado" do admin.
 */
export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full font-semibold whitespace-nowrap [&>ng-icon]:shrink-0',
  {
    variants: {
      zType: {
        neutral: 'bg-neutral-soft text-neutral-foreground',
        success: 'bg-success-soft text-success-foreground',
        warning: 'bg-warning-soft text-warning-foreground',
        danger: 'bg-danger-soft text-danger-foreground',
        ink: 'bg-foreground text-background',
        outline: 'border border-border bg-card text-foreground',
      },
      zSize: {
        default: 'h-6 px-2.5 text-xs',
        lg: 'h-8 px-3 text-[13px]',
      },
    },
    defaultVariants: {
      zType: 'neutral',
      zSize: 'default',
    },
  },
);

export type ZardBadgeTypeVariants = NonNullable<VariantProps<typeof badgeVariants>['zType']>;
export type ZardBadgeSizeVariants = NonNullable<VariantProps<typeof badgeVariants>['zSize']>;
