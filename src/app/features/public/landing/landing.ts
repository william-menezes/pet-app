import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';

/** Landing pública (rota `/`, prerender). Provisória: o layout definitivo vem na T046. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, ZardButtonComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {}
