import { cva } from 'class-variance-authority';

/**
 * Estado vazio (contrato §3.5): coluna centralizada com título, uma frase e uma ação que leva ao
 * próximo passo. Nunca termina sem ação.
 */
export const emptyVariants = cva(
  'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-balance',
  {
    variants: {},
  },
);

export const emptyHeaderVariants = cva('flex max-w-sm flex-col items-center gap-2', {
  variants: {},
});

export const emptyImageVariants = cva(
  'mb-2 flex shrink-0 items-center justify-center bg-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {},
  },
);

export const emptyIconVariants = cva(
  'mb-2 flex size-10 shrink-0 items-center justify-center rounded-md bg-inset text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {},
  },
);

export const emptyTitleVariants = cva('font-display text-xl leading-[1.15] font-semibold tracking-[-0.01em] text-foreground', {
  variants: {},
});

export const emptyDescriptionVariants = cva(
  'text-[15px] leading-[1.45] text-text [&>a]:text-link [&>a]:underline [&>a]:underline-offset-[3px]',
  {
    variants: {},
  },
);

export const emptyActionsVariants = cva(
  'flex w-full max-w-sm min-w-0 items-center justify-center gap-2 text-sm text-balance',
  {
    variants: {},
  },
);
