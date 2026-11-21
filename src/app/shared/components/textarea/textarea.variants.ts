import { cva } from 'class-variance-authority';

export const textareaVariants = cva(
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50',
);

export const inputGroupTextAreaVariants = cva(
  'flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent',
);
