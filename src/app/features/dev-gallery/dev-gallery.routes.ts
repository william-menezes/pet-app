import { Routes } from '@angular/router';

/**
 * Rotas da galeria de desenvolvimento (`/dev/ui/...`). Registradas em `app.routes.ts` só quando
 * `ngDevMode` é verdadeiro, então não entram no pacote de produção.
 * Inclui as páginas das cascas (T048).
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
  {
    path: 'tutor',
    loadComponent: () => import('./gallery-tutor/gallery-tutor').then((m) => m.GalleryTutor),
    title: 'Casca do tutor — Galeria — Faro',
  },
  {
    path: 'tutor/inner',
    loadComponent: () => import('./gallery-tutor/gallery-tutor-inner').then((m) => m.GalleryTutorInner),
    title: 'Casca do tutor (tela interna) — Galeria — Faro',
  },
  {
    path: 'flow',
    loadComponent: () => import('./gallery-flow/gallery-flow').then((m) => m.GalleryFlow),
    title: 'Casca de fluxo — Galeria — Faro',
  },
  {
    path: 'admin',
    loadComponent: () => import('./gallery-admin/gallery-admin').then((m) => m.GalleryAdmin),
    title: 'Casca do admin — Galeria — Faro',
  },
  {
    path: 'public',
    loadComponent: () => import('./gallery-public/gallery-public').then((m) => m.GalleryPublic),
    title: 'Página pública — Galeria — Faro',
  },
  {
    path: 'public/photo',
    loadComponent: () => import('./gallery-public/gallery-public-photo').then((m) => m.GalleryPublicPhoto),
    title: 'Página pública (foto) — Galeria — Faro',
  },
];
