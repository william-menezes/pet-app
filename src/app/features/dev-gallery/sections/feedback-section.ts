import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { ZardSpinnerComponent } from '@/shared/components/spinner';

/** Galeria: aviso (três tipos), spinner e esqueleto (contrato §3.6 e §3.7). */
@Component({
  selector: 'app-gallery-feedback',
  imports: [ZardAlertComponent, ZardSpinnerComponent, ZardSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-[520px] flex-col gap-4" data-testid="gallery-feedback">
      <z-alert
        zType="neutral"
        zDescription="Sua sessão expirou. Entre de novo para continuar."
        i18n-zDescription
        data-testid="dev-alert-neutral"
      />
      <z-alert
        zType="success"
        zDescription="Você saiu com segurança."
        i18n-zDescription
        data-testid="dev-alert-success"
      />
      <z-alert
        zType="danger"
        zDescription="E-mail ou senha incorretos."
        i18n-zDescription
        data-testid="dev-alert-danger"
      />

      <div class="flex items-center gap-3">
        <z-spinner data-testid="dev-spinner" />
        <z-spinner class="size-8!" />
        <span class="text-sm text-muted-foreground" i18n>Carregando seus pets...</span>
      </div>

      <div class="flex flex-col gap-2" data-testid="dev-skeleton">
        <z-skeleton class="h-5 w-48" />
        <z-skeleton class="h-4 w-full" />
        <z-skeleton class="h-4 w-72 max-w-full" />
      </div>
    </div>
  `,
})
export class GalleryFeedback {}
