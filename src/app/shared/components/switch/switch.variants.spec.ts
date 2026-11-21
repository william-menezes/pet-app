import { switchVariants } from './switch.variants';

describe('switchVariants', () => {
  const classes = switchVariants().split(' ');

  it('desligado: 52 x 32px, pílula, borda de 1,5px em border-input, sem fundo', () => {
    expect(classes).toContain('h-8');
    expect(classes).toContain('w-[52px]');
    expect(classes).toContain('rounded-full');
    expect(classes).toContain('border-[1.5px]');
    expect(classes).toContain('border-input');
    expect(classes).toContain('bg-transparent');
  });

  it('ligado usa a tinta (bg-foreground) e nunca o lima', () => {
    expect(classes).toContain('data-[state=checked]:bg-foreground');
    expect(classes).toContain('data-[state=checked]:border-foreground');
    expect(switchVariants()).not.toContain('primary');
  });

  it('a área de toque chega a 44px: o after estende 8px para cima e para baixo', () => {
    expect(classes).toContain('after:-inset-y-2');
  });

  it('o foco é global (nenhuma classe de anel)', () => {
    expect(switchVariants()).not.toContain('ring-');
  });
});
