// Flat config for ESLint v9
// Mirrors rules from legacy .eslintrc.cjs
// Using TypeScript via built-in parser in ESLint 9
import js from '@eslint/js';
import eslintPluginImport from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-config-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  js.configs.recommended,
  // Browser-targeted source files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      'no-undef': 'off'
    }
  },
  // Test files run in Node via Vitest
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: { require: 'readonly', process: 'readonly' }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    },
    plugins: {
      import: eslintPluginImport,
      'unused-imports': unusedImports,
      '@typescript-eslint': tsPlugin
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'import/no-unresolved': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': 'off'
    }
  },
  eslintConfigPrettier
];
