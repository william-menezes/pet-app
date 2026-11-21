import { buttonVariants, type ZardButtonSizeVariants, type ZardButtonTypeVariants } from './button.variants';

const TYPES: Record<ZardButtonTypeVariants, string[]> = {
  default: ['bg-primary', 'text-primary-foreground', 'hover:bg-primary-hover', 'active:bg-primary-press'],
  outline: ['bg-card', 'border-foreground', 'text-foreground'],
  ink: ['bg-ink', 'text-ink-foreground'],
  ghost: ['bg-transparent', 'text-foreground'],
  danger: ['bg-transparent', 'text-danger-foreground', 'hover:bg-danger-soft'],
  destructive: ['bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive-hover'],
  link: ['h-auto', 'min-h-11', 'text-link', 'underline'],
  secondary: ['bg-muted', 'text-foreground'],
};

const SIZES: Record<ZardButtonSizeVariants, string[]> = {
  sm: ['h-9', 'px-3.5', 'text-sm', 'before:-inset-y-1'],
  md: ['h-11', 'text-[15px]'],
  default: ['h-12', 'text-base'],
  lg: ['h-14', 'text-[17px]'],
  rescue: ['h-15', 'w-full', 'md:h-16', 'md:text-xl'],
  icon: ['size-11', 'p-0'],
};

describe('buttonVariants', () => {
  for (const [type, expected] of Object.entries(TYPES)) {
    it(`tipo "${type}" traz as classes do contrato`, () => {
      const classes = buttonVariants({ zType: type as ZardButtonTypeVariants }).split(' ');
      for (const cls of expected) {
        expect(classes, cls).toContain(cls);
      }
    });
  }

  for (const [size, expected] of Object.entries(SIZES)) {
    it(`tamanho "${size}" traz as classes do contrato`, () => {
      const classes = buttonVariants({ zSize: size as ZardButtonSizeVariants }).split(' ');
      for (const cls of expected) {
        expect(classes, cls).toContain(cls);
      }
    });
  }

  it('nenhuma combinação contém classe de anel (o foco é global)', () => {
    for (const type of Object.keys(TYPES)) {
      for (const size of Object.keys(SIZES)) {
        const classes = buttonVariants({
          zType: type as ZardButtonTypeVariants,
          zSize: size as ZardButtonSizeVariants,
        });
        expect(classes, `${type}/${size}`).not.toContain('ring-');
        expect(classes, `${type}/${size}`).not.toContain('outline-');
      }
    }
  });

  it('não existem os tipos accent nem whatsapp', () => {
    expect(Object.keys(TYPES)).not.toContain('accent');
    expect(Object.keys(TYPES)).not.toContain('whatsapp');
  });

  it('a base é pílula, com Outfit semibold', () => {
    const classes = buttonVariants({}).split(' ');
    expect(classes).toContain('rounded-full');
    expect(classes).toContain('font-display');
    expect(classes).toContain('font-semibold');
  });

  it('desativado usa as cores de desativado', () => {
    const classes = buttonVariants({ zDisabled: true }).split(' ');
    expect(classes).toContain('bg-disabled');
    expect(classes).toContain('text-disabled-foreground');
  });
});
