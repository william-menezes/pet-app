import {
  fieldDescriptionVariants,
  fieldErrorVariants,
  fieldLabelVariants,
  fieldSuccessVariants,
  fieldVariants,
} from './field.variants';

describe('field variants', () => {
  it('o rótulo fica acima do campo: coluna com 6px de distância', () => {
    const classes = fieldVariants({ zOrientation: 'vertical' }).split(' ');
    expect(classes).toContain('flex-col');
    expect(classes).toContain('gap-1.5');
  });

  it('o rótulo é text-sm, semibold e text-foreground', () => {
    const classes = fieldLabelVariants().split(' ');
    expect(classes).toContain('text-sm');
    expect(classes).toContain('font-semibold');
    expect(classes).toContain('text-foreground');
  });

  it('a ajuda é de 13px em text-muted-foreground', () => {
    const classes = fieldDescriptionVariants().split(' ');
    expect(classes).toContain('text-[13px]');
    expect(classes).toContain('text-muted-foreground');
  });

  it('o erro é de 13px, semibold, em text-danger-foreground', () => {
    const classes = fieldErrorVariants().split(' ');
    expect(classes).toContain('text-[13px]');
    expect(classes).toContain('font-semibold');
    expect(classes).toContain('text-danger-foreground');
  });

  it('o sucesso é de 13px, semibold, em text-success-foreground', () => {
    const classes = fieldSuccessVariants().split(' ');
    expect(classes).toContain('text-[13px]');
    expect(classes).toContain('text-success-foreground');
  });

  it('nenhuma variante usa lima como cor de texto ou de seleção', () => {
    const all = [fieldLabelVariants(), fieldDescriptionVariants(), fieldErrorVariants(), fieldSuccessVariants()].join(' ');
    expect(all).not.toContain('primary');
  });
});
