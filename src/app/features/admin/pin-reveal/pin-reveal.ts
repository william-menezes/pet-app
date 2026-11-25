import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';

/**
 * Caixa do PIN novo (reemissão ou fim de vínculo): mostra o PIN uma vez, com "Copiar" e o aviso "Este PIN não aparece
 * de novo". O PIN vem por `input` e não é copiado para nenhum estado daqui; quem hospeda apaga o valor no `done`
 * e ao ser destruído.
 */
@Component({
  selector: 'app-admin-pin-reveal',
  imports: [ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 rounded-2xl bg-card p-5', role: 'region', 'aria-labelledby': 'admin-pin-reveal-title', 'data-testid': 'admin-pin-reveal' },
  template: `
    <h2 id="admin-pin-reveal-title" class="font-display text-[19px] font-semibold text-foreground" i18n>PIN novo da tag {{ code() }}</h2>
    <p class="rounded-xl bg-inset px-4 py-3 text-center font-display text-[32px] leading-none font-bold tracking-[0.2em] text-foreground" data-testid="admin-pin-reveal-pin">
      {{ pin() }}
    </p>
    <p class="text-[15px] leading-[1.45] text-text" i18n>Este PIN não aparece de novo. Anote ou copie agora, antes de sair desta tela.</p>
    <div aria-live="polite">
      @if (copied()) {
        <p class="text-[13px] font-semibold text-muted-foreground" role="status" data-testid="admin-pin-reveal-copied" i18n>PIN copiado.</p>
      }
    </div>
    <div class="flex flex-wrap gap-3">
      <button type="button" z-button zType="outline" zSize="lg" (click)="copy()" data-testid="admin-pin-reveal-copy" i18n>Copiar PIN</button>
      <button type="button" z-button zSize="lg" (click)="done.emit()" data-testid="admin-pin-reveal-done" i18n>Concluir</button>
    </div>
  `,
})
export class AdminPinReveal {
  readonly pin = input.required<string>();
  readonly code = input.required<string>();
  /** O admin anotou o PIN: quem hospeda apaga o valor. */
  readonly done = output<void>();

  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.pin());
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }
}
