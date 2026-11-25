import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { SwitchRow } from '@/shared/components/faro/switch-row/switch-row';
import { ZardFieldComponent, ZardFieldLabelComponent } from '@/shared/components/field';
import { ZardSonnerService } from '@/shared/components/sonner';
import { ZardTextareaComponent } from '@/shared/components/textarea';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { RescueProfileService } from '../../../core/pets/rescue-profile.service';
import { tagErrorMessage } from '../../../core/tags/tag-errors';
import { LOST_MESSAGE_MAX, TagService } from '../../../core/tags/tag.service';
import type { DashboardPet } from '../../../models';

type State = 'loading' | 'ready' | 'error' | 'missing';

/**
 * "Ativar modo perdido" (`/app/pets/:petId/modo-perdido`, T060; referência `V2-modo-perdido*.dc.html`, claro e
 * escuro): recado com contador de 280, dois interruptores e, no tablet e no desktop, a prévia do alerta.
 *
 * O recado vem do rascunho guardado no perfil (desligar mantém o recado): ligar com o campo vazio apagaria o texto
 * que o tutor escreveu da última vez. O bloco âmbar da prévia usa os mesmos textos da página pública
 * ("Sou X. Me perdi de casa."), sem artigo, porque o app não sabe o sexo do pet.
 */
@Component({
  selector: 'app-lost-mode',
  imports: [
    RouterLink,
    NgIcon,
    ScreenHeader,
    SwitchRow,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldComponent,
    ZardFieldLabelComponent,
    ZardTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lost-mode.html',
})
export class LostMode {
  private readonly tags = inject(TagService);
  private readonly profiles = inject(RescueProfileService);
  private readonly router = inject(Router);
  private readonly sonner = inject(ZardSonnerService);

  /** Parâmetro de rota `:petId` (ligado por `withComponentInputBinding`). */
  readonly petId = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly pet = signal<DashboardPet | null>(null);
  protected readonly message = signal('');
  protected readonly showSince = signal(true);
  protected readonly showReward = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly messageMax = LOST_MESSAGE_MAX;
  protected readonly noTagMessage = tagErrorMessage('no_active_tag');
  private loadId = 0;

  protected readonly name = computed(() => this.pet()?.name ?? '');
  protected readonly alreadyOn = computed(() => this.pet()?.lostMode === true);
  protected readonly noTag = computed(() => this.pet() !== null && !this.pet()?.hasTag);
  protected readonly tooLong = computed(() => this.message().length > LOST_MESSAGE_MAX);
  protected readonly canSubmit = computed(() => !this.saving() && !this.noTag() && !this.tooLong());
  protected readonly backLink = computed(() => `/app/pets/${this.petId()}`);
  protected readonly linkRoute = computed(() => ['/vincular', this.petId()]);

  constructor() {
    effect(() => {
      this.petId();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    this.problem.set(null);
    const petId = this.petId();
    const [dashboard, profile] = await Promise.all([this.tags.myDashboard(), this.profiles.get(petId)]);
    if (id !== this.loadId) return;
    if (!dashboard.ok || (!profile.ok && profile.error !== 'not_found')) {
      this.state.set('error');
      return;
    }
    const pet = dashboard.dashboard.pets.find((p) => p.id === petId) ?? null;
    if (pet === null || !profile.ok) {
      this.state.set('missing');
      return;
    }
    this.pet.set(pet);
    this.message.set(profile.profile.lostMessage ?? '');
    this.showSince.set(profile.profile.lostShowSince);
    this.showReward.set(profile.profile.lostShowReward);
    this.state.set('ready');
  }

  protected onMessage(event: Event): void {
    this.message.set((event.target as HTMLTextAreaElement).value);
  }

  protected async submit(): Promise<void> {
    const pet = this.pet();
    if (pet === null || !this.canSubmit()) return;
    this.saving.set(true);
    this.problem.set(null);
    const res = await this.tags.setLostMode({
      petId: pet.id,
      on: true,
      message: this.message(),
      showSince: this.showSince(),
      showReward: this.showReward(),
    });
    this.saving.set(false);
    if (!res.ok) {
      this.problem.set(tagErrorMessage(res.error, res.retryAfterSeconds));
      return;
    }
    this.sonner.success(
      this.alreadyOn() ? $localize`Alerta atualizado.` : $localize`Modo perdido ativado. A página da tag já mostra o alerta.`,
    );
    void this.router.navigate(['/app/pets', pet.id]);
  }
}
