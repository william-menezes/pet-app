import { checkboxLabelVariants, checkboxVariants } from './checkbox.variants';

describe('checkboxVariants', () => {
  const classes = checkboxVariants().split(' ');

  it('desligada: 20px, raio 6, borda de 1,5px em border-input, fundo bg-card', () => {
    expect(classes).toContain('size-5');
    expect(classes).toContain('rounded-[6px]');
    expect(classes).toContain('border-[1.5px]');
    expect(classes).toContain('border-input');
    expect(classes).toContain('bg-card');
  });

  it('ligada usa a tinta (bg-foreground) e nunca o lima', () => {
    expect(classes).toContain('checked:bg-foreground');
    expect(classes).toContain('checked:border-foreground');
    expect(checkboxVariants()).not.toContain('primary');
  });

  it('inválida troca só a borda e o foco é global', () => {
    expect(classes).toContain('aria-invalid:border-destructive');
    expect(checkboxVariants()).not.toContain('ring-');
  });

  it('o rótulo usa text-foreground', () => {
    expect(checkboxLabelVariants().split(' ')).toContain('text-foreground');
  });
});
