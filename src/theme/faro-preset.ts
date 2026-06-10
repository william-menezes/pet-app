/**
 * FaroPreset — preset do PrimeNG (tema Aura) para o Faro.
 *
 * Paleta C "Faro Noturno": Índigo (primária) + Verde-Lima (accent de marca).
 * Derivado de docs/design-system.md §3.3 e do handoff do Claude Design
 * (design/faro-claude-design/). Pareie com os tokens/estilos de marca em
 * src/styles/faro-ds.css (cobre o que o PrimeNG não tem: CTA de resgate,
 * faixa do modo perdido, preview "como estranhos verão", etc.).
 *
 * Uso em app.config.ts:
 *   import { providePrimeNG } from 'primeng/config';
 *   import { FaroPreset } from './theme/faro-preset';
 *
 *   providePrimeNG({
 *     theme: { preset: FaroPreset, options: { darkModeSelector: '.faro-dark' } },
 *   });
 */
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

export const FaroPreset = definePreset(Aura, {
  semantic: {
    // Primária = Índigo (tom 500 já passa AA-normal com texto branco)
    primary: {
      50: '#EAEDFB',
      100: '#CBD3F5',
      200: '#A6B3EE',
      300: '#7B8CE4',
      400: '#566DDD',
      500: '#3A4FD6',
      600: '#2D3CAC',
      700: '#212C80',
      800: '#171E58',
      900: '#0E1336',
      950: '#080B20',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        surface: { 0: '#ffffff', 50: '#F7F8F8', 100: '#EEF0F1', 200: '#E2E5E7' },
      },
      dark: {
        // tom 400 sobre superfícies escuras para manter contraste
        primary: {
          color: '{primary.400}',
          contrastColor: '#080B20',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
        surface: { 0: '#0F1417', 50: '#161C20', 100: '#1E262B', 200: '#2A343A' },
      },
    },
  },
});
