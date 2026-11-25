/** Espécie atendida no MVP (`pets.species`, data-model.md). */
export type PetSpecies = 'dog' | 'cat';
export type PetSex = 'male' | 'female';
export type PetSize = 'small' | 'medium' | 'large';

/** Pet do tutor (linha de `pets`). `photoPath` é o caminho no bucket privado `pet-photos`. */
export interface Pet {
  id: string;
  tutorId: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  sex: PetSex | null;
  size: PetSize | null;
  neutered: boolean | null;
  /** Primeiro dia do mês de nascimento (AAAA-MM-DD). */
  birthMonth: string | null;
  temperament: string[];
  careNotes: string | null;
  photoPath: string | null;
  createdAt: string;
  updatedAt: string;
}
