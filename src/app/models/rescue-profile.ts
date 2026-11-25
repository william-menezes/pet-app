/** Opções de visibilidade e modo perdido de um pet (`rescue_profiles`, data-model.md). */
export interface RescueProfile {
  petId: string;
  showTemperament: boolean;
  showCare: boolean;
  showTutorFirstName: boolean;
  showWhatsapp: boolean;
  showPhone: boolean;
  lostMode: boolean;
  lostSince: string | null;
  lostMessage: string | null;
  lostShowSince: boolean;
  lostShowReward: boolean;
  lostShowMessage: boolean;
}

/**
 * Projeção pública de uma tag vinculada (`resolve-tag`, `public-page.contract.md`). Campo que o
 * tutor desligou NÃO vem na resposta: está ausente, nunca `null`. Nenhum identificador interno.
 */
export interface PublicRescueProfile {
  /** Código na forma de exibição, `XXXX-XXXX-X`. */
  code: string;
  pet: { name: string; photo_url?: string };
  temperament?: string[];
  care_notes?: string;
  tutor_first_name?: string;
  whatsapp_url?: string;
  phone_display?: string;
  lost?: PublicLostInfo;
}

export interface PublicLostInfo {
  /** Instante em que o tutor ligou o modo perdido (ISO 8601). */
  since?: string;
  reward?: true;
  message?: string;
}

/** "Perdido há N", calculado uma vez no servidor (horas até 48 h, depois dias). */
export interface LostElapsed {
  unit: 'hours' | 'days';
  amount: number;
}
