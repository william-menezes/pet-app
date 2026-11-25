import {
  cardContentVariants,
  cardFooterVariants,
  cardHeaderVariants,
  cardTitleVariants,
  cardVariants,
} from './card.variants';

describe('cardVariants', () => {
  it('é rounded-xl bg-card p-4', () => {
    const classes = cardVariants().split(' ');
    expect(classes).toEqual(expect.arrayContaining(['rounded-xl', 'bg-card', 'p-4']));
  });

  it('não tem borda nem sombra nem anel', () => {
    for (const size of ['default', 'sm'] as const) {
      const classes = cardVariants({ zSize: size }).split(' ');
      for (const cls of classes) {
        expect(cls, `${size}: ${cls}`).not.toMatch(/^(border|shadow|ring)/);
      }
    }
  });

  it('as partes do cartão não têm fundo de rodapé nem recuo próprio', () => {
    expect(cardFooterVariants()).not.toContain('bg-muted');
    expect(cardContentVariants()).not.toContain('px-');
    expect(cardHeaderVariants()).not.toContain('px-');
  });

  it('o título usa a receita Title (Outfit semibold, text-foreground)', () => {
    const classes = cardTitleVariants().split(' ');
    expect(classes).toEqual(expect.arrayContaining(['font-display', 'font-semibold', 'text-foreground']));
  });
});
