import { cva } from 'class-variance-authority';

/**
 * Grupo de chips. No tipo `segmented` (contrato §3.4) o grupo vira a trilha: colunas iguais,
 * `rounded-full bg-card p-1`, com `gap-1`.
 */
export const toggleGroupVariants = cva(
  'group/toggle-group flex w-fit flex-row flex-wrap items-center gap-[--spacing(var(--gap))] data-vertical:flex-col data-vertical:items-stretch data-[variant=segmented]:grid data-[variant=segmented]:w-full data-[variant=segmented]:auto-cols-fr data-[variant=segmented]:grid-flow-col data-[variant=segmented]:gap-1 data-[variant=segmented]:rounded-full data-[variant=segmented]:bg-card data-[variant=segmented]:p-1',
);

export const toggleGroupItemVariants = cva('shrink-0 data-[variant=segmented]:w-full');
