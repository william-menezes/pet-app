import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Altura da faixa do topo por tipo, no celular e no tablet. Classes inteiras para o Tailwind achar. */
const MEDIA_CLASSES = {
  photo: 'h-[300px] md:h-[410px]',
  'photo-short': 'h-[250px] md:h-[350px]',
  band: 'h-[230px] md:h-[330px]',
} as const;

/**
 * Estrutura das páginas públicas (contrato `shells.contract.md` §5.1): faixa do topo (a foto do pet
 * ou o painel de marca), folha e rodapé; no desktop, duas metades. Renderizada no servidor, sempre
 * no tema claro. Sem overlay, sem `window`/`document` e sem nada de `core/`.
 *
 * Projeção: `[media]`, conteúdo padrão (dentro de um `<main>`) e `[footer]`.
 */
@Component({
  selector: 'app-public-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col bg-background text-text xl:flex-row', 'data-testid': 'public-layout' },
  template: `
    <div
      class="relative shrink-0 overflow-hidden bg-photo xl:h-auto xl:w-1/2 [&>*]:size-full"
      [class]="mediaClass()"
      data-testid="public-layout-media"
    >
      <ng-content select="[media]" />
    </div>

    <div class="flex min-w-0 flex-1 flex-col xl:w-1/2">
      <div
        class="relative z-10 -mt-7 flex flex-1 flex-col rounded-t-3xl bg-background px-5 pt-6 pb-3.5 md:-mt-8 md:rounded-t-4xl md:pt-10 md:pb-5 xl:mt-0 xl:justify-center xl:rounded-none xl:px-24 xl:py-8"
        data-testid="public-layout-sheet"
      >
        <main class="mx-auto flex w-full flex-1 flex-col md:max-w-[560px] xl:flex-none">
          <ng-content />
        </main>
      </div>
      <ng-content select="[footer]" />
    </div>
  `,
})
export class PublicLayout {
  /** Altura da faixa do topo no celular e no tablet. No desktop a mídia ocupa a altura toda. */
  readonly media = input<'photo' | 'photo-short' | 'band'>('band');

  protected readonly mediaClass = computed(() => MEDIA_CLASSES[this.media()]);
}
