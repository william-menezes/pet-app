import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardAlertDialogImports } from '@/shared/components/alert-dialog';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';

import { DELETE_CONFIRMATION, PrivacyService, type DeleteError } from '../../../core/account/privacy.service';
import { AccountStore } from '../../../core/account/account.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { formatWait } from '../../auth/shared/wait-time';
import { ACCOUNT_ICONS } from '../shared/account-icons';

/** Destino guardado para a pessoa voltar a esta tela depois de entrar de novo com o Google. */
const PRIVACY_URL = '/app/conta/privacidade';

type DeleteProblem = DeleteError;

/**
 * Diálogo "Excluir sua conta?" (spec 004 T081). Referência: `V2-conta-excluir*.dc.html`.
 *
 * Diálogo de decisão (`z-alert-dialog`), só dentro do app: sai escuro quando o app está no tema escuro
 * (a casca do tutor replica a classe `dark` no contêiner de overlays). O botão destrutivo só habilita
 * com a palavra EXCLUIR e, em conta com senha, a senha atual. A senha vive só no campo: é limpa ao
 * fechar e depois de qualquer resposta. Sucesso: `/auth?conta=excluida`.
 */
@Component({
  selector: 'app-delete-account-dialog',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    ZardAlertComponent,
    ZardAlertDialogImports,
    ZardButtonComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-account-dialog.html',
})
export class DeleteAccountDialog {
  private readonly privacy = inject(PrivacyService);
  private readonly accountStore = inject(AccountStore);
  private readonly authService = inject(AuthService);
  private readonly returnUrl = inject(ReturnUrlService);
  private readonly router = inject(Router);

  /** Aberto/fechado, em duas vias com a tela. */
  readonly visible = model(false);

  protected readonly confirmText = new FormControl('', { nonNullable: true });
  protected readonly password = new FormControl('', { nonNullable: true });
  protected readonly showPassword = signal(false);
  protected readonly deleting = signal(false);
  protected readonly problem = signal<DeleteProblem | null>(null);
  private readonly retryAfter = signal<number | undefined>(undefined);
  /** Método que o servidor pediu na última resposta `reauth_required`. */
  protected readonly reauthMethod = signal<'password' | 'google' | null>(null);

  protected readonly hasPassword = this.accountStore.hasPassword;
  protected readonly isGoogleOnly = this.accountStore.isGoogleOnly;

  /** Valores dos campos como signals, para o botão reagir ao que se digita. */
  private readonly typedConfirm = signal('');
  private readonly typedPassword = signal('');

  protected readonly needsPassword = computed(() => this.hasPassword() || this.reauthMethod() === 'password');
  protected readonly needsGoogle = computed(() => this.reauthMethod() === 'google');
  protected readonly confirmed = computed(() => this.typedConfirm().trim() === DELETE_CONFIRMATION);
  protected readonly canSubmit = computed(
    () => this.confirmed() && (!this.needsPassword() || this.typedPassword() !== '') && !this.deleting(),
  );

  protected readonly showPasswordLabel = $localize`Mostrar senha`;
  protected readonly hidePasswordLabel = $localize`Ocultar senha`;

  protected readonly problemMessage = computed<string | null>(() => {
    switch (this.problem()) {
      case null:
        return null;
      case 'confirmation_required':
        return $localize`Digite EXCLUIR para confirmar.`;
      case 'reauth_required':
        return $localize`Confirme que é você para excluir a conta.`;
      case 'invalid_password':
        return $localize`Senha incorreta.`;
      case 'rate_limited':
        return $localize`Muitas tentativas. Tente de novo em ${formatWait(this.retryAfter())}:time:.`;
      case 'deletion_unavailable':
        return $localize`Não foi possível excluir sua conta agora. Nada foi apagado. Tente mais tarde.`;
      case 'deletion_incomplete':
        return $localize`A exclusão não terminou. Toque em excluir de novo para concluir.`;
      case 'network':
        return $localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`;
    }
  });

  constructor() {
    // Fechar (Cancelar, Esc ou outro caminho) limpa os campos. Durante a exclusão o diálogo não fecha.
    effect(() => {
      const open = this.visible();
      untracked(() => {
        if (open) return;
        if (this.deleting()) {
          this.visible.set(true);
          return;
        }
        this.reset();
      });
    });
  }

  protected onConfirmInput(): void {
    this.typedConfirm.set(this.confirmText.value);
    if (this.problem() === 'confirmation_required') this.problem.set(null);
  }

  protected onPasswordInput(): void {
    this.typedPassword.set(this.password.value);
    if (this.problem() === 'invalid_password') this.problem.set(null);
  }

  protected async onDelete(): Promise<void> {
    if (!this.canSubmit()) return;
    this.problem.set(null);
    this.deleting.set(true);
    try {
      const password = this.needsPassword() ? this.password.value : undefined;
      const result = await this.privacy.deleteAccount(password === undefined ? {} : { password });
      if (result.ok) {
        this.clearFields();
        this.deleting.set(false);
        this.visible.set(false);
        await this.router.navigate(['/auth'], { queryParams: { conta: 'excluida' }, replaceUrl: true });
        return;
      }
      this.retryAfter.set(result.retryAfterSeconds);
      if (result.error === 'reauth_required') this.reauthMethod.set(result.method ?? null);
      this.problem.set(result.error);
      // Senha errada ou vencida: a pessoa digita de novo, o campo não guarda a anterior.
      this.password.setValue('');
      this.typedPassword.set('');
    } finally {
      this.deleting.set(false);
    }
  }

  /** Conta só com o Google: guarda a volta para esta tela e abre o Google de novo. */
  protected async onGoogleReauth(): Promise<void> {
    if (this.deleting()) return;
    this.returnUrl.capture(PRIVACY_URL);
    await this.authService.signInWithGoogle();
  }

  protected cancel(): void {
    if (!this.deleting()) this.visible.set(false);
  }

  private clearFields(): void {
    this.confirmText.setValue('');
    this.password.setValue('');
    this.typedConfirm.set('');
    this.typedPassword.set('');
    this.showPassword.set(false);
  }

  private reset(): void {
    this.clearFields();
    this.problem.set(null);
    this.retryAfter.set(undefined);
    this.reauthMethod.set(null);
  }
}
