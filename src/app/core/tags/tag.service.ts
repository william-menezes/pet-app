/**
 * TagService — T040 (spec 003)
 *
 * RPCs do tutor para a ativação da tag (`contracts/tutor-rpcs.contract.md`). Único lugar do app autenticado
 * que fala com o Supabase sobre vínculo de tag.
 *
 * Regras do contrato:
 *  - o código é normalizado e o dígito conferido AQUI, antes de qualquer chamada (Princípio VIII);
 *  - nenhuma RPC lança para erro de negócio: a resposta é `{ ok: false, error }` e este serviço devolve o mesmo
 *    formato (`TagResult`). Só falha de rede ou resposta fora do formato vira `network`;
 *  - o PIN só passa pelo argumento: não é guardado, nem logado, nem mandado para URL ou storage;
 *  - nenhuma mensagem do Supabase é exposta.
 *
 * NÃO exportar por `core/tags/index.ts`: este arquivo puxa o `@supabase/supabase-js` e a página pública não
 * pode levá-lo junto (`npm run check:bundle`).
 */
import { Injectable, inject } from '@angular/core';

import type { Dashboard, DashboardPet, GeoMethod, PetSpecies, TagStatus } from '../../models';
import { format, isValid, normalize } from '../tag-code';
import { SupabaseService } from '../supabase/supabase.service';
import { TAG_ERRORS, type TagError } from './tag-errors';

export interface TagFailure {
  ok: false;
  error: TagError;
  retryAfterSeconds?: number;
}
export type TagResult<T> = ({ ok: true } & T) | TagFailure;

export interface ActivationInput {
  /** Código digitado ou lido do QR, em qualquer forma; é normalizado aqui. */
  code: string;
  /** PIN do cartão; normalizado aqui e descartado ao fim da chamada. */
  pin: string;
  petId: string;
  /** Confirmação de troca (o pet já tem tag). */
  replace?: boolean;
  /** Sempre enviado de forma explícita (a tela de PIN começa com a opção marcada). */
  enableWhatsapp: boolean;
}

export interface ActivationResult {
  code: string;
  petId: string;
  petName: string;
  whatsappEnabled: boolean;
}

export interface LostModeInput {
  petId: string;
  on: boolean;
  /** Recado para quem achar (até 280). Ignorado ao desligar. */
  message?: string | null;
  showSince: boolean;
  showReward: boolean;
}

/** Limite do recado (CHECK da tabela). */
export const LOST_MESSAGE_MAX = 280;

const PIN_PATTERN = /^[0-9A-HJKMNP-TV-Z]{6}$/;

/** PIN no formato que a RPC espera: 6 caracteres Crockford, com a mesma normalização do código. */
export function normalizePin(input: string): string {
  return normalize(input);
}

export function isPinShape(input: string): boolean {
  return PIN_PATTERN.test(normalizePin(input));
}

const failure = (error: TagError, retryAfterSeconds?: number): TagFailure =>
  retryAfterSeconds === undefined ? { ok: false, error } : { ok: false, error, retryAfterSeconds };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function toDashboardPet(raw: unknown): DashboardPet | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id']);
  const name = str(raw['name']);
  const species = raw['species'];
  if (id === null || name === null || (species !== 'dog' && species !== 'cat')) return null;
  const last = raw['last_scan'];
  const lastAt = isRecord(last) ? str(last['occurred_at']) : null;
  const geo = isRecord(last) ? last['geo_method'] : null;
  const status = raw['tag_status'];
  return {
    id,
    name,
    species: species as PetSpecies,
    photoPath: str(raw['photo_path']),
    lostMode: raw['lost_mode'] === true,
    lostSince: str(raw['lost_since']),
    hasTag: raw['has_tag'] === true,
    tagCode: str(raw['tag_code']),
    tagStatus:
      status === 'available' || status === 'assigned' || status === 'blocked' || status === 'void'
        ? (status as TagStatus)
        : null,
    scansMonth: num(raw['scans_month']),
    lastScan: lastAt === null ? null : { occurredAt: lastAt, geoMethod: geo === 'ip' || geo === 'gps' ? (geo as GeoMethod) : 'none' },
    visibleShown: num(raw['visible_shown']),
    visibleTotal: num(raw['visible_total'], 5),
  };
}

