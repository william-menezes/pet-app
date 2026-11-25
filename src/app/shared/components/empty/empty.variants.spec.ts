import { emptyDescriptionVariants, emptyTitleVariants, emptyVariants } from './empty.variants';

describe('empty variants', () => {
  it('é uma coluna centralizada, sem borda tracejada', () => {
    const classes = emptyVariants().split(' ');
    expect(classes).toEqual(expect.arrayContaining(['flex-col', 'items-center', 'text-center']));
    expect(emptyVariants()).not.toContain('border');
  });

  it('o título usa a receita Title e a frase usa text-text de 15px', () => {
    expect(emptyTitleVariants().split(' ')).toEqual(
      expect.arrayContaining(['font-display', 'font-semibold', 'text-foreground']),
    );
    expect(emptyDescriptionVariants().split(' ')).toEqual(expect.arrayContaining(['text-[15px]', 'text-text']));
  });
});
