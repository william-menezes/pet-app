import type { Pet, PetSpecies } from '../../models';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Cão" e "Gato": a lista do painel não traz o sexo do pet, então a espécie não leva artigo nem flexão. */
export function speciesLabel(species: PetSpecies): string {
  return species === 'cat' ? $localize`Gato` : $localize`Cão`;
}

/** Ano e mês de `AAAA-MM-DD`. `null` se não for uma data de mês válida. */
function parseBirth(birthMonth: string | null): { year: number; month: number } | null {
  if (birthMonth === null) return null;
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(birthMonth);
  if (match === null) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

/** "mar 2022". */
export function formatBirthMonth(birthMonth: string | null): string | null {
  const birth = parseBirth(birthMonth);
  return birth === null ? null : `${MONTHS[birth.month - 1]} ${birth.year}`;
}

/** "4 anos", "1 ano", "8 meses", "1 mês" ou "menos de 1 mês"; `null` sem data ou com data no futuro. */
export function petAge(birthMonth: string | null, now: Date = new Date()): string | null {
  const birth = parseBirth(birthMonth);
  if (birth === null) return null;
  const months = (now.getFullYear() - birth.year) * 12 + (now.getMonth() + 1 - birth.month);
  if (months < 0) return null;
  if (months < 1) return $localize`menos de 1 mês`;
  if (months < 12) return months === 1 ? $localize`1 mês` : $localize`${months}:months: meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? $localize`1 ano` : $localize`${years}:years: anos`;
}

/** "Cão · SRD · 4 anos" (a linha de baixo do nome nas listas). */
export function petSummary(pet: Pick<Pet, 'species' | 'breed' | 'birthMonth'>, now: Date = new Date()): string {
  const parts = [speciesLabel(pet.species), pet.breed?.trim() || null, petAge(pet.birthMonth, now)];
  return parts.filter((p): p is string => p !== null).join(' · ');
}

/** "Cão · SRD caramelo · nasceu em mar 2022" (a linha da capa da página do pet). */
export function petCoverLine(pet: Pick<Pet, 'species' | 'breed' | 'birthMonth'>): string {
  const born = formatBirthMonth(pet.birthMonth);
  const parts = [speciesLabel(pet.species), pet.breed?.trim() || null, born === null ? null : $localize`nasceu em ${born}:born:`];
  return parts.filter((p): p is string => p !== null).join(' · ');
}

/** Chips da página do pet: sexo, castração e porte (só os que foram informados). */
export function petChips(pet: Pick<Pet, 'sex' | 'neutered' | 'size'>): string[] {
  const chips: string[] = [];
  if (pet.sex === 'male') chips.push($localize`Macho`);
  if (pet.sex === 'female') chips.push($localize`Fêmea`);
  if (pet.neutered === true) chips.push(pet.sex === 'female' ? $localize`Castrada` : $localize`Castrado`);
  if (pet.size === 'small') chips.push($localize`Porte pequeno`);
  if (pet.size === 'medium') chips.push($localize`Porte médio`);
  if (pet.size === 'large') chips.push($localize`Porte grande`);
  return chips;
}
