// Base única das telas "MVP v2": tokens (claro e escuro), ícones, componentes e cascas.
const fs = require('fs');
const path = require('path');

const S0 = __dirname;
const OUT = path.join(S0, '..', 'artifact-files', 'ad93d784-0dac-4303-ac1e-7b55bf3b4ba3', 'project');
const dOf = (f) => fs.readFileSync(f, 'utf8').match(/ d="([^"]+)"/)[1];
const F = dOf('d:/willi/dev/pet-app/pet-app/public/logos/logo-compact.svg');
const W = dOf(path.join(S0, '..', 'dl', 'whatsapp.svg'));

const PHOTO = '/_blob/934b5d39967c388fdc7cfbe8aae9fc18';
// Logo em Outfit (2026-11-21), embutido como SVG para a tela não depender de arquivo externo.
const logoInner = (f) => fs.readFileSync('d:/willi/dev/pet-app/pet-app/public/logos/' + f, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\/>/g, '></path>').trim();
const LOGO = logoInner('logo-full-light.svg');
const LOGOD = logoInner('logo-full-dark.svg');
const ALT = 'Paçoca, um vira-lata caramelo de orelhas caídas, sorrindo para a câmera';
const FD = "font-family: 'Outfit', Inter, system-ui, sans-serif";
const FB = 'font-family: Inter, system-ui, sans-serif';

// Escala navy regenerada a partir de #25337A (passo 700).
const NAVY = { 50: '#EEF0F8', 100: '#DADFF0', 200: '#B8C0E2', 300: '#8E9ACF', 400: '#6574B8', 500: '#44549F', 600: '#32418C', 700: '#25337A', 800: '#1A2459', 900: '#0E1336', 950: '#080B20' };

const L = {
  dark: false, bg: '#F7F8F8', card: '#FFFFFF', inset: '#F7F8F8', line: '#EEF0F1', border: '#E2E5E7', control: '#7F8B88',
  strong: '#13201E', text: '#33403D', muted: '#5E6C69', selBg: '#13201E', selFg: '#FFFFFF', link: NAVY[700],
  lime: '#84C32E', onLime: '#13201E', navy: NAVY[700], navyDeep: NAVY[600], onNavySoft: NAVY[100],
  amberBg: '#FBF1DD', amberFg: '#8A4A0C', okBg: '#E4F4EA', okFg: '#0F5E30', neuBg: '#EEF0F1', neuFg: '#33403D',
  dangerBg: '#FBE7E4', dangerFg: '#A52E22', dot: '#C23A2B', disBg: '#E2E5E7', disFg: '#5E6C69', lost: '#A85A0E',
  shadow: '0 12px 34px rgba(19,32,30,.14), 0 3px 10px rgba(19,32,30,.06)', logo: LOGO, photoBg: '#E8E2D6',
};
const D = {
  dark: true, bg: '#0B0F2A', card: '#161C4A', inset: '#1F2760', line: '#262E66', border: '#2B3470', control: '#7C87C4',
  strong: '#F3F5FC', text: '#D8DCF0', muted: '#A6ADD0', selBg: '#F3F5FC', selFg: '#13201E', link: NAVY[200],
  lime: '#84C32E', onLime: '#13201E', navy: NAVY[700], navyDeep: NAVY[600], onNavySoft: NAVY[100],
  amberBg: '#3B2A10', amberFg: '#F2B866', okBg: '#12392A', okFg: '#7BD8A2', neuBg: '#1F2760', neuFg: '#D8DCF0',
  dangerBg: '#4A1C17', dangerFg: '#F3A297', dot: '#F0705F', disBg: '#1F2760', disFg: '#A6ADD0', lost: '#A85A0E',
  shadow: '0 12px 34px rgba(0,0,0,.45)', logo: LOGOD, photoBg: '#2B3470',
};
const SZ = { m: { k: 'm', w: 390, h: 844 }, t: { k: 't', w: 768, h: 1024 }, d: { k: 'd', w: 1440, h: 900 } };
const pick = (S, m, t, d) => (S.k === 'm' ? m : S.k === 't' ? t : d);
const fname = (base, S, T) => `V2-${base}${pick(S, '', '-tablet', '-desktop')}${T && T.dark ? '-escuro' : ''}.dc.html`;

