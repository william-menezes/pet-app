import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Aviso (contrato §3.6): sem borda. Só existem `neutral`, `success` e `danger`: não há aviso âmbar
 * (âmbar é do modo perdido) nem azul.
 */
export const alertVariants = cva(
  "group/alert relative flex w-full items-start gap-3 rounded-card-sm px-3.5 py-3 text-start text-sm leading-[1.45] has-data-[slot='alert-action']:pe-18",
  {
    variants: {
      zType: {
        neutral: 'bg-neutral-soft text-neutral-foreground',
        success: 'bg-success-soft text-success-foreground',
        danger: 'bg-danger-soft text-danger-foreground',
      },
    },
    defaultVariants: {
      zType: 'neutral',
    },
  },
);

export const alertIconVariants = cva('mt-px shrink-0 self-start text-current');

export const alertActionVariants = cva('absolute top-2 end-2');

export const alertTitleVariants = cva('font-semibold [&_a]:underline [&_a]:underline-offset-[3px]');

export const alertDescriptionVariants = cva('text-sm text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-[3px] [&_p:not(:last-child)]:mb-4', {
  variants: {
    zType: {
      neutral: '',
      success: '',
      danger: '',
    },
  },
  defaultVariants: {
    zType: 'neutral',
  },
});

export type ZardAlertTypeVariants = NonNullable<VariantProps<typeof alertVariants>['zType']>;
