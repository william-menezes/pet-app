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
  {
    // ── Invariante Rescue-First / two-bundle (constituição I) ──
    // A rota pública (features/public) deve ser enxuta e independente do painel e da
    // assinatura. Ela NÃO pode importar features do painel, auth nem billing.
    files: ['src/app/features/public/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/pets/**',
                '**/admin/**',
                '**/health-records/**',
                '**/subscription/**',
                '**/reminders/**',
                '**/auth/**',
                '**/billing/**',
                '**/core/auth/**',
                '**/core/billing/**',
              ],
              message:
                'Rescue-First/two-bundle: features/public não pode importar o painel, auth ou billing. A rota pública precisa funcionar mesmo com assinatura inativa.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
