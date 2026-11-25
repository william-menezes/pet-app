import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ActionCard } from '@/shared/components/faro/action-card/action-card';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { PetHero } from '@/shared/components/faro/pet-hero/pet-hero';
import { StatTile } from '@/shared/components/faro/stat-tile/stat-tile';

import { AccountService } from '../../../core/account/account.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PetService } from '../../../core/pets/pet.service';
import { ScanService } from '../../../core/scans/scan.service';
import { activationPath } from '../../../core/tags/activation-links';
import { TagService } from '../../../core/tags/tag.service';
import type { Scan } from '../../../models';
import { formatScanDay, formatScanTime, formatScanWhen } from '../../scans/scan-format';
import { lostElapsedLabel } from '../lost-elapsed';
import { PetCard } from '../pet-card/pet-card';
import { loadPetOverview, type PetOverviewItem } from '../pet-overview';
import { loadErrorText } from '../../../core/tags/tag-errors';

/** Texto de erro de carga desta tela; o do limite de chamadas vem de `loadErrorText`. */
const LOAD_FAILED = $localize`Não conseguimos carregar o painel. Verifique sua conexão e tente de novo.`;

type State = 'loading' | 'ready' | 'error';

const MS_HOUR = 3_600_000;

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora local. */
export function greeting(hour: number): string {
  if (hour < 5) return $localize`Boa noite`;
  if (hour < 12) return $localize`Bom dia`;
  if (hour < 18) return $localize`Boa tarde`;
  return $localize`Boa noite`;
}

/**
 * Painel do tutor (`/app`, T069; referência `V2-painel*.dc.html`, claro e escuro, três larguras).
 *
 * O que vem de dados reais: o `my_dashboard` (pets, tag, modo perdido, scans do mês, último scan, "estranhos veem X
 * de 5", ativação pendente), os dados dos pets e a lista de scans do pet escolhido. Não há sino de notificações nem
 * "ninguém entrou em contato ainda": o backend não traz esses dados, e a tela não inventa.
 *
 * `data-testid="pets-home"` fica na raiz e existe também enquanto carrega e em caso de erro (o teste de restauração
 * de sessão espera por ele).
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    NgIcon,
    ActionCard,
    IconTile,
    PetCard,
    PetHero,
    StatTile,
    ZardAlertComponent,
    ZardButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly tags = inject(TagService);
  private readonly petService = inject(PetService);
  private readonly scanService = inject(ScanService);
  private readonly account = inject(AccountService);
  private readonly authStore = inject(AuthStore);

  protected readonly state = signal<State>('loading');
  protected readonly errorText = signal(LOAD_FAILED);
  protected readonly items = signal<PetOverviewItem[]>([]);
  protected readonly pending = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly scans = signal<Scan[]>([]);
  protected readonly firstName = signal('');
  private readonly now = signal(new Date());

  protected readonly greeting = computed(() => greeting(this.now().getHours()));
  protected readonly initial = computed(() => this.firstName().charAt(0).toUpperCase());
  protected readonly selected = computed(() => this.items().find((i) => i.dash.id === this.selectedId()) ?? this.items()[0] ?? null);
  protected readonly many = computed(() => this.items().length > 1);

  protected readonly coverLine = computed(() => {
    const dash = this.selected()?.dash;
    if (dash === undefined) return '';
    if (!dash.hasTag) return $localize`Sem tag`;
    return dash.tagStatus === 'blocked' ? $localize`Tag bloqueada` : $localize`Tag ativa · ${dash.tagCode ?? ''}:code:`;
  });
  protected readonly photoAlt = computed(() => $localize`Foto de ${this.selected()?.dash.name ?? ''}:name:`);

  /** O cartão lima só aparece com scan nas últimas 48 h. */
  protected readonly recentScan = computed(() => {
    const last = this.selected()?.dash.lastScan;
    if (last === null || last === undefined) return null;
    return this.now().getTime() - new Date(last.occurredAt).getTime() <= 48 * MS_HOUR ? last : null;
  });
  protected readonly recentScanText = computed(() => {
    const last = this.recentScan();
    if (last === null) return '';
    const when = formatScanWhen(last.occurredAt, this.now());
    switch (last.geoMethod) {
      case 'gps':
        return $localize`${when}:when:, localização precisa.`;
      case 'ip':
        return $localize`${when}:when:, localização aproximada.`;
      case 'none':
        return $localize`${when}:when:, sem localização.`;
    }
  });
  protected readonly scansCaption = computed(() => {
    const last = this.selected()?.dash.lastScan;
    return last === null || last === undefined ? $localize`Nenhum scan este mês` : $localize`O último foi ${formatScanDay(last.occurredAt, this.now())}:day:`;
  });
  protected readonly lostLabel = computed(() => {
    const dash = this.selected()?.dash;
    const elapsed = dash?.lostSince ? lostElapsedLabel(dash.lostSince, this.now().getTime()) : null;
    return elapsed === null ? $localize`Alerta ligado na página da tag` : $localize`Ligado ${elapsed}:elapsed:`;
  });
  protected readonly scanTitle = computed(() => $localize`Alguém escaneou a tag de ${this.selected()?.dash.name ?? ''}:name:`);
  protected readonly pendingPath = computed(() => {
    const code = this.pending();
    return code === null ? '' : activationPath(code);
  });
  protected readonly lastScans = computed(() => this.scans().slice(0, 3));

  constructor() {
    // O "Últimos scans" (desktop) acompanha o pet da capa.
    effect(() => {
      const id = this.selectedId() ?? this.items()[0]?.dash.id;
      if (id === undefined) return;
      untracked(() => void this.loadScans(id));
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const [overview, account] = await Promise.all([loadPetOverview(this.tags, this.petService), this.account.ensureLoaded()]);
    if (!overview.ok) {
      this.errorText.set(loadErrorText(overview, LOAD_FAILED));
      this.state.set('error');
      return;
    }
    const user = this.authStore.user();
    const fromAuth = typeof user?.user_metadata?.['name'] === 'string' ? (user.user_metadata['name'] as string) : (user?.email?.split('@')[0] ?? '');
    this.firstName.set((account?.nome ?? fromAuth).trim().split(/\s+/)[0] ?? '');
    this.items.set(overview.items);
    this.pending.set(overview.pendingActivation);
    this.now.set(new Date());
    this.state.set('ready');
  }

  private async loadScans(petId: string): Promise<void> {
    const res = await this.scanService.list({ petId, limit: 3 });
    // Falha aqui não derruba o painel: a lista só some.
    if (this.selected()?.dash.id === petId) this.scans.set(res.ok ? res.scans : []);
  }

  protected select(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
  }

  protected scanTime(scan: Scan): string {
    return formatScanTime(scan.occurredAt, this.now());
  }

  protected scanWhat(scan: Scan): string {
    switch (scan.geoMethod) {
      case 'gps':
        return $localize`Quem escaneou enviou a localização`;
      case 'ip':
        return $localize`Localização aproximada`;
      case 'none':
        return $localize`Sem localização`;
    }
  }
}
