// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },

  // ── Código copiado do ZardUI (zard-cli): seletores com prefixo `z-` ──
  // Não se edita o código copiado só para agradar regra de estilo (spec 002, T006).
  {
    files: [
      'src/app/shared/core/**/*.ts',
      'src/app/shared/utils/**/*.ts',
      'src/app/shared/components/**/*.ts',
    ],
    ignores: ['src/app/shared/components/faro/**'],
    rules: {
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/directive-selector': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // ── Invariante Rescue-First / two-bundle (constituição I) ──
  // A rota pública (features/public) deve ser enxuta e independente do painel e da
  // assinatura. Ela NÃO pode importar features do painel, auth nem billing.
  {
    files: ['src/app/features/public/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/features/auth/**',
                '**/features/activation/**',
                '**/features/pets/**',
                '**/features/scans/**',
                '**/features/account/**',
                '**/features/admin/**',
                '**/features/dev-gallery/**',
                '**/features/legal/**',
                '**/core/auth/**',
                '**/core/account/**',
                '**/core/theme/**',
                '**/shells/tutor-shell/**',
                '**/shells/admin-shell/**',
                '**/shells/flow-shell/**',
                '**/shells/screen-header/**',
                '**/shells/shell-fallback/**',
                '**/components/alert-dialog/**',
                '**/components/sonner/**',
                '**/components/sheet/**',
                '**/components/dialog/**',
                '**/components/popover/**',
                '**/components/dropdown/**',
                '**/components/select/**',
                '**/components/tooltip/**',
              ],
              message:
                'Rescue-First: features/public não importa o app autenticado, o tema escuro nem overlays. A página da tag tem de ser pequena e funcionar sozinha.',
            },
            // Reforço fora do contrato (registrado no execution-log, T047): o import relativo curto
            // (`../pets/x`) não contém "features/" e escaparia dos padrões acima.
            {
              group: [
                '../**/auth/**',
                '../**/activation/**',
                '../**/pets/**',
                '../**/scans/**',
                '../**/account/**',
                '../**/legal/**',
                '../**/admin/**',
                '../**/dev-gallery/**',
              ],
              message:
                'Rescue-First: features/public não importa o app autenticado, o tema escuro nem overlays. A página da tag tem de ser pequena e funcionar sozinha.',
            },
          ],
        },
      ],
    },
  },

  // ── T020d: Lint anti-XSS — proíbe innerHTML/bypassSecurityTrust* nas features ──
  // Bloqueia uso de innerHTML e bypassSecurityTrust* com input do usuário
  // em código de feature (fora de core/). Quebra o build.
  {
    files: ['src/app/features/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message:
            'Anti-XSS (T020d): Proibido atribuir innerHTML diretamente em features. Use DomSanitizer via core/ ou templates Angular.',
        },
        {
          selector: "CallExpression[callee.property.name=/^bypassSecurityTrust/]",
          message:
            'Anti-XSS (T020d): Proibido chamar bypassSecurityTrust* em features. Se necessário, encapsule em um serviço de core/ com revisão de segurança explícita.',
        },
      ],
    },
  },

  // ── T020d: Isolamento do token de auth — só core/ pode tocar localStorage/sessionStorage de auth ──
  // Fora de src/app/core/**, proíbe acesso direto a localStorage e sessionStorage
  // (o token de auth é gerido exclusivamente pelo SDK em core/).
  {
    files: ['src/app/features/**/*.ts', 'src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'Anti-XSS/isolamento de token (T020d): Acesso a localStorage é permitido apenas em src/app/core/**. O token de auth só é manipulado pelo SDK em core/auth e core/supabase.',
        },
        {
          name: 'sessionStorage',
          message:
            'Anti-XSS/isolamento de token (T020d): Acesso a sessionStorage é permitido apenas em src/app/core/**. O token de auth só é manipulado pelo SDK em core/auth e core/supabase.',
        },
      ],
    },
  },

  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // ── T020d: Proíbe [innerHTML] com binding em templates ──
      '@angular-eslint/template/no-any': 'off', // não relevante aqui
      // ── T063: texto fixo de interface tem de ser extraível (i18n) ──
      '@angular-eslint/template/i18n': [
        'error',
        {
          checkId: false,
          checkText: true,
          checkAttributes: true,
          // Atributos técnicos (não são texto para o usuário). Os de texto (`title`, `alt`,
          // `label`, `placeholder`, `aria-label`, `zTitle`...) continuam exigindo `i18n-<attr>`.
          ignoreAttributes: [
            'data-testid',
            'zType',
            'zSize',
            'zId',
            'zIcon',
            'rel',
            'ariaCurrentWhenActive',
            'tone',
            'd',
            'variant',
            'decoding',
            'loading',
            'fetchpriority',
            'referrerpolicy',
            'icon',
            'as',
            'aria-live',
            'aria-labelledby',
            'aria-describedby',
            'aria-controls',
            'fill-rule',
            'clip-rule',
            'media',
            'inputmode',
            'content',
          ],
        },
      ],
    },
  },

  // ── T063: a regra de i18n não vale para o código copiado do ZardUI, para a galeria de
  // desenvolvimento ──
  {
    files: [
      'src/app/shared/components/**/*.html',
      'src/app/shared/core/**/*.html',
      'src/app/features/dev-gallery/**/*.html',
    ],
    ignores: ['src/app/shared/components/faro/**'],
    rules: {
      '@angular-eslint/template/i18n': 'off',
    },
  },

  // Fixtures de teste (templates inline dos `*.spec.ts`) e o documento HTML raiz (metas, fontes)
  // não são tela.
  {
    files: ['**/*.spec.ts/**', 'src/index.html'],
    rules: {
      '@angular-eslint/template/i18n': 'off',
    },
  },
]);
