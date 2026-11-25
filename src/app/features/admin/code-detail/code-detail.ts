import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardAlertDialogImports } from '@/shared/components/alert-dialog';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { Note } from '@/shared/components/faro/note/note';
import { ZardSonnerService } from '@/shared/components/sonner';
import { ZardToggleGroupComponent, type ZardToggleGroupItem } from '@/shared/components/toggle-group';

import { AdminTagService } from '../../../core/admin/admin-tag.service';
import type { AdminCodeDetail, AdminEndReason, AssignmentEndReason, TagStatus } from '../../../models';
import { formatScanTime } from '../../scans/scan-format';
import {
  adminErrorMessage,
  formatDay,
  formatDayTime,
  geoText,
  LABELS_AVAILABLE,
  placeText,
  replacementLabel,
  statusBadgeType,
  statusLabel,
} from '../admin-format';
import { AdminPinReveal } from '../pin-reveal/pin-reveal';

type State = 'loading' | 'ready' | 'error' | 'missing';
type ActionKind = 'block' | 'unblock' | 'reissue' | 'end' | 'swap' | 'void';

/** Quantos scans aparecem antes de "Mostrar todos". */
const SCANS_SHOWN = 10;

/**
 * "Detalhe do código" (`/admin/codigos/:code`, T080; referência `V2-admin-codigo*.dc.html`): vínculo atual, PIN
 * (só o estado, nunca o valor), scans, histórico, pedidos de 2ª via e as ações com confirmação.
 *
 * PIN novo: `reissue` e `end` devolvem o PIN em claro uma única vez; ele fica num signal que é apagado ao concluir, ao
 * trocar de código e ao destruir a tela. Nunca vai para URL, storage ou log. Ação destrutiva (encerrar vínculo, trocar
 * código, anular) mostra o código por extenso na confirmação.
 */
