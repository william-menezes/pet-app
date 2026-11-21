import type { NavItem } from '../nav-item';

/** Navegação do admin. Caminhos provisórios; a spec 003 confirma. */
export const ADMIN_NAV: NavItem[] = [
  { id: 'lotes', label: $localize`Lotes`, icon: 'list', link: '/admin', exact: true },
  { id: 'codigos', label: $localize`Códigos`, icon: 'qr', link: '/admin/codigos' },
  { id: 'fila', label: $localize`Fila de scans`, icon: 'scan', link: '/admin/fila' },
  { id: 'auditoria', label: $localize`Auditoria`, icon: 'clock', link: '/admin/auditoria' },
];
