/**
 * RescueProfileService — T064 (spec 003)
 *
 * "O que estranhos veem" e as opções do modo perdido de um pet (`rescue_profiles`). Leitura e gravação direta,
 * protegidas por RLS (o pet é do tutor) e por privilégio de coluna: o tutor só altera as colunas `show_*` e
 * `lost_show_*`. `lost_mode`, `lost_since` e `lost_message` só mudam por `set_lost_mode` (`TagService.setLostMode`).
 *
 * Ligar WhatsApp ou telefone com o celular sem confirmação faz o gatilho do banco lançar `phone_not_confirmed`
 * como EXCEÇÃO (não como `{ ok: false }`); este serviço devolve o mesmo código como erro de negócio. A tela confere
 * o celular antes (`AccountService`); isto é a rede de segurança. Nenhuma mensagem do Supabase é exposta.
 */
import { Injectable, inject } from '@angular/core';

import type { RescueProfile } from '../../models';
import { SupabaseService } from '../supabase/supabase.service';

export type RescueProfileError = 'phone_not_confirmed' | 'not_found' | 'network';
export type RescueProfileResult<T> = ({ ok: true } & T) | { ok: false; error: RescueProfileError };

/** Colunas que o tutor pode gravar direto. */
export type RescueProfilePatch = Partial<
  Pick<
    RescueProfile,
    | 'showTemperament'
    | 'showCare'
    | 'showTutorFirstName'
    | 'showWhatsapp'
    | 'showPhone'
    | 'lostShowSince'
    | 'lostShowReward'
    | 'lostShowMessage'
  >
>;

interface RescueProfileRow {
  pet_id: string;
  show_temperament: boolean;
  show_care: boolean;
  show_tutor_first_name: boolean;
  show_whatsapp: boolean;
  show_phone: boolean;
  lost_mode: boolean;
  lost_since: string | null;
  lost_message: string | null;
  lost_show_since: boolean;
  lost_show_reward: boolean;
  lost_show_message: boolean;
}

const COLUMN_OF: Record<keyof RescueProfilePatch, string> = {
  showTemperament: 'show_temperament',
  showCare: 'show_care',
  showTutorFirstName: 'show_tutor_first_name',
  showWhatsapp: 'show_whatsapp',
  showPhone: 'show_phone',
  lostShowSince: 'lost_show_since',
  lostShowReward: 'lost_show_reward',
  lostShowMessage: 'lost_show_message',
};

function toProfile(row: RescueProfileRow): RescueProfile {
  return {
    petId: row.pet_id,
    showTemperament: row.show_temperament,
    showCare: row.show_care,
    showTutorFirstName: row.show_tutor_first_name,
    showWhatsapp: row.show_whatsapp,
    showPhone: row.show_phone,
    lostMode: row.lost_mode,
    lostSince: row.lost_since,
    lostMessage: row.lost_message,
    lostShowSince: row.lost_show_since,
    lostShowReward: row.lost_show_reward,
    lostShowMessage: row.lost_show_message,
  };
}

/** Só as colunas permitidas, com os nomes do banco. `null` quando o patch não tem nenhuma. */
export function toRescueColumns(patch: RescueProfilePatch): Record<string, boolean> | null {
  const cols: Record<string, boolean> = {};
  for (const key of Object.keys(COLUMN_OF) as (keyof RescueProfilePatch)[]) {
    const value = patch[key];
    if (typeof value === 'boolean') cols[COLUMN_OF[key]] = value;
  }
  return Object.keys(cols).length === 0 ? null : cols;
}

@Injectable({ providedIn: 'root' })
export class RescueProfileService {
  private readonly supabase = inject(SupabaseService);

  /** Perfil de resgate do pet. Pet de outro tutor (ou inexistente): `not_found`. */
  async get(petId: string): Promise<RescueProfileResult<{ profile: RescueProfile }>> {
    try {
      const { data, error } = await this.supabase.client
        .from('rescue_profiles')
        .select('*')
        .eq('pet_id', petId)
        .maybeSingle();
      if (error) return { ok: false, error: 'network' };
      if (data === null) return { ok: false, error: 'not_found' };
      return { ok: true, profile: toProfile(data as RescueProfileRow) };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  /** Salva as opções. Devolve o perfil como ficou. */
  async save(petId: string, patch: RescueProfilePatch): Promise<RescueProfileResult<{ profile: RescueProfile }>> {
    const cols = toRescueColumns(patch);
    if (cols === null) return this.get(petId);
    try {
      const { data, error } = await this.supabase.client
        .from('rescue_profiles')
        .update(cols)
        .eq('pet_id', petId)
        .select('*');
      if (error) {
        return { ok: false, error: error.message?.includes('phone_not_confirmed') ? 'phone_not_confirmed' : 'network' };
      }
      // RLS esconde o perfil de outro tutor: nenhuma linha atualizada.
      if (!Array.isArray(data) || data.length === 0) return { ok: false, error: 'not_found' };
      return { ok: true, profile: toProfile(data[0] as RescueProfileRow) };
    } catch {
      return { ok: false, error: 'network' };
    }
  }
}
