import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { Note } from '@/shared/components/faro/note/note';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { ScanService, type ScanFilters } from '../../../core/scans/scan.service';
import type { Scan } from '../../../models';
import {
  formatRadius,
  formatScanTime,
  groupByMonth,
  scanHasLocation,
  scanRadiusMeters,
} from '../scan-format';
import { ScanMap } from '../scan-map/scan-map';

type Filter = 'all' | 'month' | 'precise';
type State = 'loading' | 'ready' | 'error';

/**
 * Histórico de scans (`/app/scans`, T056; referência `V2-scans*.dc.html`, claro e escuro). `?pet=<id>` filtra por
 * pet. O mapa mostra o scan mais recente que tem localização; o Leaflet só baixa quando ele aparece.
 */
@Component({
  selector: 'app-scans',
  imports: [RouterLink, ScreenHeader, Note, IconTile, ScanMap, ZardAlertComponent, ZardButtonComponent, ZardToggleGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scans.html',
})
export class Scans {
  private readonly service = inject(ScanService);

  /** `?pet=<id>` (ligado por `withComponentInputBinding`). */
  readonly pet = input<string | undefined>(undefined);

  protected readonly filter = signal<Filter>('all');
  protected readonly state = signal<State>('loading');
  protected readonly scans = signal<Scan[]>([]);
  private loadId = 0;

  protected readonly filterItems: ZardToggleGroupItem[] = [
    { value: 'all', label: $localize`Todos` },
    { value: 'month', label: $localize`Este mês` },
    { value: 'precise', label: $localize`Localização precisa` },
  ];

  protected readonly groups = computed(() => groupByMonth(this.scans()));
  /** O scan mais recente que tem localização. */
  protected readonly mapScan = computed(() => this.scans().find(scanHasLocation) ?? null);
  protected readonly mapIsLatest = computed(() => {
    const map = this.mapScan();
    return map !== null && map.id === this.scans()[0]?.id;
  });
  protected readonly mapLabel = computed(() => {
    const scan = this.mapScan();
    if (scan === null) return '';
    const radius = formatRadius(scanRadiusMeters(scan), scan.geoMethod !== 'gps');
    return scan.geoMethod === 'gps'
      ? $localize`Mapa com a localização enviada no último scan com local. Erro de ${radius}:radius:.`
      : $localize`Mapa com a área aproximada do último scan com local. Raio de ${radius}:radius:.`;
  });
  protected readonly mapRadiusText = computed(() => {
    const scan = this.mapScan();
    if (scan === null) return '';
    return scan.geoMethod === 'gps'
      ? formatRadius(scanRadiusMeters(scan), false)
      : $localize`Raio de ${formatRadius(scanRadiusMeters(scan), true)}:radius:`;
  });
  protected readonly filtering = computed(() => this.filter() !== 'all' || this.pet() !== undefined);

  constructor() {
    // Carrega na entrada e sempre que o filtro ou o pet mudam.
    effect(() => {
      this.filter();
      this.pet();
      untracked(() => void this.load());
    });
  }

  protected onFilter(value: string | string[]): void {
    this.filter.set(value === 'month' || value === 'precise' ? value : 'all');
  }

  protected async load(): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    const filters: ScanFilters = {
      ...(this.filter() === 'month' ? { period: 'month' as const } : {}),
      ...(this.filter() === 'precise' ? { preciseOnly: true } : {}),
      ...(this.pet() ? { petId: this.pet() } : {}),
    };
    const res = await this.service.list(filters);
    if (id !== this.loadId) return; // uma resposta mais nova já chegou
    if (!res.ok) {
      this.state.set('error');
      return;
    }
    this.scans.set(res.scans);
    this.state.set('ready');
  }

  protected showAll(): void {
    this.filter.set('all');
  }

  protected time(scan: Scan): string {
    return formatScanTime(scan.occurredAt);
  }

  protected what(scan: Scan): string {
    switch (scan.geoMethod) {
      case 'gps':
        return $localize`Quem escaneou enviou a localização`;
      case 'ip':
        return $localize`Quem escaneou não liberou o GPS`;
      case 'none':
        return $localize`Não foi possível saber onde foi`;
    }
  }

  protected badge(scan: Scan): string {
    switch (scan.geoMethod) {
      case 'gps':
        return $localize`Precisa · ${formatRadius(scanRadiusMeters(scan), false)}:radius:`;
      case 'ip':
        return $localize`Aproximada`;
      case 'none':
        return $localize`Sem local`;
    }
  }

  protected near(scan: Scan): string | null {
    if (scan.geoMethod === 'none' || scan.city === null) return null;
    return scan.region === null ? scan.city : `${scan.city}, ${scan.region}`;
  }

  protected mapCaption(scan: Scan): string {
    return scan.geoMethod === 'gps'
      ? $localize`Localização enviada por quem escaneou`
      : $localize`Localização aproximada, pelo provedor de internet`;
  }
}
