import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFieldImports } from '@/shared/components/field';
import { ZardInputComponent } from '@/shared/components/input';
import { ScreenHeader } from '@/shared/shells/screen-header/screen-header';
import { TutorShell } from '@/shared/shells/tutor-shell/tutor-shell';

import { GALLERY_TUTOR_NAV } from './gallery-nav';

/** Galeria: casca do tutor sem barra inferior, com `app-screen-header` (`/dev/ui/tutor/inner`). */
@Component({
  selector: 'app-gallery-tutor-inner',
  imports: [TutorShell, ScreenHeader, ZardFieldImports, ZardInputComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tutor-shell [items]="items" [bottomNav]="false" userName="Ana" userEmail="ana@email.com">
      <div class="flex flex-col gap-3 md:gap-4 xl:gap-5" data-testid="dev-gallery-tutor-inner">
        <app-screen-header title="Dados do pet" i18n-title back="back" backLink="/dev/ui/tutor">
          <button action type="button" z-button zType="ghost" zSize="md" i18n>Editar</button>
        </app-screen-header>

        <div z-field>
          <label z-field-label for="gallery-inner-name" i18n>Nome do pet</label>
          <input z-input id="gallery-inner-name" type="text" value="Paçoca" />
        </div>
        <div z-field>
          <label z-field-label for="gallery-inner-breed" i18n>Raça</label>
          <input z-input id="gallery-inner-breed" type="text" value="Sem raça definida" />
        </div>
      </div>
    </app-tutor-shell>
  `,
})
export class GalleryTutorInner {
  protected readonly items = GALLERY_TUTOR_NAV;
}
