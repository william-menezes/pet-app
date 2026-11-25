import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AdminShell } from '@/shared/shells/admin-shell/admin-shell';
import { ZardSonnerComponent } from '@/shared/components/sonner';

/** Hospedeiro da rota `/admin` (contrato `shells.contract.md` §7): a casca do admin e o aviso temporário. */
@Component({
  selector: 'app-admin-app',
  imports: [RouterOutlet, AdminShell, ZardSonnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-shell>
      <router-outlet />
    </app-admin-shell>
    <z-sonner />
  `,
})
export class AdminApp {}
