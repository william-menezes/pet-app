import {
  itemDescriptionVariants,
  itemGroupVariants,
  itemSeparatorVariants,
  itemTitleVariants,
  itemVariants,
} from './item.variants';

describe('item variants (linha de lista)', () => {
  it('a linha: flex, gap-3, px-3.5, py-3, min-h-11', () => {
    const classes = itemVariants().split(' ');
    expect(classes).toEqual(expect.arrayContaining(['flex', 'items-center', 'gap-3', 'px-3.5', 'py-3', 'min-h-11']));
  });

  it('a linha não tem borda nem sombra', () => {
    for (const cls of itemVariants().split(' ')) {
      expect(cls).not.toMatch(/^(border|shadow|ring)/);
    }
  });

  it('o grupo é um cartão rounded-xl bg-card sem padding', () => {
    const classes = itemGroupVariants().split(' ');
    expect(classes).toEqual(expect.arrayContaining(['rounded-xl', 'bg-card']));
    expect(classes.some((c) => /^p[xytblr]?-/.test(c))).toBe(false);
  });

  it('a divisória tem 1px, usa divider e é recuada 14px de cada lado', () => {
    const classes = itemSeparatorVariants().split(' ');
    expect(classes).toEqual(expect.arrayContaining(['h-px', 'bg-divider', 'mx-3.5']));
  });

  it('título de 15px semibold e subtítulo de 13px em muted-foreground', () => {
    expect(itemTitleVariants().split(' ')).toEqual(
      expect.arrayContaining(['text-[15px]', 'font-semibold', 'text-foreground']),
    );
    expect(itemDescriptionVariants().split(' ')).toEqual(
      expect.arrayContaining(['text-[13px]', 'leading-[1.35]', 'text-muted-foreground']),
    );
  });
});
