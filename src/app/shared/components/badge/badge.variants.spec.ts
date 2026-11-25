import { badgeVariants, type ZardBadgeTypeVariants } from './badge.variants';

const TYPES: Record<ZardBadgeTypeVariants, string[]> = {
  neutral: ['bg-neutral-soft', 'text-neutral-foreground'],
  success: ['bg-success-soft', 'text-success-foreground'],
  warning: ['bg-warning-soft', 'text-warning-foreground'],
  danger: ['bg-danger-soft', 'text-danger-foreground'],
  ink: ['bg-foreground', 'text-background'],
  outline: ['border', 'border-border', 'bg-card', 'text-foreground'],
};

describe('badgeVariants', () => {
  for (const [type, expected] of Object.entries(TYPES)) {
    it(`tipo "${type}" traz as classes do contrato`, () => {
      const classes = badgeVariants({ zType: type as ZardBadgeTypeVariants }).split(' ');
      for (const cls of expected) {
        expect(classes, cls).toContain(cls);
      }
    });
  }

  it('o padrão é neutro', () => {
    expect(badgeVariants().split(' ')).toContain('bg-neutral-soft');
  });

  it('tamanho default tem 24px e lg tem 32px', () => {
    expect(badgeVariants({ zSize: 'default' }).split(' ')).toEqual(expect.arrayContaining(['h-6', 'px-2.5', 'text-xs']));
    expect(badgeVariants({ zSize: 'lg' }).split(' ')).toEqual(expect.arrayContaining(['h-8', 'px-3', 'text-[13px]']));
  });

  it('só o outline tem borda, a base é pílula semibold', () => {
    const base = badgeVariants({ zType: 'success' }).split(' ');
    expect(base).not.toContain('border');
    expect(base).toContain('rounded-full');
    expect(base).toContain('font-semibold');
  });
});
