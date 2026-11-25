import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { InfoCard } from '@/shared/components/faro/info-card/info-card';
import { NoticeView } from '../notice-view';

/**
 * "Tag não encontrada" (T032): a MESMA tela para código inexistente, bloqueado, anulado ou com dígito
 * errado (anti-enumeração: nada aqui diz qual dos casos é). `subject="page"` é o `**` do app: mesma
 * tela, só o título fala de "página". Link comum (`<a href>`) para a página inicial.
 */
@Component({
  selector: 'app-not-found-view',
  imports: [NoticeView, InfoCard, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-notice-view [heading]="heading()" [body]="body()" [testid]="'public-not-found'">
      <app-info-card card icon="info" title="Encontrou um pet?" i18n-title>
        <ng-container i18n>
          Uma clínica veterinária ou ONG pode ler o microchip do animal e localizar a família.
        </ng-container>
      </app-info-card>
      <a z-button zSize="lg" zType="outline" href="/" class="w-full" actions data-testid="public-not-found-home" i18n>
        Conhecer o Faro
      </a>
    </app-notice-view>
  `,
})
export class NotFoundView {
  readonly subject = input<'tag' | 'page'>('tag');

  protected readonly heading = computed(() =>
    this.subject() === 'tag' ? $localize`Não encontramos esta tag.` : $localize`Não encontramos esta página.`,
  );
  protected readonly body = computed(() =>
    this.subject() === 'tag'
      ? $localize`O endereço pode ter sido digitado errado, ou esta tag não está mais em uso.`
      : $localize`O endereço pode ter sido digitado errado, ou esta página não existe mais.`,
  );
}
