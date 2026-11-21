import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFieldImports } from '@/shared/components/field';
import { fieldSuccessVariants } from '@/shared/components/field/field.variants';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardTextareaComponent } from '@/shared/components/textarea';

/** Galeria: campos (normal, ajuda, inválido, sucesso, desativado), área de texto e campo de senha (contrato §3.2). */
@Component({
  selector: 'app-gallery-form',
  imports: [ZardFieldImports, ZardInputComponent, ZardTextareaComponent, ZardButtonComponent, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid max-w-[440px] gap-5" data-testid="gallery-form">
      <div z-field>
        <label z-field-label for="gallery-field-normal" i18n>Nome do pet</label>
        <input z-input id="gallery-field-normal" type="text" placeholder="Paçoca" i18n-placeholder />
      </div>

      <div z-field>
        <label z-field-label for="gallery-field-help" i18n>E-mail</label>
        <input
          z-input
          id="gallery-field-help"
          type="email"
          autocomplete="email"
          inputmode="email"
          aria-describedby="gallery-field-help-text"
        />
        <p z-field-description id="gallery-field-help-text" i18n>Usamos só para avisar quando alguém ler a tag.</p>
      </div>

      <div z-field>
        <label z-field-label for="gallery-field-invalid" i18n>Celular</label>
        <input
          z-input
          id="gallery-field-invalid"
          type="tel"
          value="1199"
          aria-invalid="true"
          aria-describedby="gallery-field-invalid-error"
          data-testid="gallery-field-invalid"
        />
        <z-field-error id="gallery-field-invalid-error" i18n>Confira o número: faltam dígitos.</z-field-error>
      </div>

      <div z-field>
        <label z-field-label for="gallery-field-success" i18n>Código da tag</label>
        <input
          z-input
          id="gallery-field-success"
          type="text"
          value="7K3M-Q9XA-C"
          aria-describedby="gallery-field-success-text"
        />
        <p [class]="successClass" id="gallery-field-success-text">
          <ng-icon name="check" size="16" aria-hidden="true" />
          <span i18n>Código válido.</span>
        </p>
      </div>

      <div z-field>
        <label z-field-label for="gallery-field-disabled" i18n>Desativado</label>
        <input z-input id="gallery-field-disabled" type="text" value="Não dá para editar" disabled />
      </div>

      <div z-field>
        <label z-field-label for="gallery-field-textarea" i18n>Recado para quem achar</label>
        <textarea z-textarea id="gallery-field-textarea" rows="3" i18n-placeholder placeholder="Ele é dócil e atende pelo nome."></textarea>
      </div>

      <div z-field>
        <label z-field-label for="gallery-field-password" i18n>Senha</label>
        <div class="relative">
          <input
            z-input
            id="gallery-field-password"
            class="pr-[52px]"
            [type]="showPassword() ? 'text' : 'password'"
            autocomplete="current-password"
            data-testid="gallery-password"
          />
          <button
            type="button"
            z-button
            zType="ghost"
            zSize="icon"
            class="absolute top-[5px] right-[5px]"
            [attr.aria-pressed]="showPassword()"
            [attr.aria-label]="showPassword() ? hideLabel : showLabel"
            data-testid="gallery-password-toggle"
            (click)="showPassword.set(!showPassword())"
          >
            <ng-icon [name]="showPassword() ? 'eyeOff' : 'eye'" size="20" class="text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  `,
})
export class GalleryForm {
  protected readonly successClass = fieldSuccessVariants();
  protected readonly showPassword = signal(false);
  protected readonly showLabel = $localize`Mostrar senha`;
  protected readonly hideLabel = $localize`Ocultar senha`;
}
