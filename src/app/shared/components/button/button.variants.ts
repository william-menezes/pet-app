import { cva, type VariantProps } from 'class-variance-authority';

import { mergeClasses } from '@/shared/utils/merge-classes';

/**
 * Botão do Faro (contrato `shared-components.contract.md` §3.1).
 * A ordem das chaves importa: `zSize` vem antes de `zType` para que o tipo `link` (`h-auto`, `px-0`)
 * vença o tamanho; `zLoading` e `zDisabled` vêm por último para vencer as cores do tipo.
 * O foco é o da regra global de `src/styles.css`: nenhuma classe de foco aqui.
 */
export const buttonVariants = cva(
  mergeClasses(
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-transparent font-display font-semibold whitespace-nowrap transition-colors duration-150 select-none',
    'disabled:pointer-events-none disabled:border-transparent disabled:bg-disabled disabled:text-disabled-foreground',
    '[&_ng-icon]:shrink-0',
  ),
  {
    variants: {
      zSize: {
        sm: "relative h-9 gap-1.5 px-3.5 text-sm before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        md: 'h-11 px-[18px] text-[15px]',
        default: 'h-12 px-[22px] text-base',
        lg: 'h-14 px-5 text-[17px]',
        rescue: 'h-15 w-full gap-2.5 px-6 text-lg md:h-16 md:text-xl',
        icon: 'size-11 rounded-full p-0',
      },
      zType: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-press',
        outline: 'border-foreground bg-card text-foreground hover:bg-background active:bg-muted',
        ink: 'bg-ink text-ink-foreground hover:bg-ink/90 active:bg-ink/80',
        ghost: 'bg-transparent text-foreground hover:bg-foreground/5 active:bg-foreground/10',
        danger: 'bg-transparent text-danger-foreground hover:bg-danger-soft active:bg-danger-soft',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
        link: 'h-auto min-h-11 rounded-none border-0 px-0 font-sans text-link underline underline-offset-[3px]',
        secondary: 'bg-muted text-foreground hover:bg-border',
      },
      zShape: {
        default: '',
        circle: 'rounded-full',
        square: 'rounded-none',
      },
      zLoading: {
        true: 'pointer-events-none',
      },
      zDisabled: {
        true: 'pointer-events-none border-transparent bg-disabled text-disabled-foreground',
      },
    },
    defaultVariants: {
      zType: 'default',
      zSize: 'default',
      zShape: 'default',
    },
  },
);
export type ZardButtonShapeVariants = NonNullable<VariantProps<typeof buttonVariants>['zShape']>;
export type ZardButtonSizeVariants = NonNullable<VariantProps<typeof buttonVariants>['zSize']>;
export type ZardButtonTypeVariants = NonNullable<VariantProps<typeof buttonVariants>['zType']>;
