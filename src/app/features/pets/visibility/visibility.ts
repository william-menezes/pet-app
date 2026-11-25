import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { SwitchRow } from '@/shared/components/faro/switch-row/switch-row';
import { ZardSonnerService } from '@/shared/components/sonner';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { AccountService } from '../../../core/account/account.service';
import { formatBrPhone } from '../../../core/account/phone';
import { PetService } from '../../../core/pets/pet.service';
import { RescueProfileService } from '../../../core/pets/rescue-profile.service';
import { lostElapsed } from '../../../core/tags/server/resolve-response';
import { phoneConfirmationRoute } from '../../../core/tags/activation-links';
import { tagErrorMessage } from '../../../core/tags/tag-errors';
import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet, Pet, RescueProfile } from '../../../models';
import {
  buildPreviewProfile,
  changedVisibility,
  maskPhone,
  visibilityOf,
  type Visibility,
} from './preview-profile';
import { VisibilityPreview } from './visibility-preview';

type State = 'loading' | 'ready' | 'error' | 'missing';
type ContactKey = 'showWhatsapp' | 'showPhone';

/**
 * "O que estranhos veem" (`/app/pets/:petId/visibilidade`, T065; referência `V2-visibilidade*.dc.html`, claro e
 * escuro). Três grupos de interruptores, "Nome e foto" travado em "Sempre", "Pré-visualizar" e "Salvar".
 *
 * Celular: ligar WhatsApp ou telefone sem o celular confirmado NÃO liga: o interruptor volta a desligado e a tela
 * explica e leva à confirmação (a conferência é feita aqui, pela mesma fonte do `phoneConfirmedGuard`, antes de o
 * gatilho do banco recusar). O banco continua sendo a regra; este erro também é tratado ao salvar.
 */
