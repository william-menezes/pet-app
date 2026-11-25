import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ZardAlertDialogService } from '@/shared/components/alert-dialog';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardSonnerComponent, ZardSonnerService } from '@/shared/components/sonner';

/**
 * Galeria: aviso temporário e diálogo destrutivo (contrato §3.6).
 * O `<z-sonner>` fica aqui, na seção, e nunca em `app.html`.
 */
@Component({
  selector: 'app-gallery-overlays',
  imports: [ZardButtonComponent, ZardSonnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-sonner />
    <div class="flex flex-col gap-3" data-testid="gallery-overlays">
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" z-button zType="outline" data-testid="dev-gallery-open-toast" (click)="openToast()" i18n>
          Mostrar aviso temporário
        </button>
        <button type="button" z-button zType="danger" data-testid="dev-gallery-open-dialog" (click)="openDialog()" i18n>
          Desvincular tag
        </button>
      </div>
      <p class="text-sm text-muted-foreground" data-testid="dev-gallery-dialog-result" aria-live="polite">
        {{ result() }}
      </p>
    </div>
  `,
})
export class GalleryOverlays {
  private readonly sonner = inject(ZardSonnerService);
  private readonly dialogs = inject(ZardAlertDialogService);

  protected readonly result = signal('');

  protected openToast(): void {
    this.sonner.show($localize`Dados do pet atualizados.`, {
      action: { label: $localize`Desfazer`, onClick: () => this.result.set($localize`Desfeito.`) },
    });
  }

  protected openDialog(): void {
    this.dialogs.confirm({
      zTitle: $localize`Desvincular esta tag?`,
      zDescription: $localize`A Paçoca deixa de aparecer para quem ler esta tag. Você pode ativá-la de novo com o PIN.`,
      zOkText: $localize`Desvincular tag`,
      zCancelText: $localize`Cancelar`,
      zOkDestructive: true,
      zOnOk: () => this.result.set($localize`Tag desvinculada.`),
      zOnCancel: () => this.result.set($localize`Nada mudou.`),
    });
  }
}
