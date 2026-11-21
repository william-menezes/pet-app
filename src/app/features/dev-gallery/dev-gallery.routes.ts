import { Routes } from '@angular/router';

/**
 * Rotas da galeria de desenvolvimento (`/dev/ui/...`). Registradas em `app.routes.ts` só quando
 * `ngDevMode` é verdadeiro, então não entram no pacote de produção.
 * As páginas de cada grupo são acrescentadas pelas tarefas T029 (componentes) e T041 em diante.
 */
export const DEV_GALLERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./gallery-index/gallery-index').then((m) => m.GalleryIndex),
    title: 'Galeria de desenvolvimento — Faro',
  },
];
