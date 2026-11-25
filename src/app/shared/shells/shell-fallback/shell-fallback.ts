import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardEmptyComponent } from '@/shared/components/empty';

/**
 * Tela "em construção" dentro das cascas (contrato `shells.contract.md` §7). O caminho do botão vem
 * de `data.home` da rota. As specs 003 e 004 acrescentam as rotas reais antes do `**`.
 */
@Component({
  selector: 'app-shell-fallback',
  imports: [RouterLink, ZardButtonComponent, ZardEmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl bg-card" data-testid="shell-fallback">
      <z-empty
        zIcon="info"
        zTitle="Esta parte ainda está em construção."
        i18n-zTitle
        zDescription="Ela chega nas próximas entregas."
        i18n-zDescription
        [zActions]="[homeAction]"
      />
      <ng-template #homeAction>
        <a z-button [routerLink]="home()" data-testid="shell-fallback-home" i18n>Voltar ao início</a>
      </ng-template>
    </section>
  `,
})
export class ShellFallback {
  private readonly route = inject(ActivatedRoute);

  protected readonly home = computed(() => (this.route.snapshot.data['home'] as string | undefined) ?? '/');
}
