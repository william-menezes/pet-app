import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  type OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCheckboxComponent } from '@/shared/components/checkbox';
import { Note } from '@/shared/components/faro/note/note';
import { PetAvatar } from '@/shared/components/faro/pet-avatar/pet-avatar';
import { ZardInputOtpComponent } from '@/shared/components/input-otp';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { tagErrorMessage, type TagError } from '../../../core/tags/tag-errors';
import type { PetOption } from '../pet-option';

export interface PinProblem {
  error: TagError;
  retryAfterSeconds?: number;
}

export interface PinSubmission {
  pin: string;
  enableWhatsapp: boolean;
}

/**
 * Passo 2 da ativação: o PIN do cartão (T046; referência `V2-ativacao-pin*.dc.html`).
 *
 * O PIN vive só no `FormControl`: ao enviar, a tela entrega o valor a quem chamou e apaga as células na hora.
 * Nunca vai para signal, storage, URL ou log. Na ativação pela tag (`activate`) a opção de WhatsApp vem MARCADA
 * (exceção registrada no Princípio II da constituição, decisão do William em 2026-11-21), com o aviso logo abaixo.
 * Ao vincular pelo app (`link`) ela começa DESLIGADA ("em qualquer outro lugar, começa desligada"). Nos dois casos é
 * enviada de forma explícita.
 */
@Component({
  selector: 'app-activation-pin-step',
  imports: [
    ReactiveFormsModule,
    FlowShell,
    Note,
    PetAvatar,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardCheckboxComponent,
    ZardInputOtpComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pin-step.html',
})
export class PinStep implements OnInit {
  readonly pet = input.required<PetOption>();
  /** Código na forma de exibição, `XXXX-XXXX-X`. */
  readonly code = input.required<string>();
  /**
   * `activate` (`/ativar/:code`, a tag foi lida do QR) ou `link` (`/vincular/:petId`, o tutor escolheu a tag pelo app: T073,
   * referência `V2-vincular-pin*.dc.html`). Mudam só a barra, o título, o apoio e a linha do resumo; o PIN, o WhatsApp
   * e os erros são os mesmos. O WhatsApp começa marcado só em `activate`.
   */
  readonly variant = input<'activate' | 'link'>('activate');
  readonly submitting = input(false);
  readonly problem = input<PinProblem | null>(null);

  readonly submitted = output<PinSubmission>();
  readonly changePet = output<void>();

  protected readonly pin = new FormControl('', { nonNullable: true });
  protected readonly whatsapp = new FormControl(true, { nonNullable: true });
  protected readonly headline = [$localize`O PIN prova`, $localize`que a tag`, $localize`é sua.`];
  protected readonly sub = $localize`Ele vem no cartão dentro da embalagem e nunca na etiqueta.`;
  private readonly pinLength = signal(0);
  private readonly otp = viewChild(ZardInputOtpComponent);
  private readonly injector = inject(Injector);

  ngOnInit(): void {
    // Princípio II: marcado só na ativação pela tag; em qualquer outro lugar começa desligado.
    this.whatsapp.setValue(this.variant() === 'activate');
  }

  constructor() {
    this.pin.valueChanges.subscribe((value) => this.pinLength.set(value.length));

    // Depois de um PIN errado o foco volta para a primeira célula (as células foram apagadas).
    effect(() => {
      if (this.problem()?.error !== 'wrong_pin') return;
      afterNextRender(() => this.otp()?.inputs()[0]?.nativeElement.focus(), { injector: this.injector });
    });

    // Dá a cada célula um data-testid (activation-pin-cell-1 a -6) para os testes.
    effect(() => {
      const inputs = this.otp()?.inputs() ?? [];
      inputs.forEach((ref, index) =>
        ref.nativeElement.setAttribute('data-testid', `activation-pin-cell-${index + 1}`),
      );
    });
  }

  protected readonly barTitle = computed(() => (this.variant() === 'link' ? $localize`Vincular tag` : $localize`Ativar tag`));
  protected readonly title = computed(() => (this.variant() === 'link' ? $localize`Digite o PIN do cartão` : $localize`Agora, o PIN do cartão`));
  protected readonly intro = computed(() =>
    this.variant() === 'link'
      ? $localize`São 6 caracteres e vêm no cartão dentro da embalagem. O PIN vale uma vez só.`
      : $localize`São 6 caracteres impressos no cartão que veio com a tag. O PIN vale uma vez só.`,
  );
  protected readonly summaryLine = computed(() =>
    this.variant() === 'link' ? $localize`Tag ${this.code()}:code:` : $localize`Tag ${this.code()}:code: · lida pelo QR`,
  );

  protected readonly canSubmit = computed(() => this.pinLength() === 6 && !this.submitting());
  protected readonly pinInvalid = computed(() => this.problem()?.error === 'wrong_pin');
  protected readonly message = computed(() => {
    const problem = this.problem();
    return problem === null ? null : tagErrorMessage(problem.error, problem.retryAfterSeconds);
  });

  protected onSubmit(): void {
    const raw = this.pin.value;
    if (!this.canSubmit()) return; // PIN fora do alfabeto: o TagService devolve wrong_pin sem chamar a RPC
    const enableWhatsapp = this.whatsapp.value;
    this.clearPin();
    this.submitted.emit({ pin: raw, enableWhatsapp });
  }

  /** Apaga as células (PIN usado, errado ou tela fechada). */
  clearPin(): void {
    this.pin.setValue('');
    this.pinLength.set(0);
  }
}
