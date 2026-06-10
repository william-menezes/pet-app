import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/** Landing pública (rota `/`, prerender). Placeholder de marca — valida tema + fontes. */
@Component({
  selector: 'app-landing',
  imports: [ButtonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {}
