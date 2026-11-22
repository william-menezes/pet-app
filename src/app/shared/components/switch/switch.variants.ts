import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Interruptor de 52 x 32px (contrato §3.3). Ligado é tinta (`bg-foreground`), nunca lima.
 * O `after` estende a área de toque para 48px de altura.
 */
export const switchVariants = cva(
  "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-input bg-transparent transition-colors duration-150 after:absolute after:-inset-x-3 after:-inset-y-2 after:content-[''] aria-invalid:border-destructive data-[state=checked]:border-foreground data-[state=checked]:bg-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      zSize: {
        default: 'h-8 w-[52px]',
      },
    },
    defaultVariants: {
      zSize: 'default',
    },
  },
);

export type ZardSwitchSizeVariants = NonNullable<VariantProps<typeof switchVariants>['zSize']>;
