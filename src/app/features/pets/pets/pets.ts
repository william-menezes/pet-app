/**
 * Pets — shell do painel autenticado do tutor.
 * Placeholder; implementação completa na feature de pets.
 * Contém o botão de logout (T042, FR-010) com data-testid="login-logout".
 */
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ZardButtonComponent } from '@/shared/components/button';

@Component({
  selector: 'app-pets',
  standalone: true,
  imports: [ZardButtonComponent],
  templateUrl: './pets.html',
})
export class Pets {
  private readonly authService = inject(AuthService);

  async signOut(): Promise<void> {
    await this.authService.signOut();
  }
}
