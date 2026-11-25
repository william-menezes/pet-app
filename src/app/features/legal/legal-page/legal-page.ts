import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { Logo } from '@/shared/components/faro/logo/logo';

/**
 * Modelo das páginas legais (spec 004, T032): sempre clara, coluna de leitura de 680 px.
 * O texto jurídico ainda não existe: mostra o aviso de rascunho (`TODO(LEGAL_TEXTS)` nas páginas).
 * Prerender: sem API de navegador e sem dado da pessoa.
 */
@Component({
  selector: 'app-legal-page',
  imports: [RouterLink, ZardAlertComponent, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col bg-background text-text' },
  template: `
    <header class="flex items-center justify-between px-5 py-3.5 md:px-8 md:py-6 xl:px-12">
      <a routerLink="/" class="inline-flex min-h-11 items-center" aria-label="Faro" i18n-aria-label>
        <app-logo tone="on-light" [height]="40" />
      </a>
      <a
        routerLink="/auth/login"
        class="inline-flex min-h-11 items-center text-[15px] font-semibold text-link underline underline-offset-[3px] hover:text-foreground"
        i18n
        >Entrar</a
      >
    </header>
    <main class="flex flex-1 flex-col items-center px-5 pt-5 pb-8 md:px-8">
      <div class="flex w-full max-w-[680px] flex-col gap-[18px]" data-testid="legal-content">
        <div>
          <h1
            class="font-display text-[34px] leading-[1.04] font-bold tracking-[-0.03em] text-foreground md:text-[44px]"
            data-testid="legal-title">
            {{ title() }}
          </h1>
          <p class="mt-2.5 text-sm text-muted-foreground" i18n>Última atualização: a definir</p>
        </div>
        <z-alert
          zType="neutral"
          zDescription="Rascunho. Texto final em preparação."
          i18n-zDescription
          data-testid="legal-draft-notice" />
        <ng-content />
      </div>
    </main>
  `,
})
export class LegalPage {
  readonly title = input.required<string>();
}
