import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { BrandPanel } from '@/shared/components/faro/brand-panel/brand-panel';
import { BRAND_HEADLINE, BRAND_SUB } from '@/shared/components/faro/brand-panel/brand-copy';
import { Logo } from '@/shared/components/faro/logo/logo';
import { Steps } from '@/shared/components/faro/steps/steps';

/**
 * Casca dos fluxos: conta, ativação e cadastro de pet (contrato `shells.contract.md` §3).
 * Sempre no tema claro. Projeção: corpo (padrão) e `[footer]` (as ações).
 */
@Component({
  selector: 'app-flow-shell',
  imports: [RouterLink, NgIcon, ZardButtonComponent, BrandPanel, Logo, Steps],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh bg-background text-text', 'data-testid': 'flow-shell' },
  templateUrl: './flow-shell.html',
})
export class FlowShell {
  /** Nome do fluxo ("Ativar tag"). */
  readonly barTitle = input('');
  readonly back = input<'back' | 'close' | null>(null);
  readonly backLink = input<string | null>(null);
  readonly backClick = output<void>();
  readonly step = input<{ current: number; total: number } | null>(null);
  /** Frase do painel de marca, no desktop. */
  readonly headline = input<string[]>(BRAND_HEADLINE);
  readonly sub = input(BRAND_SUB);

  protected label(kind: 'back' | 'close'): string {
    return kind === 'close' ? $localize`Fechar` : $localize`Voltar`;
  }
}
