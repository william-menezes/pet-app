import type { GeoMethod } from './scan';
import type { AssignmentEndReason, TagStatus } from './tag';

/** Contadores do topo da tela "Lotes" (`admin_dashboard_counters`). */
export interface AdminCounters {
  generated: number;
  available: number;
  active: number;
  blocked: number;
  void: number;
}

export interface AdminBatch {
  id: string;
  quantity: number;
  createdAt: string;
  notes: string | null;
  /** Nulo: o pacote ainda não foi baixado (os PINs ainda podem ser vistos no download). */
  packageDownloadedAt: string | null;
  counts: Record<TagStatus, number>;
}

/** Filtro de situação da lista de códigos (o contrato aceita só estes quatro). */
export type AdminCodeStatus = TagStatus;

export interface AdminCodeFilters {
  search?: string;
  status?: AdminCodeStatus | null;
  batch?: string | null;
  limit?: number;
  offset?: number;
}

export interface AdminCodeRow {
  /** Código na forma de exibição. */
  code: string;
  batchId: string;
  status: TagStatus;
  petName: string | null;
  /** Primeiro nome e inicial ("Ana S."). */
  tutor: string | null;
  lastScanAt: string | null;
}

export interface AdminCodePage {
  total: number;
  rows: AdminCodeRow[];
}

export interface AdminAssignment {
  id: string;
  startedAt: string;
  petName: string | null;
  tutor: string | null;
}

export interface AdminHistoryEntry extends AdminAssignment {
  endedAt: string | null;
  endReason: AssignmentEndReason | null;
}

export interface AdminScan {
  id: string;
  occurredAt: string;
  statusAtScan: TagStatus;
  geoMethod: GeoMethod;
  accuracyM: number | null;
  city: string | null;
  region: string | null;
  assignmentId: string | null;
}

export interface AdminPinState {
  used: boolean;
  usedAt: string | null;
  failCount24h: number;
  lockedUntil: string | null;
}

export type ReplacementKind = 'damaged' | 'lost';
export type ReplacementStatus = 'open' | 'done' | 'cancelled';

export interface AdminReplacementRequest {
  id: string;
  kind: ReplacementKind;
  status: ReplacementStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminCodeDetail {
  code: string;
  batchId: string;
  status: TagStatus;
  createdAt: string;
  assignment: AdminAssignment | null;
  history: AdminHistoryEntry[];
  scans: AdminScan[];
  pin: AdminPinState;
  replacementRequests: AdminReplacementRequest[];
}

export interface AdminQueueScan {
  id: string;
  code: string;
  statusAtScan: TagStatus;
  occurredAt: string;
  geoMethod: GeoMethod;
  city: string | null;
  region: string | null;
}

export interface AdminQueueReplacement {
  id: string;
  code: string;
  kind: ReplacementKind;
  createdAt: string;
}

export interface AdminLockedTag {
  code: string;
  lockedUntil: string;
}

export interface AdminQueue {
  scans: AdminQueueScan[];
  replacements: AdminQueueReplacement[];
  lockedTags: AdminLockedTag[];
}

export interface AdminAuditRow {
  id: string;
  at: string;
  actorId: string | null;
  actorRole: string | null;
  event: string;
  entity: string | null;
  entityId: string | null;
  detail: Record<string, unknown> | null;
}

export interface AdminAuditFilters {
  event?: string | null;
  entityId?: string | null;
  limit?: number;
  offset?: number;
}

/** Motivo do encerramento de vínculo pelo admin. */
export type AdminEndReason = 'admin' | 'damaged' | 'lost';
