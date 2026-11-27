import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCheckboxComponent } from '@/shared/components/checkbox';
import { Note } from '@/shared/components/faro/note/note';
import { ZardFieldComponent, ZardFieldLabelComponent } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';

import { AdminTagService, CODES_PAGE_SIZE } from '../../../core/admin/admin-tag.service';
import type { AdminBatch, AdminCodeRow, AdminCodeStatus } from '../../../models';
import { AdminHeading } from '../admin-heading/admin-heading';
import { adminErrorMessage, LABELS_AVAILABLE, statusBadgeType, statusLabel } from '../admin-format';
import { formatScanTime } from '../../scans/scan-format';

type State = 'loading' | 'ready' | 'error';

/**
 * "Códigos" (`/admin/codigos`, T079; referência `V2-admin-codigos*.dc.html`): busca (código, pet, tutor), filtros por
 * situação e lote, lista com seleção e paginação (cartões até o tablet, tabela no desktop) e "Reimprimir seleção".
 *
 * "Reimprimir seleção" depende da geração de etiquetas (`admin-labels`, T084, bloqueada): enquanto `LABELS_AVAILABLE`
 * for falso o botão fica desativado e a tela explica por quê. A seleção continua funcionando (conta e limpa).
 */
@Component({
  selector: 'app-admin-codes',
  imports: [
    FormsModule,
    RouterLink,
    NgIcon,
    AdminHeading,
    Note,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCheckboxComponent,
    ZardFieldComponent,
    ZardFieldLabelComponent,
    ZardInputComponent,
    ZardToggleGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full flex-col gap-3.5 md:gap-[18px] xl:gap-5" data-testid="admin-codes">
      <app-admin-heading title="Códigos" i18n-title [subtitle]="subtitle()">
        <button
          action
          type="button"
          z-button
          zType="outline"
          zSize="lg"
          [zDisabled]="!labelsAvailable || selectedCount() === 0"
          data-testid="admin-codes-reprint"
          i18n>
          <ng-icon name="print" size="20" aria-hidden="true" />
          Reimprimir seleção{{ selectedCount() > 0 ? ' (' + selectedCount() + ')' : '' }}
        </button>
      </app-admin-heading>

      @if (!labelsAvailable) {
        <app-note icon="info" data-testid="admin-codes-reprint-note">
          <span i18n>A reimpressão chega com a geração das etiquetas. Por enquanto, reimprima pelo script local.</span>
        </app-note>
      }

      <form class="flex flex-col gap-3 md:flex-row md:items-end" (submit)="$event.preventDefault(); applySearch()" role="search" novalidate>
        <div z-field class="md:flex-1">
          <label z-field-label for="admin-codes-search-input" i18n>Buscar</label>
          <input
            z-input
            id="admin-codes-search-input"
            type="search"
            autocomplete="off"
            placeholder="Código, pet ou tutor"
            i18n-placeholder
            [ngModel]="searchText()"
            (ngModelChange)="searchText.set($event)"
            name="search"
            data-testid="admin-codes-search" />
        </div>
        @if (batches().length > 0) {
          <div z-field class="md:w-[220px]">
            <label z-field-label for="admin-codes-batch-select" i18n>Lote</label>
            <select
              id="admin-codes-batch-select"
              class="h-[54px] w-full rounded-md border-[1.5px] border-input bg-card px-4 text-base text-foreground"
              [ngModel]="batch() ?? ''"
              (ngModelChange)="onBatch($event)"
              name="batch"
              data-testid="admin-codes-batch">
              <option value="" i18n>Todos os lotes</option>
              @for (b of batches(); track b.id) {
                <option [value]="b.id">{{ b.id }}</option>
              }
            </select>
          </div>
        }
        <button type="submit" z-button zSize="lg" data-testid="admin-codes-search-submit" i18n>Buscar</button>
      </form>

      <z-toggle-group
        [zMode]="'single'"
        zAriaLabel="Filtrar por situação"
        i18n-zAriaLabel
        [zItems]="statusItems"
        [zValue]="statusValue()"
        (valueChange)="onStatus($event)"
        data-testid="admin-codes-filters" />

      <div aria-live="polite">
        @switch (state()) {
          @case ('loading') {
            <p class="py-6 text-center text-text" role="status" aria-busy="true" data-testid="admin-codes-loading" i18n>Um instante…</p>
          }
          @case ('error') {
            <div class="flex flex-col items-start gap-3" data-testid="admin-codes-error">
              <z-alert class="w-full" zType="danger" [zRole]="'status'" [zDescription]="errorText()" />
              @if (!forbidden()) {
                <button type="button" z-button zType="outline" (click)="load()" data-testid="admin-codes-retry" i18n>Tentar de novo</button>
              }
            </div>
          }
        }
      </div>

      @if (state() === 'ready') {
        @if (rows().length === 0) {
          <div class="flex flex-col items-start gap-3 rounded-2xl bg-card p-5" data-testid="admin-codes-empty">
            <p class="font-display text-[19px] font-semibold text-foreground" i18n>Nenhum código encontrado</p>
            <p class="text-[15px] leading-[1.45] text-text" i18n>Confira a busca e os filtros, ou volte para a lista completa.</p>
            <button type="button" z-button zType="outline" (click)="clearFilters()" data-testid="admin-codes-clear" i18n>Limpar busca e filtros</button>
          </div>
        } @else {
          <!-- Celular e tablet: cartões -->
          <ul class="m-0 flex list-none flex-col gap-3 p-0 xl:hidden" data-testid="admin-codes-cards">
            @for (row of rows(); track row.code) {
              <li class="flex items-start gap-1 rounded-2xl bg-card py-2 pr-4 pl-2" data-testid="admin-code-card">
                <z-checkbox [ngModel]="isSelected(row.code)" (ngModelChange)="toggle(row.code, $event)" [attr.data-testid]="'admin-code-select'">
                  <span class="sr-only" i18n>Selecionar {{ row.code }}</span>
                </z-checkbox>
                <a class="flex min-w-0 flex-1 flex-col gap-1.5 py-2 text-foreground" [routerLink]="['/admin/codigos', row.code]" data-testid="admin-code-link">
                  <span class="flex items-center justify-between gap-3">
                    <span class="font-display text-[18px] font-semibold">{{ row.code }}</span>
                    <z-badge [zType]="badge(row)">{{ status(row) }}</z-badge>
                  </span>
                  <span class="text-sm text-text">{{ owner(row) }}</span>
                  <span class="text-[13px] text-muted-foreground">{{ lastScan(row) }}</span>
                </a>
              </li>
            }
          </ul>

          <!-- Desktop: tabela -->
          <div class="hidden rounded-2xl bg-card px-5 py-1.5 xl:block" data-testid="admin-codes-table">
            <table class="w-full border-collapse text-left text-sm">
              <caption class="sr-only" i18n>Códigos de tags</caption>
              <thead>
                <tr class="border-b border-divider text-[13px] font-semibold text-muted-foreground">
                  <th scope="col" class="h-11 w-12 pr-2"><span class="sr-only" i18n>Seleção</span></th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Código</th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Lote</th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Situação</th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Pet e tutor</th>
                  <th scope="col" class="h-11 font-semibold" i18n>Último scan</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.code) {
                  <tr class="border-b border-divider last:border-b-0" data-testid="admin-code-row">
                    <td class="pr-2">
                      <z-checkbox [ngModel]="isSelected(row.code)" (ngModelChange)="toggle(row.code, $event)" [attr.data-testid]="'admin-code-select'">
                        <span class="sr-only" i18n>Selecionar {{ row.code }}</span>
                      </z-checkbox>
                    </td>
                    <th scope="row" class="h-14 pr-3 font-display text-[15px] font-semibold">
                      <a class="text-link underline-offset-[3px] hover:underline" [routerLink]="['/admin/codigos', row.code]" data-testid="admin-code-link">{{ row.code }}</a>
                    </th>
                    <td class="pr-3 text-text">{{ row.batchId }}</td>
                    <td class="pr-3"><z-badge [zType]="badge(row)">{{ status(row) }}</z-badge></td>
                    <td class="pr-3 text-text">{{ owner(row) }}</td>
                    <td class="text-text">{{ lastScan(row) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <nav class="flex flex-wrap items-center justify-between gap-3" aria-label="Paginação" i18n-aria-label data-testid="admin-codes-pager">
            <span class="text-sm text-muted-foreground" data-testid="admin-codes-range">{{ rangeText() }}</span>
            <span class="flex gap-2">
              <button type="button" z-button zType="outline" zSize="md" [zDisabled]="offset() === 0" (click)="goTo(offset() - pageSize)" data-testid="admin-codes-prev" i18n>
                Anterior
              </button>
              <button type="button" z-button zType="outline" zSize="md" [zDisabled]="!hasNext()" (click)="goTo(offset() + pageSize)" data-testid="admin-codes-next" i18n>
                Próxima
              </button>
            </span>
          </nav>
          @if (selectedCount() > 0) {
            <p class="text-sm text-muted-foreground" data-testid="admin-codes-selected">
              <span i18n>{{ selectedCount() }} selecionados.</span>&ngsp;
              <button type="button" class="font-medium text-link underline underline-offset-[3px]" (click)="clearSelection()" data-testid="admin-codes-selection-clear" i18n>
                Limpar seleção
              </button>
            </p>
          }
        }
      }
    </div>
  `,
})
export class AdminCodes {
  private readonly admin = inject(AdminTagService);

  protected readonly pageSize = CODES_PAGE_SIZE;
  protected readonly labelsAvailable = LABELS_AVAILABLE;

  protected readonly statusItems: ZardToggleGroupItem[] = [
    { value: 'all', label: $localize`Todos` },
    { value: 'available', label: $localize`Disponíveis` },
    { value: 'assigned', label: $localize`Ativos` },
    { value: 'blocked', label: $localize`Bloqueados` },
    { value: 'void', label: $localize`Anulados` },
  ];

  protected readonly state = signal<State>('loading');
  protected readonly errorText = signal('');
  protected readonly forbidden = signal(false);
  protected readonly rows = signal<AdminCodeRow[]>([]);
  protected readonly total = signal(0);
  protected readonly batches = signal<AdminBatch[]>([]);

  /** O que o admin digitou; só vira busca ao enviar (Enter ou "Buscar"). */
  protected readonly searchText = signal('');
  private readonly search = signal('');
  protected readonly batch = signal<string | null>(null);
  protected readonly offset = signal(0);
  private readonly selectedSet = signal<ReadonlySet<string>>(new Set());
  private loadId = 0;

  protected readonly statusFilter = signal<AdminCodeStatus | null>(null);
  protected readonly statusValue = computed(() => this.statusFilter() ?? 'all');
  protected readonly selectedCount = computed(() => this.selectedSet().size);
  protected readonly hasNext = computed(() => this.offset() + this.pageSize < this.total());
  protected readonly subtitle = computed(() => {
    const total = this.total();
    if (this.state() !== 'ready') return '';
    return total === 1 ? $localize`1 código.` : $localize`${total}:count: códigos.`;
  });
  protected readonly rangeText = computed(() => {
    const total = this.total();
    const from = this.offset() + 1;
    const to = Math.min(this.offset() + this.pageSize, total);
    return $localize`${from}:from:–${to}:to: de ${total}:total:`;
  });

  constructor() {
    void this.load();
    void this.loadBatches();
  }

  protected async load(): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    const res = await this.admin.listCodes({
      search: this.search(),
      status: this.statusFilter(),
      batch: this.batch(),
      limit: this.pageSize,
      offset: this.offset(),
    });
    if (id !== this.loadId) return;
    if (!res.ok) {
      this.forbidden.set(res.error === 'forbidden');
      this.errorText.set(adminErrorMessage(res.error));
      this.state.set('error');
      return;
    }
    this.rows.set(res.page.rows);
    this.total.set(res.page.total);
    this.state.set('ready');
  }

  /** As opções do filtro de lote; sem elas a tela segue sem o filtro. */
  private async loadBatches(): Promise<void> {
    const res = await this.admin.listBatches();
    if (res.ok) this.batches.set(res.batches);
  }

  protected applySearch(): void {
    this.search.set(this.searchText().trim());
    this.restart();
  }

  protected onStatus(value: string | string[]): void {
    const v = Array.isArray(value) ? (value[0] ?? 'all') : value;
    this.statusFilter.set(v === 'available' || v === 'assigned' || v === 'blocked' || v === 'void' ? v : null);
    this.restart();
  }

  protected onBatch(value: string): void {
    this.batch.set(value === '' ? null : value);
    this.restart();
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.search.set('');
    this.statusFilter.set(null);
    this.batch.set(null);
    this.restart();
  }

  private restart(): void {
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(offset, 0));
    void this.load();
  }

  protected isSelected(code: string): boolean {
    return this.selectedSet().has(code);
  }

  protected toggle(code: string, on: boolean): void {
    const next = new Set(this.selectedSet());
    if (on) next.add(code);
    else next.delete(code);
    this.selectedSet.set(next);
  }

  protected clearSelection(): void {
    this.selectedSet.set(new Set());
  }

  protected status(row: AdminCodeRow): string {
    return statusLabel(row.status);
  }

  protected badge(row: AdminCodeRow) {
    return statusBadgeType(row.status);
  }

  protected owner(row: AdminCodeRow): string {
    return row.petName === null && row.tutor === null ? $localize`Sem vínculo` : [row.petName, row.tutor].filter((v) => v !== null).join(' · ');
  }

  protected lastScan(row: AdminCodeRow): string {
    return row.lastScanAt === null ? $localize`Nunca escaneada` : $localize`Último scan: ${formatScanTime(row.lastScanAt)}:when:`;
  }
}

