import { cva } from 'class-variance-authority';

/** Campo de 54px, raio 12, borda de 1,5px em `border-input` (contrato §3.2). `text-base` evita o zoom do iOS. */
export const inputVariants = cva(
  'h-[54px] w-full min-w-0 rounded-md border-[1.5px] border-input bg-card px-4 text-base text-foreground transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground aria-invalid:border-destructive',
);

export const inputGroupInputVariants = cva('h-auto flex-1 rounded-none border-0 bg-transparent disabled:bg-transparent');