const P = {
  pin: '<path d="M16 10c0-2.21-1.79-4-4-4s-4 1.79-4 4 1.79 4 4 4 4-1.79 4-4m-6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2"></path><path d="M11.42 21.81c.17.12.38.19.58.19s.41-.06.58-.19c.3-.22 7.45-5.37 7.42-11.82 0-4.41-3.59-8-8-8s-8 3.59-8 8c-.03 6.44 7.12 11.6 7.42 11.82M12 4c3.31 0 6 2.69 6 6 .02 4.44-4.39 8.43-6 9.74-1.61-1.31-6.02-5.29-6-9.74 0-3.31 2.69-6 6-6"></path>',
  warn: '<path d="M11 9h2v6h-2zM11 17h2v2h-2z"></path><path d="M12.87 2.51c-.35-.63-1.4-.63-1.75 0l-9.99 18c-.17.31-.17.69.01.99.18.31.51.49.86.49h20c.35 0 .68-.19.86-.49a1 1 0 0 0 .01-.99zM3.7 20 12 5.06 20.3 20z"></path>',
  back: '<path d="M14.29 6.29 8.59 12l5.7 5.71 1.42-1.42-4.3-4.29 4.3-4.29z"></path>',
  chev: '<path d="m9.71 17.71 5.7-5.71-5.7-5.71-1.42 1.42 4.3 4.29-4.3 4.29z"></path>',
  down: '<path d="m12 15.41 5.71-5.7-1.42-1.42-4.29 4.3-4.29-4.3-1.42 1.42z"></path>',
  close: '<path d="m7.76 6.34-1.42 1.42L10.59 12l-4.25 4.24 1.42 1.42L12 13.41l4.24 4.25 1.42-1.42L13.41 12l4.25-4.24-1.42-1.42L12 10.59z"></path>',
  check: '<path d="m9 15.59-4.29-4.3-1.42 1.42L9 18.41 20.71 6.71l-1.42-1.42z"></path>',
  plus: '<path d="M3 13h8v8h2v-8h8v-2h-8V3h-2v8H3z"></path>',
  clock: '<path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8"></path><path d="M13 7h-2v5.41l3.29 3.3 1.42-1.42-2.71-2.7z"></path>',
  info: '<path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8"></path><path d="M11 11h2v6h-2zM11 7h2v2h-2z"></path>',
  eye: '<path d="M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6"></path><path d="M12 19c7.63 0 9.93-6.62 9.95-6.68.07-.21.07-.43 0-.63-.02-.07-2.32-6.68-9.95-6.68s-9.93 6.61-9.95 6.67c-.07.21-.07.43 0 .63.02.07 2.32 6.68 9.95 6.68Zm0-12c5.35 0 7.42 3.85 7.93 5-.5 1.16-2.58 5-7.93 5s-7.42-3.84-7.93-5c.5-1.16 2.58-5 7.93-5"></path>',
  lock: '<path d="M6 22h12c1.1 0 2-.9 2-2v-9c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5S7 4.24 7 7v2H6c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2M9 7c0-1.65 1.35-3 3-3s3 1.35 3 3v2H9zm-3 4h12v9H6z"></path>',
  bell: '<path d="M19 12.59V10c0-3.22-2.18-5.93-5.14-6.74C13.57 2.52 12.85 2 12 2s-1.56.52-1.86 1.26C7.18 4.08 5 6.79 5 10v2.59L3.29 14.3a1 1 0 0 0-.29.71v2c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-2c0-.27-.11-.52-.29-.71zM19 16H5v-.59l1.71-1.71a1 1 0 0 0 .29-.71v-3c0-2.76 2.24-5 5-5s5 2.24 5 5v3c0 .27.11.52.29.71L19 15.41zM14.82 20H9.18c.41 1.17 1.51 2 2.82 2s2.41-.83 2.82-2"></path>',
  home: '<path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1c.4 0 .77-.24.92-.62.15-.37.07-.8-.22-1.09l-8.99-9a.996.996 0 0 0-1.41 0l-9.01 9c-.29.29-.37.72-.22 1.09s.52.62.92.62Zm9-8.59 6 6V20H6v-9.59z"></path>',
  paw: '<path d="m15,5c0-1.65-1.35-3-3-3s-3,1.35-3,3,1.35,3,3,3,3-1.35,3-3Zm-4,0c0-.55.45-1,1-1s1,.45,1,1-.45,1-1,1-1-.45-1-1Z"></path><path d="m19,5c-1.65,0-3,1.35-3,3s1.35,3,3,3,3-1.35,3-3-1.35-3-3-3Zm0,4c-.55,0-1-.45-1-1s.45-1,1-1,1,.45,1,1-.45,1-1,1Z"></path><path d="m8,8c0-1.65-1.35-3-3-3s-3,1.35-3,3,1.35,3,3,3,3-1.35,3-3Zm-4,0c0-.55.45-1,1-1s1,.45,1,1-.45,1-1,1-1-.45-1-1Z"></path><path d="m5.22,21.14c.81.53,1.74.8,2.68.8.67,0,1.33-.14,1.97-.41l.98-.43c.74-.32,1.59-.32,2.32,0l.98.43c1.52.67,3.25.52,4.64-.39,1.39-.91,2.22-2.44,2.22-4.1,0-2.25-1.53-4.2-3.71-4.75-.51-.13-.97-.39-1.35-.76l-.48-.48c-1.91-1.91-5.02-1.91-6.92,0l-.48.48c-.37.37-.84.63-1.35.76-2.18.55-3.71,2.5-3.71,4.75,0,1.66.83,3.19,2.22,4.1Zm1.98-6.91c.86-.22,1.65-.66,2.27-1.29l.48-.48c.56-.56,1.31-.85,2.05-.85s1.48.28,2.05.85l.48.48c.63.63,1.41,1.07,2.28,1.29,1.29.32,2.19,1.48,2.19,2.81,0,1-.48,1.88-1.31,2.42-.83.54-1.83.63-2.75.23l-.98-.43c-1.25-.55-2.68-.55-3.93,0l-.98.43c-.91.4-1.91.32-2.75-.23s-1.31-1.43-1.31-2.42c0-1.33.9-2.49,2.2-2.81Z"></path>',
  scan: '<path d="M9 5V3H3v6h2V5zM21 9V3h-6v2h4v4zM19 19h-4v2h6v-6h-2zM5 15H3v6h6v-2H5zM2 11h20v2H2z"></path>',
  user: '<path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5m0-8c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3M4 22h16c.55 0 1-.45 1-1v-1c0-3.86-3.14-7-7-7h-4c-3.86 0-7 3.14-7 7v1c0 .55.45 1 1 1m6-7h4c2.76 0 5 2.24 5 5H5c0-2.76 2.24-5 5-5"></path>',
  edit: '<path d="M4 21h4c.27 0 .52-.11.71-.29l11-11a.996.996 0 0 0 0-1.41l-4-4a.996.996 0 0 0-1.41 0l-11 11c-.19.19-.29.44-.29.71v4c0 .55.45 1 1 1Zm1-4.59 10-10L17.59 9l-10 10H5z"></path>',
  qr: '<path d="M3 4.5v5c0 .83.67 1.5 1.5 1.5h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-5C3.67 3 3 3.67 3 4.5M5 5h4v4H5zM3 19.5c0 .83.67 1.5 1.5 1.5h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-5c-.83 0-1.5.67-1.5 1.5zM5 15h4v4H5zM19.5 3h-5c-.83 0-1.5.67-1.5 1.5v5c0 .83.67 1.5 1.5 1.5h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5M19 9h-4V5h4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 17h2v2h-2zM19 19h2v2h-2zM15 19h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2z"></path>',
  share: '<path d="M5.5 15.5c1.07 0 2.02-.5 2.67-1.26l6.87 3.87c-.01.13-.04.26-.04.39 0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5c-1.07 0-2.02.5-2.67 1.26l-6.87-3.87c.01-.13.04-.26.04-.39s-.02-.26-.04-.39l6.87-3.87C16.47 8.5 17.42 9 18.5 9 20.43 9 22 7.43 22 5.5S20.43 2 18.5 2 15 3.57 15 5.5c0 .13.02.26.04.39L8.17 9.76A3.48 3.48 0 0 0 5.5 8.5C3.57 8.5 2 10.07 2 12s1.57 3.5 3.5 3.5"></path>',
  print: '<path d="m19,7h-1V2H6v5h-1c-1.65,0-3,1.35-3,3v7c0,1.1.9,2,2,2h2v3h12v-3h2c1.1,0,2-.9,2-2v-7c0-1.65-1.35-3-3-3Zm-11-3h8v3h-8v-3Zm8,16h-8v-4h8v4Zm4-3h-2v-3H6v3h-2v-7c0-.55.45-1,1-1h14c.55,0,1,.45,1,1v7Z"></path>',
  camera: '<path d="M12 8c-2.17 0-4 1.83-4 4s1.83 4 4 4 4-1.83 4-4-1.83-4-4-4m0 6c-1.07 0-2-.93-2-2s.93-2 2-2 2 .93 2 2-.93 2-2 2"></path><path d="M20 5h-2.59L14.7 2.29a1 1 0 0 0-.71-.29h-4c-.27 0-.52.11-.71.29L6.57 5H3.98c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 13H4V7h3c.27 0 .52-.11.71-.29L10.42 4h3.17l2.71 2.71c.19.19.44.29.71.29h3v11Z"></path>',
  search: '<path d="M10 18c1.85 0 3.54-.63 4.9-1.69l4.4 4.4 1.41-1.41-4.4-4.4A7.95 7.95 0 0 0 18 10c0-4.41-3.59-8-8-8s-8 3.59-8 8 3.59 8 8 8m0-14c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6"></path>',
  tag: '<path d="M11.71 2.29A1 1 0 0 0 11 2H3c-.55 0-1 .45-1 1v8c0 .27.11.52.29.71l10 10c.2.2.45.29.71.29s.51-.1.71-.29l8-8a.996.996 0 0 0 0-1.41zM13 19.59l-9-9V4h6.59l9 9z"></path><path d="M7.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3"></path>',
  list: '<path d="M8 6h13v2H8zM8 11h13v2H8zM8 16h13v2H8zM3 6h2v2H3zM3 11h2v2H3zM3 16h2v2H3z"></path>',
  phone: '<path d="M18.07 22h.35c.47-.02.9-.26 1.17-.64l2.14-3.09c.23-.33.32-.74.24-1.14s-.31-.74-.64-.97l-4.64-3.09a1.47 1.47 0 0 0-.83-.25c-.41 0-.81.16-1.1.48l-1.47 1.59c-.69-.43-1.61-1.07-2.36-1.82-.72-.72-1.37-1.64-1.82-2.36l1.59-1.47c.54-.5.64-1.32.23-1.93L7.84 2.67c-.22-.33-.57-.57-.97-.64a1.455 1.455 0 0 0-1.13.24L2.65 4.41c-.39.27-.62.7-.64 1.17-.03.69-.16 6.9 4.68 11.74 4.35 4.35 9.81 4.69 11.38 4.69ZM6.88 10.05c-.16.15-.21.39-.11.59.05.09 1.15 2.24 2.74 3.84 1.6 1.6 3.75 2.7 3.84 2.75.2.1.44.06.59-.11l1.99-2.15 3.86 2.57-1.7 2.46c-1.16 0-6.13-.24-9.99-4.1S4 7.06 4 5.91l2.46-1.7 2.57 3.86-2.15 1.99Z"></path>',
  mail: '<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 2v.51l-8 6.22-8-6.22V6zM4 18V9.04l7.39 5.74c.18.14.4.21.61.21s.43-.07.61-.21L20 9.03v8.96H4Z"></path>',
  contrast: '<path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-1.41 2L4 18.59V4zM5.41 20 20 5.41V20z"></path><path d="M7 11h2V9h2V7H9V5H7v2H5v2h2zM13 15h6v2h-6z"></path>',
  shield: '<path d="m20.42,6.11l-7.97-4c-.28-.14-.62-.14-.9,0L3.58,6.11c-.31.15-.51.45-.55.79-.01.11-.96,10.77,8.55,15.01.13.06.27.09.41.09s.28-.03.41-.09c9.51-4.25,8.57-14.9,8.55-15.01-.03-.34-.24-.64-.55-.79Zm-8.42,13.79c-6.74-3.27-7.06-10.26-7-12.26l7-3.51,7,3.51c.04,1.99-.33,9.02-7,12.27Z"></path>',
  download: '<path d="M12 16.41 18.71 9.71 17.29 8.29 13 12.59 13 4 11 4 11 12.59 6.71 8.29 5.29 9.71 12 16.41z"></path><path d="M4 18H20V20H4z"></path>',
  exit: '<path d="M15 11H8v2h7v4l6-5-6-5z"></path><path d="M5 21h7v-2H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2"></path>',
  trash: '<path d="M17 6V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H2v2h2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8h2V6zM9 4h6v2H9zM6 20V8h12v12z"></path><path d="M9 10h2v8H9zM13 10h2v8h-2z"></path>',
  refresh: '<path d="M19.07 4.93a9.9 9.9 0 0 0-3.18-2.14 10.12 10.12 0 0 0-7.79 0c-1.19.5-2.26 1.23-3.18 2.14S3.28 6.92 2.78 8.11A9.95 9.95 0 0 0 1.99 12h2c0-1.08.21-2.13.63-3.11.4-.95.98-1.81 1.72-2.54.73-.74 1.59-1.31 2.54-1.71 1.97-.83 4.26-.83 6.23 0 .95.4 1.81.98 2.54 1.72.17.17.33.34.48.52L16 9.01h6V3l-2.45 2.45c-.15-.18-.31-.36-.48-.52M19.37 15.11c-.4.95-.98 1.81-1.72 2.54-.73.74-1.59 1.31-2.54 1.71-1.97.83-4.26.83-6.23 0-.95-.4-1.81-.98-2.54-1.72-.17-.17-.33-.34-.48-.52l2.13-2.13H2v6l2.45-2.45c.15.18.31.36.48.52.92.92 1.99 1.64 3.18 2.14 1.23.52 2.54.79 3.89.79s2.66-.26 3.89-.79c1.19-.5 2.26-1.23 3.18-2.14s1.64-1.99 2.14-3.18c.52-1.23.79-2.54.79-3.89h-2c0 1.08-.21 2.13-.63 3.11Z"></path>',
  file: '<path d="m19.94 7.68-.03-.09a.8.8 0 0 0-.2-.29l-5-5c-.09-.09-.19-.15-.29-.2l-.09-.03a.8.8 0 0 0-.26-.05c-.02 0-.04-.01-.06-.01H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-12s-.01-.04-.01-.06c0-.09-.02-.17-.05-.26ZM6 20V4h7v4c0 .55.45 1 1 1h4v11z"></path><path d="M8 11h8v2H8zM8 15h8v2H8zM8 7h3v2H8z"></path>',
  block: '<path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2M4 12c0-1.85.63-3.54 1.69-4.9l11.21 11.21A7.95 7.95 0 0 1 12 20c-4.41 0-8-3.59-8-8m14.31 4.9L7.1 5.69A7.95 7.95 0 0 1 12 4c4.41 0 8 3.59 8 8 0 1.85-.63 3.54-1.69 4.9"></path>',
};
const ico = (n, size, fill) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="flex-shrink: 0">${P[n]}</svg>`;
const waIcon = (fill, size = 22) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="flex-shrink: 0"><path d="${W}"></path></svg>`;
const focinho = (w, fill, style, label) =>
  `<svg ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} width="${w}" height="${Math.round((w * 207) / 234)}" viewBox="20 20 234 207"${style ? ` style="${style}"` : ''}><path fill="${fill}" fill-rule="evenodd" clip-rule="evenodd" d="${F}"></path></svg>`;
