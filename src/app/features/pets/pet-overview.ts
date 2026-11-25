import type { PetService } from '../../core/pets/pet.service';
import type { TagService } from '../../core/tags/tag.service';
import type { DashboardPet, Pet } from '../../models';

/** Um pet na lista do painel: a situação (do `my_dashboard`), os dados (da tabela `pets`) e a foto já assinada. */
export interface PetOverviewItem {
  dash: DashboardPet;
  /** `null` se a leitura da tabela falhou: a tela mostra só o que o painel trouxe. */
  pet: Pet | null;
  photoUrl: string | null;
}

export type PetOverview =
  | { ok: true; items: PetOverviewItem[]; pendingActivation: string | null }
  | { ok: false };

/**
 * Carrega o que o painel e a lista de pets mostram: `my_dashboard` (situação da tag, modo perdido, scans) mais os
 * dados dos pets (raça, nascimento) e as URLs assinadas das fotos. Só o `my_dashboard` é indispensável: sem os
 * dados dos pets a tela ainda funciona, sem raça nem idade.
 */
export async function loadPetOverview(tags: TagService, pets: PetService): Promise<PetOverview> {
  const [dashboard, rows] = await Promise.all([tags.myDashboard(), pets.list()]);
  if (!dashboard.ok) return { ok: false };
  const byId = new Map<string, Pet>(rows.ok ? rows.pets.map((p) => [p.id, p]) : []);
  const urls = await pets.photoUrls(dashboard.dashboard.pets.map((p) => p.photoPath));
  return {
    ok: true,
    pendingActivation: dashboard.dashboard.pendingActivation,
    items: dashboard.dashboard.pets.map((dash) => ({
      dash,
      pet: byId.get(dash.id) ?? null,
      photoUrl: dash.photoPath === null ? null : (urls[dash.photoPath] ?? null),
    })),
  };
}
