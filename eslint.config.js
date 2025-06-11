import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import react from 'eslint-plugin-react';

const sharedRules = {
  ...typescript.configs.recommended.rules,
  '@typescript-eslint/no-unused-vars': [
    'warn',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  'no-console': 'off',
  'prefer-const': 'error',
  'no-var': 'error',
  'no-useless-escape': 'warn',
  'no-undef': 'error',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      '**/*.d.ts',
    ],
  },
  // Base TypeScript configuration for all files
  {
    files: ['**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
  },
  // Server-side (Node.js) configuration
  {
    files: [
      'packages/mcp-server/**/*.{js,ts}',
      '**/scripts/**/*.{js,ts}',
      '*.config.{js,ts}', // For tailwind.config.js, etc.
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: sharedRules,
  },
  // Test files configuration (Jest)
  {
    files: [
      '**/__tests__/**/*.{js,ts}',
      '**/*.test.{js,ts}',
      '**/*.spec.{js,ts}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: sharedRules,
  },
  // Client-side (React/Next.js) configuration
  {
    files: ['apps/**/*.{js,ts,jsx,tsx}', 'packages/ui/**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node, // For Next.js API routes
        React: 'readonly',
        JSX: 'readonly',
        // Fetch API types for TypeScript
        RequestInit: 'readonly',
        RequestInfo: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        SpeechRecognition: 'readonly',
        webkitSpeechRecognition: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
    },
    rules: {
      ...sharedRules,
      'react/prop-types': 'off', // Optional: if you use TypeScript for props
      'react/react-in-jsx-scope': 'off', // Optional: for Next.js/React 17+
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  prettier,
];
