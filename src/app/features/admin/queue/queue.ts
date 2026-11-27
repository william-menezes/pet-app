import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardSonnerService } from '@/shared/components/sonner';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';

import { AdminTagService } from '../../../core/admin/admin-tag.service';
import type { AdminQueue, AdminQueueScan } from '../../../models';
import { formatScanTime } from '../../scans/scan-format';
import { AdminHeading } from '../admin-heading/admin-heading';
import { adminErrorMessage, formatDayTime, formatShortDay, placeText, replacementLabel, statusBadgeType, statusLabel } from '../admin-format';

type State = 'loading' | 'ready' | 'error';
type Section = 'all' | 'scans' | 'replacements' | 'locked';

/** O servidor devolve no máximo isto por chamada. */
const QUEUE_LIMIT = 100;

/**
 * "Fila" (`/admin/fila`, T081; referência `V2-admin-fila*.dc.html`): o que pede atenção. Três seções: scans de tags sem
 * vínculo (bloqueada, anulada ou ainda não ativada), pedidos de 2ª via abertos e tags travadas por PIN errado, com
 * filtro por chips. Cada linha leva ao detalhe do código; o pedido de 2ª via tem "Marcar como resolvido".
 * Celular e tablet: um cartão por linha; desktop: as mesmas linhas em colunas.
 */
