import type { AdminError } from '../../core/admin/admin-tag.service';
import { format, isValid, normalize } from '../../core/tag-code';
import type { GeoMethod, ReplacementKind, TagStatus } from '../../models';

/**
 * Textos e formatos do admin. Tudo no horário de Brasília. Nenhum texto daqui revela PIN ou dado pessoal além do que
 * a RPC já devolve (primeiro nome e inicial do tutor).
 */

/**
 * A geração do PDF de etiquetas (`admin-labels`, T084) está bloqueada: sem a fonte e as máscaras do lote-001 não
 * existe reimpressão. Enquanto for `false`, os botões "Reimprimir" ficam desativados e dizem por quê. Ligar isto
 * exige ligar também a chamada à função (hoje não há).
 */
export const LABELS_AVAILABLE = false;

const TIME_ZONE = 'America/Sao_Paulo';

export function statusLabel(status: TagStatus): string {
  switch (status) {
    case 'available':
      return $localize`Disponível`;
    case 'assigned':
      return $localize`Ativo`;
    case 'blocked':
      return $localize`Bloqueado`;
    case 'void':
      return $localize`Anulado`;
  }
}

/**
 * Selo de cada situação. Só o verde ("Ativo") carrega cor: bloqueado e anulado ficam neutros, com o texto dizendo
 * a situação, porque vermelho é só ação destrutiva e âmbar só o modo perdido (DESIGN.md). A tela de referência
 * pinta "Bloqueado" de âmbar e "Anulado" de vermelho; aqui vale o DESIGN.md.
 */
export function statusBadgeType(status: TagStatus): 'success' | 'neutral' | 'outline' {
  switch (status) {
    case 'assigned':
      return 'success';
    case 'blocked':
      return 'outline';
    default:
      return 'neutral';
  }
}

/** "17 nov 2026". */
export function formatDay(iso: string): string {
  const text = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  return text.replaceAll(' de ', ' ').replaceAll('.', '');
}

/** "02 nov", sem ano. */
export function formatShortDay(iso: string): string {
  const text = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, day: '2-digit', month: 'short' }).format(new Date(iso));
  return text.replaceAll(' de ', ' ').replaceAll('.', '');
}

/** "20 nov, 16:20" (quando o evento é de outro dia que hoje, a data vem na frente). */
export function formatDayTime(iso: string): string {
  const hour = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  return `${formatShortDay(iso)}, ${hour}`;
}

/** "São Paulo, SP", "SP" ou `null` quando não há lugar. */
export function placeText(city: string | null, region: string | null): string | null {
  if (city && region) return `${city}, ${region}`;
  return city ?? region ?? null;
}

/** "Aproximada (IP)", "Precisa (GPS) · ± 15 m" ou "Sem localização". */
export function geoText(method: GeoMethod, accuracyM: number | null): string {
  switch (method) {
    case 'gps':
      return accuracyM === null ? $localize`Precisa (GPS)` : $localize`Precisa (GPS) · ± ${Math.round(accuracyM)}:meters: m`;
    case 'ip':
      return $localize`Aproximada (IP)`;
    case 'none':
      return $localize`Sem localização`;
  }
}

export function replacementLabel(kind: ReplacementKind): string {
  return kind === 'damaged' ? $localize`Dano` : $localize`Perda`;
}

