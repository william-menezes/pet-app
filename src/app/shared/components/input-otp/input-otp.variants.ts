import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Células de código (contrato §3.7): 6 posições em grade, até 368px. Cada célula tem 60px, Outfit
 * 26px semibold e três bordas: vazia (1,5px, `border-input`), preenchida (1,5px, `border-foreground`)
 * e ativa (2,5px, `border-foreground`). O foco visível é o da regra global.
 */
export const inputOtpVariants = cva('grid max-w-[368px] grid-cols-6 gap-2 has-disabled:opacity-50');

/** Os grupos não desenham nada: as células ficam direto na grade. */
export const inputOtpGroupVariants = cva('contents');

export const inputOtpSlotVariants = cva(
  'relative h-[60px] w-full min-w-0 rounded-md border-[1.5px] border-input bg-card text-center font-display font-semibold text-foreground uppercase transition-colors duration-150 disabled:cursor-not-allowed aria-invalid:border-destructive data-filled:border-foreground data-active:border-[2.5px] data-active:border-foreground data-active:aria-invalid:border-destructive',
  {
    variants: {
      zSize: {
        default: 'text-[26px]',
      },
    },
    defaultVariants: {
      zSize: 'default',
    },
  },
);

export const inputOtpSeparatorVariants = cva('flex items-center', {
  variants: {
    zSize: {
      default: "[&_svg:not([class*='size-'])]:size-4",
    },
  },
  defaultVariants: {
    zSize: 'default',
  },
});

export type ZardInputOtpSize = NonNullable<VariantProps<typeof inputOtpSlotVariants>['zSize']>;
export type ZardInputOtpVariants = VariantProps<typeof inputOtpVariants>;
export type ZardInputOtpSlotVariants = VariantProps<typeof inputOtpSlotVariants>;
export type ZardInputOtpGroupVariants = VariantProps<typeof inputOtpGroupVariants>;
export type ZardInputOtpSeparatorVariants = VariantProps<typeof inputOtpSeparatorVariants>;

/** Modo de entrada: `numeric` (código por SMS) ou `alphanumeric` (PIN de ativação, `0-9` e `A-Z`). */
export type ZardInputOtpMode = 'numeric' | 'alphanumeric';
