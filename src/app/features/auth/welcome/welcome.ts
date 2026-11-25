import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { BrandMark } from '@/shared/components/faro/brand-mark/brand-mark';
import { Logo } from '@/shared/components/faro/logo/logo';

import { ReturnUrlService, sanitizeReturnUrl } from '../../../core/auth/return-url';

/**
 * Boas-vindas (`/auth`, spec 004 T033). Referência: `design/telas-v2/V2-boas-vindas*.dc.html`.
 * Celular e tablet: foto no topo e folha subindo sobre ela. Desktop: foto na metade esquerda.
 * A foto é fornecida pelo dono (`public/photos/boas-vindas.jpg`); sem o arquivo, fica só o fundo `bg-photo`.
 */
@Component({
  selector: 'app-welcome',
  imports: [RouterLink, ZardAlertComponent, ZardButtonComponent, BrandMark, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './welcome.html',
})
export class Welcome implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly returnUrlService = inject(ReturnUrlService);

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  /** Foto das boas-vindas. Some se o arquivo não existir. */
  protected readonly photoSrc = '/photos/boas-vindas.jpg';
  protected readonly photoLoaded = signal(false);
  protected readonly photoFailed = signal(false);

  /** `returnUrl` já sanitizado, repassado aos dois links. */
  protected readonly queryParams = computed(() => {
    const returnUrl = sanitizeReturnUrl(this.query().get('returnUrl'));
    return returnUrl === null ? null : { returnUrl };
  });

  protected readonly accountDeleted = computed(() => this.query().get('conta') === 'excluida');

  ngOnInit(): void {
    this.returnUrlService.capture(this.query().get('returnUrl'));
  }
}
