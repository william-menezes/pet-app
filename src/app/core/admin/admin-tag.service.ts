/**
 * AdminTagService — T077 (spec 003; `contracts/admin.contract.md`)
 *
 * Único lugar do app que fala com as RPCs `admin_*` e com a Edge Function `admin-create-batch`. O guard da rota é
 * conveniência: a autorização é do banco (`is_admin()` dentro de cada função) e a resposta `forbidden` chega aqui
 * como erro de negócio.
 *
 * Regras:
 *  - nenhuma RPC lança para erro de negócio: a resposta é `{ ok: false, error }` e este serviço devolve o mesmo
 *    formato. Só falha de rede ou resposta fora do formato vira `network`; nenhuma mensagem do Supabase é exposta;
 *  - o código é normalizado e o dígito conferido AQUI (Princípio VIII);
 *  - PIN novo (`newPin`) existe em claro só na resposta de `reissuePin` e `endAssignment`. Este serviço não guarda,
 *    não loga e não manda para URL ou storage: quem chama mostra uma vez e apaga;
 *  - o pacote do lote (zip com `pins.csv`) volta como `Blob` e some com o que o chamador fizer dele: o serviço não
 *    guarda referência. `saveBlob` baixa e devolve a memória na hora.
 *
 * NÃO exportar por `core/tags/index.ts`: puxa o `@supabase/supabase-js` (`check:bundle`).
 */
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import type {
  AdminAuditFilters,
  AdminAuditRow,
  AdminBatch,
  AdminCodeDetail,
  AdminCodeFilters,
  AdminCodePage,
  AdminCodeRow,
  AdminCounters,
  AdminEndReason,
  AdminHistoryEntry,
  AdminLockedTag,
  AdminQueue,
  AdminQueueReplacement,
  AdminQueueScan,
  AdminReplacementRequest,
  AdminScan,
  GeoMethod,
  ReplacementKind,
  ReplacementStatus,
  TagStatus,
} from '../../models';
import { format, isValid, normalize } from '../tag-code';
import { SupabaseService } from '../supabase/supabase.service';

export type AdminError =
  | 'forbidden'
  | 'invalid_status'
  | 'invalid_code'
  | 'invalid_reason'
  | 'invalid_input'
  | 'not_found'
  | 'invalid_transition'
  | 'tag_not_available'
  | 'no_active_assignment'
  | 'too_many_requests'
  | 'package_already_downloaded'
  | 'batch_range_exhausted'
  | 'network';

const ADMIN_ERRORS: readonly AdminError[] = [
  'forbidden',
  'invalid_status',
  'invalid_code',
  'invalid_reason',
  'invalid_input',
  'not_found',
  'invalid_transition',
  'tag_not_available',
  'no_active_assignment',
  'too_many_requests',
  'package_already_downloaded',
  'batch_range_exhausted',
];

export interface AdminFailure {
  ok: false;
  error: AdminError;
}
export type AdminResult<T> = ({ ok: true } & T) | AdminFailure;

/** Limites de `admin-create-batch` (contrato). */
export const BATCH_MIN = 1;
export const BATCH_MAX = 500;
export const BATCH_NOTES_MAX = 200;

/** Páginas das listas. */
export const CODES_PAGE_SIZE = 25;
export const AUDIT_PAGE_SIZE = 50;

export interface BatchPackage {
  /** Id do lote criado (`lote-NNN`); não é segredo. */
  batchId: string;
  /** O zip com `pins.csv`. Contém PINs: baixar e soltar, nunca guardar. */
  blob: Blob;
}

export interface NewPin {
  code: string;
  /** PIN novo em claro, uma única vez. */
  newPin: string;
}

const failure = (error: AdminError): AdminFailure => ({ ok: false, error });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const isStatus = (v: unknown): v is TagStatus => v === 'available' || v === 'assigned' || v === 'blocked' || v === 'void';
const geo = (v: unknown): GeoMethod => (v === 'ip' || v === 'gps' ? v : 'none');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const display = (code: string): string => (isValid(normalize(code)) ? format(normalize(code)) : code);

/** Código normalizado (9 caracteres, dígito conferido) ou `null` se não tem a forma de código. */
function normalizedCode(input: string): string | null {
  const code = normalize(input);
  return isValid(code) ? code : null;
}

/** `lote-001` e variações de caixa. */
const BATCH_PATTERN = /^lote-\d{3}$/;

