import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  untracked,
  PLATFORM_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { PetAvatar } from '@/shared/components/faro/pet-avatar/pet-avatar';
import { ZardSonnerService } from '@/shared/components/sonner';
import { ZardFieldComponent, ZardFieldErrorComponent, ZardFieldLabelComponent } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardTextareaComponent } from '@/shared/components/textarea';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { sanitizeReturnUrl } from '../../../core/auth/return-url';
import {
  PET_BREED_MAX,
  PET_CARE_MAX,
  PET_NAME_MAX,
  PET_TEMPERAMENT_ITEM_MAX,
  PET_TEMPERAMENT_MAX_ITEMS,
  PetService,
  type PetError,
} from '../../../core/pets/pet.service';
import { withPetParam } from '../../../core/tags/activation-links';
import { TagService } from '../../../core/tags/tag.service';
import type { Pet, PetSex, PetSize, PetSpecies } from '../../../models';
import { RemovePet } from '../remove-pet/remove-pet';

type Step = 1 | 2;
type Problem = 'create_failed' | 'photo_failed' | PetError;
type LoadState = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

/** Foto escolhida antes do redimensionamento: acima disto nem tentamos (o navegador travaria). */
const PHOTO_PICK_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Novo pet, em dois passos (`/novo-pet`, T044 e T045; referência `V2-novo-pet-dados*` e `V2-novo-pet-resgate*`).
 *
 * O pet só é gravado no fim ("Salvar pet" ou "Pular por enquanto"); voltar ao passo 1 não perde o que foi
 * digitado. `?returnUrl=` (caminho interno) diz para onde voltar: a ativação recebe o pet criado em
 * `?pet=<id>`; sem destino, o painel. A foto só sobe depois que o pet existe (o caminho do arquivo leva o id).
 *
 * Editar (`/app/pets/:petId/editar`, T071): os MESMOS dois passos, com os dados do pet já preenchidos. Salvar grava as
 * alterações (e a foto nova, se houve) e volta para a página do pet; "Remover pet" fica no passo 1.
 */
