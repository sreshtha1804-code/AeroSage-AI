import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/** Quality gates that apply to all application code. */
const qualityRules = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-console': 'error',
  'no-var': 'error',
  'prefer-const': 'error',
  'no-param-reassign': 'error',
  'no-nested-ternary': 'error',
  'no-else-return': 'error',
  curly: ['error', 'all'],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  complexity: ['error', 15],
  'max-depth': ['error', 4],
  'max-params': ['error', 4],
};

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
    rules: { ...qualityRules },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: 'detect' } },
    rules: {
      ...qualityRules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react/prop-types': 'off',
    },
  },
  {
    files: ['tests/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react/prop-types': 'off',
      'react/display-name': 'off',
    },
  },
];
