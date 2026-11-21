import { cva, type VariantProps } from 'class-variance-authority';

export const cardVariants = cva(
  'group/card flex flex-col gap-3 overflow-hidden rounded-xl bg-card p-4 text-sm text-card-foreground',
  {
    variants: {
      zSize: {
        default: '',
        sm: 'gap-2 p-3',
      },
    },
  },
);

export type ZardCardSizeType = NonNullable<VariantProps<typeof cardVariants>['zSize']>;

export const cardHeaderVariants = cva(
  'group/card-header @container/card-header grid auto-rows-min items-start gap-1 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [&.border-b]:pb-3',
);

export const cardTitleVariants = cva(
  'font-display text-lg leading-[1.15] font-semibold tracking-[-0.01em] text-foreground group-data-[size=sm]/card:text-base',
);

export const cardDescriptionVariants = cva('text-sm text-muted-foreground');

export const cardActionVariants = cva('col-start-2 row-span-2 row-start-1 self-start justify-self-end');

export const cardContentVariants = cva('');

export const cardFooterVariants = cva('flex items-center');
