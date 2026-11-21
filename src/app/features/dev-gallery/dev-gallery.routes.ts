import { Routes } from '@angular/router';

/**
 * Rotas da galeria de desenvolvimento (`/dev/ui/...`). Registradas em `app.routes.ts` só quando
 * `ngDevMode` é verdadeiro, então não entram no pacote de produção.
 * As páginas das cascas são acrescentadas pelas tarefas T041 em diante.
 */
export const DEV_GALLERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./gallery-index/gallery-index').then((m) => m.GalleryIndex),
    title: 'Galeria de desenvolvimento — Faro',
  },
  {
    path: 'components',
    loadComponent: () => import('./gallery-components/gallery-components').then((m) => m.GalleryComponents),
    title: 'Componentes — Galeria — Faro',
  },
];