const GOOGLE = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48" style="flex-shrink: 0"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>';

const page = (title, w, h, T, rootStyle, body) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com"></link>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"></link>
<style>
body{margin:0}
a{color:${T.link}}a:hover{color:${T.strong}}
</style>
</helmet>
<div style="position: relative; width: ${w}px; min-height: ${h}px; box-sizing: border-box; background: ${T.bg}; ${FB}; color: ${T.strong}; display: flex; ${rootStyle}; overflow: hidden">
${body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;

// ---------- componentes ----------
const grow = (min = 12) => `<div style="flex-grow: 1; min-height: ${min}px"></div>`;
const gap = (h) => `<div style="height: ${h}px; flex-shrink: 0"></div>`;
const h1 = (T, t, size, extra = '') => `<h1 style="margin: 0; ${FD}; font-size: ${size}px; line-height: 1.04; font-weight: 700; letter-spacing: -0.03em; color: ${T.strong}; ${extra}">${t}</h1>`;
const h2 = (T, t, size = 20) => `<h2 style="margin: 0; ${FD}; font-size: ${size}px; line-height: 1.15; font-weight: 600; letter-spacing: -0.01em; color: ${T.strong}">${t}</h2>`;
const para = (T, t, size = 16, mt = 10, extra = '') => `<p style="margin: ${mt}px 0 0; font-size: ${size}px; line-height: 1.45; color: ${T.text}; ${extra}">${t}</p>`;
const btn = (T, label, o = {}) => {
  const k = o.disabled ? 'disabled' : o.kind || 'primary';
  const h = o.h || 56;
  const base = `height: ${h}px; ${o.full === false ? 'padding: 0 24px' : 'width: 100%; padding: 0 20px'}; box-sizing: border-box; border-radius: 999px; display: ${o.full === false ? 'inline-flex' : 'flex'}; align-items: center; justify-content: center; gap: 10px; ${FD}; font-size: ${o.fs || 17}px; font-weight: 600; text-decoration: none; flex-shrink: 0`;
  const skin = {
    primary: [`background: ${T.lime}; color: ${T.onLime}; border: none`, T.onLime],
    outline: [`background: ${T.card}; color: ${T.strong}; border: 1.5px solid ${T.strong}`, T.strong],
    ink: [`background: ${T.selBg}; color: ${T.selFg}; border: none`, T.selFg],
    ghost: [`background: transparent; color: ${T.strong}; border: none`, T.strong],
    danger: [`background: transparent; color: ${T.dangerFg}; border: none`, T.dangerFg],
    dashed: [`background: transparent; color: ${T.strong}; border: 1.5px dashed ${T.control}; border-radius: 20px; ${FB}; font-size: 15px`, T.strong],
    disabled: [`background: ${T.disBg}; color: ${T.disFg}; border: none`, T.disFg],
  }[k];
  const icon = !o.icon ? '' : o.icon === 'whats' ? waIcon(skin[1]) : o.icon === 'google' ? GOOGLE : ico(o.icon, 20, skin[1]);
  const inner = `${icon}<span>${label}</span>`;
  return o.href ? `<a href="${o.href}" style="${base}; ${skin[0]}">${inner}</a>` : `<button${o.disabled ? ' disabled' : ''} style="${base}; ${skin[0]}">${inner}</button>`;
};
const iconBtn = (T, icon, label, o = {}) => {
  const st = `position: relative; width: 44px; height: 44px; border-radius: 999px; border: none; background: ${o.bg || T.card}; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; text-decoration: none`;
  const inner = `${ico(icon, 20, o.fill || T.strong)}${o.dot ? `<span style="position: absolute; top: 10px; right: 11px; width: 8px; height: 8px; border-radius: 999px; background: ${T.dot}"></span>` : ''}`;
  return o.href ? `<a href="${o.href}" aria-label="${label}" style="${st}">${inner}</a>` : `<button aria-label="${label}" style="${st}">${inner}</button>`;
};
const textLink = (T, label, href = '#', size = 14) => `<a href="${href}" style="font-size: ${size}px; font-weight: 600; text-underline-offset: 3px">${label}</a>`;
const badge = (T, t, tone = 'neu') => `<span style="display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: ${T[tone + 'Bg']}; color: ${T[tone + 'Fg']}; font-size: 12px; font-weight: 600; white-space: nowrap">${t}</span>`;
const chip = (T, t, sel) => `<button${sel ? ' aria-pressed="true"' : ' aria-pressed="false"'} style="height: 38px; padding: 0 14px; border-radius: 999px; ${sel ? `border: 1px solid ${T.selBg}; background: ${T.selBg}; color: ${T.selFg}` : `border: 1px solid ${T.border}; background: ${T.card}; color: ${T.strong}`}; ${FB}; font-size: 13px; font-weight: 600; white-space: nowrap">${t}</button>`;
const tagChip = (T, t) => `<span style="display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 999px; background: ${T.card}; border: 1px solid ${T.border}; color: ${T.strong}; font-size: 13px; font-weight: 600">${t}</span>`;
const chipRow = (inner, mt = 0) => `<div style="margin-top: ${mt}px; display: flex; flex-wrap: wrap; gap: 8px">${inner}</div>`;
const segmented = (T, opts, sel, label) => `<div role="group" aria-label="${label}" style="display: grid; grid-template-columns: repeat(${opts.length}, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 999px; background: ${T.card}">${opts.map((o, i) => `<button aria-pressed="${i === sel}" style="height: 40px; border: none; border-radius: 999px; ${i === sel ? `background: ${T.selBg}; color: ${T.selFg}` : `background: transparent; color: ${T.strong}`}; ${FB}; font-size: 14px; font-weight: 600">${o}</button>`).join('')}</div>`;
const tile40 = (T, icon, tone) => `<span style="width: 40px; height: 40px; border-radius: 12px; background: ${tone ? T[tone + 'Bg'] : T.inset}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">${ico(icon, 20, tone ? T[tone + 'Fg'] : T.strong)}</span>`;
const card = (T, inner, pad = '16px', extra = '') => `<div style="background: ${T.card}; border-radius: 20px; padding: ${pad}; display: flex; flex-direction: column; ${extra}">${inner}</div>`;
const divider = (T) => `<div style="height: 1px; background: ${T.line}; margin: 0 14px"></div>`;
const toggle = (T, on, label) => `<button role="switch" aria-checked="${on}" aria-label="${label}" style="position: relative; width: 52px; height: 32px; border-radius: 999px; padding: 0; flex-shrink: 0; ${on ? `background: ${T.selBg}; border: 1.5px solid ${T.selBg}` : `background: transparent; border: 1.5px solid ${T.control}`}"><span style="position: absolute; top: 3.5px; ${on ? 'right: 3.5px' : 'left: 3.5px'}; width: 22px; height: 22px; border-radius: 999px; background: ${on ? T.selFg : T.control}"></span></button>`;
const row = (T, o) => {
  const inner = `${o.icon ? tile40(T, o.icon, o.tone) : ''}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600; color: ${T.strong}">${o.title}</span>${o.sub ? `<span style="font-size: 13px; line-height: 1.35; color: ${T.muted}">${o.sub}</span>` : ''}</span>${o.trail !== undefined ? o.trail : o.href ? ico('chev', 20, T.muted) : ''}`;
  const st = `display: flex; align-items: center; gap: 12px; padding: 12px 14px; min-height: 44px; text-decoration: none; color: ${T.strong}`;
  return o.href ? `<a href="${o.href}" style="${st}">${inner}</a>` : `<div style="${st}">${inner}</div>`;
};
const group = (T, rows) => `<div style="background: ${T.card}; border-radius: 20px; display: flex; flex-direction: column; flex-shrink: 0">${rows.join(divider(T))}</div>`;
const sectionLabel = (T, t) => `<span style="font-size: 13px; font-weight: 600; color: ${T.muted}; padding: 0 4px">${t}</span>`;
const field = (T, id, label, o = {}) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600; color: ${T.strong}">${label}</label><div style="position: relative">${o.area ? `<textarea id="${id}" rows="3" style="width: 100%; box-sizing: border-box; border-radius: 12px; border: 1.5px solid ${T.control}; background: ${T.card}; padding: 14px 16px; ${FB}; font-size: 16px; line-height: 1.45; color: ${T.strong}; resize: none">${o.value || ''}</textarea>` : `<input id="${id}" type="${o.type || 'text'}"${o.value ? ` value="${o.value}"` : ''}${o.ph ? ` placeholder="${o.ph}"` : ''} style="height: 54px; width: 100%; box-sizing: border-box; border-radius: 12px; border: 1.5px solid ${T.control}; background: ${T.card}; padding: 0 ${o.trail ? 52 : 16}px 0 16px; ${FB}; font-size: 16px; color: ${T.strong}"></input>`}${o.trail || ''}</div>${o.help ? `<span style="font-size: 13px; color: ${T.muted}">${o.help}</span>` : ''}${o.ok ? `<span style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: ${T.okFg}">${ico('check', 16, T.okFg)}${o.ok}</span>` : ''}</div>`;
const eyeBtn = (T) => `<button aria-label="Mostrar senha" style="position: absolute; right: 5px; top: 5px; width: 44px; height: 44px; border: none; border-radius: 999px; background: transparent; display: flex; align-items: center; justify-content: center; padding: 0">${ico('eye', 20, T.muted)}</button>`;
const checkbox = (T, id, label, checked = true) => `<label for="${id}" style="display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; line-height: 1.4; color: ${T.strong}"><input id="${id}" type="checkbox"${checked ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; flex-shrink: 0; accent-color: ${T.selBg}"></input><span>${label}</span></label>`;
const steps = (T, n, of) => `<div style="display: flex; flex-direction: column; gap: 8px"><div role="img" aria-label="Passo ${n} de ${of}" style="display: flex; gap: 6px">${Array.from({ length: of }, (_, i) => `<span style="flex-grow: 1; height: 5px; border-radius: 999px; background: ${i < n ? T.selBg : T.border}"></span>`).join('')}</div><span style="font-size: 13px; color: ${T.muted}">Passo ${n} de ${of}</span></div>`;
const cells = (T, chars, focus, what) => `<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; max-width: 368px">${Array.from({ length: 6 }, (_, i) => `<input aria-label="${what} ${i + 1}" maxlength="1" inputmode="${what === 'Dígito' ? 'numeric' : 'text'}"${chars[i] ? ` value="${chars[i]}"` : ''} style="height: 60px; width: 100%; box-sizing: border-box; border-radius: 12px; border: ${i === focus ? `2.5px solid ${T.strong}` : `1.5px solid ${chars[i] ? T.strong : T.control}`}; background: ${T.card}; text-align: center; padding: 0; ${FD}; font-size: 26px; font-weight: 600; color: ${T.strong}"></input>`).join('')}</div>`;
const avatar = (T, size = 56, photo = true) => (photo ? `<img src="${PHOTO}" alt="" style="width: ${size}px; height: ${size}px; border-radius: 999px; object-fit: cover; object-position: center 30%; flex-shrink: 0"></img>` : `<span style="width: ${size}px; height: ${size}px; border-radius: 999px; background: ${T.neuBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">${ico('paw', Math.round(size * 0.42), T.strong)}</span>`);
const radioCard = (T, o) => `<button role="radio" aria-checked="${!!o.sel}" style="display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; text-align: left; background: ${T.card}; border-radius: 20px; padding: 12px 14px; border: 2px solid ${o.sel ? T.strong : 'transparent'}; ${FB}; color: ${T.strong}">${avatar(T, 52, o.photo)}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 16px; font-weight: 600">${o.title}</span><span style="font-size: 13px; color: ${T.muted}">${o.sub}</span>${o.warn ? `<span style="font-size: 13px; font-weight: 600; color: ${T.amberFg}">${o.warn}</span>` : ''}</span><span style="width: 22px; height: 22px; border-radius: 999px; box-sizing: border-box; flex-shrink: 0; ${o.sel ? `border: 7px solid ${T.strong}; background: ${T.card}` : `border: 1.5px solid ${T.control}`}"></span></button>`;
const note = (T, icon, t) => `<div style="display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.45; color: ${T.muted}">${ico(icon, 18, T.muted)}<span>${t}</span></div>`;
const infoCard = (T, icon, title, text) => `<div style="background: ${T.card}; border-radius: 20px; padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px">${tile40(T, icon)}<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; font-weight: 600; color: ${T.strong}">${title}</span><span style="font-size: 14px; line-height: 1.45; color: ${T.text}">${text}</span></div></div>`;
const photo = (pos, radius = 0) => `<img src="${PHOTO}" alt="${ALT}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${pos}${radius ? `; border-radius: ${radius}px` : ''}"></img>`;
const logoImg = (src, h, extra = '') => `<svg role="img" aria-label="Faro" width="${Math.round((h * 770) / 290)}" height="${h}" viewBox="0 0 770 290" fill="none" style="display: block; flex-shrink: 0; align-self: flex-start; ${extra}">${src}</svg>`;
const mark = (o, size = 44) => `<span style="position: absolute; top: ${o}px; left: ${o}px; width: ${size}px; height: ${size}px; border-radius: 999px; background: #FFFFFF; display: flex; align-items: center; justify-content: center">${focinho(Math.round(size * 0.6), '#84C32E', '', 'Faro')}</span>`;
// Painel de marca navy com o focinho gigante (login, fluxos e páginas públicas sem foto).
const brandPanel = (w, headline, sub, o = {}) => `<div style="position: relative; ${w ? `width: ${w}px; flex-shrink: 0` : `height: ${o.h}px; flex-shrink: 0`}; background: ${NAVY[700]}; overflow: hidden; padding: ${o.pad || '48px 56px 56px'}; box-sizing: border-box; display: flex; flex-direction: column">
${focinho(o.fw || 640, '#84C32E', `position: absolute; right: ${o.fr !== undefined ? o.fr : -190}px; top: ${o.ft !== undefined ? o.ft : -130}px`)}
${logoImg(LOGOD, o.logoH || 60, 'position: relative')}
${headline ? `<div style="flex-grow: 1"></div><span style="position: relative; ${FD}; font-size: ${o.hs || 64}px; line-height: 1; font-weight: 700; letter-spacing: -0.03em; color: #FFFFFF">${headline}</span>${sub ? `<span style="position: relative; margin-top: 18px; max-width: 420px; font-size: 18px; line-height: 1.45; color: ${NAVY[100]}">${sub}</span>` : ''}` : ''}
</div>`;

// ---------- cascas ----------
const TUTOR_NAV = [['Início', 'home', 'painel'], ['Pets', 'paw', 'pets'], ['Scans', 'scan', 'scans'], ['Conta', 'user', 'conta']];
const navItems = (S, T, active) => TUTOR_NAV.map(([t, i, base]) => ({ t, i, on: t === active, href: base ? fname(base, S, T) : '#' }));
const bottomNav = (S, T, active) => `<nav aria-label="Navegação principal" style="margin: 12px 16px 16px; background: ${T.card}; border-radius: 999px; padding: 6px; box-shadow: ${T.shadow}; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; flex-shrink: 0">${navItems(S, T, active).map((n) => `<a href="${n.href}"${n.on ? ' aria-current="page"' : ''} style="height: 52px; border-radius: 999px; ${n.on ? `background: ${T.selBg}; color: ${T.selFg}` : `color: ${T.muted}`}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-decoration: none; font-size: 11px; font-weight: 600">${ico(n.i, 20, n.on ? T.selFg : T.muted)}${n.t}</a>`).join('')}</nav>`;
const rail = (S, T, active) => `<nav aria-label="Navegação principal" style="width: 88px; flex-shrink: 0; background: ${T.card}; padding: 22px 0; display: flex; flex-direction: column; align-items: center; gap: 8px">
${focinho(34, '#84C32E', 'margin-bottom: 18px', 'Faro')}
${navItems(S, T, active).map((n) => `<a href="${n.href}"${n.on ? ' aria-current="page"' : ''} style="width: 64px; height: 60px; border-radius: 18px; ${n.on ? `background: ${T.selBg}; color: ${T.selFg}` : `color: ${T.muted}`}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; text-decoration: none; font-size: 11px; font-weight: 600">${ico(n.i, 22, n.on ? T.selFg : T.muted)}${n.t}</a>`).join('\n')}
</nav>`;
const userChip = (T) => `<div style="display: flex; align-items: center; gap: 12px"><span style="width: 44px; height: 44px; border-radius: 999px; background: ${T.selBg}; color: ${T.selFg}; display: flex; align-items: center; justify-content: center; ${FD}; font-size: 18px; font-weight: 600; flex-shrink: 0">A</span><div style="display: flex; flex-direction: column; min-width: 0"><span style="font-size: 15px; font-weight: 600; color: ${T.strong}">Ana</span><span style="font-size: 13px; color: ${T.muted}">ana@email.com</span></div></div>`;
const sidebar = (S, T, active) => `<nav aria-label="Navegação principal" style="width: 264px; flex-shrink: 0; background: ${T.card}; padding: 24px 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px">
${logoImg(T.logo, 48, 'margin-bottom: 22px')}
${navItems(S, T, active).map((n) => `<a href="${n.href}"${n.on ? ' aria-current="page"' : ''} style="height: 48px; padding: 0 16px; border-radius: 999px; ${n.on ? `background: ${T.selBg}; color: ${T.selFg}` : `color: ${T.text}`}; display: flex; align-items: center; gap: 12px; text-decoration: none; font-size: 15px; font-weight: 600">${ico(n.i, 20, n.on ? T.selFg : T.text)}${n.t}</a>`).join('\n')}
<div style="flex-grow: 1"></div>
${userChip(T)}
</nav>`;
const barBtn = (T, kind, href) => (kind ? iconBtn(T, kind, kind === 'close' ? 'Fechar' : 'Voltar', href ? { href } : {}) : '');
// Casca do app do tutor. o: {title, active, bar:'back'|'close', barHref, action, body, footer:[html], hub, h}
const app = (S, T, o) => {
  const foot = o.footer && o.footer.length;
  if (S.k === 'm') {
    return page(o.title + ' · celular', S.w, o.h || S.h, T, 'flex-direction: column', `${o.hub ? o.hubHeader : `<div style="padding: 12px 16px 0; flex-shrink: 0"><div style="display: flex; align-items: center; gap: 12px; min-height: 48px">${barBtn(T, o.bar, o.barHref)}<h1 style="margin: 0; flex-grow: 1; ${FD}; font-size: 19px; font-weight: 600; color: ${T.strong}">${o.title}</h1>${o.action || ''}</div></div>`}
<div style="flex-grow: 1; padding: ${o.hub ? '16px 16px 0' : '14px 16px 16px'}; display: flex; flex-direction: column; gap: 12px">
${o.body}
</div>
${foot ? `<div style="padding: 0 16px 20px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0">${o.footer.join('')}</div>` : ''}
${o.hub ? bottomNav(S, T, o.active) : ''}`);
  }
  const head = o.hub
    ? o.hubHeader
    : `<div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0">${barBtn(T, o.bar, o.barHref)}<h1 style="margin: 0; flex-grow: 1; ${FD}; font-size: ${pick(S, 0, 28, 34)}px; line-height: 1.1; font-weight: 700; letter-spacing: -0.03em; color: ${T.strong}">${o.title}</h1>${o.action || ''}</div>`;
  const footer = foot ? `<div style="display: flex; justify-content: flex-end; gap: 12px; flex-shrink: 0">${o.footerWide ? o.footerWide.join('') : o.footer.join('')}</div>` : '';
  return page(o.title + pick(S, '', ' · tablet', ' · desktop'), S.w, o.h || S.h, T, 'flex-direction: row', `${S.k === 't' ? rail(S, T, o.active) : sidebar(S, T, o.active)}
<div style="flex-grow: 1; min-width: 0; padding: ${S.k === 't' ? '24px 28px' : '32px 48px'}; display: flex; flex-direction: column; gap: ${S.k === 't' ? 16 : 20}px">
${head}
${o.body}
${footer}
</div>`);
};
// Casca dos fluxos (conta, ativação, novo pet). Só tema claro.
// o: {title, bar, barHref, barTitle, step:[n,of], body, footer:[html], side:[headline, sub], h}
const flow = (S, o) => {
  const T = L;
  const st = o.step ? steps(T, o.step[0], o.step[1]) : '';
  const foot = (o.footer || []).join('');
  if (S.k === 'm') {
    return page(o.title + ' · celular', S.w, o.h || S.h, T, 'flex-direction: column', `<div style="padding: 12px 16px 0; flex-shrink: 0"><div style="display: flex; align-items: center; gap: 12px; min-height: 48px">${barBtn(T, o.bar, o.barHref)}<span style="flex-grow: 1; ${FD}; font-size: 19px; font-weight: 600; color: ${T.strong}">${o.barTitle || ''}</span></div></div>
<div style="flex-grow: 1; padding: 12px 20px 16px; display: flex; flex-direction: column; gap: 16px">
${st}
${o.body}
</div>
<div style="padding: 0 20px 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; flex-shrink: 0">${foot}</div>`);
  }
  const inner = `<div style="width: ${S.k === 't' ? 480 : 440}px; display: flex; flex-direction: column; gap: 18px">
${o.barTitle ? `<span style="${FD}; font-size: 16px; font-weight: 600; color: ${T.muted}">${o.barTitle}</span>` : ''}
${st}
${o.body}
<div style="margin-top: 10px; display: flex; flex-direction: column; align-items: center; gap: 10px">${foot}</div>
</div>`;
  if (S.k === 't') {
    return page(o.title + ' · tablet', S.w, o.h || S.h, T, 'flex-direction: column', `<div style="padding: 24px 28px 0; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0">${logoImg(LOGO, 52)}${barBtn(T, o.bar, o.barHref)}</div>
<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 0 56px">
${inner}
</div>`);
  }
  return page(o.title + ' · desktop', S.w, o.h || S.h, T, 'flex-direction: row', `${brandPanel(560, o.side[0], o.side[1], { fw: 560, fr: -180, ft: -120, hs: 56 })}
<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">
<div style="padding: 24px 32px 0; display: flex; justify-content: flex-end; min-height: 44px; flex-shrink: 0">${barBtn(T, o.bar, o.barHref)}</div>
<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px 0 56px">
${inner}
</div>
</div>`);
};

module.exports = { fs, path, OUT, F, W, PHOTO, LOGO, LOGOD, ALT, FD, FB, NAVY, L, D, SZ, pick, fname, P, ico, waIcon, focinho, GOOGLE, page, grow, gap, h1, h2, para, btn, iconBtn, textLink, badge, chip, tagChip, chipRow, segmented, tile40, card, divider, toggle, row, group, sectionLabel, field, eyeBtn, checkbox, steps, cells, avatar, radioCard, note, infoCard, photo, logoImg, mark, brandPanel, bottomNav, rail, sidebar, userChip, barBtn, app, flow };
