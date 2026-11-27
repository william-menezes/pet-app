import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { PetAvatar } from '@/shared/components/faro/pet-avatar/pet-avatar';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { speciesLabel, type PetOption } from '../pet-option';

export type PetStepState = 'loading' | 'ready' | 'error';

/**
 * Passo 1 da ativação: "Para qual pet é esta tag?" (T043; referência `V2-ativacao-pet*.dc.html`).
 * Pet que já tem tag pede confirmação ANTES do PIN: a RPC só avisa `pet_has_tag` depois de conferir o PIN, e
 * pedir de novo o PIN para trocar a tag seria pior (e gastaria tentativa).
 */
@Component({
  selector: 'app-activation-pet-step',
  imports: [NgIcon, FlowShell, PetAvatar, ZardAlertComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pet-step.html',
})
export class PetStep {
  /** Código na forma de exibição, `XXXX-XXXX-X`. */
  readonly code = input.required<string>();
  readonly pets = input.required<PetOption[]>();
  readonly state = input<PetStepState>('ready');
  /** Texto do erro de carga; sem ele, o genérico de conexão. */
  readonly errorText = input<string | null>(null);
  /** Aviso no topo da lista (por exemplo, o pet não foi encontrado). */
  readonly notice = input<string | null>(null);
  readonly selectedId = model<string | null>(null);
  /** Painel de confirmação da troca de tag aberto. */
  readonly confirmReplace = model(false);

  readonly picked = output<{ petId: string; replace: boolean }>();
  readonly addPet = output<void>();
  readonly retry = output<void>();

  protected readonly selected = computed(() => this.pets().find((p) => p.id === this.selectedId()) ?? null);
  protected readonly label = speciesLabel;
  protected readonly headline = [$localize`Uma tag,`, $localize`um pet.`];
  protected readonly loadFailed = $localize`Não conseguimos carregar seus pets. Verifique sua conexão e tente de novo.`;
  protected readonly sub = $localize`Você escolhe para quem é a tag e confirma com o PIN do cartão.`;

  protected select(id: string): void {
    this.selectedId.set(id);
    this.confirmReplace.set(false);
  }

  protected onContinue(): void {
    const pet = this.selected();
    if (pet === null) return;
    if (pet.hasTag && !this.confirmReplace()) {
      this.confirmReplace.set(true);
      return;
    }
    this.picked.emit({ petId: pet.id, replace: pet.hasTag });
  }

  protected petSub(pet: PetOption): string {
    return pet.hasTag ? $localize`${speciesLabel(pet.species)}:species: · com tag` : $localize`${speciesLabel(pet.species)}:species: · sem tag`;
  }
}
