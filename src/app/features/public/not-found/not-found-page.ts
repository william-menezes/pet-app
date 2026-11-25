import { ChangeDetectionStrategy, Component } from '@angular/core';

import { NotFoundView } from '../tag-page/not-found-view/not-found-view';

/** `**` do app: qualquer caminho que não é rota nem código de tag. Mesma tela de "tag não encontrada". */
@Component({
  selector: 'app-not-found-page',
  imports: [NotFoundView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-not-found-view [subject]="'page'" />`,
})
export class NotFoundPage {}
