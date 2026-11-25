import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardAlertDialogImports } from '@/shared/components/alert-dialog';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { IconTile } from '@/shared/components/faro/icon-tile/icon-tile';
import { ZardSonnerService } from '@/shared/components/sonner';
import type { FaroIconName } from '@/shared/icons/faro-icons';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';

import { tagErrorMessage } from '../../../core/tags/tag-errors';
import { TagService } from '../../../core/tags/tag.service';
import type { DashboardPet } from '../../../models';
import { formatScanDay } from '../../scans/scan-format';

type State = 'loading' | 'ready' | 'error' | 'missing';
type Kind = 'transfer' | 'release' | 'damaged' | 'lost';
type Phase = 'confirm' | 'pin' | 'registered';

interface Action {
  kind: Kind;
  icon: FaroIconName;
  title: string;
  hint: string;
  tone: 'neutral' | 'danger';
}

/**
 * "Gerenciar tag" (`/app/pets/:petId/tag`, T088 a T090; referência `V2-tag*.dc.html`, claro e escuro): o cartão do
 * código e quatro ações: passar a tag adiante e desvincular (as duas liberam a tag e mostram o PIN novo uma vez),
 * pedir 2ª via de tag danificada (a tag continua funcionando) e de tag perdida (o código antigo é anulado).
 *
 * PIN novo: vem de `release_tag` e fica só num signal desta tela, apagado ao concluir, ao trocar de pet e ao sair
 * (destruição). Nunca vai para storage, URL ou log. Toda ação confirma antes; perder a tag e desvincular dizem o que
 * acontece de verdade.
 */
