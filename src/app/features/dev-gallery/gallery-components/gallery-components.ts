import { ChangeDetectionStrategy, Component } from '@angular/core';

import { GalleryBrand } from '../sections/brand-section';
import { GalleryButton } from '../sections/button-section';
import { GalleryChips } from '../sections/chips-section';
import { GalleryCodeCells } from '../sections/code-cells-section';
import { GalleryFeedback } from '../sections/feedback-section';
import { GalleryForm } from '../sections/form-section';
import { GalleryInfo } from '../sections/info-section';
import { GalleryLists } from '../sections/lists-section';
import { GalleryOverlays } from '../sections/overlays-section';
import { GalleryPet } from '../sections/pet-section';
import { GalleryStats } from '../sections/stats-section';
import { GalleryToggles } from '../sections/toggles-section';

/** Página de componentes da galeria (`/dev/ui/components`): as 12 seções, sempre no tema claro. */
@Component({
  selector: 'app-gallery-components',
  imports: [
    GalleryBrand,
    GalleryButton,
    GalleryChips,
    GalleryCodeCells,
    GalleryFeedback,
    GalleryForm,
    GalleryInfo,
    GalleryLists,
    GalleryOverlays,
    GalleryPet,
    GalleryStats,
    GalleryToggles,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-dvh bg-background' },
  template: `
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 md:px-8" data-testid="dev-gallery-components">
      <h1 class="text-[34px] leading-[1.04] font-bold tracking-[-0.03em]" i18n>Componentes</h1>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-button">
        <h2 id="gallery-h-button" class="text-xl font-semibold" i18n>Botão</h2>
        <app-gallery-button />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-form">
        <h2 id="gallery-h-form" class="text-xl font-semibold" i18n>Campos</h2>
        <app-gallery-form />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-toggles">
        <h2 id="gallery-h-toggles" class="text-xl font-semibold" i18n>Caixa e interruptor</h2>
        <app-gallery-toggles />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-chips">
        <h2 id="gallery-h-chips" class="text-xl font-semibold" i18n>Selo, chip e segmentado</h2>
        <app-gallery-chips />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-lists">
        <h2 id="gallery-h-lists" class="text-xl font-semibold" i18n>Cartão, linhas e estado vazio</h2>
        <app-gallery-lists />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-feedback">
        <h2 id="gallery-h-feedback" class="text-xl font-semibold" i18n>Avisos, carregando e esqueleto</h2>
        <app-gallery-feedback />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-overlays">
        <h2 id="gallery-h-overlays" class="text-xl font-semibold" i18n>Aviso temporário e diálogo</h2>
        <app-gallery-overlays />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-code-cells">
        <h2 id="gallery-h-code-cells" class="text-xl font-semibold" i18n>Células de código</h2>
        <app-gallery-code-cells />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-brand">
        <h2 id="gallery-h-brand" class="text-xl font-semibold" i18n>Marca</h2>
        <app-gallery-brand />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-stats">
        <h2 id="gallery-h-stats" class="text-xl font-semibold" i18n>Números e passos</h2>
        <app-gallery-stats />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-pet">
        <h2 id="gallery-h-pet" class="text-xl font-semibold" i18n>Capa do pet e cartão de ação</h2>
        <app-gallery-pet />
      </section>

      <section class="flex flex-col gap-4" aria-labelledby="gallery-h-info">
        <h2 id="gallery-h-info" class="text-xl font-semibold" i18n>Ícone, informação e nota</h2>
        <app-gallery-info />
      </section>
    </main>
  `,
})
export class GalleryComponents {}
