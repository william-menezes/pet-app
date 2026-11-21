import type { NavItem } from '@/shared/shells/nav-item';

/** Itens de navegação das cascas na galeria: apontam para as páginas da própria galeria. */
export const GALLERY_TUTOR_NAV: NavItem[] = [
  { id: 'inicio', label: $localize`Início`, icon: 'home', link: '/dev/ui/tutor', exact: true },
  { id: 'pets', label: $localize`Pets`, icon: 'paw', link: '/dev/ui/tutor/inner' },
  { id: 'scans', label: $localize`Scans`, icon: 'scan', link: '/dev/ui/components' },
  { id: 'conta', label: $localize`Conta`, icon: 'user', link: '/dev/ui', exact: true },
];

export const GALLERY_ADMIN_NAV: NavItem[] = [
  { id: 'lotes', label: $localize`Lotes`, icon: 'list', link: '/dev/ui/admin', exact: true },
  { id: 'codigos', label: $localize`Códigos`, icon: 'qr', link: '/dev/ui/components' },
  { id: 'fila', label: $localize`Fila de scans`, icon: 'scan', link: '/dev/ui/flow' },
  { id: 'auditoria', label: $localize`Auditoria`, icon: 'clock', link: '/dev/ui/public' },
];
