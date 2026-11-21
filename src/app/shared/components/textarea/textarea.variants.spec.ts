import { textareaVariants } from './textarea.variants';

describe('textareaVariants', () => {
  const classes = textareaVariants().split(' ');

  it('tem o mesmo raio e borda do campo e altura mínima de 96px', () => {
    expect(classes).toContain('min-h-[96px]');
    expect(classes).toContain('rounded-md');
    expect(classes).toContain('border-[1.5px]');
    expect(classes).toContain('border-input');
    expect(classes).toContain('py-3.5');
    expect(classes).toContain('resize-none');
  });

  it('usa text-base e troca só a borda quando inválida', () => {
    expect(classes).toContain('text-base');
    expect(classes).toContain('aria-invalid:border-destructive');
    expect(textareaVariants()).not.toContain('ring-');
  });
});
