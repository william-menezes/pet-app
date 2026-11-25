import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { PetAvatar } from '@/shared/components/faro/pet-avatar/pet-avatar';
import { ZardFieldComponent, ZardFieldLabelComponent } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { PetService } from '../../../core/pets/pet.service';
import { format, isValid, normalize } from '../../../core/tag-code';
import { codeFromQr } from '../../../core/tag-code/qr-payload';
import { phoneConfirmationRoute } from '../../../core/tags/activation-links';
import { tagErrorMessage } from '../../../core/tags/tag-errors';
import { TagService, type ActivationResult } from '../../../core/tags/tag.service';
import { DoneStep } from '../../activation/done-step/done-step';
import type { PetOption } from '../../activation/pet-option';
import { speciesLabel } from '../../activation/pet-option';
import { PinStep, type PinProblem, type PinSubmission } from '../../activation/pin-step/pin-step';
import { QrScanner, type CameraFailure } from './qr-scanner';

type View = 'loading' | 'error' | 'missing' | 'taken' | 'code' | 'pin' | 'done';
type Tab = 'scan' | 'type';
type CheckState = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'problem'; message: string };

/**
 * Vincular tag pelo app (`/vincular/:petId`, T072 e T073; referência `V2-vincular-codigo*` e `V2-vincular-pin*`):
 * passo 1, o código (escanear o QR ou digitar) e o pet; passo 2, o PIN do cartão, com o MESMO componente de PIN da
 * ativação; e "Tag ativa!". Casca de fluxo, sempre clara. Os passos são estado da tela, não endereços.
 *
 * O código, venha da câmera ou do teclado, passa por `core/tag-code` (normaliza e confere o dígito) ANTES de qualquer
 * chamada, e o QR só vale se for `HTTPS://TAGFARO.COM.BR/<CODIGO>`. O PIN nunca fica aqui: o passo do PIN entrega o
 * texto uma vez, direto para a chamada.
 */
