import type { PetSpecies } from '@/models';

/** Um pet na lista "Para qual pet é esta tag?" (dados do `my_dashboard` e a URL assinada da foto). */
export interface PetOption {
  id: string;
  name: string;
  species: PetSpecies;
  hasTag: boolean;
  /** `XXXX-XXXX-X` da tag que o pet já tem. */
  tagCode: string | null;
  photoUrl: string | null;
}

/** "Cão" e "Gato": a lista de resgate não traz o sexo do pet, então não há "Gata". */
export function speciesLabel(species: PetSpecies): string {
  return species === 'cat' ? $localize`Gato` : $localize`Cão`;
}
