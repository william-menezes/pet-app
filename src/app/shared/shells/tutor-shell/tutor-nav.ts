import type { NavItem } from '../nav-item';

/** Navegação do app do tutor. Caminhos provisórios; as specs 003 e 004 confirmam. */
export const TUTOR_NAV: NavItem[] = [
  { id: 'inicio', label: $localize`Início`, icon: 'home', link: '/app', exact: true },
  { id: 'pets', label: $localize`Pets`, icon: 'paw', link: '/app/pets' },
  { id: 'scans', label: $localize`Scans`, icon: 'scan', link: '/app/scans' },
  { id: 'conta', label: $localize`Conta`, icon: 'user', link: '/app/conta' },
];
