import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/**
 * Capa com a foto do pet (contrato §5.11). A altura vem do pai (referência: 236 / 320 / 400px).
 * Projeção `[heroTop]`: canto de cima à esquerda, a 14px. O nome é um `<h1>`: a tela que usar
 * dois destes ou já tiver um título principal usa `heading` (`h2` ou `none`).
 */
@Component({
  selector: 'app-pet-hero',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block overflow-hidden rounded-2xl bg-photo md:rounded-3xl' },
  template: `
    @if (photoUrl(); as url) {
      <img
        [src]="url"
        [alt]="alt()"
        width="1200"
        height="900"
        [attr.fetchpriority]="priority() ? 'high' : null"
        [attr.loading]="priority() ? 'eager' : 'lazy'"
        decoding="async"
        class="absolute inset-0 size-full object-cover object-[center_30%]"
        data-testid="pet-hero-photo"
      />
      <div
        class="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-scrim to-transparent"
        aria-hidden="true"
        data-testid="pet-hero-veil"
      ></div>
    } @else {
      <div class="absolute inset-0 flex items-center justify-center pb-16 text-muted-foreground" data-testid="pet-hero-paw">
        <ng-icon name="paw" size="72" aria-hidden="true" />
      </div>
    }

    <div class="absolute top-3.5 left-3.5 z-10">
      <ng-content select="[heroTop]" />
    </div>

    <div class="absolute inset-x-[18px] bottom-4 z-10">
      @switch (heading()) {
        @case ('h1') {
          <h1 [class]="nameClasses()" data-testid="pet-hero-name">{{ name() }}</h1>
        }
        @case ('h2') {
          <h2 [class]="nameClasses()" data-testid="pet-hero-name">{{ name() }}</h2>
        }
        @default {
          <p [class]="nameClasses()" aria-hidden="true" data-testid="pet-hero-name">{{ name() }}</p>
        }
      }
      @if (subtitle()) {
        <p class="mt-1 text-sm" [class]="photoUrl() ? 'text-white' : 'text-foreground'" data-testid="pet-hero-subtitle">
          {{ subtitle() }}
        </p>
      }
    </div>
  `,
})
export class PetHero {
  readonly name = input.required<string>();
  /** "Tag ativa · 7K3M-Q9XA-C" */
  readonly subtitle = input('');
  /** Sem foto: fundo `bg-photo` e o ícone `paw`. */
  readonly photoUrl = input<string | null>(null);
  /** Descrição da foto. */
  readonly alt = input('');
  /** `true`: `fetchpriority="high"` e `loading="eager"`. */
  readonly priority = input(false);
  /**
   * Como o nome entra na árvore de acessibilidade: `h1` (padrão), `h2` quando a tela já tem o próprio `h1`, ou `none`
   * quando o nome já é o título da tela (na capa fica só o texto, escondido do leitor de tela).
   */
  readonly heading = input<'h1' | 'h2' | 'none'>('h1');

  protected readonly nameClasses = computed(
    () =>
      `font-display text-[36px] leading-none font-bold tracking-[-0.03em] md:text-[48px] xl:text-[56px] ${
        this.photoUrl() ? 'text-white' : 'text-foreground'
      }`,
  );
}
