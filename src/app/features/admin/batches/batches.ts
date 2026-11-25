import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { StatTile } from '@/shared/components/faro/stat-tile/stat-tile';
import { ZardFieldComponent, ZardFieldDescriptionComponent, ZardFieldErrorComponent, ZardFieldLabelComponent } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSonnerService } from '@/shared/components/sonner';

import { AdminTagService, BATCH_MAX, BATCH_MIN, BATCH_NOTES_MAX } from '../../../core/admin/admin-tag.service';
import { FileSaver } from '../../../core/admin/save-file';
import type { AdminBatch, AdminCounters } from '../../../models';
import { AdminHeading } from '../admin-heading/admin-heading';
import { adminErrorMessage, formatDay } from '../admin-format';

type State = 'loading' | 'ready' | 'error';
/** `form` e `confirm` são os dois passos antes de gerar; `done` mostra o fim; `failed` fica no passo do erro. */
type Panel = 'closed' | 'form' | 'confirm' | 'working' | 'done';

/**
 * "Lotes" (`/admin`, T078; referência `V2-admin-lotes*.dc.html`): contadores, lista de lotes (cartões até o tablet,
 * tabela no desktop), o aviso do pacote e "Criar lote": formulário, confirmação e download do pacote.
 *
 * O pacote (zip com `pins.csv`) tem PINs em claro e o servidor entrega uma vez só. Ele é salvo no instante em que
 * chega e solto: o componente não guarda o `Blob`, não o põe em signal e não o manda para URL ou storage. O que fica
 * na tela é só o id do lote criado.
 */
