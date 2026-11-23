import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**', 'dist-server/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  sonarjs.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      unicorn,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-undef': 'off',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      complexity: ['error', 15],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'log'] }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'unicorn/error-message': 'error',
      'unicorn/new-for-builtins': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/no-for-loop': 'error',
      'unicorn/no-invalid-remove-event-listener': 'error',
      'unicorn/no-lonely-if': 'error',
      'unicorn/no-useless-fallback-in-spread': 'error',
      'unicorn/no-useless-undefined': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-at': 'error',
      'unicorn/prefer-export-from': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-optional-catch-binding': 'error',
      'unicorn/prefer-set-has': 'error',
      'unicorn/prefer-string-starts-ends-with': 'error',
      'unicorn/throw-new-error': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/todo-tag': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'api/**/*.ts', 'server.ts'],
    rules: {
      'max-lines': ['error', { max: 210, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 45, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      'no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 1, 2],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],
    },
  },
  {
    files: ['src/App.tsx', 'src/components/**/*.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/constants/**/*.ts', 'src/components/illustrations/**/*.tsx', 'src/i18n/**/*.ts'],
    rules: {
      'no-magic-numbers': 'off',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'no-magic-numbers': 'off',
    },
  },
];
