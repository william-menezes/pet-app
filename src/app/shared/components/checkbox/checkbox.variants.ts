import { cva } from 'class-variance-authority';

/**
 * Caixa de 20px (contrato §3.3). Marcada é tinta (`bg-foreground`), nunca lima. A área extra do
 * `after` leva o alvo de toque a 44px. O foco é o da regra global.
 */
export const checkboxVariants = cva(
  "peer relative size-5 shrink-0 cursor-[unset] appearance-none rounded-[6px] border-[1.5px] border-input bg-card transition-colors after:absolute after:-inset-3.5 after:content-[''] checked:border-foreground checked:bg-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
);

export const checkboxLabelVariants = cva('cursor-[unset] text-sm text-foreground empty:hidden select-none');
