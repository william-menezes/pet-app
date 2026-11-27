/**
 * resolve-response.ts — T029 (spec 003)
 *
 * Converte a resposta do `resolve-tag` em `TagResolution`, CAMPO A CAMPO: nada da resposta crua é
 * copiado para o `TransferState` (e, portanto, para o HTML). Campo ausente continua ausente; o que não
 * tem o formato esperado é descartado; uma resposta que não é um dos estados do contrato vira
 * `contingency`. `rate_limited` também vira `contingency` ("Este pet tem dono", com "Tentar de novo").
 *
 * `whatsapp_url` só vale se for um link `https://wa.me/…`; a foto só vale se for `https:`. Assim
 * nenhum esquema perigoso (`javascript:`) chega ao `href`/`src`.
 */
import { format, isValid } from '../../tag-code/tag-code';
import type { LostElapsed, PublicLostInfo, PublicRescueProfile, TagResolution } from '../../../models';

const CONTINGENCY: TagResolution = { state: 'contingency' };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.slice(0, max) : undefined;

function httpsUrl(value: unknown, prefix?: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return undefined;
    if (prefix !== undefined && !value.startsWith(prefix)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Horas até 48 h, depois dias (contrato). `null` se a data é inválida. */
export function lostElapsed(sinceIso: string, now: number): LostElapsed | null {
  const since = Date.parse(sinceIso);
  if (Number.isNaN(since)) return null;
  const hours = Math.max(1, Math.floor((now - since) / 3_600_000));
  return hours <= 48 ? { unit: 'hours', amount: hours } : { unit: 'days', amount: Math.floor(hours / 24) };
}

function parseLost(value: unknown): PublicLostInfo | undefined {
  if (!isObject(value)) return undefined;
  const lost: PublicLostInfo = {};
  const since = text(value['since'], 40);
  if (since !== undefined && !Number.isNaN(Date.parse(since))) lost.since = since;
  if (value['reward'] === true) lost.reward = true;
  const message = text(value['message'], 280);
  if (message !== undefined) lost.message = message;
  return lost;
}

function parseProfile(value: unknown): PublicRescueProfile | null {
  if (!isObject(value) || !isObject(value['pet'])) return null;
  const name = text(value['pet']['name'], 40);
  const code = typeof value['code'] === 'string' && isValid(value['code']) ? format(value['code']) : undefined;
  if (name === undefined || code === undefined) return null;

  const profile: PublicRescueProfile = { code, pet: { name } };
  const photo = httpsUrl(value['pet']['photo_url']);
  if (photo !== undefined) profile.pet.photo_url = photo;

  if (Array.isArray(value['temperament'])) {
    const items = value['temperament']
      .map((item) => text(item, 30))
      .filter((item): item is string => item !== undefined)
      .slice(0, 5);
    if (items.length > 0) profile.temperament = items;
  }
  const care = text(value['care_notes'], 280);
  if (care !== undefined) profile.care_notes = care;
  const tutor = text(value['tutor_first_name'], 40);
  if (tutor !== undefined) profile.tutor_first_name = tutor;
  const whatsapp = httpsUrl(value['whatsapp_url'], 'https://wa.me/');
  if (whatsapp !== undefined) profile.whatsapp_url = whatsapp;
  const phone = text(value['phone_display'], 20);
  if (phone !== undefined) profile.phone_display = phone;
  const lost = parseLost(value['lost']);
  if (lost !== undefined) profile.lost = lost;
  return profile;
}

export function parseResolveResponse(body: unknown, now: number): TagResolution {
  if (!isObject(body)) return CONTINGENCY;
  switch (body['state']) {
    case 'assigned': {
      const profile = parseProfile(body['profile']);
      if (profile === null) return CONTINGENCY;
      const elapsed = profile.lost?.since !== undefined ? lostElapsed(profile.lost.since, now) : null;
      return elapsed === null ? { state: 'assigned', profile } : { state: 'assigned', profile, lostElapsed: elapsed };
    }
    case 'available': {
      const code = body['code'];
      return typeof code === 'string' && isValid(code) ? { state: 'available', code: format(code) } : CONTINGENCY;
    }
    case 'not_found':
      return { state: 'not_found' };
    default:
      // `rate_limited` e qualquer outra coisa: contingência.
      return CONTINGENCY;
  }
}