function toBatch(raw: unknown): AdminBatch | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id']);
  const createdAt = str(raw['created_at']);
  if (id === null || createdAt === null) return null;
  const counts = isRecord(raw['counts']) ? raw['counts'] : {};
  return {
    id,
    quantity: num(raw['quantity']),
    createdAt,
    notes: str(raw['notes']),
    packageDownloadedAt: str(raw['package_downloaded_at']),
    counts: {
      available: num(counts['available']),
      assigned: num(counts['assigned']),
      blocked: num(counts['blocked']),
      void: num(counts['void']),
    },
  };
}

function toCodeRow(raw: unknown): AdminCodeRow | null {
  if (!isRecord(raw)) return null;
  const code = str(raw['code']);
  const status = raw['status'];
  if (code === null || !isStatus(status)) return null;
  return {
    code: display(code),
    batchId: str(raw['batch_id']) ?? '',
    status,
    petName: str(raw['pet_name']),
    tutor: str(raw['tutor']),
    lastScanAt: str(raw['last_scan_at']),
  };
}

function toAssignment(raw: unknown): { id: string; startedAt: string; petName: string | null; tutor: string | null } | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id']);
  const startedAt = str(raw['started_at']);
  if (id === null || startedAt === null) return null;
  return { id, startedAt, petName: str(raw['pet_name']), tutor: str(raw['tutor']) };
}

const END_REASONS = ['released', 'transferred', 'lost', 'damaged', 'admin', 'account_deleted'] as const;

function toHistory(raw: unknown): AdminHistoryEntry | null {
  const base = toAssignment(raw);
  if (base === null || !isRecord(raw)) return null;
  const reason = raw['end_reason'];
  return {
    ...base,
    endedAt: str(raw['ended_at']),
    endReason: END_REASONS.find((r) => r === reason) ?? null,
  };
}

function toScan(raw: unknown): AdminScan | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id']);
  const occurredAt = str(raw['occurred_at']);
  const status = raw['status_at_scan'];
  if (id === null || occurredAt === null || !isStatus(status)) return null;
  const accuracy = raw['accuracy_m'];
  return {
    id,
    occurredAt,
    statusAtScan: status,
    geoMethod: geo(raw['geo_method']),
    accuracyM: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
    city: str(raw['city']),
    region: str(raw['region']),
    assignmentId: str(raw['assignment_id']),
  };
}

function toReplacement(raw: unknown): AdminReplacementRequest | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id']);
  const kind = raw['kind'];
  const status = raw['status'];
  const createdAt = str(raw['created_at']);
  if (id === null || createdAt === null) return null;
  if (kind !== 'damaged' && kind !== 'lost') return null;
  if (status !== 'open' && status !== 'done' && status !== 'cancelled') return null;
  return { id, kind: kind as ReplacementKind, status: status as ReplacementStatus, createdAt, resolvedAt: str(raw['resolved_at']) };
}

/** Descarta o que não tem a forma esperada: uma linha estranha derruba a tela inteira para `network`. */
function all<T>(list: unknown[], map: (raw: unknown) => T | null): T[] | null {
  const out: T[] = [];
  for (const raw of list) {
    const item = map(raw);
    if (item === null) return null;
    out.push(item);
  }
  return out;
}

@Injectable({ providedIn: 'root' })
export class AdminTagService {
  private readonly supabase = inject(SupabaseService);

  private async call(name: string, args?: Record<string, unknown>): Promise<AdminResult<{ data: Record<string, unknown> }>> {
    try {
      const { data, error } = await this.supabase.client.rpc(name, args);
      if (error || !isRecord(data)) return failure('network');
      if (data['ok'] === true) return { ok: true, data };
      const code = data['error'];
      if (typeof code !== 'string' || !ADMIN_ERRORS.includes(code as AdminError)) return failure('network');
      return failure(code as AdminError);
    } catch {
      return failure('network');
    }
  }

  /** Contadores do topo da tela "Lotes". */
  async counters(): Promise<AdminResult<{ counters: AdminCounters }>> {
    const res = await this.call('admin_dashboard_counters');
    if (!res.ok) return res;
    const d = res.data;
    return {
      ok: true,
      counters: { generated: num(d['generated']), available: num(d['available']), active: num(d['active']), blocked: num(d['blocked']), void: num(d['void']) },
    };
  }

  async listBatches(): Promise<AdminResult<{ batches: AdminBatch[] }>> {
    const res = await this.call('admin_list_batches');
    if (!res.ok) return res;
    const batches = all(arr(res.data['batches']), toBatch);
    return batches === null ? failure('network') : { ok: true, batches };
  }

