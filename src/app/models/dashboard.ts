import type { PetSpecies } from './pet';
import type { GeoMethod } from './scan';
import type { TagStatus } from './tag';

/** Pet como o `my_dashboard()` o devolve (uma chamada para o painel e para a lista de pets da ativação). */
export interface DashboardPet {
  id: string;
  name: string;
  species: PetSpecies;
  photoPath: string | null;
  lostMode: boolean;
  lostSince: string | null;
  hasTag: boolean;
  /** Código na forma de exibição, `XXXX-XXXX-X`; nulo quando o pet não tem tag ativa. */
  tagCode: string | null;
  tagStatus: TagStatus | null;
  scansMonth: number;
  lastScan: { occurredAt: string; geoMethod: GeoMethod } | null;
  visibleShown: number;
  visibleTotal: number;
}

export interface Dashboard {
  pets: DashboardPet[];
  /** Código da ativação pendente (`XXXX-XXXX-X`) ou nulo. */
  pendingActivation: string | null;
}