@Component({
  selector: 'app-link-tag',
  imports: [
    RouterLink,
    NgIcon,
    FlowShell,
    PetAvatar,
    PinStep,
    DoneStep,
    QrScanner,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldComponent,
    ZardFieldLabelComponent,
    ZardInputComponent,
    ZardToggleGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-tag.html',
})
export class LinkTag {
  private readonly tags = inject(TagService);
  private readonly petService = inject(PetService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Parâmetro de rota `:petId` (ligado por `withComponentInputBinding`). */
  readonly petId = input.required<string>();

  protected readonly view = signal<View>('loading');
  protected readonly pets = signal<PetOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly tab = signal<Tab>('type');
  protected readonly typed = signal('');
  protected readonly check = signal<CheckState>({ kind: 'idle' });
  protected readonly notice = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly problem = signal<PinProblem | null>(null);
  protected readonly result = signal<ActivationResult | null>(null);
  /** Pet que já tem tag quando a tela abre. */
  protected readonly takenCode = signal<string | null>(null);
  private checkId = 0;

  protected readonly tabItems: ZardToggleGroupItem[] = [
    { value: 'scan', label: $localize`Escanear QR` },
    { value: 'type', label: $localize`Digitar código` },
  ];
  protected readonly headline = [$localize`Uma tag,`, $localize`um pet.`];
  protected readonly sub = $localize`Escaneie o QR ou digite o código impresso embaixo dele.`;
  protected readonly validText = $localize`Código válido · tag disponível`;

  protected readonly normalized = computed(() => normalize(this.typed()));
  /** Código na forma de exibição, só quando válido. */
  protected readonly display = computed(() => (isValid(this.normalized()) ? format(this.normalized()) : ''));
  protected readonly available = computed(() => this.pets().filter((p) => !p.hasTag));
  protected readonly chosen = computed(() => this.pets().find((p) => p.id === this.selectedId()) ?? null);
  protected readonly closeLink = computed(() => `/app/pets/${this.petId()}`);
  protected readonly canContinue = computed(() => this.check().kind === 'ok' && this.chosen() !== null);

  constructor() {
    // Trocar de passo recria a casca inteira e o foco cairia no body: leva o foco ao título do passo novo.
    let first = true;
    effect(() => {
      this.view();
      if (first) {
        first = false;
        return;
      }
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('h1')?.focus(), { injector: this.injector });
    });

    effect(() => {
      this.petId();
      untracked(() => void this.load());
    });

    // Confere o código assim que ele tem o tamanho de um código.
    effect(() => {
      const code = this.normalized();
      untracked(() => void this.runCheck(code));
    });
  }

  protected async load(): Promise<void> {
    this.view.set('loading');
    const res = await this.tags.myDashboard();
    if (!res.ok) {
      this.view.set('error');
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
    const mine = this.pets().find((p) => p.id === this.petId());
    if (mine === undefined) {
      this.view.set('missing');
      return;
    }
    if (mine.hasTag) {
      this.takenCode.set(mine.tagCode);
      this.view.set('taken');
      return;
    }
    this.selectedId.set(mine.id);
    this.view.set('code');
  }

  // ── Passo 1: o código ────────────────────────────────────────────────────

  protected petSub(pet: PetOption): string {
    return `${speciesLabel(pet.species)} · ${$localize`sem tag`}`;
  }

  protected onTab(value: string | string[]): void {
    this.notice.set(null);
    this.tab.set(value === 'scan' ? 'scan' : 'type');
  }

  protected onType(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const normalized = normalize(value);
    // Com o código completo e certo, mostra na forma de exibição (XXXX-XXXX-X).
    this.typed.set(normalized.length === 9 && isValid(normalized) ? format(normalized) : value);
    this.notice.set(null);
  }

  protected onScanned(text: string): void {
    const code = codeFromQr(text);
    if (code === null) {
      this.notice.set($localize`Esse QR não é de uma tag do Faro. Aponte para o QR que fica na tag.`);
      return;
    }
    this.typed.set(format(code));
    this.notice.set(null);
    this.tab.set('type');
  }

  protected onCameraFailed(reason: CameraFailure): void {
    this.notice.set(
      reason === 'denied'
        ? $localize`A câmera não foi liberada. Digite o código que fica embaixo do QR.`
        : $localize`Não conseguimos usar a câmera. Digite o código que fica embaixo do QR.`,
    );
    this.tab.set('type');
  }

  private async runCheck(code: string): Promise<void> {
    const id = ++this.checkId;
    if (code.length < 9) {
      this.check.set({ kind: 'idle' });
      return;
    }
    if (!isValid(code)) {
      this.check.set({ kind: 'problem', message: tagErrorMessage('invalid_code') });
      return;
    }
    this.check.set({ kind: 'checking' });
    const res = await this.tags.checkForLink(code);
    if (id !== this.checkId) return;
    this.check.set(res.ok ? { kind: 'ok' } : { kind: 'problem', message: tagErrorMessage(res.error, res.retryAfterSeconds) });
  }

  protected onPet(id: string): void {
    this.selectedId.set(id);
  }

  protected onContinue(): void {
    if (!this.canContinue()) return;
    this.problem.set(null);
    this.view.set('pin');
  }

  // ── Passo 2: o PIN ───────────────────────────────────────────────────────

  protected onChangeCode(): void {
    this.problem.set(null);
    this.view.set('code');
  }

  /** O texto do PIN existe só nesta chamada (variável local); depois dela não resta cópia. */
  protected async onSubmit(submission: PinSubmission): Promise<void> {
    const pet = this.chosen();
    const code = this.display();
    if (pet === null || code === '' || this.submitting()) return;
    this.submitting.set(true);
    this.problem.set(null);
    const res = await this.tags.activate({
      code,
      pin: submission.pin,
      petId: pet.id,
      replace: false,
      enableWhatsapp: submission.enableWhatsapp,
    });
    this.submitting.set(false);

    if (res.ok) {
      this.result.set(res);
      this.view.set('done');
      return;
    }
    if (res.error === 'phone_not_confirmed') {
      const route = phoneConfirmationRoute(`/vincular/${this.petId()}`);
      void this.router.navigate(route.commands, { queryParams: route.queryParams });
      return;
    }
    this.problem.set({ error: res.error, ...(res.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: res.retryAfterSeconds }) });
  }
}
