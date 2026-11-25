import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSonnerService } from '@/shared/components/sonner';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { AccountService } from '../../../core/account/account.service';
import { AccountStore } from '../../../core/account/account.store';
import { ACCOUNT_ICONS } from '../shared/account-icons';

const NAME_MIN = 2;
const NAME_MAX = 80;

type NameProblem = 'empty' | 'length' | 'network';

/**
 * Dados pessoais, `/app/conta/dados` (spec 004 T083). Referência: `V2-conta-dados*.dc.html`.
 * Nome (2 a 80 caracteres após `trim`) e e-mail somente leitura. "Salvar alterações" só habilita com
 * mudança. O aviso "Dados salvos." sai pelo `sonner`, que o `TutorApp` hospeda. Segue o tema do app.
 */
@Component({
  selector: 'app-personal-data',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    ScreenHeader,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardFieldImports,
    ZardInputComponent,
  ],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './personal-data.html',
})
export class PersonalData implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly accountStore = inject(AccountStore);
  private readonly sonner = inject(ZardSonnerService);

  protected readonly account = this.accountStore.account;
  protected readonly name = new FormControl('', { nonNullable: true });

  /** O que está digitado, como signal, para o botão reagir. */
  private readonly typed = signal('');
  private touched = false;

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly problem = signal<NameProblem | null>(null);

  protected readonly changed = computed(() => {
    const account = this.account();
    return account !== null && this.typed().trim() !== account.nome;
  });

  protected readonly nameInvalid = computed(() => this.problem() === 'empty' || this.problem() === 'length');

  constructor() {
    // O nome do cadastro entra no campo assim que a conta carrega, se a pessoa ainda não digitou.
    effect(() => {
      const account = this.account();
      untracked(() => {
        if (account === null || this.touched) return;
        this.name.setValue(account.nome);
        this.typed.set(account.nome);
      });
    });
  }

  ngOnInit(): void {
    void this.accountService.ensureLoaded();
  }

  protected onNameInput(): void {
    this.touched = true;
    this.typed.set(this.name.value);
    this.saved.set(false);
    if (this.problem() !== null) this.problem.set(null);
  }

  protected async onSave(): Promise<void> {
    if (this.saving() || !this.changed()) return;
    const value = this.typed().trim();
    if (value.length === 0) {
      this.problem.set('empty');
      return;
    }
    if (value.length < NAME_MIN || value.length > NAME_MAX) {
      this.problem.set('length');
      return;
    }

    this.problem.set(null);
    this.saving.set(true);
    try {
      const result = await this.accountService.updateName(value);
      if (result.ok) {
        this.name.setValue(value);
        this.typed.set(value);
        this.saved.set(true);
        this.sonner.success($localize`Dados salvos.`);
      } else {
        this.problem.set(result.reason === 'invalid' ? 'length' : 'network');
      }
    } finally {
      this.saving.set(false);
    }
  }
}
