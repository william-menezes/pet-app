import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Índice da galeria de desenvolvimento (só existe em build de desenvolvimento; ver `app.routes.ts`). */
@Component({
  selector: 'app-gallery-index',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-10 md:px-8" data-testid="dev-gallery">
      <h1 class="text-[34px] leading-[1.04] font-bold tracking-[-0.03em]" i18n>Galeria de desenvolvimento</h1>
      <p class="text-base leading-[1.45]" i18n>
        Componentes e cascas do Faro, sem sessão e sem banco. Esta página não existe em produção.
      </p>
      <nav aria-label="Páginas da galeria" i18n-aria-label>
        <ul class="flex flex-col">
          @for (page of pages; track page.path) {
            <li class="border-b border-divider last:border-b-0">
              <a
                [routerLink]="page.path"
                class="inline-flex min-h-11 w-full items-center text-link font-semibold underline underline-offset-[3px]"
                [attr.data-testid]="'dev-gallery-link-' + page.id"
              >
                {{ page.label }}
              </a>
            </li>
          }
        </ul>
      </nav>
    </main>
  `,
})
export class GalleryIndex {
  protected readonly pages = [
    { id: 'components', path: '/dev/ui/components', label: $localize`Componentes` },
    { id: 'tutor', path: '/dev/ui/tutor', label: $localize`Casca do tutor (com barra inferior)` },
    { id: 'tutor-inner', path: '/dev/ui/tutor/inner', label: $localize`Casca do tutor (tela interna)` },
    { id: 'flow', path: '/dev/ui/flow', label: $localize`Casca de fluxo` },
    { id: 'admin', path: '/dev/ui/admin', label: $localize`Casca do admin` },
    { id: 'public', path: '/dev/ui/public', label: $localize`Página pública (faixa)` },
    { id: 'public-photo', path: '/dev/ui/public/photo', label: $localize`Página pública (foto)` },
  ];
}
