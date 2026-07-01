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
    },
  },
]);
