import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, PLATFORM_ID, afterNextRender, inject, input, output, viewChild } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';

import { RescueView } from '../../public/tag-page/rescue-view/rescue-view';
import type { LostElapsed, PublicRescueProfile } from '../../../models';

/**
 * Prévia "como estranhos verão" (T066): a PRÓPRIA tela da página pública, na visão do dono, com as escolhas ainda
 * não salvas. Cobre a tela inteira, sempre clara (a página pública não tem tema escuro, mesmo com o app no escuro),
 * e se fecha com o botão, com Esc, e devolve o foco a quem a abriu.
 *
 * É um painel do app (não é a página pública), por isso pode ser um diálogo: a regra "sem overlay" vale para
 * `features/public`, que continua sem importar nada daqui.
 */
@Component({
  selector: 'app-visibility-preview',
  imports: [NgIcon, RescueView, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'faro-light fixed inset-0 z-[70] block overflow-y-auto overscroll-contain bg-background text-text',
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-label]': 'label',
    'data-testid': 'visibility-preview',
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div class="sticky top-0 z-[80] flex items-center gap-3 border-b border-border bg-card px-4 py-2 md:px-8">
      <button
        #closeButton
        type="button"
        z-button
        zType="outline"
        zSize="md"
        (click)="closed.emit()"
        data-testid="visibility-preview-close">
        <ng-icon name="back" size="20" aria-hidden="true" />
        <span i18n>Voltar para editar</span>
      </button>
      <p class="min-w-0 flex-1 text-[13px] leading-[1.35] text-muted-foreground" i18n>
        Assim a página aparece para quem escanear a tag, com as suas escolhas de agora (ainda não salvas).
      </p>
    </div>
    <app-rescue-view
      [profile]="profile()"
      [lostElapsed]="lostElapsed()"
      [ownerView]="true"
      [showOwnerEdit]="false" />
  `,
})
export class VisibilityPreview {
  private readonly closeButton = viewChild.required('closeButton', { read: ElementRef<HTMLButtonElement> });

  readonly profile = input.required<PublicRescueProfile>();
  readonly lostElapsed = input<LostElapsed | null>(null);
  readonly closed = output<void>();

  protected readonly label = $localize`Como estranhos verão`;

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.closeButton().nativeElement.focus());
    }
  }
}
