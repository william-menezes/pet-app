import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  model,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

import { ZardInputOtpComponent } from './input-otp.component';

@Component({
  selector: 'z-input-otp-signal, [z-input-otp-signal]',
  template: `
    <div
      [class]="classes()"
      [attr.data-input-otp-container]="''"
      role="group"
      [attr.aria-label]="zAriaLabel() || null"
    >
      @if (!hasSlots()) {
        @for (i of range(); track i) {
          <input
            #otpInput
            type="text"
            [value]="tokens()[i - 1] || ''"
            [attr.maxlength]="1"
            [attr.inputmode]="inputMode()"
            [attr.autocomplete]="autocomplete()"
            [attr.autocapitalize]="autocapitalize()"
            spellcheck="false"
            [attr.aria-label]="ariaLabel(i)"
            [attr.data-active]="allSelected() || focusedIndex() === i - 1 ? '' : null"
            [attr.data-filled]="tokens()[i - 1] ? '' : null"
            [disabled]="disabled()"
            [readonly]="zReadonly()"
            [class]="slotClasses(i - 1)"
            (input)="onInput($event, i - 1)"
            (focus)="onInputFocus($event, i - 1)"
            (blur)="onInputBlur()"
            (paste)="onPaste($event)"
            (keydown)="onKeyDown($event)"
          />
        }
      }
      <ng-content />
    </div>
  `,
  providers: [
    {
      provide: ZardInputOtpComponent,
      useExisting: forwardRef(() => ZardInputOtpSignalComponent),
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[attr.data-disabled]': 'disabled() ? "" : null',
  },
  exportAs: 'zInputOtpSignal',
})
export class ZardInputOtpSignalComponent extends ZardInputOtpComponent implements FormValueControl<string> {
  readonly value = model<string>('');
  override readonly disabled = model<boolean>(false);

  constructor() {
    super();

    effect(() => {
      const next = this.value() ?? '';
      const current = untracked(() => this.tokens().join(''));
      if (current !== next) {
        super.writeValue(next);
      }
    });
  }

  protected override emitValue(newValue: string): void {
    this.value.set(newValue);
  }
}
