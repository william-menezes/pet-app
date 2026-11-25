import type { IconDefinition, IconPack } from '@boxicons/js';
import { AlertCircle } from '@boxicons/js/icons/AlertCircle';
import { AlertTriangle } from '@boxicons/js/icons/AlertTriangle';
import { Bell } from '@boxicons/js/icons/Bell';
import { Block } from '@boxicons/js/icons/Block';
import { Camera } from '@boxicons/js/icons/Camera';
import { Check } from '@boxicons/js/icons/Check';
import { CheckCircle } from '@boxicons/js/icons/CheckCircle';
import { ChevronDown } from '@boxicons/js/icons/ChevronDown';
import { ChevronLeft } from '@boxicons/js/icons/ChevronLeft';
import { ChevronRight } from '@boxicons/js/icons/ChevronRight';
import { Clock } from '@boxicons/js/icons/Clock';
import { Edit } from '@boxicons/js/icons/Edit';
import { Eye } from '@boxicons/js/icons/Eye';
import { EyeSlash } from '@boxicons/js/icons/EyeSlash';
import { Home } from '@boxicons/js/icons/Home';
import { InfoCircle } from '@boxicons/js/icons/InfoCircle';
import { ListUl } from '@boxicons/js/icons/ListUl';
import { LoaderLines } from '@boxicons/js/icons/LoaderLines';
import { Location } from '@boxicons/js/icons/Location';
import { Lock } from '@boxicons/js/icons/Lock';
import { Minus } from '@boxicons/js/icons/Minus';
import { PawPrint } from '@boxicons/js/icons/PawPrint';
import { Plus } from '@boxicons/js/icons/Plus';
import { Printer } from '@boxicons/js/icons/Printer';
import { Qr } from '@boxicons/js/icons/Qr';
import { Scan } from '@boxicons/js/icons/Scan';
import { Search } from '@boxicons/js/icons/Search';
import { Share } from '@boxicons/js/icons/Share';
import { Tag } from '@boxicons/js/icons/Tag';
import { User } from '@boxicons/js/icons/User';
import { Whatsapp } from '@boxicons/js/icons/Whatsapp';
import { X } from '@boxicons/js/icons/X';

/**
 * Boxicons v3 sob nomes do Faro.
 *
 * Monta o mesmo SVG que `createSvgString` do pacote (fill `currentColor`, `aria-hidden`), sem
 * `width`/`height`: o tamanho vem do `<ng-icon size="…">`. Os glifos entram por caminho
 * (`@boxicons/js/icons/<Nome>`) e não pelo barrel, que carrega os 4.362 ícones (lento nos testes).
 */
const svg = (icon: IconDefinition, pack: IconPack = icon.defaultPack): string => {
  const data = icon.packs[pack] ?? icon.packs[icon.defaultPack];
  if (!data) {
    throw new Error(`Boxicons: o ícone "${icon.name}" não tem o pacote "${pack}".`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}" fill="currentColor" aria-hidden="true">${data.content}</svg>`;
};

export const faroIcons = {
  pin: svg(Location),
  warn: svg(AlertTriangle),
  back: svg(ChevronLeft),
  chev: svg(ChevronRight),
  down: svg(ChevronDown),
  close: svg(X),
  check: svg(Check),
  plus: svg(Plus),
  clock: svg(Clock),
  info: svg(InfoCircle),
  eye: svg(Eye),
  eyeOff: svg(EyeSlash),
  lock: svg(Lock),
  bell: svg(Bell),
  home: svg(Home),
  paw: svg(PawPrint),
  scan: svg(Scan),
  user: svg(User),
  edit: svg(Edit),
  qr: svg(Qr),
  share: svg(Share),
  print: svg(Printer),
  camera: svg(Camera),
  search: svg(Search),
  tag: svg(Tag),
  list: svg(ListUl),
  block: svg(Block),
  minus: svg(Minus),
  loader: svg(LoaderLines),
  alert: svg(AlertCircle),
  checkCircle: svg(CheckCircle),
  whats: svg(Whatsapp, 'brands'),
};

export type FaroIconName = keyof typeof faroIcons;
