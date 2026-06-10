import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Shell raiz do Faro — apenas hospeda o conteúdo roteado (público SSR ou painel CSR). */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
