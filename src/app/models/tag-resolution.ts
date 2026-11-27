import type { LostElapsed, PublicRescueProfile } from './rescue-profile';

/**
 * Resultado de abrir `/<código>`: os quatro estados do `resolve-tag` mais a contingência
 * (limite estourado, falha ou tempo esgotado: "Este pet tem dono", com "Tentar de novo").
 * `assigned` é o estado da tag vinculada (o contrato diz `assigned`, não `rescue`).
 */
export type TagResolution =
  | { state: 'assigned'; profile: PublicRescueProfile; lostElapsed?: LostElapsed }
  | { state: 'available'; code: string }
  | { state: 'not_found' }
  | { state: 'contingency' };

export type TagResolutionState = TagResolution['state'];
