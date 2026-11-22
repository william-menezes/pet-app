import { faroIcons } from './faro-icons';

describe('faroIcons', () => {
  const entries = Object.entries(faroIcons);

  it('registra exatamente 32 ícones', () => {
    expect(entries.length).toBe(32);
  });

  it('cada valor é um SVG com viewBox', () => {
    for (const [name, value] of entries) {
      expect(value, name).toContain('<svg');
      expect(value, name).toContain('viewBox');
    }
  });

  it('nenhum SVG fixa width nem height (o tamanho vem do ng-icon)', () => {
    for (const [name, value] of entries) {
      expect(value, name).not.toContain(' width="');
      expect(value, name).not.toContain(' height="');
    }
  });
});
