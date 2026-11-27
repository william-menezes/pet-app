/** Situação do código da tag (`tag_codes.status`). */
export type TagStatus = 'available' | 'assigned' | 'blocked' | 'void';

/** Motivo do fim de um vínculo (`tag_assignments.end_reason`). */
export type AssignmentEndReason =
  | 'released'
  | 'transferred'
  | 'lost'
  | 'damaged'
  | 'admin'
  | 'account_deleted';

/** Vínculo tag, pet e tutor. */
export interface TagAssignment {
  id: string;
  /** Código canônico de 9 caracteres. */
  tagCode: string;
  petId: string | null;
  tutorId: string | null;
  startedAt: string;
  endedAt: string | null;
  endReason: AssignmentEndReason | null;
}
