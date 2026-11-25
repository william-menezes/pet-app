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
 * Projeção: `[media]`, `[lead]` (opcional), conteúdo padrão (dentro de um `<main>`) e `[footer]`.
 *
 * `lead` (modo perdido, T061): um bloco de cor própria que ocupa o lugar do topo arredondado da folha.
 * Quem o projeta cuida do fundo, do canto arredondado e do preenchimento; a folha segue embaixo, sem o
 * recuo sobre a faixa e sem o canto arredondado.
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
      @if (lead()) {
        <div class="relative z-10 -mt-7 md:-mt-8 xl:mt-0" data-testid="public-layout-lead">
          <ng-content select="[lead]" />
        </div>
      }
      <div
        class="relative z-10 flex flex-1 flex-col bg-background px-5 pb-3.5 md:pb-5 xl:px-24 xl:py-8"
        [class]="sheetClass()"
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

  /** `true`: há um bloco `[lead]` acima da folha (modo perdido). */
  readonly lead = input(false);

  protected readonly mediaClass = computed(() => MEDIA_CLASSES[this.media()]);

  protected readonly sheetClass = computed(() =>
    this.lead()
      ? 'pt-4 md:pt-6 xl:justify-start'
      : '-mt-7 rounded-t-3xl pt-6 md:-mt-8 md:rounded-t-4xl md:pt-10 xl:mt-0 xl:justify-center xl:rounded-none',
  );
}