@Component({
  selector: 'app-admin-batches',
  imports: [
    NgIcon,
    AdminHeading,
    StatTile,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardFieldComponent,
    ZardFieldDescriptionComponent,
    ZardFieldErrorComponent,
    ZardFieldLabelComponent,
    ZardInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full flex-col gap-3.5 md:gap-[18px] xl:gap-5" data-testid="admin-batches">
      <app-admin-heading
        title="Lotes de tags"
        i18n-title
        subtitle="Cada lote gera os códigos e os PINs dos cartões."
        i18n-subtitle>
        <button
          action
          type="button"
          z-button
          zSize="lg"
          [zDisabled]="panel() !== 'closed' || state() !== 'ready'"
          (click)="openForm()"
          data-testid="admin-batches-create"
          i18n>
          Criar lote
        </button>
      </app-admin-heading>

      <div aria-live="polite">
        @switch (state()) {
          @case ('loading') {
            <p class="py-6 text-center text-text" role="status" aria-busy="true" data-testid="admin-batches-loading" i18n>Um instante…</p>
          }
          @case ('error') {
            <div class="flex flex-col items-start gap-3" data-testid="admin-batches-error">
              <z-alert class="w-full" zType="danger" [zRole]="'status'" [zDescription]="errorText()" />
              @if (!forbidden()) {
                <button type="button" z-button zType="outline" (click)="load()" data-testid="admin-batches-retry" i18n>Tentar de novo</button>
              }
            </div>
          }
        }
      </div>

      @if (state() === 'ready') {
        @if (counters(); as c) {
          <div class="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5 xl:gap-5" data-testid="admin-batches-counters">
            <app-stat-tile label="Códigos gerados" i18n-label [value]="'' + c.generated" [caption]="batchesCaption()" />
            <app-stat-tile label="Disponíveis" i18n-label [value]="'' + c.available" caption="prontos para venda" i18n-caption />
            <app-stat-tile label="Ativos" i18n-label [value]="'' + c.active" caption="vinculados a pets" i18n-caption />
            <app-stat-tile label="Bloqueados" i18n-label [value]="'' + c.blocked" caption="a página mostra “tag não encontrada”" i18n-caption />
            <app-stat-tile label="Anulados" i18n-label [value]="'' + c.void" caption="2ª via por perda" i18n-caption />
          </div>
        }

        @if (panel() !== 'closed') {
          <section class="flex flex-col gap-4 rounded-2xl bg-card p-5 md:p-6" aria-labelledby="admin-batches-panel-title" data-testid="admin-batches-panel">
            @switch (panel()) {
              @case ('form') {
                <h2 id="admin-batches-panel-title" class="font-display text-[22px] font-semibold text-foreground" i18n>Criar lote</h2>
                <form class="flex flex-col gap-4 md:max-w-[560px]" (submit)="$event.preventDefault(); toConfirm()" novalidate>
                  <div z-field>
                    <label z-field-label for="admin-batches-quantity-input" i18n>Quantidade de tags</label>
                    <input
                      z-input
                      id="admin-batches-quantity-input"
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      [value]="quantityText()"
                      (input)="onQuantity($event)"
                      [attr.aria-invalid]="quantityInvalid() ? 'true' : null"
                      aria-describedby="admin-batches-quantity-help"
                      data-testid="admin-batches-quantity" />
                    @if (quantityInvalid()) {
                      <z-field-error id="admin-batches-quantity-help" data-testid="admin-batches-quantity-error" i18n>
                        Informe um número inteiro de {{ min }} a {{ max }}.
                      </z-field-error>
                    } @else {
                      <z-field-description id="admin-batches-quantity-help" i18n>
                        De {{ min }} a {{ max }}. Um lote de 54 leva cerca de 10 segundos; lotes grandes levam bem mais.
                      </z-field-description>
                    }
                  </div>
                  <div z-field>
                    <label z-field-label for="admin-batches-notes-input" i18n>Observação (opcional)</label>
                    <input
                      z-input
                      id="admin-batches-notes-input"
                      type="text"
                      autocomplete="off"
                      [attr.maxlength]="notesMax"
                      [value]="notes()"
                      (input)="onNotes($event)"
                      data-testid="admin-batches-notes" />
                  </div>
                  <div class="flex flex-wrap gap-3">
                    <button type="submit" z-button zSize="lg" [zDisabled]="quantityInvalid()" data-testid="admin-batches-continue" i18n>Continuar</button>
                    <button type="button" z-button zType="outline" zSize="lg" (click)="closePanel()" data-testid="admin-batches-cancel" i18n>Cancelar</button>
                  </div>
                </form>
              }
              @case ('confirm') {
                <h2 id="admin-batches-panel-title" class="font-display text-[22px] font-semibold text-foreground" i18n>Gerar {{ quantity() }} códigos?</h2>
                <p class="max-w-[640px] text-[15px] leading-[1.45] text-text" i18n>
                  O arquivo com os PINs dos cartões baixa agora e aparece uma vez só. Não dá para baixar de novo: guarde-o até imprimir os cartões.
                </p>
                @if (problem(); as text) {
                  <z-alert class="w-full" zType="danger" [zRole]="'status'" [zDescription]="text" data-testid="admin-batches-problem" />
                }
                <div class="flex flex-wrap gap-3">
                  <button type="button" z-button zSize="lg" (click)="generate()" data-testid="admin-batches-generate" i18n>Gerar lote e baixar</button>
                  <button type="button" z-button zType="outline" zSize="lg" (click)="backToForm()" data-testid="admin-batches-back" i18n>Voltar</button>
                </div>
              }
              @case ('working') {
                <h2 id="admin-batches-panel-title" class="font-display text-[22px] font-semibold text-foreground" i18n>Gerando os códigos…</h2>
                <p class="text-[15px] leading-[1.45] text-text" role="status" aria-busy="true" data-testid="admin-batches-working" i18n>
                  Não feche esta página. O arquivo baixa sozinho quando terminar.
                </p>
              }
              @case ('done') {
                <h2 id="admin-batches-panel-title" class="font-display text-[22px] font-semibold text-foreground">{{ doneTitle() }}</h2>
                <p class="max-w-[640px] text-[15px] leading-[1.45] text-text" role="status" data-testid="admin-batches-done">{{ doneText() }}</p>
                <div>
                  <button type="button" z-button zType="outline" zSize="lg" (click)="closePanel()" data-testid="admin-batches-done-close" i18n>Concluir</button>
                </div>
              }
            }
          </section>
        }

        @if (batches().length === 0) {
          <div class="flex flex-col items-start gap-3 rounded-2xl bg-card p-5" data-testid="admin-batches-empty">
            <p class="font-display text-[19px] font-semibold text-foreground" i18n>Nenhum lote criado ainda</p>
            <p class="text-[15px] leading-[1.45] text-text" i18n>Crie o primeiro lote para gerar os códigos e os PINs dos cartões.</p>
            <button type="button" z-button zType="outline" [zDisabled]="panel() !== 'closed'" (click)="openForm()" data-testid="admin-batches-empty-create" i18n>Criar lote</button>
          </div>
        } @else {
          <!-- Celular e tablet: um cartão por lote -->
          <ul class="m-0 flex list-none flex-col gap-3 p-0 xl:hidden" data-testid="admin-batches-cards">
            @for (batch of batches(); track batch.id) {
              <li class="flex flex-col gap-2 rounded-2xl bg-card p-4" data-testid="admin-batch-card">
                <div class="flex items-center justify-between gap-3">
                  <span class="font-display text-[19px] font-semibold text-foreground">{{ batch.id }}</span>
                  <z-badge [zType]="batch.packageDownloadedAt ? 'success' : 'neutral'">{{ packageText(batch) }}</z-badge>
                </div>
                <p class="text-sm text-text">{{ batchLine(batch) }}</p>
                @if (batch.notes) {
                  <p class="text-sm text-muted-foreground">{{ batch.notes }}</p>
                }
                <div>
                  <button type="button" z-button zType="outline" zSize="sm" [zDisabled]="exporting() === batch.id" (click)="exportCodes(batch)" data-testid="admin-batch-export" i18n>
                    Exportar códigos
                  </button>
                </div>
              </li>
            }
          </ul>

          <!-- Desktop: tabela -->
          <div class="hidden rounded-2xl bg-card px-5 py-1.5 xl:block" data-testid="admin-batches-table">
            <table class="w-full border-collapse text-left text-sm">
              <caption class="sr-only" i18n>Lotes de tags</caption>
              <thead>
                <tr class="border-b border-divider text-[13px] font-semibold text-muted-foreground">
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Lote</th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Criado em</th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Qtd.</th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Ativos</th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Pacote</th>
                  <th scope="col" class="h-11 pr-3 font-semibold" i18n>Observação</th>
                  <th scope="col" class="h-11 text-right font-semibold"><span class="sr-only" i18n>Ações</span></th>
                </tr>
              </thead>
              <tbody>
                @for (batch of batches(); track batch.id) {
                  <tr class="border-b border-divider last:border-b-0" data-testid="admin-batch-row">
                    <th scope="row" class="h-14 pr-3 font-display text-[15px] font-semibold text-foreground">{{ batch.id }}</th>
                    <td class="pr-3 text-text">{{ day(batch) }}</td>
                    <td class="pr-3 text-text">{{ batch.quantity }}</td>
                    <td class="pr-3 text-text">{{ batch.counts.assigned }}</td>
                    <td class="pr-3"><z-badge [zType]="batch.packageDownloadedAt ? 'success' : 'neutral'">{{ packageText(batch) }}</z-badge></td>
                    <td class="pr-3 text-text">{{ batch.notes ?? '—' }}</td>
                    <td class="text-right">
                      <button type="button" z-button zType="outline" zSize="sm" [zDisabled]="exporting() === batch.id" (click)="exportCodes(batch)" data-testid="admin-batch-export" i18n>
                        Exportar códigos
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <div class="flex items-start gap-3 rounded-2xl bg-card px-4 py-3.5" data-testid="admin-batches-notice">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-foreground">
            <ng-icon name="lock" size="20" aria-hidden="true" />
          </span>
          <div class="flex min-w-0 flex-col gap-0.5">
            <p class="text-[15px] font-semibold text-foreground" i18n>O pacote de um lote aparece uma vez só</p>
            <p class="text-[13px] leading-[1.45] text-muted-foreground" i18n>
              O arquivo traz os PINs dos cartões e só existe no download original. Guarde-o até imprimir os cartões. O PDF das etiquetas ainda não é
              gerado aqui: use o script local de etiquetas. “Exportar códigos” baixa só os códigos, sem PINs.
            </p>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminBatches {
  private readonly admin = inject(AdminTagService);
  private readonly sonner = inject(ZardSonnerService);
  private readonly files = inject(FileSaver);

  protected readonly min = BATCH_MIN;
  protected readonly max = BATCH_MAX;
  protected readonly notesMax = BATCH_NOTES_MAX;

  protected readonly state = signal<State>('loading');
  protected readonly counters = signal<AdminCounters | null>(null);
  protected readonly batches = signal<AdminBatch[]>([]);
  protected readonly errorText = signal('');
  protected readonly forbidden = signal(false);

  protected readonly panel = signal<Panel>('closed');
  protected readonly quantityText = signal('54');
  protected readonly notes = signal('');
  protected readonly problem = signal<string | null>(null);
  /** Id do lote recém-criado (não é segredo). */
  protected readonly doneBatch = signal('');
  protected readonly exporting = signal<string | null>(null);

  protected readonly quantity = computed(() => Number(this.quantityText().trim()));
  protected readonly quantityInvalid = computed(() => {
    const text = this.quantityText().trim();
    const n = Number(text);
    return !/^\d{1,3}$/.test(text) || !Number.isInteger(n) || n < BATCH_MIN || n > BATCH_MAX;
  });
  protected readonly doneTitle = computed(() => (this.doneBatch() === '' ? $localize`Lote criado` : $localize`${this.doneBatch()}:batch: criado`));
  protected readonly doneText = computed(() => {
    const file = this.doneBatch() === '' ? $localize`O arquivo com os PINs` : $localize`O arquivo ${this.doneBatch()}:batch:.zip`;
    return $localize`${file}:file: foi baixado e tem os PINs dos cartões. Confira a pasta de downloads agora: ele não aparece de novo. Se não encontrar, reemita o PIN de cada código na tela do código.`;
  });
  protected readonly batchesCaption = computed(() => {
    const n = this.batches().length;
    return n === 1 ? $localize`1 lote` : $localize`${n}:count: lotes`;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const [counters, batches] = await Promise.all([this.admin.counters(), this.admin.listBatches()]);
    if (!counters.ok || !batches.ok) {
      const error = !counters.ok ? counters.error : !batches.ok ? batches.error : 'network';
      this.forbidden.set(error === 'forbidden');
      this.errorText.set(adminErrorMessage(error));
      this.state.set('error');
      return;
    }
    this.counters.set(counters.counters);
    this.batches.set(batches.batches);
    this.state.set('ready');
  }

  protected day(batch: AdminBatch): string {
    return formatDay(batch.createdAt);
  }

  protected packageText(batch: AdminBatch): string {
    return batch.packageDownloadedAt === null ? $localize`Não baixado` : $localize`Baixado`;
  }

  protected batchLine(batch: AdminBatch): string {
    return $localize`${formatDay(batch.createdAt)}:date: · ${batch.quantity}:count: códigos · ${batch.counts.assigned}:active: ativos`;
  }

  protected openForm(): void {
    this.problem.set(null);
    this.panel.set('form');
  }

  protected closePanel(): void {
    this.problem.set(null);
    this.panel.set('closed');
  }

  protected backToForm(): void {
    this.problem.set(null);
    this.panel.set('form');
  }

  protected onQuantity(event: Event): void {
    this.quantityText.set((event.target as HTMLInputElement).value);
  }

  protected onNotes(event: Event): void {
    this.notes.set((event.target as HTMLInputElement).value);
  }

  protected toConfirm(): void {
    if (this.quantityInvalid()) return;
    this.problem.set(null);
    this.panel.set('confirm');
  }

  protected async generate(): Promise<void> {
    if (this.panel() !== 'confirm' || this.quantityInvalid()) return;
    this.problem.set(null);
    this.panel.set('working');
    const result = await this.admin.createBatch(this.quantity(), this.notes());
    if (!result.ok) {
      this.panel.set('confirm');
      this.problem.set(
        result.error === 'network'
          ? $localize`Não recebemos a resposta. O lote pode ter sido criado sem o arquivo: confira a lista de lotes e, se houver um lote sem arquivo, reemita o PIN de cada código na tela do código.`
          : adminErrorMessage(result.error),
      );
      if (result.error === 'network') void this.refreshLists();
      return;
    }
    // Salva na hora; depois disto `result` (e o Blob dentro dele) não é mais lido nem guardado.
    this.files.save(result.blob, `${result.batchId ?? 'lote-novo'}.zip`);
    this.doneBatch.set(result.batchId ?? '');
    this.panel.set('done');
    void this.refreshLists();
  }

  /** Atualiza contadores e lista sem trocar a tela por "carregando" (o painel de fim continua visível). */
  private async refreshLists(): Promise<void> {
    const [counters, batches] = await Promise.all([this.admin.counters(), this.admin.listBatches()]);
    if (counters.ok) this.counters.set(counters.counters);
    if (batches.ok) this.batches.set(batches.batches);
  }

  protected async exportCodes(batch: AdminBatch): Promise<void> {
    if (this.exporting() !== null) return;
    this.exporting.set(batch.id);
    const result = await this.admin.exportCodes(batch.id);
    this.exporting.set(null);
    if (!result.ok) {
      this.sonner.error(adminErrorMessage(result.error));
      return;
    }
    this.files.save(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }), `${batch.id}-codigos.csv`);
    this.sonner.success($localize`Códigos de ${batch.id}:batch: exportados, sem PINs.`);
  }
}
