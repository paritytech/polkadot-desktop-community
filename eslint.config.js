import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import deMorgan from 'eslint-plugin-de-morgan';
import formatjs from 'eslint-plugin-formatjs';
import { importX } from 'eslint-plugin-import-x';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { localRules } from './eslint/localRules.js';

const boundaryTypes = ['shared', 'domains', 'aggregates', 'features', 'widgets', 'routes'];

const boundaryElements = boundaryTypes.map(type => ({
  type,
  pattern: `src/${type}/*`,
  capture: ['package'],
}));

const allowedEntryPoints = ['index.ts', 'index.tsx'];
const sharedAllowedEntryPoints = [...allowedEntryPoints, 'images/**/*'];

const entryPointsForType = type => (type === 'shared' ? sharedAllowedEntryPoints : allowedEntryPoints);

const boundaryDependencyRules = [
  { from: 'shared', allow: ['shared'] },
  { from: 'routes', allow: ['shared', 'features', 'widgets'] },
  { from: 'domains', allow: ['shared', 'domains'] },
  { from: 'aggregates', allow: ['shared', 'domains', 'aggregates'] },
  { from: 'features', allow: ['shared', 'features', 'aggregates', 'domains', 'widgets'] },
  { from: 'widgets', allow: ['shared', 'aggregates', 'domains', 'features', 'widgets'] },
].map(({ from, allow }) => ({
  from: { type: from },
  allow: allow.map(targetType => ({
    to: { type: targetType, internalPath: entryPointsForType(targetType) },
  })),
}));

const importXPathGroups = [
  ...boundaryTypes.map(type => ({
    group: 'parent',
    pattern: `@/${type}/**`,
    position: 'before',
  })),
  {
    group: 'external',
    pattern: '~config',
    position: 'before',
  },
];

export default tseslint.config(
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      '.vscode',
      '.idea',
      '.github',
      '.papi',
      'coverage',
      'release',
      'node_modules',
      'scripts/*',
      'coverage.txt',
      'junit.xml',
      'jest-unit-results.json',
      'package.json',
      'e2e/test-products/**',
      'vendor/**',
    ],
  },

  // Base JS recommended config
  js.configs.recommended,

  // Base configuration for all files
  {
    plugins: {
      prettier,
      'import-x': importX,
      'unused-imports': unusedImports,
      'de-morgan': deMorgan,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      // Prettier
      'prettier/prettier': 'error',

      // Import rules
      'import-x/no-unresolved': 'off',
      'import-x/named': 'off',
      'import-x/namespace': 'off',
      'import-x/no-named-as-default': 'error',
      // Fitness function: zero import cycles (see docs/abstract/review-framework.md, dims 6 & 9).
      'import-x/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
      'import-x/consistent-type-specifier-style': ['error', 'prefer-inline'],
      'import-x/order': [
        'error',
        {
          named: { enabled: true, types: 'types-first' },
          alphabetize: { order: 'asc', orderImportKind: 'asc' },
          groups: ['builtin', 'external', 'parent', ['sibling', 'index']],
          pathGroups: importXPathGroups,
          'newlines-between': 'always',
          distinctGroup: false,
        },
      ],

      // Unused imports
      'no-unused-vars': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      'no-irregular-whitespace': 'error',

      // de-morgan rules
      ...deMorgan.configs['recommended-legacy'].rules,
    },
  },

  // JS/MJS/CJS files configuration
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        projectService: true,
      },
      globals: {
        ...globals.node,
        vi: true,
      },
    },
  },

  // Test files configuration
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      'no-restricted-properties': 'off',
      'formatjs/no-literal-string-in-jsx': 'off',
    },
  },

  // TSX files with formatjs (non-test, non-stories)
  {
    files: ['**/*.tsx'],
    ignores: ['**/*.stories.tsx', '**/*.test.tsx'],
    plugins: {
      formatjs,
    },
    rules: {
      'formatjs/no-literal-string-in-jsx': 'warn',
    },
  },

  // TSX files with React
  {
    files: ['**/*.tsx'],
    plugins: {
      react,
    },
    languageOptions: {
      globals: {
        JSX: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      'react/jsx-no-useless-fragment': 'error',
      'react/jsx-no-constructed-context-values': 'error',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      'react/no-array-index-key': 'warn',
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-sort-props': ['error', { callbacksLast: true, noSortAlphabetically: true }],
      'react/function-component-definition': [
        'error',
        {
          namedComponents: 'arrow-function',
          unnamedComponents: 'arrow-function',
        },
      ],
    },
  },

  // TypeScript/TSX files configuration
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),

  // TypeScript/TSX with additional plugins and rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      boundaries,
      'local-rules': localRules,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver': {
        typescript: true,
        node: {
          extensions: ['.ts', '.tsx', '.js'],
        },
      },
      // For resolving in eslint-plugin-boundaries
      'import/resolver': {
        typescript: true,
        node: {
          extensions: ['.ts', '.tsx', '.js'],
        },
      },
      'boundaries/elements': boundaryElements,
      'boundaries/dependency-nodes': ['import'],
    },
    rules: {
      // Local rules
      'local-rules/no-self-import': [
        'error',
        {
          root: './src',
          exclude: ['pages'],
        },
      ],
      'local-rules/no-relative-import-from-root': [
        'error',
        {
          root: './src',
          exclude: [],
        },
      ],
      'local-rules/enforce-di-naming-convention': ['error'],

      'no-console': ['error', { allow: ['warn', 'error', 'info', 'group', 'groupCollapsed', 'groupEnd', 'table'] }],

      // Imports
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      // Validated by typescript
      'import-x/export': 'off',
      // Restricted by our code style
      'import-x/default': 'off',
      // Too heavy
      'import-x/no-rename-default': 'off',
      'import-x/no-useless-path-segments': 'off',
      'no-restricted-imports': [
        'error',
        {
          name: 'classnames',
          message: 'Use cnTw instead',
        },
        {
          name: '@polkadot/api',
          message: 'Use polkadot-api',
        },
      ],
      'import-x/max-dependencies': [
        'warn',
        {
          max: 25,
          ignoreTypeImports: true,
        },
      ],

      // Validated by typescript
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',

      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array', readonly: 'array' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // Boundaries setup
      ...boundaries.configs.recommended.rules,
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: boundaryDependencyRules,
        },
      ],
    },
  },

  // TypeScript/TSX production files (excludes tests/mocks)
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.test.tsx', '**/mocks/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],

      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/require-await': 'warn',

      'no-restricted-syntax': [
        'error',
        // for..in ban
        {
          message: 'Use `for..of` instead.',
          selector: 'ForInStatement',
        },
        // forEach ban
        {
          message: 'Use `for..of` instead.',
          selector: 'CallExpression[callee.property.name="forEach"][arguments.0.type="ArrowFunctionExpression"]',
        },
        {
          message: 'Unnecessary cnTw call, inline value inside an attribute',
          selector:
            'JSXExpressionContainer CallExpression[callee.name="cnTw"][arguments.length=1]>.arguments:first-child[type="Literal"]',
        },
      ],
    },
  },
);