  /**
   * Busca, filtros e paginação. A busca por código é normalizada no banco; o texto é mandado como foi digitado,
   * sem espaços nas pontas (vazio vira "sem busca").
   */
  async listCodes(filters: AdminCodeFilters = {}): Promise<AdminResult<{ page: AdminCodePage }>> {
    const search = (filters.search ?? '').trim();
    const limit = Math.min(Math.max(filters.limit ?? CODES_PAGE_SIZE, 1), 100);
    const res = await this.call('admin_list_codes', {
      p_search: search === '' ? null : search,
      p_status: filters.status ?? null,
      p_batch: filters.batch ?? null,
      p_limit: limit,
      p_offset: Math.max(filters.offset ?? 0, 0),
    });
    if (!res.ok) return res;
    const rows = all(arr(res.data['rows']), toCodeRow);
    return rows === null ? failure('network') : { ok: true, page: { total: num(res.data['total']), rows } };
  }

  async codeDetail(code: string): Promise<AdminResult<{ detail: AdminCodeDetail }>> {
    const normalized = normalizedCode(code);
    if (normalized === null) return failure('invalid_code');
    const res = await this.call('admin_code_detail', { p_code: normalized });
    if (!res.ok) return res;
    const d = res.data;
    const status = d['status'];
    const createdAt = str(d['created_at']);
    const history = all(arr(d['history']), toHistory);
    const scans = all(arr(d['scans']), toScan);
    const replacements = all(arr(d['replacement_requests']), toReplacement);
    if (!isStatus(status) || createdAt === null || history === null || scans === null || replacements === null) return failure('network');
    const pin = isRecord(d['pin']) ? d['pin'] : {};
    return {
      ok: true,
      detail: {
        code: display(str(d['code']) ?? normalized),
        batchId: str(d['batch_id']) ?? '',
        status,
        createdAt,
        assignment: toAssignment(d['assignment']),
        history,
        scans,
        pin: { used: pin['used'] === true, usedAt: str(pin['used_at']), failCount24h: num(pin['fail_count_24h']), lockedUntil: str(pin['locked_until']) },
        replacementRequests: replacements,
      },
    };
  }

  /** `blocked`, `available` (desbloquear) ou `void` (irreversível). Devolve a situação final. */
  async setStatus(code: string, status: 'available' | 'blocked' | 'void', note?: string): Promise<AdminResult<{ status: TagStatus }>> {
    const normalized = normalizedCode(code);
    if (normalized === null) return failure('invalid_code');
    const trimmed = (note ?? '').trim();
    const res = await this.call('admin_set_status', { p_code: normalized, p_status: status, p_note: trimmed === '' ? null : trimmed });
    if (!res.ok) return res;
    const final = res.data['status'];
    return isStatus(final) ? { ok: true, status: final } : failure('network');
  }

  /** Só tag `available`. O PIN novo vem uma única vez. */
  async reissuePin(code: string): Promise<AdminResult<NewPin>> {
    return this.newPin('admin_reissue_pin', code, {});
  }

  /** Encerra o vínculo (a tag volta a `available` com PIN novo, que vem uma única vez). */
  async endAssignment(code: string, reason: AdminEndReason = 'admin'): Promise<AdminResult<NewPin>> {
    return this.newPin('admin_end_assignment', code, { p_reason: reason });
  }

  private async newPin(fn: string, code: string, extra: Record<string, unknown>): Promise<AdminResult<NewPin>> {
    const normalized = normalizedCode(code);
    if (normalized === null) return failure('invalid_code');
    const res = await this.call(fn, { p_code: normalized, ...extra });
    if (!res.ok) return res;
    const newPin = str(res.data['new_pin']);
    return newPin === null ? failure('network') : { ok: true, code: display(str(res.data['code']) ?? normalized), newPin };
  }

  async resolveReplacement(requestId: string, status: 'done' | 'cancelled'): Promise<AdminResult<object>> {
    const res = await this.call('admin_resolve_replacement', { p_request: requestId, p_status: status });
    return res.ok ? { ok: true } : res;
  }

