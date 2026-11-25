import {
  ALERT_DIALOG_BACKDROP_CLASSES,
  alertDialogDescriptionVariants,
  alertDialogFooterVariants,
  alertDialogTitleVariants,
  alertDialogVariants,
} from './alert-dialog.variants';

describe('alert-dialog variants', () => {
  it('o painel é rounded-2xl bg-popover p-6, de até 420px, sem anel', () => {
    const classes = alertDialogVariants().split(' ');
    expect(classes).toEqual(
      expect.arrayContaining(['rounded-2xl', 'bg-popover', 'p-6', 'w-[calc(100vw-2rem)]', 'max-w-[420px]']),
    );
    expect(alertDialogVariants()).not.toContain('ring-');
  });

  it('o fundo é bg-ink/50', () => {
    expect(ALERT_DIALOG_BACKDROP_CLASSES).toContain('bg-ink/50');
  });

  it('título na receita Title de 20px e texto de 15px em text-text', () => {
    expect(alertDialogTitleVariants().split(' ')).toEqual(
      expect.arrayContaining(['font-display', 'text-xl', 'font-semibold', 'text-foreground']),
    );
    expect(alertDialogDescriptionVariants().split(' ')).toEqual(expect.arrayContaining(['text-[15px]', 'text-text']));
  });

  it('os botões ficam em coluna (confirmar primeiro) no celular e em linha, à direita, em md+', () => {
    const classes = alertDialogFooterVariants().split(' ');
    expect(classes).toEqual(expect.arrayContaining(['flex-col-reverse', 'md:flex-row', 'md:justify-end']));
  });
});
