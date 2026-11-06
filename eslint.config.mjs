import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Design tokens centralisés (docs/DESIGN_ET_MARQUE.md §2.1) : aucune couleur codée en dur
    // dans les composants et les pages.
    files: ['src/components/**/*.tsx', 'src/app/**/*.tsx'],
    ignores: ['src/app/brand/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Couleur codée en dur : utilise un token de src/app/globals.css.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Couleur codée en dur : utilise un token de src/app/globals.css.',
        },
      ],
    },
  },
];

export default config;
