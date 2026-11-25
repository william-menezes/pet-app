import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';

import type { Scan } from '../../../models';
import { scanRadiusMeters } from '../scan-format';

/**
 * O Leaflet só é baixado quando o mapa aparece (chunk da rota de scans). O token existe para os testes
 * trocarem o carregamento: o jsdom não tem layout para o mapa de verdade.
 */
export type LeafletModule = typeof Leaflet;
export type LeafletLoader = () => Promise<LeafletModule>;

export const LEAFLET_LOADER = new InjectionToken<LeafletLoader>('LEAFLET_LOADER', {
  providedIn: 'root',
  factory: () => async () => {
    const mod = (await import('leaflet')) as LeafletModule & { default?: LeafletModule };
    return mod.default ?? mod;
  },
});

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Mapa do último scan (T056; referência `V2-scans*.dc.html`): círculo para a localização aproximada
 * (IP), pino com o raio do erro para a precisa (GPS). Sem interação: não rouba a rolagem da página.
 * O mapa é decorativo para leitor de tela (`aria-hidden`): quem o descreve é o rótulo do cartão. A
 * atribuição do OpenStreetMap fica fora dele, no cartão. Os tiles vêm do OpenStreetMap (`img-src https:`
 * já cobre).
 */
@Component({
  selector: 'app-scan-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './scan-map.css',
  host: { class: 'block size-full' },
  template: `<div #canvas class="size-full bg-photo" aria-hidden="true" data-testid="scans-map-canvas"></div>`,
})
export class ScanMap {
  /** Scan com localização (lat e lng preenchidos). */
  readonly scan = input.required<Scan>();

  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly loader = inject(LEAFLET_LOADER);
  private readonly leaflet = signal<LeafletModule | null>(null);
  private map: Leaflet.Map | null = null;
  private layer: Leaflet.LayerGroup | null = null;

  constructor() {
    afterNextRender(() => {
      void this.loader().then((L) => this.leaflet.set(L));
    });
    effect(() => {
      const L = this.leaflet();
      const scan = this.scan();
      if (L !== null) this.draw(L, scan);
    });
    inject(DestroyRef).onDestroy(() => {
      this.map?.remove();
      this.map = null;
    });
  }

  private draw(L: LeafletModule, scan: Scan): void {
    if (scan.lat === null || scan.lng === null) return;
    if (this.map === null) {
      this.map = L.map(this.canvas().nativeElement, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      });
      L.tileLayer(TILES, { maxZoom: 19 }).addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);
    }
    this.layer?.clearLayers();
    const center: Leaflet.LatLngExpression = [scan.lat, scan.lng];
    // O SVG do Leaflet pede cor literal: lê o valor do token `--brand` (navy da marca) onde o mapa está.
    const brand = getComputedStyle(this.canvas().nativeElement).getPropertyValue('--brand').trim() || 'currentColor';
    // O círculo só sabe seus limites com o mapa já posicionado: primeiro uma vista qualquer, depois o ajuste.
    this.map.setView(center, 12, { animate: false });
    const circle = L.circle(center, {
      radius: scanRadiusMeters(scan),
      color: brand,
      weight: 2,
      fillColor: brand,
      fillOpacity: 0.16,
      interactive: false,
    }).addTo(this.layer as Leaflet.LayerGroup);
    if (scan.geoMethod === 'gps') {
      L.marker(center, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: '',
          html: '<span class="block size-5 rounded-full border-[3px] border-white bg-brand shadow-md"></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(this.layer as Leaflet.LayerGroup);
    }
    this.map.fitBounds(circle.getBounds(), { padding: [16, 16], maxZoom: 16, animate: false });
  }
}
