import { cva, type VariantProps } from 'class-variance-authority';

import { mergeClasses } from '@/shared/utils/merge-classes';

/**
 * Grupo de linhas (contrato §3.5): um cartão `rounded-xl bg-card` sem padding; as linhas ficam
 * dentro e entre elas há `app-item-separator` (1px em `divider`, recuada 14px).
 */
export const itemGroupVariants = cva('group/item-group flex w-full flex-col overflow-hidden rounded-xl bg-card');

export const itemSeparatorVariants = cva('mx-3.5 block h-px shrink-0 bg-divider');

/** Linha: `app-icon-tile` opcional, título, subtítulo e um item à direita. */
export const itemVariants = cva(
  mergeClasses('group/item flex min-h-11 w-full items-center text-sm transition-colors duration-100', '[a]:hover:bg-background'),
  {
    variants: {
      zVariant: {
        default: '',
      },
      zSize: {
        default: 'gap-3 px-3.5 py-3',
      },
    },
    defaultVariants: {
      zVariant: 'default',
      zSize: 'default',
    },
  },
);

export const itemMediaVariants = cva(
  mergeClasses(
    'flex shrink-0 items-center justify-center gap-2',
    'group-has-data-[slot=item-description]/item:self-start',
    '[&_svg]:pointer-events-none',
  ),
  {
    variants: {
      zVariant: {
        default: 'bg-transparent',
        icon: 'text-foreground',
        image: 'size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover',
      },
    },
    defaultVariants: {
      zVariant: 'default',
    },
  },
);

export const itemContentVariants = cva('flex min-w-0 flex-1 flex-col gap-0.5 [&+[data-slot=item-content]]:flex-none');

export const itemTitleVariants = cva(
  'line-clamp-1 flex w-fit items-center gap-2 text-[15px] leading-snug font-semibold text-foreground',
);

export const itemDescriptionVariants = cva(
  mergeClasses(
    'line-clamp-2 text-start text-[13px] leading-[1.35] font-normal text-muted-foreground',
    '[&>a]:text-link [&>a]:underline [&>a]:underline-offset-[3px]',
  ),
);

export const itemActionsVariants = cva('flex shrink-0 items-center gap-2');

export const itemHeaderVariants = cva('flex basis-full items-center justify-between gap-2');

export const itemFooterVariants = cva('flex basis-full items-center justify-between gap-2');

export type ZardItemVariantVariants = NonNullable<VariantProps<typeof itemVariants>['zVariant']>;
export type ZardItemSizeVariants = NonNullable<VariantProps<typeof itemVariants>['zSize']>;
export type ZardItemMediaVariantVariants = NonNullable<VariantProps<typeof itemMediaVariants>['zVariant']>;
