import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { Note } from '@/shared/components/faro/note/note';
import { ZardFieldComponent, ZardFieldLabelComponent } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';

import { AUDIT_PAGE_SIZE, AdminTagService } from '../../../core/admin/admin-tag.service';
import type { AdminAuditRow } from '../../../models';
import { AdminHeading } from '../admin-heading/admin-heading';
import { actorLabel, adminErrorMessage, auditDetailText, auditEventLabel, auditGroups, entityText, formatDayTime } from '../admin-format';

type State = 'loading' | 'ready' | 'error';

/**
 * "Auditoria" (`/admin/auditoria`, T082; referência `V2-admin-auditoria*.dc.html`): lista só de leitura, filtrável por
 * código ou lote (no banco) e por tipo de evento, mais recentes primeiro, com "Carregar mais".
 *
 * O banco filtra por um evento só; os chips agrupam vários eventos. Por isso o chip filtra as linhas já carregadas, e
 * quando nenhuma das carregadas serve a tela oferece "Carregar mais". O "quem" mostra o papel (admin, tutor,
 * visitante, sistema), nunca um identificador de conta, e o detalhe só mostra chaves conhecidas.
 */
@Component({
  selector: 'app-admin-audit',
  imports: [FormsModule, AdminHeading, Note, ZardAlertComponent, ZardButtonComponent, ZardFieldComponent, ZardFieldLabelComponent, ZardInputComponent, ZardToggleGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full flex-col gap-3.5 md:gap-[18px] xl:gap-5" data-testid="admin-audit">
      <app-admin-heading title="Auditoria" i18n-title subtitle="Tudo o que mexe com tags, PINs, vínculos e contas. Só leitura." i18n-subtitle />

      <form class="flex flex-col gap-3 md:max-w-[560px] md:flex-row md:items-end" (submit)="$event.preventDefault(); applyEntity()" role="search" novalidate>
        <div z-field class="md:flex-1">
          <label z-field-label for="admin-audit-entity-input" i18n>Código ou lote</label>
          <input
            z-input
            id="admin-audit-entity-input"
            type="search"
            autocomplete="off"
            placeholder="7K3M-Q9XA-C ou lote-001"
            i18n-placeholder
            [ngModel]="entityInput()"
            (ngModelChange)="entityInput.set($event)"
            name="entity"
            data-testid="admin-audit-entity" />
        </div>
        <button type="submit" z-button zSize="lg" data-testid="admin-audit-entity-submit" i18n>Filtrar</button>
      </form>

      <z-toggle-group
        [zMode]="'single'"
        zAriaLabel="Filtrar por tipo de evento"
        i18n-zAriaLabel
        [zItems]="chips"
        [zValue]="group()"
        (valueChange)="onGroup($event)"
        data-testid="admin-audit-filters" />

      <div aria-live="polite">
        @switch (state()) {
          @case ('loading') {
            <p class="py-6 text-center text-text" role="status" aria-busy="true" data-testid="admin-audit-loading" i18n>Um instante…</p>
          }
          @case ('error') {
            <div class="flex flex-col items-start gap-3" data-testid="admin-audit-error">
              <z-alert class="w-full" zType="danger" [zRole]="'status'" [zDescription]="errorText()" />
              @if (!forbidden()) {
                <button type="button" z-button zType="outline" (click)="reload()" data-testid="admin-audit-retry" i18n>Tentar de novo</button>
              }
            </div>
          }
        }
      </div>

      @if (state() === 'ready') {
        @if (visible().length === 0) {
          <div class="flex flex-col items-start gap-3 rounded-2xl bg-card p-5" data-testid="admin-audit-empty">
            <p class="font-display text-[19px] font-semibold text-foreground" i18n>Nenhum evento encontrado</p>
            @if (more()) {
              <p class="text-[15px] leading-[1.45] text-text" i18n>Nenhum dos eventos já carregados é deste tipo. Carregue mais eventos ou volte para todos.</p>
              <button type="button" z-button zType="outline" [zDisabled]="loadingMore()" (click)="loadMore()" data-testid="admin-audit-empty-more" i18n>Carregar mais</button>
            } @else {
              <p class="text-[15px] leading-[1.45] text-text" i18n>Confira o código ou o tipo de evento, ou volte para todos.</p>
              <button type="button" z-button zType="outline" (click)="clearFilters()" data-testid="admin-audit-clear" i18n>Ver todos os eventos</button>
            }
          </div>
        } @else {
          <ul class="m-0 flex list-none flex-col gap-3 p-0 xl:gap-0 xl:divide-y xl:divide-divider xl:overflow-hidden xl:rounded-2xl xl:bg-card xl:px-5 xl:py-1.5" data-testid="admin-audit-list">
            <li class="hidden grid-cols-[1fr_1.6fr_1.2fr_1fr_1.6fr] gap-3 py-3 text-[13px] font-semibold text-muted-foreground xl:grid" aria-hidden="true">
              <span i18n>Quando</span><span i18n>Evento</span><span i18n>Código ou lote</span><span i18n>Quem</span><span i18n>Detalhe</span>
            </li>
            @for (row of visible(); track row.id) {
              <li
                class="flex flex-col gap-1 rounded-2xl bg-card p-4 xl:grid xl:grid-cols-[1fr_1.6fr_1.2fr_1fr_1.6fr] xl:items-center xl:gap-3 xl:rounded-none xl:bg-transparent xl:px-0 xl:py-3"
                data-testid="admin-audit-row">
                <span class="text-[13px] text-muted-foreground xl:text-sm xl:text-text">{{ when(row) }}</span>
                <span class="flex flex-col">
                  <span class="text-[15px] font-semibold text-foreground" data-testid="admin-audit-event">{{ label(row) }}</span>
                  <span class="text-[13px] text-muted-foreground">{{ row.event }}</span>
                </span>
                <span class="text-sm text-text">{{ entity(row) }}</span>
                <span class="text-sm text-text">{{ actor(row) }}</span>
                <span class="text-sm text-text">{{ detail(row) }}</span>
              </li>
            }
          </ul>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="text-sm text-muted-foreground" data-testid="admin-audit-count">{{ countText() }}</span>
            @if (more()) {
              <button type="button" z-button zType="outline" zSize="md" [zDisabled]="loadingMore()" (click)="loadMore()" data-testid="admin-audit-more" i18n>Carregar mais</button>
            }
          </div>
          @if (moreProblem(); as text) {
            <z-alert class="w-full" zType="danger" [zRole]="'status'" [zDescription]="text" data-testid="admin-audit-more-error" />
          }
        }
        <app-note icon="lock" data-testid="admin-audit-note">
          <span i18n>A auditoria nunca guarda PIN, número de telefone nem endereço IP.</span>
        </app-note>
      }
    </div>
  `,
})
export class AdminAuditPage {
  private readonly admin = inject(AdminTagService);
  private readonly groups = auditGroups();

  protected readonly chips: ZardToggleGroupItem[] = [{ value: 'all', label: $localize`Todos` }, ...this.groups.map((g) => ({ value: g.id, label: g.label }))];

  protected readonly state = signal<State>('loading');
  protected readonly errorText = signal('');
  protected readonly forbidden = signal(false);
  protected readonly rows = signal<AdminAuditRow[]>([]);
  protected readonly more = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly moreProblem = signal<string | null>(null);
  protected readonly group = signal('all');
  /** O que o admin digitou; só vira filtro ao enviar. */
  protected readonly entityInput = signal('');
  private readonly entityFilter = signal('');
  private loadId = 0;

  protected readonly visible = computed(() => {
    const group = this.groups.find((g) => g.id === this.group());
    const rows = this.rows();
    return group === undefined ? rows : rows.filter((r) => group.events.includes(r.event));
  });
  protected readonly countText = computed(() => {
    const n = this.visible().length;
    return n === 1 ? $localize`Mostrando 1 evento` : $localize`Mostrando ${n}:count: eventos`;
  });

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    this.moreProblem.set(null);
    const res = await this.admin.audit({ entityId: this.entityFilter(), limit: AUDIT_PAGE_SIZE, offset: 0 });
    if (id !== this.loadId) return;
    if (!res.ok) {
      this.forbidden.set(res.error === 'forbidden');
      this.errorText.set(adminErrorMessage(res.error));
      this.state.set('error');
      return;
    }
    this.rows.set(res.rows);
    this.more.set(res.rows.length >= AUDIT_PAGE_SIZE);
    this.state.set('ready');
  }

  protected async loadMore(): Promise<void> {
    if (this.loadingMore()) return;
    const id = this.loadId;
    this.loadingMore.set(true);
    this.moreProblem.set(null);
    const res = await this.admin.audit({ entityId: this.entityFilter(), limit: AUDIT_PAGE_SIZE, offset: this.rows().length });
    this.loadingMore.set(false);
    if (id !== this.loadId) return;
    if (!res.ok) {
      this.moreProblem.set(adminErrorMessage(res.error));
      return;
    }
    this.rows.update((rows) => [...rows, ...res.rows]);
    this.more.set(res.rows.length >= AUDIT_PAGE_SIZE);
  }

  protected applyEntity(): void {
    this.entityFilter.set(this.entityInput().trim());
    void this.reload();
  }

  protected onGroup(value: string | string[]): void {
    this.group.set((Array.isArray(value) ? value[0] : value) || 'all');
  }

  protected clearFilters(): void {
    this.entityInput.set('');
    this.entityFilter.set('');
    this.group.set('all');
    void this.reload();
  }

  protected when(row: AdminAuditRow): string {
    return formatDayTime(row.at);
  }

  protected label(row: AdminAuditRow): string {
    return auditEventLabel(row.event);
  }

  protected entity(row: AdminAuditRow): string {
    return entityText(row.entityId);
  }

  protected actor(row: AdminAuditRow): string {
    return actorLabel(row.actorRole);
  }

  protected detail(row: AdminAuditRow): string {
    return auditDetailText(row.detail);
  }
}
