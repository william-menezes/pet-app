import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCheckboxComponent } from '@/shared/components/checkbox';
import { Note } from '@/shared/components/faro/note/note';
import { PetAvatar } from '@/shared/components/faro/pet-avatar/pet-avatar';
import { ZardInputOtpComponent } from '@/shared/components/input-otp';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { tagErrorMessage, type TagError } from '../../../core/tags/tag-errors';
import { isPinShape } from '../../../core/tags/tag.service';
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
 * Nunca vai para signal, storage, URL ou log. A opção de WhatsApp vem MARCADA (exceção registrada no Princípio II
 * da constituição, decisão do William em 2026-11-21), com o aviso logo abaixo, e é sempre enviada de forma
 * explícita.
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
export class PinStep {
  readonly pet = input.required<PetOption>();
  /** Código na forma de exibição, `XXXX-XXXX-X`. */
  readonly code = input.required<string>();
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

  constructor() {
    this.pin.valueChanges.subscribe((value) => this.pinLength.set(value.length));

    // Dá a cada célula um data-testid (activation-pin-cell-1 a -6) para os testes.
    effect(() => {
      const inputs = this.otp()?.inputs() ?? [];
      inputs.forEach((ref, index) =>
        ref.nativeElement.setAttribute('data-testid', `activation-pin-cell-${index + 1}`),
      );
    });
  }

  protected readonly canSubmit = computed(() => this.pinLength() === 6 && !this.submitting());
  protected readonly pinInvalid = computed(() => this.problem()?.error === 'wrong_pin');
  protected readonly message = computed(() => {
    const problem = this.problem();
    return problem === null ? null : tagErrorMessage(problem.error, problem.retryAfterSeconds);
  });

  protected onSubmit(): void {
    const raw = this.pin.value;
    if (!this.canSubmit() || !isPinShape(raw)) return;
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
