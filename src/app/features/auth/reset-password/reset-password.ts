import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { FlowShell } from '@/shared/shells/flow-shell/flow-shell';

import { PasswordService } from '../../../core/auth/password.service';
import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';
import { AuthStatusBadge } from '../shared/status-badge';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

type ResetProblem = 'weak' | 'too_long' | 'network' | null;

/**
 * Nova senha (`/auth/nova-senha`, spec 004 T070). Sem guard. Referências: `V2-nova-senha*.dc.html` e
 * `V2-nova-senha-invalido*.dc.html`.
 *
 * O link do e-mail traz `token_hash` e `type=recovery`. A tela NÃO chama nada ao carregar (scanners de
 * e-mail abrem links): só o botão "Salvar nova senha" consome o link. Sem `token_hash` (ou depois de
 * `invalid_link`) mostra "Este link não vale mais". A senha vive só no campo do formulário.
 */
@Component({
  selector: 'app-reset-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    FlowShell,
    AuthStatusBadge,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly passwords = inject(PasswordService);
  private readonly returnUrlService = inject(ReturnUrlService);

  protected readonly headline = [$localize`De volta em`, $localize`um minuto.`];
  protected readonly sub = $localize`Você cria uma senha nova e continua de onde parou.`;
  protected readonly showPasswordLabel = $localize`Mostrar senha`;
  protected readonly hidePasswordLabel = $localize`Ocultar senha`;

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** `token_hash` só vale com `type=recovery`. */
  private readonly tokenHash = computed<string | null>(() => {
    const q = this.query();
    const token = q.get('token_hash');
    return token !== null && token !== '' && q.get('type') === 'recovery' ? token : null;
  });

  protected readonly password = new FormControl('', { nonNullable: true });
  protected readonly showPassword = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<ResetProblem>(null);
  private readonly linkRejected = signal(false);

  protected readonly invalid = computed(() => this.tokenHash() === null || this.linkRejected());

  protected readonly queryParams = computed(() => {
    const returnUrl = sanitizeReturnUrl(this.query().get('returnUrl'));
    return returnUrl === null ? null : { returnUrl };
  });

  constructor() {
    // Um link novo na mesma tela recomeça do zero.
    effect(() => {
      this.tokenHash();
      untracked(() => {
        this.linkRejected.set(false);
        this.problem.set(null);
      });
    });
  }

  ngOnInit(): void {
    this.returnUrlService.capture(this.query().get('returnUrl'));
  }

  protected onPasswordInput(): void {
    if (this.problem() !== null) this.problem.set(null);
  }

  protected async onSave(): Promise<void> {
    const token = this.tokenHash();
    if (this.saving() || token === null) return;

    const value = this.password.value;
    if (value.length < PASSWORD_MIN) {
      this.problem.set('weak');
      return;
    }
    if (value.length > PASSWORD_MAX) {
      this.problem.set('too_long');
      return;
    }
    this.problem.set(null);

    this.saving.set(true);
    try {
      const result = await this.passwords.resetPassword(token, value);
      if (result.ok) {
        this.password.reset('');
        await this.router.navigate(['/auth/login'], {
          queryParams: { senha: 'alterada' },
          replaceUrl: true,
        });
        return;
      }
      switch (result.reason) {
        case 'invalid_link':
          this.password.reset('');
          this.linkRejected.set(true);
          break;
        case 'weak_password':
          this.problem.set('weak');
          break;
        case 'network':
          this.problem.set('network');
          break;
      }
    } finally {
      this.saving.set(false);
    }
  }
}