  async scanQueue(limit = 100, offset = 0): Promise<AdminResult<{ queue: AdminQueue }>> {
    const res = await this.call('admin_scan_queue', { p_limit: limit, p_offset: offset });
    if (!res.ok) return res;
    const scans = all(arr(res.data['scans']), (raw): AdminQueueScan | null => {
      if (!isRecord(raw)) return null;
      const id = str(raw['id']);
      const code = str(raw['code']);
      const at = str(raw['occurred_at']);
      const status = raw['status_at_scan'];
      if (id === null || code === null || at === null || !isStatus(status)) return null;
      return { id, code: display(code), statusAtScan: status, occurredAt: at, geoMethod: geo(raw['geo_method']), city: str(raw['city']), region: str(raw['region']) };
    });
    const replacements = all(arr(res.data['replacements']), (raw): AdminQueueReplacement | null => {
      if (!isRecord(raw)) return null;
      const id = str(raw['id']);
      const code = str(raw['code']);
      const at = str(raw['created_at']);
      const kind = raw['kind'];
      if (id === null || code === null || at === null || (kind !== 'damaged' && kind !== 'lost')) return null;
      return { id, code: display(code), kind: kind as ReplacementKind, createdAt: at };
    });
    const locked = all(arr(res.data['locked_tags']), (raw): AdminLockedTag | null => {
      if (!isRecord(raw)) return null;
      const code = str(raw['code']);
      const until = str(raw['locked_until']);
      return code === null || until === null ? null : { code: display(code), lockedUntil: until };
    });
    if (scans === null || replacements === null || locked === null) return failure('network');
    return { ok: true, queue: { scans, replacements, lockedTags: locked } };
  }

  /** Auditoria, mais recentes primeiro. `entityId` aceita código na forma de exibição ou `lote-NNN`. */
  async audit(filters: AdminAuditFilters = {}): Promise<AdminResult<{ rows: AdminAuditRow[] }>> {
    const entity = (filters.entityId ?? '').trim();
    const res = await this.call('admin_audit', {
      p_event: filters.event ?? null,
      p_entity_id: entity === '' ? null : entity,
      p_limit: Math.min(Math.max(filters.limit ?? AUDIT_PAGE_SIZE, 1), 200),
      p_offset: Math.max(filters.offset ?? 0, 0),
    });
    if (!res.ok) return res;
    const rows = all(arr(res.data['rows']), (raw): AdminAuditRow | null => {
      if (!isRecord(raw)) return null;
      const id = str(raw['id']);
      const at = str(raw['at']);
      const event = str(raw['event']);
      if (id === null || at === null || event === null) return null;
      return {
        id,
        at,
        actorId: str(raw['actor_id']),
        actorRole: str(raw['actor_role']),
        event,
        entity: str(raw['entity']),
        entityId: str(raw['entity_id']),
        detail: isRecord(raw['detail']) ? raw['detail'] : null,
      };
    });
    return rows === null ? failure('network') : { ok: true, rows };
  }

  /** CSV do lote só com código, versão e máscara do QR (sem PIN). */
  async exportCodes(batchId: string): Promise<AdminResult<{ batchId: string; count: number; csv: string }>> {
    if (!BATCH_PATTERN.test(batchId)) return failure('not_found');
    const res = await this.call('admin_export_codes', { p_batch: batchId });
    if (!res.ok) return res;
    const csv = str(res.data['csv']);
    return csv === null ? failure('network') : { ok: true, batchId, count: num(res.data['count']), csv };
  }

  /**
   * Cria o lote e devolve o pacote (zip com `pins.csv`). Usa `fetch` (e não `functions.invoke`) porque o corpo é
   * binário: o `invoke` leria um zip como texto e corromperia os bytes. O token é o da sessão do admin; a função
   * confere o papel por dentro.
   */
  async createBatch(quantity: number, notes?: string): Promise<AdminResult<BatchPackage>> {
    if (!Number.isInteger(quantity) || quantity < BATCH_MIN || quantity > BATCH_MAX) return failure('invalid_input');
    const trimmed = (notes ?? '').trim();
    if (trimmed.length > BATCH_NOTES_MAX) return failure('invalid_input');
    try {
      const { data } = await this.supabase.client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return failure('forbidden');
      const response = await fetch(`${environment.supabaseUrl}/functions/v1/admin-create-batch`, {
        method: 'POST',
        headers: { apikey: environment.supabaseAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmed === '' ? { quantity } : { quantity, notes: trimmed }),
      });
      if (response.status === 200) {
        const batchId = response.headers.get('X-Batch-Id');
        if (batchId === null || !BATCH_PATTERN.test(batchId)) return failure('network');
        return { ok: true, batchId, blob: await response.blob() };
      }
      if (response.status === 401 || response.status === 403) return failure('forbidden');
      if (response.status === 429) return failure('too_many_requests');
      if (response.status === 400) return failure('invalid_input');
      if (response.status === 409) return failure('batch_range_exhausted');
      return failure('network');
    } catch {
      return failure('network');
    }
  }
}
