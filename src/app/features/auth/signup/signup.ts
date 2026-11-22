import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCheckboxComponent } from '@/shared/components/checkbox';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { maskBrPhoneInput, normalizeBrPhone } from '../../../core/account/phone';
import { RegistrationService, type SignUpResult } from '../../../core/auth/registration.service';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';

type SignupFailure = Extract<SignUpResult, { ok: false }>['reason'];

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimmedLength(min: number, max: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const length = control.value.trim().length;
    if (length === 0) return { required: true };
    return length < min || length > max ? { length: true } : null;
  };
}

function brMobile(control: AbstractControl<string>): ValidationErrors | null {
  if (control.value.trim() === '') return { required: true };
  return normalizeBrPhone(control.value) === null ? { phone: true } : null;
}

/**
 * Criar conta (`/auth/criar-conta`, spec 004 T034). Referência: `design/telas-v2/V2-criar-conta*.dc.html`.
 * O botão do Google entra na T061. A senha nunca sai do formulário; o e-mail segue para a tela de
 * confirmação pelo estado do roteador, não pela URL.
 */
@Component({
  selector: 'app-signup',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    FlowShell,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardCheckboxComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signup.html',
})
export class Signup implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly registration = inject(RegistrationService);
  private readonly returnUrlService = inject(ReturnUrlService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly headline = [$localize`Só o`, $localize`necessário.`];
  protected readonly sub = $localize`Nome, e-mail e celular. Nada de CPF ou endereço para ativar a sua tag.`;
  protected readonly showPasswordLabel = $localize`Mostrar senha`;
  protected readonly hidePasswordLabel = $localize`Ocultar senha`;

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [trimmedLength(2, 80)] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(EMAIL_FORMAT)],
    }),
    celular: new FormControl('', { nonNullable: true, validators: [brMobile] }),
    senha: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
    }),
    aceite: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  protected readonly isLoading = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly failure = signal<SignupFailure | null>(null);

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly queryParams = computed(() => {
    const returnUrl = sanitizeReturnUrl(this.query().get('returnUrl'));
    return returnUrl === null ? null : { returnUrl };
  });

  protected readonly failureMessage = computed<string | null>(() => {
    switch (this.failure()) {
      case 'weak_password':
        return $localize`Use uma senha com pelo menos 8 caracteres.`;
      case 'rate_limited':
        return $localize`Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar de novo.`;
      case 'network':
        return $localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`;
      case 'invalid':
        return $localize`Confira os campos destacados e tente de novo.`;
      default:
        return null;
    }
  });

  ngOnInit(): void {
    this.returnUrlService.capture(this.query().get('returnUrl'));
  }

  /** Mensagem do campo, só depois de tocado (ou de uma tentativa de envio). */
  protected fieldError(name: 'nome' | 'email' | 'celular' | 'senha' | 'aceite'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) return null;
    switch (name) {
      case 'nome':
        return control.hasError('required')
          ? $localize`Informe seu nome.`
          : $localize`Use entre 2 e 80 caracteres.`;
      case 'email':
        return control.hasError('required')
          ? $localize`Informe seu e-mail.`
          : $localize`Informe um e-mail válido.`;
      case 'celular':
        return control.hasError('required')
          ? $localize`Informe seu celular.`
          : $localize`Informe um celular com DDD e o 9 na frente, por exemplo (11) 98765-4421.`;
      case 'senha':
        return control.hasError('maxlength')
          ? $localize`Use no máximo 72 caracteres.`
          : $localize`Use uma senha com pelo menos 8 caracteres.`;
      case 'aceite':
        return $localize`Para criar a conta, aceite os Termos e a Política de privacidade.`;
    }
  }

  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const masked = maskBrPhoneInput(input.value);
    if (masked !== input.value) input.value = masked;
    this.form.controls.celular.setValue(masked);
  }

  protected async onSubmit(): Promise<void> {
    if (this.isLoading()) return;
    this.failure.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      setTimeout(() =>
        this.host.nativeElement.querySelector<HTMLElement>('input[aria-invalid="true"]')?.focus(),
      );
      return;
    }

    const { nome, email, celular, senha, aceite } = this.form.getRawValue();
    this.isLoading.set(true);
    try {
      const result = await this.registration.signUp({ nome, email, celular, senha, aceite });
      if (result.ok) {
        // O e-mail vai pelo estado do roteador (nunca pela URL).
        await this.router.navigate(['/auth/confirmar-email'], { state: { email: email.trim() } });
        return;
      }
      this.failure.set(result.reason);
    } finally {
      this.isLoading.set(false);
    }
  }
}
