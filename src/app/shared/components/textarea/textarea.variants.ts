import { cva } from 'class-variance-authority';

/** Área de texto: mesmo raio e borda do campo, `min-h-[96px]`, sem redimensionar (contrato §3.2). */
export const textareaVariants = cva(
  'flex min-h-[96px] w-full resize-none rounded-md border-[1.5px] border-input bg-card px-4 py-3.5 text-base leading-[1.45] text-foreground transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground aria-invalid:border-destructive',
);

export const inputGroupTextAreaVariants = cva(
  'flex-1 resize-none rounded-none border-0 bg-transparent py-2 disabled:bg-transparent',
);