@Component({
  selector: 'app-admin-queue',
  imports: [RouterLink, AdminHeading, ZardAlertComponent, ZardBadgeComponent, ZardButtonComponent, ZardToggleGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full flex-col gap-3.5 md:gap-[18px] xl:gap-5" data-testid="admin-queue">
      <app-admin-heading title="Fila" i18n-title subtitle="O que pede atenção: scans de tags sem dono, pedidos de 2ª via e tags travadas." i18n-subtitle />

      <z-toggle-group
        [zMode]="'single'"
        zAriaLabel="Filtrar a fila"
        i18n-zAriaLabel
        [zItems]="chips()"
        [zValue]="section()"
        (valueChange)="onSection($event)"
        data-testid="admin-queue-filters" />

      <div aria-live="polite">
        @switch (state()) {
          @case ('loading') {
            <p class="py-6 text-center text-text" role="status" aria-busy="true" data-testid="admin-queue-loading" i18n>Um instante…</p>
          }
          @case ('error') {
            <div class="flex flex-col items-start gap-3" data-testid="admin-queue-error">
              <z-alert class="w-full" zType="danger" [zRole]="'status'" [zDescription]="errorText()" />
              @if (!forbidden()) {
                <button type="button" z-button zType="outline" (click)="load()" data-testid="admin-queue-retry" i18n>Tentar de novo</button>
              }
            </div>
          }
        }
      </div>

      @if (state() === 'ready' && queue(); as q) {
        @if (total() === 0) {
          <div class="flex flex-col items-start gap-3 rounded-2xl bg-card p-5" data-testid="admin-queue-empty">
            <p class="font-display text-[19px] font-semibold text-foreground" i18n>Nada pedindo atenção agora</p>
            <p class="text-[15px] leading-[1.45] text-text" i18n>Quando alguém escanear uma tag sem dono, pedir 2ª via ou travar um PIN, aparece aqui.</p>
            <a z-button zType="outline" routerLink="/admin/codigos" data-testid="admin-queue-empty-codes" i18n>Ver códigos</a>
          </div>
        }

        @if (showScans()) {
          <section class="flex flex-col gap-3 rounded-2xl bg-card p-5" aria-labelledby="admin-queue-scans-title" data-testid="admin-queue-scans">
            <div>
              <h2 id="admin-queue-scans-title" class="font-display text-[19px] font-semibold text-foreground" i18n>Scans de tags sem vínculo</h2>
              <p class="mt-1 text-sm text-muted-foreground" i18n>Alguém escaneou uma tag bloqueada, anulada ou ainda não ativada. Pode ser um pet perdido.</p>
            </div>
            @if (q.scans.length === 0) {
              <p class="text-[15px] text-text" data-testid="admin-queue-scans-empty" i18n>Nenhum scan sem vínculo.</p>
            } @else {
              <ul class="m-0 flex list-none flex-col divide-y divide-divider p-0">
                <li class="hidden grid-cols-[1.2fr_1fr_1fr_1.6fr] gap-3 pb-2 text-[13px] font-semibold text-muted-foreground xl:grid" aria-hidden="true">
                  <span i18n>Código</span><span i18n>Situação</span><span i18n>Quando</span><span i18n>Local</span>
                </li>
                @for (scan of q.scans; track scan.id) {
                  <li class="flex flex-col gap-1.5 py-3 xl:grid xl:grid-cols-[1.2fr_1fr_1fr_1.6fr] xl:items-center xl:gap-3" data-testid="admin-queue-scan">
                    <a class="font-display text-[16px] font-semibold text-link underline-offset-[3px] hover:underline" [routerLink]="['/admin/codigos', scan.code]" data-testid="admin-queue-code">{{ scan.code }}</a>
                    <span><z-badge [zType]="badge(scan)">{{ status(scan) }}</z-badge></span>
                    <span class="text-sm text-text">{{ when(scan) }}</span>
                    <span class="text-sm text-text">{{ place(scan) }}</span>
                  </li>
                }
              </ul>
              @if (q.scans.length >= limit) {
                <p class="text-[13px] text-muted-foreground" data-testid="admin-queue-scans-limit" i18n>Mostrando os {{ limit }} mais recentes.</p>
              }
            }
          </section>
        }

        @if (showReplacements()) {
          <section class="flex flex-col gap-3 rounded-2xl bg-card p-5" aria-labelledby="admin-queue-requests-title" data-testid="admin-queue-replacements">
            <div>
              <h2 id="admin-queue-requests-title" class="font-display text-[19px] font-semibold text-foreground" i18n>Pedidos de 2ª via</h2>
              <p class="mt-1 text-sm text-muted-foreground" i18n>Dano: reimprima o mesmo código. Perda: o código antigo já foi anulado; envie uma tag nova.</p>
            </div>
            @if (q.replacements.length === 0) {
              <p class="text-[15px] text-text" data-testid="admin-queue-replacements-empty" i18n>Nenhum pedido aberto.</p>
            } @else {
              <ul class="m-0 flex list-none flex-col divide-y divide-divider p-0">
                <li class="hidden grid-cols-[1.2fr_1fr_1fr_1.6fr] gap-3 pb-2 text-[13px] font-semibold text-muted-foreground xl:grid" aria-hidden="true">
                  <span i18n>Código</span><span i18n>Tipo</span><span i18n>Pedido em</span><span></span>
                </li>
                @for (r of q.replacements; track r.id) {
                  <li class="flex flex-col gap-1.5 py-3 xl:grid xl:grid-cols-[1.2fr_1fr_1fr_1.6fr] xl:items-center xl:gap-3" data-testid="admin-queue-replacement">
                    <a class="font-display text-[16px] font-semibold text-link underline-offset-[3px] hover:underline" [routerLink]="['/admin/codigos', r.code]" data-testid="admin-queue-code">{{ r.code }}</a>
                    <span><z-badge zType="neutral">{{ kind(r.kind) }}</z-badge></span>
                    <span class="text-sm text-text">{{ day(r.createdAt) }}</span>
                    <span>
                      <button type="button" z-button zType="outline" zSize="md" [zDisabled]="resolving() !== null" (click)="resolve(r.id)" data-testid="admin-queue-resolve" i18n>
                        Marcar como resolvido
                      </button>
                    </span>
                  </li>
                }
              </ul>
            }
          </section>
        }

        @if (showLocked()) {
          <section class="flex flex-col gap-3 rounded-2xl bg-card p-5" aria-labelledby="admin-queue-locked-title" data-testid="admin-queue-locked">
            <div>
              <h2 id="admin-queue-locked-title" class="font-display text-[19px] font-semibold text-foreground" i18n>Tags travadas</h2>
              <p class="mt-1 text-sm text-muted-foreground" i18n>Muitas tentativas de PIN erradas. A trava sai sozinha no horário indicado.</p>
            </div>
            @if (q.lockedTags.length === 0) {
              <p class="text-[15px] text-text" data-testid="admin-queue-locked-empty" i18n>Nenhuma tag travada.</p>
            } @else {
              <ul class="m-0 flex list-none flex-col divide-y divide-divider p-0">
                <li class="hidden grid-cols-[1.2fr_1fr_1fr_1.6fr] gap-3 pb-2 text-[13px] font-semibold text-muted-foreground xl:grid" aria-hidden="true">
                  <span i18n>Código</span><span i18n>Situação</span><span i18n>Motivo</span><span i18n>Destrava em</span>
                </li>
                @for (t of q.lockedTags; track t.code) {
                  <li class="flex flex-col gap-1.5 py-3 xl:grid xl:grid-cols-[1.2fr_1fr_1fr_1.6fr] xl:items-center xl:gap-3" data-testid="admin-queue-locked-item">
                    <a class="font-display text-[16px] font-semibold text-link underline-offset-[3px] hover:underline" [routerLink]="['/admin/codigos', t.code]" data-testid="admin-queue-code">{{ t.code }}</a>
                    <span><z-badge zType="outline" i18n>Travada</z-badge></span>
                    <span class="text-sm text-text" i18n>Erros de PIN</span>
                    <span class="text-sm text-text">{{ until(t.lockedUntil) }}</span>
                  </li>
                }
              </ul>
            }
          </section>
        }
      }
    </div>
  `,
})
export class AdminQueuePage {
  private readonly admin = inject(AdminTagService);
  private readonly sonner = inject(ZardSonnerService);

  protected readonly limit = QUEUE_LIMIT;
  protected readonly state = signal<State>('loading');
  protected readonly errorText = signal('');
  protected readonly forbidden = signal(false);
  protected readonly queue = signal<AdminQueue | null>(null);
  protected readonly section = signal<Section>('all');
  protected readonly resolving = signal<string | null>(null);

  protected readonly total = computed(() => {
    const q = this.queue();
    return q === null ? 0 : q.scans.length + q.replacements.length + q.lockedTags.length;
  });
  protected readonly showScans = computed(() => this.section() === 'all' || this.section() === 'scans');
  protected readonly showReplacements = computed(() => this.section() === 'all' || this.section() === 'replacements');
  protected readonly showLocked = computed(() => this.section() === 'all' || this.section() === 'locked');
  protected readonly chips = computed<ZardToggleGroupItem[]>(() => {
    const q = this.queue();
    const n = (count: number | undefined) => (count === undefined ? '' : ` · ${count}`);
    return [
      { value: 'all', label: $localize`Tudo${n(q === null ? undefined : this.total())}:count:` },
      { value: 'scans', label: $localize`Scans sem vínculo${n(q?.scans.length)}:count:` },
      { value: 'replacements', label: $localize`2ª via${n(q?.replacements.length)}:count:` },
      { value: 'locked', label: $localize`Travadas${n(q?.lockedTags.length)}:count:` },
    ];
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const res = await this.admin.scanQueue(QUEUE_LIMIT, 0);
    if (!res.ok) {
      this.forbidden.set(res.error === 'forbidden');
      this.errorText.set(adminErrorMessage(res.error));
      this.state.set('error');
      return;
    }
    this.queue.set(res.queue);
    this.state.set('ready');
  }

  protected onSection(value: string | string[]): void {
    const v = Array.isArray(value) ? value[0] : value;
    this.section.set(v === 'scans' || v === 'replacements' || v === 'locked' ? v : 'all');
  }

  protected badge(scan: AdminQueueScan) {
    return statusBadgeType(scan.statusAtScan);
  }

  protected status(scan: AdminQueueScan): string {
    return statusLabel(scan.statusAtScan);
  }

  protected when(scan: AdminQueueScan): string {
    return formatScanTime(scan.occurredAt);
  }

  protected place(scan: AdminQueueScan): string {
    const place = placeText(scan.city, scan.region);
    const how = scan.geoMethod === 'gps' ? $localize`precisa` : scan.geoMethod === 'ip' ? $localize`aproximada` : null;
    if (place === null) return $localize`Sem localização`;
    return how === null ? place : `${place} · ${how}`;
  }

  protected kind(kind: 'damaged' | 'lost'): string {
    return replacementLabel(kind);
  }

  protected day(iso: string): string {
    return formatShortDay(iso);
  }

  protected until(iso: string): string {
    return formatDayTime(iso);
  }

  protected async resolve(requestId: string): Promise<void> {
    if (this.resolving() !== null) return;
    this.resolving.set(requestId);
    const res = await this.admin.resolveReplacement(requestId, 'done');
    this.resolving.set(null);
    if (!res.ok) {
      this.sonner.error(adminErrorMessage(res.error));
      return;
    }
    this.sonner.success($localize`Pedido marcado como resolvido.`);
    this.queue.update((q) => (q === null ? q : { ...q, replacements: q.replacements.filter((r) => r.id !== requestId) }));
  }
}
