import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { PrivacyService } from '../../../core/account/privacy.service';
import { formatWait } from '../../auth/shared/wait-time';
import { ACCOUNT_ICONS } from '../shared/account-icons';
import { DeleteAccountDialog } from './delete-account-dialog';

type ExportProblem = { reason: 'rate_limited'; retryAfterSeconds?: number } | { reason: 'network' };

/**
 * Privacidade, `/app/conta/privacidade` (spec 004 T080 e T081). Referência: `V2-conta-privacidade*.dc.html`
 * e `V2-conta-excluir*.dc.html`. Dois blocos: exportar os dados (download gerado no navegador) e excluir a
 * conta (botão de texto vermelho que abre o diálogo de decisão). Segue o tema do app.
 */
@Component({
  selector: 'app-privacy',
  imports: [NgIcon, ScreenHeader, ZardAlertComponent, ZardButtonComponent, DeleteAccountDialog],
  providers: [provideIcons(ACCOUNT_ICONS)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy.html',
})
export class Privacy {
  private readonly privacy = inject(PrivacyService);

  protected readonly exporting = signal(false);
  protected readonly exported = signal(false);
  protected readonly exportProblem = signal<ExportProblem | null>(null);
  protected readonly deleteOpen = signal(false);

  protected readonly exportProblemMessage = computed<string | null>(() => {
    const problem = this.exportProblem();
    if (problem === null) return null;
    if (problem.reason === 'rate_limited') {
      return $localize`Você já exportou seus dados 3 vezes hoje. Tente de novo em ${formatWait(problem.retryAfterSeconds)}:time:.`;
    }
    return $localize`Não conseguimos gerar o arquivo agora. Verifique sua conexão e tente de novo.`;
  });

  protected async onExport(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exported.set(false);
    this.exportProblem.set(null);
    try {
      const result = await this.privacy.exportData();
      if (result.ok) {
        this.exported.set(true);
      } else if (result.reason === 'rate_limited') {
        this.exportProblem.set({ reason: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds });
      } else {
        this.exportProblem.set({ reason: 'network' });
      }
    } finally {
      this.exporting.set(false);
    }
  }

  protected openDelete(): void {
    this.deleteOpen.set(true);
  }
}