@Component({
  selector: 'app-manage-tag',
  imports: [RouterLink, NgIcon, IconTile, ScreenHeader, ZardAlertComponent, ZardAlertDialogImports, ZardBadgeComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full flex-col gap-3 md:max-w-[640px] md:gap-4" data-testid="manage-tag">
      <app-screen-header [title]="screenTitle()" [back]="'back'" [backLink]="backLink()" />

      <div aria-live="polite">
        @switch (state()) {
          @case ('loading') {
            <p class="py-6 text-center text-text" role="status" aria-busy="true" data-testid="manage-tag-loading" i18n>Um instante…</p>
          }
          @case ('error') {
            <div class="flex flex-col items-start gap-3" data-testid="manage-tag-error">
              <z-alert class="w-full" zType="danger" [zRole]="'status'" zDescription="Não conseguimos carregar a tag. Verifique sua conexão e tente de novo." i18n-zDescription />
              <button type="button" z-button zType="outline" (click)="load()" data-testid="manage-tag-retry" i18n>Tentar de novo</button>
            </div>
          }
          @case ('missing') {
            <div class="flex flex-col items-start gap-3 rounded-2xl bg-card p-5" data-testid="manage-tag-missing">
              <p class="font-display text-[19px] font-semibold text-foreground" i18n>Não encontramos este pet.</p>
              <a z-button zType="outline" routerLink="/app/pets" data-testid="manage-tag-missing-pets" i18n>Ver meus pets</a>
            </div>
          }
        }
      </div>

      @if (state() === 'ready' && dash(); as d) {
        @if (!d.hasTag) {
          <div class="flex flex-col items-start gap-3 rounded-2xl bg-card p-5" data-testid="manage-tag-none">
            <p class="font-display text-[19px] font-semibold text-foreground" i18n>{{ d.name }} ainda não tem tag</p>
            <p class="text-[15px] leading-[1.45] text-text" i18n>Vincule uma tag para gerenciá-la aqui.</p>
            <a z-button [routerLink]="['/vincular', petId()]" data-testid="manage-tag-link" i18n>Vincular tag</a>
          </div>
        } @else {
          <section class="flex flex-col gap-2 rounded-2xl bg-card p-5" aria-labelledby="manage-tag-code" data-testid="manage-tag-card">
            <h2 id="manage-tag-code" class="font-display text-[28px] leading-[1.1] font-bold tracking-[-0.02em] text-foreground md:text-[32px]" data-testid="manage-tag-code">
              {{ d.tagCode }}
            </h2>
            <p class="text-[15px] leading-[1.4] text-text" data-testid="manage-tag-since">{{ sinceText() }}</p>
            <span>
              @if (d.tagStatus === 'blocked') {
                <z-badge zType="outline" i18n>Bloqueada</z-badge>
              } @else {
                <z-badge zType="success" i18n>Ativa</z-badge>
              }
            </span>
          </section>

          @if (d.tagStatus === 'blocked') {
            <z-alert class="w-full" zType="neutral" [zRole]="'status'" [zDescription]="blockedMessage" data-testid="manage-tag-blocked" />
          } @else {
            <ul class="m-0 flex list-none flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card p-0" data-testid="manage-tag-actions">
              @for (action of actions(); track action.kind) {
                <li>
                  <button
                    type="button"
                    class="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left"
                    [class]="action.tone === 'danger' ? 'text-danger-foreground' : 'text-foreground'"
                    (click)="ask(action.kind)"
                    [attr.data-testid]="'manage-tag-' + action.kind">
                    <app-icon-tile [icon]="action.icon" [tone]="action.tone" />
                    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span class="text-[15px] font-semibold">{{ action.title }}</span>
                      <span class="text-[13px] font-normal text-muted-foreground">{{ action.hint }}</span>
                    </span>
                    <ng-icon name="chev" size="20" class="shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              }
            </ul>
          }
        }
      }

      <z-alert-dialog [(zVisible)]="visible">
        @switch (phase()) {
          @case ('confirm') {
            <z-alert-dialog-header>
              <z-alert-dialog-title data-testid="manage-tag-confirm-title">{{ confirmTitle() }}</z-alert-dialog-title>
              <z-alert-dialog-description data-testid="manage-tag-confirm-text">{{ confirmText() }}</z-alert-dialog-description>
            </z-alert-dialog-header>
            <div aria-live="polite">
              @if (problem(); as text) {
                <z-alert zType="danger" [zRole]="'status'" [zDescription]="text" data-testid="manage-tag-problem" />
              }
            </div>
            <z-alert-dialog-footer>
              <button type="button" z-button zType="outline" zSize="lg" [zDisabled]="working()" (click)="cancel()" data-testid="manage-tag-cancel" i18n>Cancelar</button>
              <button
                type="button"
                z-button
                [zType]="kind() === 'lost' || kind() === 'release' ? 'destructive' : 'default'"
                zSize="lg"
                [zLoading]="working()"
                [zDisabled]="working()"
                (click)="confirm()"
                data-testid="manage-tag-confirm">
                {{ confirmLabel() }}
              </button>
            </z-alert-dialog-footer>
          }
          @case ('pin') {
            <z-alert-dialog-header>
              <z-alert-dialog-title data-testid="manage-tag-pin-title">{{ pinTitle() }}</z-alert-dialog-title>
              <z-alert-dialog-description>{{ pinText() }}</z-alert-dialog-description>
            </z-alert-dialog-header>
            <p class="rounded-xl bg-inset px-4 py-3 text-center font-display text-[32px] leading-none font-bold tracking-[0.2em] text-foreground" data-testid="manage-tag-pin">
              {{ pin() }}
            </p>
            <p class="text-center text-[15px] font-semibold text-foreground" data-testid="manage-tag-pin-warning" i18n>Anote agora. Ele não aparece de novo.</p>
            <div aria-live="polite">
              @if (copied()) {
                <p class="text-center text-[13px] font-semibold text-muted-foreground" role="status" data-testid="manage-tag-copied" i18n>PIN copiado.</p>
              }
            </div>
            <z-alert-dialog-footer>
              <button type="button" z-button zType="outline" zSize="lg" (click)="copy()" data-testid="manage-tag-copy" i18n>Copiar PIN</button>
              <button type="button" z-button zSize="lg" (click)="finish()" data-testid="manage-tag-done" i18n>Concluir</button>
            </z-alert-dialog-footer>
          }
          @case ('registered') {
            <z-alert-dialog-header>
              <z-alert-dialog-title data-testid="manage-tag-registered-title" i18n>Pedido registrado</z-alert-dialog-title>
              <z-alert-dialog-description data-testid="manage-tag-registered-text">{{ registeredText() }}</z-alert-dialog-description>
            </z-alert-dialog-header>
            <z-alert-dialog-footer>
              <button type="button" z-button zSize="lg" (click)="finish()" data-testid="manage-tag-registered-done" i18n>Entendi</button>
            </z-alert-dialog-footer>
          }
        }
      </z-alert-dialog>
    </div>
  `,
})
export class ManageTag {
  private readonly tags = inject(TagService);
  private readonly router = inject(Router);
  private readonly sonner = inject(ZardSonnerService);

  /** Parâmetro de rota `:petId` (ligado por `withComponentInputBinding`). */
  readonly petId = input.required<string>();

  protected readonly blockedMessage = $localize`Tag bloqueada. Fale com o suporte.`;

  protected readonly state = signal<State>('loading');
  protected readonly dash = signal<DashboardPet | null>(null);
  protected readonly startedAt = signal<string | null>(null);

  protected readonly visible = signal(false);
  protected readonly kind = signal<Kind>('transfer');
  protected readonly phase = signal<Phase>('confirm');
  protected readonly working = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly copied = signal(false);
  /** PIN novo, em claro, uma vez. Apagado ao concluir, ao trocar de pet e ao destruir a tela. */
  protected readonly pin = signal<string | null>(null);
  private loadId = 0;

  protected readonly name = computed(() => this.dash()?.name ?? '');
  protected readonly screenTitle = computed(() => (this.name() === '' ? $localize`Tag` : $localize`Tag de ${this.name()}:name:`));
  protected readonly backLink = computed(() => `/app/pets/${this.petId()}`);
  protected readonly sinceText = computed(() => {
    const started = this.startedAt();
    return started === null
      ? $localize`Vinculada a ${this.name()}:name:`
      : $localize`Vinculada a ${this.name()}:name: desde ${formatScanDay(started)}:when:`;
  });

  protected readonly actions = computed<Action[]>(() => {
    const name = this.name();
    return [
      { kind: 'transfer', icon: 'share', title: $localize`Passar a tag adiante`, hint: $localize`Gera um PIN novo para o próximo dono`, tone: 'neutral' },
      { kind: 'damaged', icon: 'print', title: $localize`Pedir 2ª via: tag danificada`, hint: $localize`Mesmo código, etiqueta nova`, tone: 'neutral' },
      { kind: 'lost', icon: 'warn', title: $localize`Pedir 2ª via: perdi a tag`, hint: $localize`Código novo; o antigo deixa de funcionar`, tone: 'neutral' },
      { kind: 'release', icon: 'block', title: $localize`Desvincular tag de ${name}:name:`, hint: $localize`A tag fica livre e ganha um PIN novo`, tone: 'danger' },
    ];
  });

  protected readonly confirmTitle = computed(() => {
    const code = this.dash()?.tagCode ?? '';
    switch (this.kind()) {
      case 'transfer':
        return $localize`Passar a tag ${code}:code: adiante?`;
      case 'release':
        return $localize`Desvincular a tag ${code}:code:?`;
      case 'damaged':
        return $localize`Pedir 2ª via da tag ${code}:code:?`;
      case 'lost':
        return $localize`Pedir 2ª via: você perdeu a tag ${code}:code:?`;
    }
  });
  protected readonly confirmText = computed(() => {
    const code = this.dash()?.tagCode ?? '';
    const name = this.name();
    switch (this.kind()) {
      case 'transfer':
        return $localize`A tag ${code}:code: deixa de estar ligada a ${name}:name: e fica livre para o próximo dono. O PIN antigo deixa de valer e você vê o PIN novo uma única vez, para entregar junto com a tag.`;
      case 'release':
        return $localize`A tag ${code}:code: deixa de estar ligada a ${name}:name: e volta a ficar livre. Quem escanear não vê mais os dados de ${name}:name:. Você vê o PIN novo dela uma única vez.`;
      case 'damaged':
        return $localize`Vamos registrar o pedido de uma etiqueta nova com o mesmo código ${code}:code:. A tag continua funcionando enquanto isso.`;
      case 'lost':
        return $localize`O endereço da tag ${code}:code: deixa de funcionar agora e não volta: quem achar a tag não vê mais os dados de ${name}:name:. Vamos registrar o pedido de uma tag nova, com outro código, que você ativa com o PIN do cartão dela. Não dá para desfazer.`;
    }
  });
  protected readonly confirmLabel = computed(() => {
    switch (this.kind()) {
      case 'transfer':
        return $localize`Passar adiante`;
      case 'release':
        return $localize`Desvincular`;
      case 'damaged':
        return $localize`Pedir 2ª via`;
      case 'lost':
        return $localize`Anular e pedir tag nova`;
    }
  });
  protected readonly pinTitle = computed(() => (this.kind() === 'release' ? $localize`A tag foi desvinculada` : $localize`A tag foi liberada`));
  protected readonly pinText = computed(() => {
    const code = this.dash()?.tagCode ?? '';
    return this.kind() === 'release'
      ? $localize`A tag ${code}:code: voltou a ficar livre. Este é o PIN novo dela.`
      : $localize`A tag ${code}:code: está livre para o próximo dono. Entregue este PIN junto com a tag.`;
  });
  protected readonly registeredText = computed(() =>
    this.kind() === 'lost'
      ? $localize`O código antigo foi anulado e a tag antiga parou de funcionar. Quando a tag nova chegar, ative com o PIN do cartão dela.`
      : $localize`Registramos o pedido de uma etiqueta nova com o mesmo código. A tag continua funcionando enquanto ela não chega.`,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pin.set(null));
    effect(() => {
      this.petId();
      untracked(() => {
        this.pin.set(null);
        void this.load();
      });
    });
  }

  protected async load(): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    const res = await this.tags.myDashboard();
    if (id !== this.loadId) return;
    if (!res.ok) {
      this.state.set('error');
      return;
    }
    const dash = res.dashboard.pets.find((p) => p.id === this.petId()) ?? null;
    if (dash === null) {
      this.state.set('missing');
      return;
    }
    // A data só enfeita: se falhar, a tela segue sem ela.
    const started = dash.tagCode === null ? null : await this.tags.assignmentStart(dash.tagCode);
    if (id !== this.loadId) return;
    this.dash.set(dash);
    this.startedAt.set(started);
    this.state.set('ready');
  }

  protected ask(kind: Kind): void {
    this.kind.set(kind);
    this.problem.set(null);
    this.phase.set('confirm');
    this.visible.set(true);
  }

  protected cancel(): void {
    this.visible.set(false);
  }

  protected async confirm(): Promise<void> {
    const code = this.dash()?.tagCode;
    if (code === null || code === undefined || this.working()) return;
    this.working.set(true);
    this.problem.set(null);
    const kind = this.kind();
    if (kind === 'transfer' || kind === 'release') {
      const res = await this.tags.releaseTag(code, kind === 'transfer' ? 'transferred' : 'released');
      this.working.set(false);
      if (!res.ok) {
        this.problem.set(tagErrorMessage(res.error, res.retryAfterSeconds));
        return;
      }
      this.copied.set(false);
      this.pin.set(res.newPin);
      this.phase.set('pin');
      return;
    }
    const res = await this.tags.requestReplacement(code, kind);
    this.working.set(false);
    if (!res.ok) {
      this.problem.set(tagErrorMessage(res.error, res.retryAfterSeconds));
      return;
    }
    this.phase.set('registered');
  }

  protected async copy(): Promise<void> {
    const pin = this.pin();
    if (pin === null) return;
    try {
      await navigator.clipboard.writeText(pin);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  /** Concluir: o PIN sai da memória e a tela segue para a página do pet (a tag mudou de estado). */
  protected finish(): void {
    this.pin.set(null);
    this.copied.set(false);
    this.visible.set(false);
    const kind = this.kind();
    this.sonner.success(
      kind === 'transfer' ? $localize`Tag liberada para o próximo dono.` : kind === 'release' ? $localize`Tag desvinculada.` : $localize`Pedido de 2ª via registrado.`,
    );
    void this.router.navigate(['/app/pets', this.petId()]);
  }
}
