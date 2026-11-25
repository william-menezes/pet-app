import { DestroyRef, computed, inject, signal } from '@angular/core';

/**
 * Contagem regressiva em segundos, para os botões "Reenviar" e "Enviar" dos fluxos de /auth.
 * Guarda o instante final e um relógio de 1 s (por isso funciona com relógio falso nos testes).
 * Deve ser criada em contexto de injeção (campo de componente): encerra o relógio no `destroy`.
 */
export class Countdown {
  private readonly deadline = signal(0);
  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly remaining = computed(() => Math.max(0, Math.ceil((this.deadline() - this.now()) / 1000)));
  /** `m:ss`. */
  readonly text = computed(() => {
    const total = this.remaining();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Conta `seconds` a partir de agora. */
  start(seconds: number): void {
    this.startAt(Date.now() + Math.max(0, seconds) * 1000);
  }

  /** Conta até o instante `deadlineMs` (milissegundos desde a época). Instante passado zera. */
  startAt(deadlineMs: number): void {
    this.stop();
    this.now.set(Date.now());
    this.deadline.set(deadlineMs);
    if (this.remaining() === 0) return;
    this.timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.remaining() === 0) this.stop();
    }, 1000);
  }

  clear(): void {
    this.stop();
    this.deadline.set(0);
    this.now.set(Date.now());
  }

  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
