import { Component, input } from '@angular/core';

/**
 * Página pública de resgate (rotas `/:codigo` e `/:codigo/perdido`, SSR).
 * Placeholder — o perfil de resgate real (projeção whitelisted + scan + WhatsApp) vem na feature.
 * Rescue-First: não depende de assinatura ativa.
 */
@Component({
  selector: 'app-rescue-page',
  imports: [],
  templateUrl: './rescue-page.html',
  styleUrl: './rescue-page.css',
})
export class RescuePage {
  /** Código opaco da tag (route param `:codigo`), via withComponentInputBinding. */
  readonly codigo = input('');
  /** Modo perdido (route data) — ativa a faixa âmbar de alerta. */
  readonly perdido = input(false);
}
