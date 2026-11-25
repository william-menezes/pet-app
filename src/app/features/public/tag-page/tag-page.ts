import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';

import { isValid, normalize } from '../../../core/tag-code/tag-code';
import { ScanClient } from '../../../core/tags/scan-client.service';
import type { TagResolution } from '../../../models';
import { ContingencyView } from './contingency-view/contingency-view';
import { NotActivatedView } from './not-activated-view/not-activated-view';
import { NotFoundView } from './not-found-view/not-found-view';
import { RescueView, type LocationStatus } from './rescue-view/rescue-view';

/** Título e descrição genéricos (Open Graph incluso): nunca o nome do pet nem a foto. */
const GENERIC_TITLE = $localize`Faro · tag de identificação`;
const GENERIC_DESCRIPTION = $localize`O caminho de volta para casa. A tag com QR Code que ajuda quem achou um pet a falar com a família.`;

/**
 * Página da tag, `/<código>` (T030). Escolhe a tela pelo estado que o resolvedor da rota trouxe:
 * resgate (com ou sem modo perdido), não ativada, não encontrada ou contingência. Nenhum estado é um erro
 * técnico (Princípio I). Sem overlay; não importa nada do app autenticado nem de `core/auth`.
 *
 * O `<head>` é genérico e `noindex`: o nome do pet só aparece no corpo da página.
 *
 * Scan (T054) e visão do dono (T048): DEPOIS da hidratação, e só no navegador, a página chama
 * `POST /api/scan`. Abrir o HTML não gera scan. Se o servidor responde que quem abriu é o dono, mostra a
 * visão do dono; se devolve um token, libera "Enviar onde estou" (a posição só é pedida depois do toque,
 * com o consentimento do navegador).
 */
@Component({
  selector: 'app-tag-page',
  imports: [RescueView, NotActivatedView, NotFoundView, ContingencyView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (resolution().state) {
      @case ('assigned') {
        @if (assigned(); as data) {
          <app-rescue-view
            [profile]="data.profile"
            [lostElapsed]="data.lostElapsed ?? null"
            [ownerView]="ownerView()"
            [locationStatus]="locationStatus()"
            (shareLocation)="shareLocation()"
          />
        }
      }
      @case ('available') {
        @if (available(); as data) {
          <app-not-activated-view [code]="data.code" />
        }
      }
      @case ('not_found') {
        <app-not-found-view />
      }
      @default {
        <app-contingency-view [retryHref]="retryHref()" />
      }
    }
  `,
})
export class TagPage {
  private readonly meta = inject(Meta);
  private readonly scans = inject(ScanClient);

  private readonly owner = signal(false);
  private readonly scanToken = signal<string | null>(null);
  private readonly location = signal<Exclude<LocationStatus, 'unavailable'>>('idle');

  /** Resultado do resolvedor da rota (`resolve`). */
  readonly resolution = input.required<TagResolution>();
  /** Segmento da URL como veio (`posParams` do `tagCodeMatcher`). */
  readonly codigo = input('');

  protected readonly assigned = computed(() => {
    const value = this.resolution();
    return value.state === 'assigned' ? value : null;
  });
  protected readonly available = computed(() => {
    const value = this.resolution();
    return value.state === 'available' ? value : null;
  });
  protected readonly ownerView = this.owner.asReadonly();
  /** Visão do dono: o botão aparece, desativado. Visitante: só com um token de scan. */
  protected readonly locationStatus = computed<LocationStatus>(() =>
    this.owner() ? 'idle' : this.scanToken() === null ? 'unavailable' : this.location(),
  );
  /** O mesmo endereço, em forma canônica: "Tentar de novo" refaz o pedido ao servidor. */
  protected readonly retryHref = computed(() => `/${normalize(this.codigo())}`);

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    this.meta.updateTag({ name: 'description', content: GENERIC_DESCRIPTION });
    this.meta.updateTag({ property: 'og:title', content: GENERIC_TITLE });
    this.meta.updateTag({ property: 'og:description', content: GENERIC_DESCRIPTION });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    afterNextRender(() => void this.registerScan());
  }

  private async registerScan(): Promise<void> {
    const code = normalize(this.codigo());
    if (!isValid(code) || this.resolution().state === 'contingency') return;
    const result = await this.scans.registerScan(code);
    if (result.owner) this.owner.set(true);
    else if (result.scan_token !== undefined) this.scanToken.set(result.scan_token);
  }

  /** "Enviar onde estou": pede a posição ao navegador (consentimento) e manda ao servidor do app. */
  protected shareLocation(): void {
    const token = this.scanToken();
    if (token === null || this.owner() || this.location() === 'sending') return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.location.set('denied');
      return;
    }
    this.location.set('sending');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        void this.scans.sendLocation(token, { lat: latitude, lng: longitude, accuracyM: accuracy }).then((ok) => {
          this.location.set(ok ? 'sent' : 'idle');
        });
      },
      (error) => this.location.set(error.code === error.PERMISSION_DENIED ? 'denied' : 'idle'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }
}
