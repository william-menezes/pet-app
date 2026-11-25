import type { FaroIconName } from '@/shared/icons/faro-icons';

/** Item de navegação de uma casca (contrato `shells.contract.md` §1). */
export interface NavItem {
  /** Usado no `data-testid` (`tutor-nav-<id>`, `admin-nav-<id>`). */
  id: string;
  label: string;
  icon: FaroIconName;
  /** Caminho absoluto. */
  link: string;
  /** `true`: só fica ativo no caminho exato. */
  exact?: boolean;
}