export function adminErrorMessage(error: AdminError): string {
  switch (error) {
    case 'forbidden':
      return $localize`Esta conta não tem acesso a esta ação.`;
    case 'invalid_status':
    case 'invalid_reason':
    case 'invalid_input':
      return $localize`Confira os dados informados e tente de novo.`;
    case 'invalid_code':
      return $localize`Confira o código. Ele tem nove caracteres, como 7K3M-Q9XA-C.`;
    case 'not_found':
      return $localize`Não encontramos este item.`;
    case 'invalid_transition':
      return $localize`Esta mudança de situação não é permitida a partir da situação atual.`;
    case 'tag_not_available':
      return $localize`Só dá para reemitir o PIN de uma tag disponível. Encerre o vínculo antes.`;
    case 'no_active_assignment':
      return $localize`Este código não tem vínculo ativo.`;
    case 'too_many_requests':
      return $localize`Muitas ações em pouco tempo. Aguarde um minuto.`;
    case 'package_already_downloaded':
      return $localize`O pacote deste lote já foi baixado e não aparece de novo.`;
    case 'batch_range_exhausted':
      return $localize`A numeração de lotes chegou ao limite. Fale com o desenvolvimento.`;
    case 'network':
      return $localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`;
  }
}

export interface AuditGroup {
  id: string;
  label: string;
  events: readonly string[];
}

/** Grupos dos chips da auditoria. O banco filtra por um evento só; o grupo filtra as linhas já carregadas. */
export function auditGroups(): AuditGroup[] {
  return [
    { id: 'activation', label: $localize`Ativação`, events: ['tag_activated', 'activation_failed', 'activation_locked_account', 'activation_locked_tag'] },
    { id: 'pin', label: $localize`PIN`, events: ['pin_reissued'] },
    { id: 'batches', label: $localize`Lotes`, events: ['batch_created', 'batch_package_downloaded', 'codes_exported'] },
    { id: 'assignments', label: $localize`Vínculos`, events: ['tag_released', 'assignment_ended_by_admin', 'replacement_requested', 'replacement_resolved'] },
    { id: 'status', label: $localize`Situação`, events: ['tag_status_changed', 'lost_mode_on', 'lost_mode_off'] },
  ];
}

/** Nome em português de cada evento conhecido; o resto aparece pelo código. */
export function auditEventLabel(event: string): string {
  switch (event) {
    case 'tag_activated':
      return $localize`Tag ativada`;
    case 'activation_failed':
      return $localize`PIN errado`;
    case 'activation_locked_account':
      return $localize`Conta travada por PIN errado`;
    case 'activation_locked_tag':
      return $localize`Tag travada por PIN errado`;
    case 'pin_reissued':
      return $localize`PIN reemitido`;
    case 'batch_created':
      return $localize`Lote criado`;
    case 'batch_package_downloaded':
      return $localize`Pacote do lote baixado`;
    case 'codes_exported':
      return $localize`Códigos exportados`;
    case 'tag_released':
      return $localize`Tag liberada pelo tutor`;
    case 'assignment_ended_by_admin':
      return $localize`Vínculo encerrado pelo admin`;
    case 'replacement_requested':
      return $localize`2ª via pedida`;
    case 'replacement_resolved':
      return $localize`Pedido de 2ª via fechado`;
    case 'tag_status_changed':
      return $localize`Situação do código alterada`;
    case 'lost_mode_on':
      return $localize`Modo perdido ligado`;
    case 'lost_mode_off':
      return $localize`Modo perdido desligado`;
    case 'scan_recorded':
      return $localize`Scan registrado`;
    default:
      return event;
  }
}

/**
 * Quem fez, pelo papel gravado no banco. O banco grava o papel de conexão (`authenticated` para qualquer conta logada,
 * admin ou tutor; `anon` para visitante; `service_role` para o servidor): não dá para distinguir admin de tutor por
 * aqui, e a tela não inventa. Nunca mostra o identificador da conta.
 */
export function actorLabel(role: string | null): string {
  switch (role) {
    case 'admin':
      return $localize`admin`;
    case 'tutor':
    case 'authenticated':
      return $localize`conta logada`;
    case 'anon':
      return $localize`visitante`;
    default:
      return $localize`sistema`;
  }
}

function statusWord(value: string): string {
  switch (value) {
    case 'available':
    case 'assigned':
    case 'blocked':
    case 'void':
      return statusLabel(value).toLowerCase();
    case 'done':
      return $localize`resolvido`;
    case 'cancelled':
      return $localize`cancelado`;
    default:
      return value;
  }
}

function reasonWord(value: string): string {
  switch (value) {
    case 'replaced':
      return $localize`troca de tag`;
    case 'lost':
      return $localize`tag perdida`;
    case 'damaged':
      return $localize`tag danificada`;
    case 'released':
      return $localize`liberada pelo tutor`;
    case 'transferred':
      return $localize`passada adiante`;
    case 'admin':
      return $localize`encerrado pelo admin`;
    case 'account_deleted':
      return $localize`conta excluída`;
    default:
      return value;
  }
}

/**
 * Resumo do `detail` do evento, só com chaves conhecidas e valores simples (os valores em inglês do banco viram
 * palavras em português). O banco já não grava PIN, telefone nem IP; mesmo assim nada fora desta lista aparece.
 */
export function auditDetailText(detail: Record<string, unknown> | null): string {
  if (detail === null) return '';
  const parts: string[] = [];
  const text = (key: string): string | null => {
    const value = detail[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  };
  const from = text('from');
  const to = text('to');
  if (to !== null) parts.push(from === null ? `→ ${statusWord(to)}` : `${statusWord(from)} → ${statusWord(to)}`);
  const status = text('status');
  if (status !== null) parts.push(statusWord(status));
  const reason = text('reason');
  if (reason !== null) parts.push(reasonWord(reason));
  const kind = text('kind');
  if (kind === 'damaged' || kind === 'lost') parts.push(replacementLabel(kind).toLowerCase());
  const note = text('note');
  if (note !== null) parts.push(note);
  const count = text('count');
  if (count !== null) parts.push($localize`${count}:count: códigos`);
  const failCount = text('fail_count');
  if (failCount !== null) parts.push($localize`tentativa ${failCount}:count:`);
  const failCount24 = text('fail_count_24h');
  if (failCount24 !== null) parts.push($localize`${failCount24}:count: erros em 24 h`);
  return parts.join(' · ');
}

/** Código na forma de exibição; `lote-NNN` fica como veio; evento de pet não mostra o identificador interno. */
export function entityText(entity: string | null, entityId: string | null): string {
  if (entity === 'pet') return $localize`Pet`;
  if (entityId === null) return '—';
  const code = normalize(entityId);
  return isValid(code) ? format(code) : entityId;
}