@Component({
  selector: 'app-visibility',
  imports: [RouterLink, NgIcon, ScreenHeader, SwitchRow, VisibilityPreview, ZardAlertComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './visibility.html',
})
export class VisibilityPage {
  private readonly tags = inject(TagService);
  private readonly pets = inject(PetService);
  private readonly profiles = inject(RescueProfileService);
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly sonner = inject(ZardSonnerService);

  /** Parâmetro de rota `:petId` (ligado por `withComponentInputBinding`). */
  readonly petId = input.required<string>();

  private readonly whatsappRow = viewChild<SwitchRow>('whatsappRow');
  private readonly phoneRow = viewChild<SwitchRow>('phoneRow');
  private readonly previewButton = viewChild('previewButton', { read: ElementRef<HTMLButtonElement> });

  protected readonly state = signal<State>('loading');
  protected readonly dashboardPet = signal<DashboardPet | null>(null);
  protected readonly pet = signal<Pet | null>(null);
  protected readonly profile = signal<RescueProfile | null>(null);
  protected readonly saved = signal<Visibility | null>(null);
  protected readonly draft = signal<Visibility | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly tutorFirstName = signal<string | null>(null);
  /** Celular do tutor no formato de exibição; `null` sem celular. */
  protected readonly phoneDisplay = signal<string | null>(null);
  protected readonly phoneConfirmed = signal(false);

  protected readonly phoneNotice = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly previewing = signal(false);
  private loadId = 0;

  protected readonly name = computed(() => this.pet()?.name ?? '');
  protected readonly backLink = computed(() => `/app/pets/${this.petId()}`);
  protected readonly confirmRoute = computed(() => phoneConfirmationRoute(`/app/pets/${this.petId()}/visibilidade`));
  protected readonly phoneNoticeText = tagErrorMessage('phone_not_confirmed');

  protected readonly temperamentHint = computed(() => {
    const items = this.pet()?.temperament ?? [];
    return items.length === 0 ? $localize`Nada cadastrado ainda` : items.join(', ');
  });
  protected readonly careHint = computed(() => this.pet()?.careNotes?.trim() || $localize`Nada cadastrado ainda`);
  protected readonly phoneHint = computed(() => {
    const display = this.phoneDisplay();
    if (display === null) return $localize`Nenhum celular cadastrado`;
    return this.phoneConfirmed()
      ? $localize`${maskPhone(display)}:phone: · confirmado`
      : $localize`${maskPhone(display)}:phone: · ainda não confirmado`;
  });

  protected readonly preview = computed(() => {
    const pet = this.pet();
    const draft = this.draft();
    const profile = this.profile();
    const dashboard = this.dashboardPet();
    if (pet === null || draft === null || profile === null) return null;
    const lostOn = dashboard?.lostMode === true;
    return buildPreviewProfile({
      name: pet.name,
      photoUrl: this.photoUrl(),
      tagCode: dashboard?.tagCode ?? null,
      temperament: pet.temperament,
      careNotes: pet.careNotes,
      tutorFirstName: this.tutorFirstName(),
      phoneDisplay: this.phoneDisplay(),
      visibility: draft,
      lost: { on: lostOn, since: profile.lostSince ?? dashboard?.lostSince ?? null, message: profile.lostMessage },
    });
  });
  protected readonly previewElapsed = computed(() => {
    const since = this.preview()?.lost?.since;
    return since === undefined ? null : lostElapsed(since, Date.now());
  });

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
    const [dashboard, pet, profile, account] = await Promise.all([
      this.tags.myDashboard(),
      this.pets.get(petId),
      this.profiles.get(petId),
      this.account.ensureLoaded(),
    ]);
    if (id !== this.loadId) return;
    if (!dashboard.ok || (!pet.ok && pet.error !== 'not_found') || (!profile.ok && profile.error !== 'not_found')) {
      this.state.set('error');
      return;
    }
    const dashboardPet = dashboard.dashboard.pets.find((p) => p.id === petId) ?? null;
    if (!pet.ok || !profile.ok || dashboardPet === null) {
      this.state.set('missing');
      return;
    }
    const urls = await this.pets.photoUrls([pet.pet.photoPath]);
    if (id !== this.loadId) return;

    this.dashboardPet.set(dashboardPet);
    this.pet.set(pet.pet);
    this.profile.set(profile.profile);
    this.saved.set(visibilityOf(profile.profile));
    this.draft.set(visibilityOf(profile.profile));
    this.photoUrl.set(pet.pet.photoPath === null ? null : (urls[pet.pet.photoPath] ?? null));
    this.tutorFirstName.set(account?.nome.trim().split(/\s+/)[0] || null);
    this.phoneDisplay.set(account?.celular ? formatBrPhone(account.celular) : null);
    // Sem conta carregada, trata como não confirmado: o aviso leva à confirmação e o banco continua sendo a regra.
    this.phoneConfirmed.set(account?.celular != null && account.celularConfirmadoEm != null);
    this.state.set('ready');
  }

  /** Muda uma escolha. WhatsApp e telefone só ligam com o celular confirmado. */
  protected set(key: keyof Visibility, value: boolean): void {
    this.problem.set(null);
    const isContact = key === 'showWhatsapp' || key === 'showPhone';
    if (value && isContact && !this.phoneConfirmed()) {
      this.refuseContact(key);
      return;
    }
    this.draft.update((d) => (d === null ? d : { ...d, [key]: value }));
  }

  /** Desfaz o toque no interruptor e explica. */
  private refuseContact(key: ContactKey): void {
    (key === 'showWhatsapp' ? this.whatsappRow() : this.phoneRow())?.setChecked(false);
    this.phoneNotice.set(true);
  }

  protected openPreview(): void {
    this.previewing.set(true);
  }

  protected closePreview(): void {
    this.previewing.set(false);
    queueMicrotask(() => this.previewButton()?.nativeElement.focus());
  }

  protected async save(): Promise<void> {
    const saved = this.saved();
    const draft = this.draft();
    if (saved === null || draft === null || this.saving()) return;
    const patch = changedVisibility(saved, draft);
    if (Object.keys(patch).length === 0) {
      void this.router.navigate(['/app/pets', this.petId()]);
      return;
    }
    this.saving.set(true);
    this.problem.set(null);
    const res = await this.profiles.save(this.petId(), patch);
    this.saving.set(false);
    if (!res.ok) {
      if (res.error === 'phone_not_confirmed') {
        // O celular deixou de estar confirmado depois que a tela abriu: volta o contato para desligado.
        this.phoneConfirmed.set(false);
        this.draft.update((d) => (d === null ? d : { ...d, showWhatsapp: saved.showWhatsapp, showPhone: saved.showPhone }));
        this.whatsappRow()?.setChecked(saved.showWhatsapp);
        this.phoneRow()?.setChecked(saved.showPhone);
        this.phoneNotice.set(true);
        return;
      }
      this.problem.set(
        res.error === 'not_found'
          ? $localize`Não encontramos este pet.`
          : $localize`Não conseguimos salvar. Verifique sua conexão e tente de novo.`,
      );
      return;
    }
    this.profile.set(res.profile);
    this.saved.set(visibilityOf(res.profile));
    this.sonner.success($localize`Alterações salvas.`);
    void this.router.navigate(['/app/pets', this.petId()]);
  }
}
