import { formatBirthMonth, petAge, petChips, petCoverLine, petSummary, speciesLabel } from './pet-format';

const NOW = new Date(2026, 10, 25); // 25 nov 2026

describe('pet-format', () => {
  it('espécie sem flexão de gênero', () => {
    expect(speciesLabel('dog')).toBe('Cão');
    expect(speciesLabel('cat')).toBe('Gato');
  });

  it('mês de nascimento abreviado', () => {
    expect(formatBirthMonth('2022-03-01')).toBe('mar 2022');
    expect(formatBirthMonth(null)).toBeNull();
    expect(formatBirthMonth('2022-13-01')).toBeNull();
    expect(formatBirthMonth('ontem')).toBeNull();
  });

  describe('petAge', () => {
    it('anos, com singular', () => {
      expect(petAge('2022-03-01', NOW)).toBe('4 anos');
      expect(petAge('2025-11-01', NOW)).toBe('1 ano');
    });
    it('meses quando tem menos de um ano', () => {
      expect(petAge('2026-03-01', NOW)).toBe('8 meses');
      expect(petAge('2026-10-01', NOW)).toBe('1 mês');
      expect(petAge('2026-11-01', NOW)).toBe('menos de 1 mês');
    });
    it('sem data ou no futuro: null', () => {
      expect(petAge(null, NOW)).toBeNull();
      expect(petAge('2027-01-01', NOW)).toBeNull();
    });
  });

  it('resumo e linha da capa só com o que foi informado', () => {
    const pet = { species: 'dog' as const, breed: 'SRD caramelo', birthMonth: '2022-03-01' };
    expect(petSummary(pet, NOW)).toBe('Cão · SRD caramelo · 4 anos');
    expect(petCoverLine(pet)).toBe('Cão · SRD caramelo · nasceu em mar 2022');
    expect(petSummary({ species: 'cat', breed: null, birthMonth: null }, NOW)).toBe('Gato');
    expect(petCoverLine({ species: 'cat', breed: '  ', birthMonth: null })).toBe('Gato');
  });

  it('chips: sexo, castração (com a flexão do sexo) e porte', () => {
    expect(petChips({ sex: 'male', neutered: true, size: 'medium' })).toEqual(['Macho', 'Castrado', 'Porte médio']);
    expect(petChips({ sex: 'female', neutered: true, size: 'small' })).toEqual(['Fêmea', 'Castrada', 'Porte pequeno']);
    expect(petChips({ sex: null, neutered: false, size: 'large' })).toEqual(['Porte grande']);
    expect(petChips({ sex: null, neutered: null, size: null })).toEqual([]);
  });
});
