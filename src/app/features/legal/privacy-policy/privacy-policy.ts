import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LegalPage } from '../legal-page/legal-page';

/** Política de privacidade (`/legal/privacidade`). Pré-renderizada. */
@Component({
  selector: 'app-privacy-policy',
  imports: [LegalPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-legal-page [title]="title" />`,
})
export class PrivacyPolicy {
  // TODO(LEGAL_TEXTS): texto final da Política de privacidade, a ser fornecido pelo William.
  protected readonly title = $localize`Política de privacidade`;
}
