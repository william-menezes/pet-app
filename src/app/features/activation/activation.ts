import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { PetService } from '../../core/pets/pet.service';
import { format, isValid, normalize } from '../../core/tag-code';
import { activationPath, phoneConfirmationRoute } from '../../core/tags/activation-links';
import { tagErrorMessage } from '../../core/tags/tag-errors';
import { TagService, type ActivationResult } from '../../core/tags/tag.service';
import { DoneStep } from './done-step/done-step';
import type { PetOption } from './pet-option';
import { PetStep, type PetStepState } from './pet-step/pet-step';
import { PinStep, type PinProblem, type PinSubmission } from './pin-step/pin-step';

type View = 'invalid' | 'pet' | 'pin' | 'done';

/**
 * Ativação da tag (`/ativar/:code`, T042 a T047): escolher o pet, PIN, "Tag ativa!". Os passos são estado da tela
 * (um signal), não endereços (contrato de integração §1.2). Sempre no tema claro (casca de fluxo).
 *
 * Quem entra aqui já passou por `activationGuard` (sessão, código guardado) e `phoneConfirmedGuard`.
 * O PIN nunca chega a este componente como estado: o passo do PIN entrega o texto uma vez, direto para a chamada.
 */
@Component({
  selector: 'app-activation',
  imports: [RouterLink, FlowShell, PetStep, PinStep, DoneStep, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activation.html',
})
export class Activation implements OnInit {
  private readonly router = inject(Router);
  private readonly tags = inject(TagService);
  private readonly petService = inject(PetService);

  /** Parâmetro de rota `:code` (ligado por `withComponentInputBinding`). */
  readonly code = input('');
  /** `?pet=<id>`: pet escolhido na volta de "Novo pet". */
  readonly pet = input<string | undefined>(undefined);

  protected readonly normalized = computed(() => normalize(this.code()));
  protected readonly display = computed(() => (isValid(this.normalized()) ? format(this.normalized()) : ''));
  protected readonly invalidMessage = tagErrorMessage('invalid_code');

  protected readonly view = signal<View>('pet');
  protected readonly petState = signal<PetStepState>('loading');
  protected readonly pets = signal<PetOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly confirmReplace = signal(false);
  protected readonly petNotice = signal<string | null>(null);
  protected readonly replace = signal(false);
  protected readonly submitting = signal(false);
  protected readonly problem = signal<PinProblem | null>(null);
  protected readonly result = signal<ActivationResult | null>(null);

  protected readonly chosen = computed(() => this.pets().find((p) => p.id === this.selectedId()) ?? null);

  ngOnInit(): void {
    if (!isValid(this.normalized())) {
      this.view.set('invalid');
      return;
    }
    void this.loadPets();
  }

  protected async loadPets(): Promise<void> {
    this.petState.set('loading');
    const res = await this.tags.myDashboard();
    if (!res.ok) {
      this.petState.set('error');
      return;
    }
    const urls = await this.petService.photoUrls(res.dashboard.pets.map((p) => p.photoPath));
    this.pets.set(
      res.dashboard.pets.map((p) => ({
        id: p.id,
        name: p.name,
        species: p.species,
        hasTag: p.hasTag,
        tagCode: p.tagCode,
        photoUrl: p.photoPath === null ? null : (urls[p.photoPath] ?? null),
      })),
    );
    const wanted = this.pet();
    const current = this.selectedId();
    if (current === null || !this.pets().some((p) => p.id === current)) {
      this.selectedId.set(wanted !== undefined && this.pets().some((p) => p.id === wanted) ? wanted : null);
    }
    this.petState.set('ready');
  }

  protected onPicked(pick: { petId: string; replace: boolean }): void {
    this.selectedId.set(pick.petId);
    this.replace.set(pick.replace);
    this.problem.set(null);
    this.petNotice.set(null);
    this.view.set('pin');
  }

  protected onAddPet(): void {
    void this.router.navigate(['/novo-pet'], { queryParams: { returnUrl: activationPath(this.normalized()) } });
  }

  protected onChangePet(): void {
    this.problem.set(null);
    this.confirmReplace.set(false);
    this.view.set('pet');
  }

  /** O texto do PIN existe só nesta chamada (variável local); depois dela não resta cópia. */
  protected async onSubmit(submission: PinSubmission): Promise<void> {
    const pet = this.chosen();
    if (pet === null || this.submitting()) return;
    this.submitting.set(true);
    this.problem.set(null);
    const res = await this.tags.activate({
      code: this.normalized(),
      pin: submission.pin,
      petId: pet.id,
      replace: this.replace(),
      enableWhatsapp: submission.enableWhatsapp,
    });
    this.submitting.set(false);

    if (res.ok) {
      this.result.set(res);
      this.view.set('done');
      return;
    }
    switch (res.error) {
      case 'phone_not_confirmed': {
        const route = phoneConfirmationRoute(activationPath(this.normalized(), pet.id));
        void this.router.navigate(route.commands, { queryParams: route.queryParams });
        return;
      }
      case 'pet_has_tag':
        // Reserva: a lista estava velha (o pet ganhou tag depois). Volta ao passo 1 pedindo a confirmação.
        this.pets.update((list) => list.map((p) => (p.id === pet.id ? { ...p, hasTag: true } : p)));
        this.confirmReplace.set(true);
        this.view.set('pet');
        return;
      case 'pet_not_found':
        this.petNotice.set(tagErrorMessage('pet_not_found'));
        this.selectedId.set(null);
        this.view.set('pet');
        void this.loadPets();
        return;
      default:
        this.problem.set({ error: res.error, ...(res.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: res.retryAfterSeconds }) });
    }
  }
}