@Component({
  selector: 'app-admin-code-detail',
  imports: [
    RouterLink,
    NgIcon,
    AdminPinReveal,
    Note,
    ZardAlertComponent,
    ZardAlertDialogImports,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardToggleGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full flex-col gap-3.5 md:gap-[18px] xl:gap-5" data-testid="admin-code-detail">
      <div class="flex items-center gap-3">
        <a z-button zType="ghost" zSize="icon" class="bg-card" routerLink="/admin/codigos" aria-label="Voltar para Códigos" i18n-aria-label data-testid="admin-code-back">
          <ng-icon name="back" size="22" aria-hidden="true" />
        </a>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 class="font-display text-[28px] leading-[1.08] font-bold tracking-[-0.03em] text-foreground md:text-[32px] xl:text-[36px]" data-testid="admin-code-title">
            {{ displayCode() }}
          </h1>
          @if (detail(); as d) {
            <z-badge zSize="lg" [zType]="badge(d.status)" data-testid="admin-code-status">{{ statusText(d.status) }}</z-badge>
          }
        </div>
      </div>

      <div aria-live="polite">
        @switch (state()) {
          @case ('loading') {
            <p class="py-6 text-center text-text" role="status" aria-busy="true" data-testid="admin-code-loading" i18n>Um instante…</p>
          }
          @case ('error') {
            <div class="flex flex-col items-start gap-3" data-testid="admin-code-error">
              <z-alert class="w-full" zType="danger" [zRole]="'status'" [zDescription]="errorText()" />
              @if (!forbidden()) {
                <button type="button" z-button zType="outline" (click)="load()" data-testid="admin-code-retry" i18n>Tentar de novo</button>
              }
            </div>
          }
          @case ('missing') {
            <div class="flex flex-col items-start gap-3 rounded-2xl bg-card p-5" data-testid="admin-code-missing">
              <p class="font-display text-[19px] font-semibold text-foreground" i18n>Não encontramos este código</p>
              <p class="text-[15px] leading-[1.45] text-text" i18n>Confira o código ou procure na lista.</p>
              <a z-button zType="outline" routerLink="/admin/codigos" data-testid="admin-code-missing-list" i18n>Ver códigos</a>
            </div>
          }
        }
      </div>

      @if (pin(); as newPin) {
        <app-admin-pin-reveal [pin]="newPin" [code]="displayCode()" (done)="clearPin()" />
      }

      @if (state() === 'ready' && detail(); as d) {
        <p class="text-[15px] text-text" data-testid="admin-code-meta" i18n>{{ d.batchId }} · criado em {{ day(d.createdAt) }}</p>

        <div class="flex flex-col gap-3.5 md:gap-[18px] xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start xl:gap-5">
          <div class="flex flex-col gap-3.5 md:gap-[18px] xl:order-1 xl:gap-5">
            <section class="flex flex-col gap-3 rounded-2xl bg-card p-5" aria-labelledby="admin-code-link-title" data-testid="admin-code-assignment">
              <h2 id="admin-code-link-title" class="font-display text-[19px] font-semibold text-foreground" i18n>Vínculo atual</h2>
              @if (d.assignment; as a) {
                <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
                  <dt class="text-muted-foreground" i18n>Pet</dt>
                  <dd class="m-0 text-foreground" data-testid="admin-code-pet">{{ a.petName ?? '—' }}</dd>
                  <dt class="text-muted-foreground" i18n>Tutor</dt>
                  <dd class="m-0 text-foreground" data-testid="admin-code-tutor">{{ a.tutor ?? '—' }}</dd>
                  <dt class="text-muted-foreground" i18n>Desde</dt>
                  <dd class="m-0 text-foreground">{{ day(a.startedAt) }}</dd>
                </dl>
              } @else {
                <p class="text-[15px] text-text" data-testid="admin-code-no-assignment" i18n>Sem vínculo no momento.</p>
              }
              <div class="border-t border-divider pt-3">
                <p class="text-[13px] text-muted-foreground" i18n>PIN</p>
                <p class="text-[15px] text-foreground" data-testid="admin-code-pin-state">{{ pinText() }}</p>
                @if (lockedText(); as locked) {
                  <p class="text-[13px] text-muted-foreground" data-testid="admin-code-pin-locked">{{ locked }}</p>
                }
              </div>
            </section>

            <section class="flex flex-col gap-3 rounded-2xl bg-card p-5" aria-labelledby="admin-code-scans-title" data-testid="admin-code-scans">
              <h2 id="admin-code-scans-title" class="font-display text-[19px] font-semibold text-foreground" i18n>Scans</h2>
              @if (d.scans.length === 0) {
                <p class="text-[15px] text-text" i18n>Ninguém escaneou este código ainda.</p>
              } @else {
                <ul class="m-0 flex list-none flex-col divide-y divide-divider p-0">
                  @for (scan of shownScans(); track scan.id) {
                    <li class="flex flex-col gap-0.5 py-2.5" data-testid="admin-code-scan">
                      <span class="text-[15px] font-semibold text-foreground">{{ time(scan.occurredAt) }}</span>
                      <span class="text-sm text-text">{{ scanLine(scan) }}</span>
                    </li>
                  }
                </ul>
                @if (d.scans.length > scansShown) {
                  <div>
                    <button type="button" z-button zType="outline" zSize="md" (click)="toggleScans()" data-testid="admin-code-scans-toggle">
                      {{ showAllScans() ? seeLess : seeAll() }}
                    </button>
                  </div>
                }
              }
            </section>

            <section class="flex flex-col gap-3 rounded-2xl bg-card p-5" aria-labelledby="admin-code-history-title" data-testid="admin-code-history">
              <h2 id="admin-code-history-title" class="font-display text-[19px] font-semibold text-foreground" i18n>Histórico de vínculos</h2>
              @if (d.history.length === 0) {
                <p class="text-[15px] text-text" i18n>Sem vínculos anteriores.</p>
              } @else {
                <ul class="m-0 flex list-none flex-col divide-y divide-divider p-0">
                  @for (h of d.history; track h.id) {
                    <li class="flex flex-col gap-0.5 py-2.5" data-testid="admin-code-history-item">
                      <span class="text-[15px] font-semibold text-foreground">{{ historyOwner(h.petName, h.tutor) }}</span>
                      <span class="text-sm text-text">{{ historyLine(h.startedAt, h.endedAt, h.endReason) }}</span>
                    </li>
                  }
                </ul>
              }
            </section>

            @if (d.replacementRequests.length > 0) {
              <section class="flex flex-col gap-3 rounded-2xl bg-card p-5" aria-labelledby="admin-code-requests-title" data-testid="admin-code-requests">
                <h2 id="admin-code-requests-title" class="font-display text-[19px] font-semibold text-foreground" i18n>Pedidos de 2ª via</h2>
                <ul class="m-0 flex list-none flex-col divide-y divide-divider p-0">
                  @for (r of d.replacementRequests; track r.id) {
                    <li class="flex flex-wrap items-center justify-between gap-3 py-2.5" data-testid="admin-code-request">
                      <span class="flex flex-col">
                        <span class="text-[15px] font-semibold text-foreground">{{ kind(r.kind) }}</span>
                        <span class="text-sm text-text">{{ requestLine(r.status, r.createdAt) }}</span>
                      </span>
                      @if (r.status === 'open') {
                        <button type="button" z-button zType="outline" zSize="md" [zDisabled]="working()" (click)="resolve(r.id)" data-testid="admin-code-request-resolve" i18n>
                          Marcar como resolvido
                        </button>
                      }
                    </li>
                  }
                </ul>
              </section>
            }
          </div>

          <section class="flex flex-col gap-3 rounded-2xl bg-card p-5 xl:sticky xl:top-6 xl:order-2" aria-labelledby="admin-code-actions-title" data-testid="admin-code-actions">
            <h2 id="admin-code-actions-title" class="font-display text-[19px] font-semibold text-foreground" i18n>Ações</h2>
            @if (d.status === 'void') {
              <app-note icon="info" data-testid="admin-code-void-note">
                <span i18n>Código anulado: não há mais ações. O histórico fica guardado.</span>
              </app-note>
            } @else {
              <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
                <li>
                  @if (d.status === 'blocked') {
                    <button type="button" z-button zType="outline" class="h-auto min-h-14 w-full justify-start py-2.5" [zDisabled]="working()" (click)="ask('unblock')" data-testid="admin-action-unblock">
                      <span class="flex flex-col items-start text-left">
                        <span i18n>Desbloquear código</span>
                        <span class="text-[13px] font-normal text-muted-foreground" i18n>A página da tag volta a funcionar</span>
                      </span>
                    </button>
                  } @else {
                    <button type="button" z-button zType="outline" class="h-auto min-h-14 w-full justify-start py-2.5" [zDisabled]="working()" (click)="ask('block')" data-testid="admin-action-block">
                      <span class="flex flex-col items-start text-left">
                        <span i18n>Bloquear código</span>
                        <span class="text-[13px] font-normal text-muted-foreground" i18n>Quem escanear vê “tag não encontrada”</span>
                      </span>
                    </button>
                  }
                </li>
                <li>
                  <button
                    type="button"
                    z-button
                    zType="outline"
                    class="h-auto min-h-14 w-full justify-start py-2.5"
                    [zDisabled]="working() || d.status !== 'available'"
                    (click)="ask('reissue')"
                    data-testid="admin-action-reissue">
                    <span class="flex flex-col items-start text-left">
                      <span i18n>Reemitir PIN</span>
                      <span class="text-[13px] font-normal text-muted-foreground">{{ d.status === 'available' ? reissueHint : reissueBlocked }}</span>
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    z-button
                    zType="outline"
                    class="h-auto min-h-14 w-full justify-start py-2.5"
                    [zDisabled]="working() || d.assignment === null"
                    (click)="ask('end')"
                    data-testid="admin-action-end">
                    <span class="flex flex-col items-start text-left">
                      <span i18n>Encerrar vínculo</span>
                      <span class="text-[13px] font-normal text-muted-foreground">{{ d.assignment === null ? endBlocked : endHint }}</span>
                    </span>
                  </button>
                </li>
                <li>
                  <button type="button" z-button zType="outline" class="h-auto min-h-14 w-full justify-start py-2.5" [zDisabled]="true" data-testid="admin-action-reprint">
                    <span class="flex flex-col items-start text-left">
                      <span i18n>Reimprimir QR</span>
                      <span class="text-[13px] font-normal text-muted-foreground">{{ reprintHint }}</span>
                    </span>
                  </button>
                </li>
                <li>
                  <button type="button" z-button zType="outline" class="h-auto min-h-14 w-full justify-start py-2.5" [zDisabled]="working()" (click)="ask('swap')" data-testid="admin-action-swap">
                    <span class="flex flex-col items-start text-left">
                      <span i18n>Trocar código (2ª via)</span>
                      <span class="text-[13px] font-normal text-muted-foreground" i18n>Tag perdida: código novo, o antigo é anulado</span>
                    </span>
                  </button>
                </li>
                <li>
                  <button type="button" z-button zType="danger" class="h-auto min-h-14 w-full justify-start py-2.5" [zDisabled]="working()" (click)="ask('void')" data-testid="admin-action-void">
                    <span class="flex flex-col items-start text-left">
                      <span i18n>Anular código</span>
                      <span class="text-[13px] font-normal text-muted-foreground" i18n>Definitivo; o histórico fica guardado</span>
                    </span>
                  </button>
                </li>
              </ul>
            }
          </section>
        </div>
      }

      <z-alert-dialog [(zVisible)]="visible">
        <z-alert-dialog-header>
          <z-alert-dialog-title data-testid="admin-confirm-title">{{ confirmTitle() }}</z-alert-dialog-title>
          <z-alert-dialog-description data-testid="admin-confirm-text">{{ confirmText() }}</z-alert-dialog-description>
        </z-alert-dialog-header>
        @if (action() === 'end') {
          <z-toggle-group
            [zMode]="'single'"
            zAriaLabel="Motivo do encerramento"
            i18n-zAriaLabel
            [zItems]="endReasonItems"
            [zValue]="endReason()"
            (valueChange)="onEndReason($event)"
            data-testid="admin-confirm-reason" />
        }
        <div aria-live="polite">
          @if (problem(); as text) {
            <z-alert zType="danger" [zRole]="'status'" [zDescription]="text" data-testid="admin-confirm-problem" />
          }
        </div>
        <z-alert-dialog-footer>
          <button type="button" z-button zType="outline" zSize="lg" [zDisabled]="working()" (click)="cancel()" data-testid="admin-confirm-cancel" i18n>Cancelar</button>
          <button
            type="button"
            z-button
            [zType]="destructive() ? 'destructive' : 'default'"
            zSize="lg"
            [zLoading]="working()"
            [zDisabled]="working()"
            (click)="confirm()"
            data-testid="admin-confirm-ok">
            {{ confirmLabel() }}
          </button>
        </z-alert-dialog-footer>
      </z-alert-dialog>
    </div>
  `,
})
export class AdminCodeDetailPage {
  private readonly admin = inject(AdminTagService);
  private readonly sonner = inject(ZardSonnerService);

  /** Parâmetro de rota `:code` (ligado por `withComponentInputBinding`). */
  readonly code = input.required<string>();

  protected readonly scansShown = SCANS_SHOWN;
  protected readonly seeLess = $localize`Mostrar menos`;
  protected readonly reissueHint = $localize`Para cartão perdido`;
  protected readonly reissueBlocked = $localize`Só para tag disponível: encerre o vínculo antes`;
  protected readonly endHint = $localize`Suporte e realocação`;
  protected readonly endBlocked = $localize`Este código não tem vínculo ativo`;
  protected readonly reprintHint = LABELS_AVAILABLE ? $localize`Mesma versão e máscara` : $localize`Indisponível até a geração das etiquetas`;

  protected readonly endReasonItems: ZardToggleGroupItem[] = [
    { value: 'admin', label: $localize`Suporte` },
    { value: 'damaged', label: $localize`Tag danificada` },
    { value: 'lost', label: $localize`Tag perdida` },
  ];

  protected readonly state = signal<State>('loading');
  protected readonly errorText = signal('');
  protected readonly forbidden = signal(false);
  protected readonly detail = signal<AdminCodeDetail | null>(null);
  protected readonly showAllScans = signal(false);

  protected readonly visible = signal(false);
  protected readonly action = signal<ActionKind | null>(null);
  protected readonly endReason = signal<AdminEndReason>('admin');
  protected readonly working = signal(false);
  protected readonly problem = signal<string | null>(null);
  /** PIN novo, em claro, uma vez. Apagado ao concluir, ao trocar de código e ao destruir a tela. */
  protected readonly pin = signal<string | null>(null);
  private loadId = 0;

  protected readonly displayCode = computed(() => this.detail()?.code ?? this.code());
  protected readonly shownScans = computed(() => {
    const scans = this.detail()?.scans ?? [];
    return this.showAllScans() ? scans : scans.slice(0, SCANS_SHOWN);
  });
  protected readonly seeAll = computed(() => $localize`Mostrar todos os ${this.detail()?.scans.length ?? 0}:count: scans`);
  protected readonly destructive = computed(() => {
    const kind = this.action();
    return kind === 'end' || kind === 'swap' || kind === 'void';
  });
  protected readonly confirmTitle = computed(() => {
    const code = this.displayCode();
    switch (this.action()) {
      case 'block':
        return $localize`Bloquear ${code}:code:?`;
      case 'unblock':
        return $localize`Desbloquear ${code}:code:?`;
      case 'reissue':
        return $localize`Reemitir o PIN de ${code}:code:?`;
      case 'end':
        return $localize`Encerrar o vínculo de ${code}:code:?`;
      case 'swap':
        return $localize`Trocar o código ${code}:code:?`;
      case 'void':
        return $localize`Anular ${code}:code:?`;
      default:
        return '';
    }
  });
  protected readonly confirmText = computed(() => {
    const code = this.displayCode();
    switch (this.action()) {
      case 'block':
        return $localize`Quem escanear a tag ${code}:code: passa a ver “tag não encontrada”. O vínculo é mantido e o tutor vê “Tag bloqueada. Fale com o suporte.” no app. Dá para desbloquear depois.`;
      case 'unblock':
        return $localize`A tag ${code}:code: volta a funcionar na página pública.`;
      case 'reissue':
        return $localize`O PIN antigo da tag ${code}:code: deixa de valer. O PIN novo aparece uma única vez, na próxima tela.`;
      case 'end':
        return $localize`A tag ${code}:code: perde o vínculo com o pet e com o tutor, volta a ficar disponível e ganha um PIN novo, que aparece uma única vez. O endereço da tag deixa de mostrar os dados do pet.`;
      case 'swap':
        return $localize`O código ${code}:code: é anulado para sempre e deixa de funcionar. Envie uma tag nova ao tutor: ele ativa com o PIN dela. Não dá para desfazer.`;
      case 'void':
        return $localize`O código ${code}:code: é anulado para sempre: o vínculo termina e a página da tag mostra “tag não encontrada”. O histórico fica guardado. Não dá para desfazer.`;
      default:
        return '';
    }
  });
  protected readonly confirmLabel = computed(() => {
    switch (this.action()) {
      case 'block':
        return $localize`Bloquear`;
      case 'unblock':
        return $localize`Desbloquear`;
      case 'reissue':
        return $localize`Reemitir PIN`;
      case 'end':
        return $localize`Encerrar vínculo`;
      case 'swap':
        return $localize`Anular e trocar`;
      case 'void':
        return $localize`Anular código`;
      default:
        return '';
    }
  });
  protected readonly pinText = computed(() => {
    const pin = this.detail()?.pin;
    if (!pin) return '';
    const used = pin.used && pin.usedAt !== null ? $localize`Usado em ${formatDay(pin.usedAt)}:date:` : $localize`Ainda não usado`;
    return $localize`${used}:state: · tentativas erradas (24 h): ${pin.failCount24h}:count:`;
  });
  protected readonly lockedText = computed(() => {
    const until = this.detail()?.pin.lockedUntil;
    if (!until || new Date(until).getTime() <= Date.now()) return null;
    return $localize`Travada até ${formatDayTime(until)}:when:`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pin.set(null));
    effect(() => {
      this.code();
      untracked(() => {
        this.pin.set(null);
        void this.load();
      });
    });
  }

  protected async load(): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    const res = await this.admin.codeDetail(this.code());
    if (id !== this.loadId) return;
    if (!res.ok) {
      if (res.error === 'invalid_code' || res.error === 'not_found') {
        this.state.set('missing');
        return;
      }
      this.forbidden.set(res.error === 'forbidden');
      this.errorText.set(adminErrorMessage(res.error));
      this.state.set('error');
      return;
    }
    this.detail.set(res.detail);
    this.showAllScans.set(false);
    this.state.set('ready');
  }

  protected badge(status: TagStatus) {
    return statusBadgeType(status);
  }

  protected statusText(status: TagStatus): string {
    return statusLabel(status);
  }

  protected day(iso: string): string {
    return formatDay(iso);
  }

  protected time(iso: string): string {
    return formatScanTime(iso);
  }

  protected kind(kind: 'damaged' | 'lost'): string {
    return replacementLabel(kind);
  }

  protected scanLine(scan: AdminCodeDetail['scans'][number]): string {
    const place = placeText(scan.city, scan.region);
    const geo = geoText(scan.geoMethod, scan.accuracyM);
    return place === null ? geo : `${geo} · ${place}`;
  }

  protected historyOwner(pet: string | null, tutor: string | null): string {
    return [pet, tutor].filter((v) => v !== null).join(' · ') || $localize`Vínculo sem dados`;
  }

  protected historyLine(startedAt: string, endedAt: string | null, reason: AssignmentEndReason | null): string {
    const range = endedAt === null ? $localize`${formatDay(startedAt)}:start: · em andamento` : `${formatDay(startedAt)} – ${formatDay(endedAt)}`;
    return reason === null ? range : `${range} · ${endReasonText(reason)}`;
  }

  protected requestLine(status: 'open' | 'done' | 'cancelled', createdAt: string): string {
    const state = status === 'open' ? $localize`Aberto` : status === 'done' ? $localize`Resolvido` : $localize`Cancelado`;
    return $localize`${state}:state: · pedido em ${formatDay(createdAt)}:date:`;
  }

  protected toggleScans(): void {
    this.showAllScans.update((v) => !v);
  }

  protected ask(kind: ActionKind): void {
    this.problem.set(null);
    this.endReason.set('admin');
    this.action.set(kind);
    this.visible.set(true);
  }

  protected cancel(): void {
    this.visible.set(false);
    this.action.set(null);
  }

  protected onEndReason(value: string | string[]): void {
    const v = Array.isArray(value) ? value[0] : value;
    if (v === 'admin' || v === 'damaged' || v === 'lost') this.endReason.set(v);
  }

  protected clearPin(): void {
    this.pin.set(null);
  }

  protected async confirm(): Promise<void> {
    const kind = this.action();
    const code = this.detail()?.code;
    if (kind === null || code === undefined || this.working()) return;
    this.working.set(true);
    this.problem.set(null);

    let ok = false;
    let message = '';
    switch (kind) {
      case 'block':
      case 'unblock':
      case 'void':
      case 'swap': {
        const target = kind === 'block' ? 'blocked' : kind === 'unblock' ? 'available' : 'void';
        const res = await this.admin.setStatus(code, target);
        if (res.ok) {
          ok = true;
          message =
            kind === 'block'
              ? $localize`Código bloqueado.`
              : kind === 'unblock'
                ? $localize`Código desbloqueado.`
                : kind === 'swap'
                  ? $localize`Código anulado. Envie uma tag nova ao tutor.`
                  : $localize`Código anulado.`;
        } else this.problem.set(adminErrorMessage(res.error));
        break;
      }
      case 'reissue':
      case 'end': {
        const res = kind === 'reissue' ? await this.admin.reissuePin(code) : await this.admin.endAssignment(code, this.endReason());
        if (res.ok) {
          ok = true;
          this.pin.set(res.newPin);
          message = kind === 'reissue' ? $localize`PIN reemitido.` : $localize`Vínculo encerrado.`;
        } else this.problem.set(adminErrorMessage(res.error));
        break;
      }
    }
    this.working.set(false);
    if (!ok) return;
    this.visible.set(false);
    this.action.set(null);
    this.sonner.success(message);
    await this.reload();
  }

  protected async resolve(requestId: string): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    const res = await this.admin.resolveReplacement(requestId, 'done');
    this.working.set(false);
    if (!res.ok) {
      this.sonner.error(adminErrorMessage(res.error));
      return;
    }
    this.sonner.success($localize`Pedido marcado como resolvido.`);
    await this.reload();
  }

  /** Relê o detalhe sem trocar a tela por "carregando" (o PIN novo, se houver, continua visível). */
  private async reload(): Promise<void> {
    const res = await this.admin.codeDetail(this.code());
    if (res.ok) this.detail.set(res.detail);
  }
}

function endReasonText(reason: AssignmentEndReason): string {
  switch (reason) {
    case 'released':
      return $localize`liberada pelo tutor`;
    case 'transferred':
      return $localize`passada adiante`;
    case 'lost':
      return $localize`tag perdida`;
    case 'damaged':
      return $localize`tag danificada`;
    case 'admin':
      return $localize`encerrado pelo admin`;
    case 'account_deleted':
      return $localize`conta excluída`;
  }
}
