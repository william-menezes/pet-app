import { cva } from 'class-variance-authority';

export const inputVariants = cva(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50',
);

export const inputGroupInputVariants = cva(
  'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent',
);
