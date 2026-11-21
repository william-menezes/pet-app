import { toggleGroupVariants } from './toggle-group.variants';

describe('toggleGroupVariants (segmentado)', () => {
  const classes = toggleGroupVariants().split(' ');

  it('a trilha do segmentado: grid de colunas iguais, pílula, bg-card, p-1, gap-1', () => {
    for (const cls of [
      'data-[variant=segmented]:grid',
      'data-[variant=segmented]:auto-cols-fr',
      'data-[variant=segmented]:rounded-full',
      'data-[variant=segmented]:bg-card',
      'data-[variant=segmented]:p-1',
      'data-[variant=segmented]:gap-1',
    ]) {
      expect(classes, cls).toContain(cls);
    }
  });
});
