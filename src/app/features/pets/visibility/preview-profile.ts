import type { PublicRescueProfile, RescueProfile } from '../../../models';

/** As oito escolhas de "O que estranhos veem" (as cinco de sempre e as três do modo perdido). */
export type Visibility = Pick<
  RescueProfile,
  | 'showTemperament'
  | 'showCare'
  | 'showTutorFirstName'
  | 'showWhatsapp'
  | 'showPhone'
  | 'lostShowSince'
  | 'lostShowReward'
  | 'lostShowMessage'
>;

export const VISIBILITY_KEYS: readonly (keyof Visibility)[] = [
  'showTemperament',
  'showCare',
  'showTutorFirstName',
  'showWhatsapp',
  'showPhone',
  'lostShowSince',
  'lostShowReward',
  'lostShowMessage',
];

export function visibilityOf(profile: RescueProfile): Visibility {
  return {
    showTemperament: profile.showTemperament,
    showCare: profile.showCare,
    showTutorFirstName: profile.showTutorFirstName,
    showWhatsapp: profile.showWhatsapp,
    showPhone: profile.showPhone,
    lostShowSince: profile.lostShowSince,
    lostShowReward: profile.lostShowReward,
    lostShowMessage: profile.lostShowMessage,
  };
}

/** Só as escolhas que mudaram em relação ao que está salvo. */
export function changedVisibility(saved: Visibility, draft: Visibility): Partial<Visibility> {
  const patch: Partial<Visibility> = {};
  for (const key of VISIBILITY_KEYS) {
    if (saved[key] !== draft[key]) patch[key] = draft[key];
  }
  return patch;
}

export interface PreviewInput {
  name: string;
  photoUrl: string | null;
  /** `XXXX-XXXX-X`; nulo quando o pet ainda não tem tag. */
  tagCode: string | null;
  temperament: readonly string[];
  careNotes: string | null;
  tutorFirstName: string | null;
  /** Celular do tutor já formatado, `(11) 98765-4421`; nulo sem celular. */
  phoneDisplay: string | null;
  visibility: Visibility;
  /** Estado do modo perdido (ele aparece na prévia só quando está ligado). */
  lost: { on: boolean; since: string | null; message: string | null };
}

/**
 * Monta o que `resolve-tag` devolveria para as escolhas atuais (ainda não salvas), para a prévia reutilizar a mesma
 * tela da página pública. Regra da projeção: campo desligado (ou sem conteúdo) fica AUSENTE, nunca `null`.
 *
 * Não monta `wa.me` de verdade: a prévia é a visão do dono, onde os botões de contato ficam desativados, então o
 * endereço só precisa existir para o botão aparecer.
 */
export function buildPreviewProfile(input: PreviewInput): PublicRescueProfile {
  const { visibility: v } = input;
  const profile: PublicRescueProfile = {
    code: input.tagCode ?? '',
    pet: input.photoUrl === null ? { name: input.name } : { name: input.name, photo_url: input.photoUrl },
  };
  if (v.showTemperament && input.temperament.length > 0) profile.temperament = [...input.temperament];
  const care = input.careNotes?.trim() ?? '';
  if (v.showCare && care !== '') profile.care_notes = care;
  const first = input.tutorFirstName?.trim() ?? '';
  if (v.showTutorFirstName && first !== '') profile.tutor_first_name = first;
  if (input.phoneDisplay !== null) {
    if (v.showWhatsapp) profile.whatsapp_url = 'https://wa.me/';
    if (v.showPhone) profile.phone_display = input.phoneDisplay;
  }
  if (input.lost.on) {
    const message = input.lost.message?.trim() ?? '';
    profile.lost = {
      ...(v.lostShowSince && input.lost.since !== null ? { since: input.lost.since } : {}),
      ...(v.lostShowReward ? { reward: true as const } : {}),
      ...(v.lostShowMessage && message !== '' ? { message } : {}),
    };
  }
  return profile;
}

/** `(11) 98765-4421` vira `(11) 9••••-4421`. Qualquer outro formato é devolvido como veio. */
export function maskPhone(display: string): string {
  return display.replace(/^(\(\d{2}\) 9)\d{4}(-\d{4})$/, '$1••••$2');
}
