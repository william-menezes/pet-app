import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Diálogo (contrato §3.6): cartão `rounded-2xl bg-popover p-6`, no máximo 420px de largura e 16px
 * de folga em cada lado do celular. Sem anel e sem sombra. Proibido na página pública.
 */
export const alertDialogVariants = cva(
  [
    'group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-[420px] -translate-1/2 gap-5',
    'rounded-2xl bg-popover p-6 text-popover-foreground',
  ],
  {
    variants: {
      zSize: {
        default: '',
        sm: '',
      },
    },
    defaultVariants: {
      zSize: 'default',
    },
  },
);

/** Classes of the mask behind an alert dialog, shared by the declarative form and the service. */
export const ALERT_DIALOG_BACKDROP_CLASSES = ['bg-ink/50'];

export const alertDialogHeaderVariants = cva(['flex flex-col gap-2 text-start']);

/** Título na receita Title, 20px. */
export const alertDialogTitleVariants = cva([
  'font-display text-xl leading-[1.15] font-semibold tracking-[-0.01em] text-foreground wrap-anywhere',
]);

/** Texto de 15px em `text-text`. */
export const alertDialogDescriptionVariants = cva([
  'text-[15px] leading-[1.45] text-text wrap-anywhere',
  '[&_a]:text-link [&_a]:underline [&_a]:underline-offset-[3px]',
]);

/** Botões em coluna no celular (o de confirmar primeiro, largura total) e em linha, à direita, em `md`+. */
export const alertDialogFooterVariants = cva(['flex flex-col-reverse gap-2.5', 'md:flex-row md:justify-end']);

export const alertDialogMediaVariants = cva(['inline-flex size-10 items-center justify-center rounded-md bg-inset']);

export type ZardAlertDialogVariants = VariantProps<typeof alertDialogVariants>;
export type ZardAlertDialogSizeVariants = NonNullable<VariantProps<typeof alertDialogVariants>['zSize']>;
