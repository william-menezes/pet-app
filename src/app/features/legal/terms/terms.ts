import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LegalPage } from '../legal-page/legal-page';

/** Termos de uso (`/legal/termos`). Pré-renderizada. */
@Component({
  selector: 'app-terms',
  imports: [LegalPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-legal-page [title]="title" />`,
})
export class Terms {
  // TODO(LEGAL_TEXTS): texto final dos Termos de uso, a ser fornecido pelo William.
  protected readonly title = $localize`Termos de uso`;
}