@Component({
  selector: 'app-new-pet',
  imports: [
    NgIcon,
    FlowShell,
    PetAvatar,
    RemovePet,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldComponent,
    ZardFieldErrorComponent,
    ZardFieldLabelComponent,
    ZardInputComponent,
    ZardTextareaComponent,
    ZardToggleGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-pet.html',
})
export class NewPet {
  private readonly router = inject(Router);
  private readonly petService = inject(PetService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly tags = inject(TagService);
  private readonly sonner = inject(ZardSonnerService);

  /** `:petId` da rota de edição (ligado por `withComponentInputBinding`); ausente em `/novo-pet`. */
  readonly petId = input<string | undefined>(undefined);
  /** `?returnUrl=` (ligado por `withComponentInputBinding`). */
  readonly returnUrl = input<string | undefined>(undefined);

  protected readonly nameMax = PET_NAME_MAX;
  protected readonly breedMax = PET_BREED_MAX;
  protected readonly careMax = PET_CARE_MAX;
  protected readonly customMax = PET_TEMPERAMENT_ITEM_MAX;
  protected readonly maxTemperament = PET_TEMPERAMENT_MAX_ITEMS;
  protected readonly step1Headline = [$localize`Quem é`, $localize`o seu pet?`];
  protected readonly step1Sub = $localize`O básico para quem achar saber com quem está falando.`;
  protected readonly step2Headline = [$localize`O que ajuda`, $localize`num resgate.`];
  protected readonly step2Sub = $localize`Uma foto clara e duas linhas sobre o jeito do seu pet fazem diferença para quem achou.`;

  protected readonly step = signal<Step>(1);
  protected readonly editing = computed(() => this.petId() !== undefined);
  protected readonly loadState = signal<LoadState>('idle');
  /** Foto que o pet já tem (URL assinada) e o caminho dela, para apagar a antiga ao trocar. */
  protected readonly existingPhotoUrl = signal<string | null>(null);
  private existingPhotoPath: string | null = null;
  /** Tag ativa do pet (`XXXX-XXXX-X`), para a confirmação de remover. */
  protected readonly activeTagCode = signal<string | null>(null);
  protected readonly barTitle = computed(() => (this.editing() ? $localize`Editar pet` : $localize`Novo pet`));
  protected readonly avatarUrl = computed(() => this.photoPreview() ?? this.existingPhotoUrl());

  // Passo 1
  protected readonly species = signal<PetSpecies | null>(null);
  protected readonly name = signal('');
  protected readonly breed = signal('');
  protected readonly sex = signal<PetSex | null>(null);
  protected readonly size = signal<PetSize | null>(null);
  protected readonly triedStep1 = signal(false);

  // Passo 2
  protected readonly photoFile = signal<File | null>(null);
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly photoNotice = signal<string | null>(null);
  protected readonly temperament = signal<string[]>([]);
  protected readonly customOptions = signal<string[]>([]);
  protected readonly addingCustom = signal(false);
  protected readonly customDraft = signal('');
  protected readonly careNotes = signal('');

  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  private readonly createdPetId = signal<string | null>(null);

  protected readonly speciesItems: ZardToggleGroupItem[] = [
    { value: 'dog', label: $localize`Cão` },
    { value: 'cat', label: $localize`Gato` },
  ];
  protected readonly sexItems: ZardToggleGroupItem[] = [
    { value: 'male', label: $localize`Macho` },
    { value: 'female', label: $localize`Fêmea` },
  ];
  protected readonly sizeItems: ZardToggleGroupItem[] = [
    { value: 'small', label: $localize`Pequeno` },
    { value: 'medium', label: $localize`Médio` },
    { value: 'large', label: $localize`Grande` },
  ];
  private readonly presetTemperament = [
    $localize`Dócil com pessoas`,
    $localize`Medo de barulho`,
    $localize`Não gosta de gatos`,
    $localize`Foge fácil`,
  ];

  protected readonly temperamentItems = computed<ZardToggleGroupItem[]>(() => {
    const selected = this.temperament();
    const full = selected.length >= PET_TEMPERAMENT_MAX_ITEMS;
    return [...this.presetTemperament, ...this.customOptions()].map((label) => ({
      value: label,
      label,
      disabled: full && !selected.includes(label),
    }));
  });

  protected readonly nameError = computed(() => {
    if (!this.triedStep1()) return null;
    const n = this.name().trim();
    if (n.length === 0) return $localize`Diga o nome do seu pet.`;
    if (n.length > PET_NAME_MAX) return $localize`O nome pode ter até ${PET_NAME_MAX}:max: letras.`;
    return null;
  });
  protected readonly speciesError = computed(() =>
    this.triedStep1() && this.species() === null ? $localize`Escolha cão ou gato.` : null,
  );
  protected readonly breedError = computed(() =>
    this.breed().trim().length > PET_BREED_MAX ? $localize`A raça pode ter até ${PET_BREED_MAX}:max: letras.` : null,
  );
  protected readonly careError = computed(() =>
    this.careNotes().length > PET_CARE_MAX ? $localize`Os cuidados podem ter até ${PET_CARE_MAX}:max: letras.` : null,
  );

  /** Destino do "fechar" do passo 1: de onde o tutor veio, ou o painel. */
  protected readonly closeLink = computed(() =>
    this.editing() ? `/app/pets/${this.petId()}` : (sanitizeReturnUrl(this.returnUrl()) ?? '/app'),
  );

  protected readonly problemMessage = computed(() => {
    switch (this.problem()) {
      case null:
        return null;
      case 'photo_failed':
        return $localize`O pet foi salvo, mas a foto não foi enviada. Tente de novo ou continue sem ela.`;
      case 'invalid':
        return $localize`Confira os dados do pet e tente de novo.`;
      default:
        return $localize`Não conseguimos salvar agora. Verifique sua conexão e tente de novo.`;
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreview());
    // Edição: carrega o pet e preenche os campos.
    effect(() => {
      const id = this.petId();
      if (id === undefined) return;
      untracked(() => void this.loadExisting(id));
    });
    // Trocar de passo recria a casca e o foco cairia no body: leva o foco ao título do passo novo.
    let first = true;
    effect(() => {
      this.step();
      if (first) {
        first = false;
        return;
      }
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('h1')?.focus(), { injector: this.injector });
    });
  }

  /** Edição: lê o pet, a foto e a tag e preenche os campos. */
  protected async loadExisting(id: string): Promise<void> {
    this.loadState.set('loading');
    const [pet, dashboard] = await Promise.all([this.petService.get(id), this.tags.myDashboard()]);
    if (!pet.ok) {
      this.loadState.set(pet.error === 'not_found' ? 'missing' : 'error');
      return;
    }
    this.fill(pet.pet);
    this.existingPhotoPath = pet.pet.photoPath;
    if (dashboard.ok) this.activeTagCode.set(dashboard.dashboard.pets.find((p) => p.id === id)?.tagCode ?? null);
    const urls = await this.petService.photoUrls([pet.pet.photoPath]);
    this.existingPhotoUrl.set(pet.pet.photoPath === null ? null : (urls[pet.pet.photoPath] ?? null));
    this.loadState.set('ready');
  }

  private fill(pet: Pet): void {
    this.species.set(pet.species);
    this.name.set(pet.name);
    this.breed.set(pet.breed ?? '');
    this.sex.set(pet.sex);
    this.size.set(pet.size);
    this.careNotes.set(pet.careNotes ?? '');
    this.temperament.set([...pet.temperament]);
    // Jeitos que o tutor escreveu à mão ficam como opções, para poderem ser desmarcados.
    this.customOptions.set(pet.temperament.filter((t) => !this.presetTemperament.includes(t)));
  }

  /** Remover pet concluído (e o PIN novo, se houve, já foi visto): volta para a lista. */
  protected onRemoved(): void {
    void this.router.navigateByUrl('/app/pets');
  }

  // ── Passo 1 ──────────────────────────────────────────────────────────────

  protected onText(target: 'name' | 'breed' | 'care' | 'custom', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    switch (target) {
      case 'name':
        return this.name.set(value);
      case 'breed':
        return this.breed.set(value);
      case 'care':
        return this.careNotes.set(value);
      case 'custom':
        return this.customDraft.set(value);
    }
  }

  protected onSpecies(value: string | string[]): void {
    this.species.set(value === 'dog' || value === 'cat' ? value : null);
  }
  protected onSex(value: string | string[]): void {
    this.sex.set(value === 'male' || value === 'female' ? value : null);
  }
  protected onSize(value: string | string[]): void {
    this.size.set(value === 'small' || value === 'medium' || value === 'large' ? value : null);
  }

  protected onContinue(): void {
    this.triedStep1.set(true);
    if (this.nameError() !== null || this.speciesError() !== null || this.breedError() !== null) return;
    this.problem.set(null);
    this.step.set(2);
  }

  protected onBack(): void {
    this.problem.set(null);
    this.step.set(1);
  }

  // ── Passo 2 ──────────────────────────────────────────────────────────────

  protected onPhotoPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (file === null) return;
    if (!file.type.startsWith('image/')) {
      this.photoNotice.set($localize`Escolha uma imagem (JPG, PNG ou WebP).`);
      return;
    }
    if (file.size > PHOTO_PICK_MAX_BYTES) {
      this.photoNotice.set($localize`Essa foto é grande demais. Escolha outra.`);
      return;
    }
    this.photoNotice.set(null);
    this.revokePreview();
    this.photoFile.set(file);
    if (this.isBrowser) this.photoPreview.set(URL.createObjectURL(file));
  }

  protected onTemperament(value: string | string[]): void {
    this.temperament.set(Array.isArray(value) ? value : value === '' ? [] : [value]);
  }

  protected startCustom(): void {
    this.addingCustom.set(true);
  }

  protected addCustom(): void {
    const label = this.customDraft().trim();
    if (label.length === 0 || label.length > PET_TEMPERAMENT_ITEM_MAX) return;
    const known = [...this.presetTemperament, ...this.customOptions()];
    if (!known.includes(label)) this.customOptions.update((list) => [...list, label]);
    if (!this.temperament().includes(label) && this.temperament().length < PET_TEMPERAMENT_MAX_ITEMS) {
      this.temperament.update((list) => [...list, label]);
    }
    this.customDraft.set('');
    this.addingCustom.set(false);
  }

  /** "Salvar pet": grava tudo o que foi preenchido. */
  protected async onSave(): Promise<void> {
    if (this.careError() !== null) return;
    await this.persist(true);
  }

  /** "Pular por enquanto": grava só o passo 1 (foto, jeito e cuidados ficam para depois). */
  protected async onSkip(): Promise<void> {
    await this.persist(false);
  }

  /** Depois de um pet salvo com foto que falhou: tenta só a foto de novo. */
  protected async onRetry(): Promise<void> {
    await this.persist(true);
  }

  /** Depois de um pet salvo com foto que falhou: segue sem a foto. */
  protected onContinueWithoutPhoto(): void {
    if (this.editing()) {
      void this.router.navigateByUrl(`/app/pets/${this.petId()}`);
      return;
    }
    const id = this.createdPetId();
    if (id !== null) this.finish(id);
  }

  private async persist(withExtras: boolean): Promise<void> {
    const species = this.species();
    if (this.saving() || species === null) return;
    this.saving.set(true);
    this.problem.set(null);

    const editId = this.petId();
    if (editId !== undefined) {
      await this.persistEdit(editId, species);
      return;
    }

    let petId = this.createdPetId();
    if (petId === null) {
      const created = await this.petService.create({
        name: this.name(),
        species,
        breed: this.breed(),
        sex: this.sex(),
        size: this.size(),
        ...(withExtras ? { temperament: this.temperament(), careNotes: this.careNotes() } : {}),
      });
      if (!created.ok) {
        this.saving.set(false);
        this.problem.set(created.error === 'invalid' ? 'invalid' : 'create_failed');
        return;
      }
      petId = created.petId;
      this.createdPetId.set(petId);
    }

    const photo = withExtras ? this.photoFile() : null;
    if (photo !== null) {
      const up = await this.petService.uploadPhoto(petId, photo);
      if (!up.ok) {
        this.saving.set(false);
        this.problem.set('photo_failed');
        return;
      }
    }
    this.saving.set(false);
    this.finish(petId);
  }

  /** Edição: grava os campos e, se escolheu foto nova, envia a foto (apagando a antiga). */
  private async persistEdit(petId: string, species: PetSpecies): Promise<void> {
    const updated = await this.petService.update(petId, {
      name: this.name(),
      species,
      breed: this.breed(),
      sex: this.sex(),
      size: this.size(),
      temperament: this.temperament(),
      careNotes: this.careNotes(),
    });
    if (!updated.ok) {
      this.saving.set(false);
      this.problem.set(updated.error === 'invalid' ? 'invalid' : 'create_failed');
      return;
    }
    const photo = this.photoFile();
    if (photo !== null) {
      const up = await this.petService.uploadPhoto(petId, photo, this.existingPhotoPath);
      if (!up.ok) {
        this.saving.set(false);
        this.problem.set('photo_failed');
        return;
      }
      this.photoFile.set(null);
    }
    this.saving.set(false);
    this.sonner.success($localize`Alterações salvas.`);
    void this.router.navigateByUrl(`/app/pets/${petId}`);
  }

  /** Volta para onde veio: a ativação recebe `?pet=<id>`; sem destino, o painel. */
  private finish(petId: string): void {
    const back = sanitizeReturnUrl(this.returnUrl());
    const target = back === null ? null : withPetParam(back, petId);
    void this.router.navigateByUrl(target ?? '/app');
  }

  private revokePreview(): void {
    const url = this.photoPreview();
    if (url !== null && this.isBrowser) URL.revokeObjectURL(url);
    this.photoPreview.set(null);
  }
}