@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Chama a RPC e devolve o objeto de resposta já separado entre sucesso e erro de negócio.
   * Erro do cliente (rede, 5xx) ou corpo fora do formato: `network`.
   */
  private async call(name: string, args?: Record<string, unknown>): Promise<TagResult<{ data: Record<string, unknown> }>> {
    try {
      const { data, error } = await this.supabase.client.rpc(name, args);
      if (error || !isRecord(data)) return failure('network');
      if (data['ok'] === true) return { ok: true, data };
      const code = data['error'];
      if (typeof code !== 'string' || !TAG_ERRORS.includes(code as TagError)) return failure('network');
      const retry = data['retry_after_seconds'];
      return failure(code as TagError, typeof retry === 'number' ? retry : undefined);
    } catch {
      return failure('network');
    }
  }

  /** `check_tag_for_link`: 'Código válido · tag disponível'. */
  async checkForLink(code: string): Promise<TagResult<{ code: string }>> {
    const normalized = normalize(code);
    if (!isValid(normalized)) return failure('invalid_code');
    const res = await this.call('check_tag_for_link', { p_code: normalized });
    if (!res.ok) return res;
    return { ok: true, code: str(res.data['code']) ?? format(normalized) };
  }

  /** `activate_tag`. O PIN malformado nem sai do aparelho (não gasta tentativa). */
  async activate(input: ActivationInput): Promise<TagResult<ActivationResult>> {
    const code = normalize(input.code);
    if (!isValid(code)) return failure('invalid_code');
    if (!isPinShape(input.pin)) return failure('wrong_pin');
    const res = await this.call('activate_tag', {
      p_code: code,
      p_pin: normalizePin(input.pin),
      p_pet_id: input.petId,
      p_replace: input.replace === true,
      p_enable_whatsapp: input.enableWhatsapp,
    });
    if (!res.ok) return res;
    const petId = str(res.data['pet_id']);
    const petName = str(res.data['pet_name']);
    if (petId === null || petName === null) return failure('network');
    return {
      ok: true,
      code: str(res.data['code']) ?? format(code),
      petId,
      petName,
      whatsappEnabled: res.data['whatsapp_enabled'] === true,
    };
  }

  /** `set_pending_activation`: guarda o código para a conta (7 dias). Não é oráculo: não diz nada sobre a tag. */
  async setPendingActivation(code: string): Promise<TagResult<object>> {
    const normalized = normalize(code);
    if (!isValid(normalized)) return failure('invalid_code');
    const res = await this.call('set_pending_activation', { p_code: normalized });
    return res.ok ? { ok: true } : res;
  }

  /** `get_pending_activation`: código pendente (`XXXX-XXXX-X`) ou `null`. */
  async getPendingActivation(): Promise<TagResult<{ code: string | null }>> {
    const res = await this.call('get_pending_activation');
    return res.ok ? { ok: true, code: str(res.data['code']) } : res;
  }

  async clearPendingActivation(): Promise<TagResult<object>> {
    const res = await this.call('clear_pending_activation');
    return res.ok ? { ok: true } : res;
  }

  /**
   * `set_lost_mode`: liga (com recado e as duas opções) ou desliga o modo perdido do pet. Ligar sem tag ativa devolve
   * `no_active_tag`. Desligar mantém o recado como rascunho (o servidor decide); o recado branco vira `null`.
   */
  async setLostMode(input: LostModeInput): Promise<TagResult<object>> {
    const message = (input.message ?? '').trim();
    if (message.length > LOST_MESSAGE_MAX) return failure('network');
    const res = await this.call('set_lost_mode', {
      p_pet_id: input.petId,
      p_on: input.on,
      p_message: input.on && message !== '' ? message : null,
      p_show_since: input.showSince,
      p_show_reward: input.showReward,
    });
    return res.ok ? { ok: true } : res;
  }

  /** `my_dashboard`: pets do tutor com a situação da tag (e a ativação pendente). */
  async myDashboard(): Promise<TagResult<{ dashboard: Dashboard }>> {
    const res = await this.call('my_dashboard');
    if (!res.ok) return res;
    const raw = res.data['pets'];
    if (!Array.isArray(raw)) return failure('network');
    const pets = raw.map(toDashboardPet);
    if (pets.some((p) => p === null)) return failure('network');
    return {
      ok: true,
      dashboard: { pets: pets as DashboardPet[], pendingActivation: str(res.data['pending_activation']) },
    };
  }
}
