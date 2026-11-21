import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthStore } from '@/core/auth/auth.store';
import { ZardSonnerComponent } from '@/shared/components/sonner';
import { leafRouteData } from '@/shared/shells/leaf-route-data';
import { TutorShell } from '@/shared/shells/tutor-shell/tutor-shell';

/**
 * Hospedeiro da rota `/app` (contrato `shells.contract.md` §7): liga a casca do tutor aos dados da
 * sessão. A barra inferior só aparece nas telas-raiz (`data: { hub: true }`).
 */
@Component({
  selector: 'app-tutor-app',
  imports: [RouterOutlet, TutorShell, ZardSonnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tutor-shell [bottomNav]="isHub() === true" [userName]="userName()" [userEmail]="userEmail()">
      <router-outlet />
    </app-tutor-shell>
    <z-sonner />
  `,
})
export class TutorApp {
  private readonly store = inject(AuthStore);

  protected readonly isHub = leafRouteData<boolean>('hub');
  protected readonly userEmail = computed(() => this.store.user()?.email ?? '');
  protected readonly userName = computed(() => {
    const user = this.store.user();
    const metadata = user?.user_metadata?.['name'];
    if (typeof metadata === 'string' && metadata.trim()) return metadata.trim();
    return user?.email?.split('@')[0] ?? '';
  });
}
