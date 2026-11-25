import { toggleVariants } from './toggle.variants';

describe('toggleVariants (chip)', () => {
  const classes = toggleVariants().split(' ');

  it('chip solto: 38px, pílula, borda e texto do contrato', () => {
    expect(classes).toEqual(
      expect.arrayContaining(['h-[38px]', 'rounded-full', 'border', 'px-3.5', 'text-[13px]', 'font-semibold']),
    );
    expect(classes).toEqual(expect.arrayContaining(['border-border', 'bg-card', 'text-foreground']));
  });

  it('chip escolhido usa a tinta: bg-foreground text-background', () => {
    expect(classes).toContain('data-[state=on]:bg-foreground');
    expect(classes).toContain('data-[state=on]:text-background');
    expect(classes).toContain('data-[state=on]:border-foreground');
    expect(toggleVariants()).not.toContain('primary');
  });

  it('a área de toque chega a 44px (after estende 5px acima e abaixo)', () => {
    expect(classes).toContain('after:-inset-y-[5px]');
  });

  it('o tipo segmented tem 40px, sem borda, e escolhido em tinta', () => {
    const seg = toggleVariants({ zType: 'segmented' }).split(' ');
    expect(seg).toEqual(expect.arrayContaining(['h-10', 'border-0', 'text-sm', 'data-[state=on]:bg-foreground']));
    expect(seg).toContain('data-[state=on]:text-background');
  });

  it('o foco é global (nenhuma classe de anel)', () => {
    expect(toggleVariants()).not.toContain('ring-');
  });
});
