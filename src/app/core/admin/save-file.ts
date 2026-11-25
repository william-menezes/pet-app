import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Salva um arquivo gerado no navegador (pacote do lote, CSV de códigos) e devolve a memória na hora: o endereço
 * temporário é revogado logo depois do clique e nada fica guardado aqui. O pacote tem PINs em claro; quem chama
 * também solta o `Blob` (não o põe em signal, storage ou URL).
 *
 * É um serviço (e não uma função solta) para os testes das telas poderem trocá-lo pelo `TestBed`.
 */
@Injectable({ providedIn: 'root' })
export class FileSaver {
  private readonly doc = inject(DOCUMENT);

  save(content: Blob, filename: string): void {
    const url = URL.createObjectURL(content);
    const link = this.doc.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    this.doc.body.appendChild(link);
    link.click();
    link.remove();
    // O clique já entregou o arquivo ao navegador; o endereço não precisa viver mais que este ciclo.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
