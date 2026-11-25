import { inputVariants } from './input.variants';

describe('inputVariants', () => {
  const classes = inputVariants().split(' ');

  it('tem 54px de altura, raio 12 e borda de 1,5px em border-input', () => {
    expect(classes).toContain('h-[54px]');
    expect(classes).toContain('rounded-md');
    expect(classes).toContain('border-[1.5px]');
    expect(classes).toContain('border-input');
    expect(classes).toContain('bg-card');
  });

  it('usa text-base (16px) para o iOS não dar zoom ao focar', () => {
    expect(classes).toContain('text-base');
    expect(classes).not.toContain('md:text-sm');
  });

  it('o inválido só troca a borda; o foco é global', () => {
    expect(classes).toContain('aria-invalid:border-destructive');
    expect(inputVariants()).not.toContain('ring-');
    expect(inputVariants()).not.toContain('focus');
  });

  it('desativado usa as cores de desativado', () => {
    expect(classes).toContain('disabled:bg-disabled');
    expect(classes).toContain('disabled:text-disabled-foreground');
  });
});
