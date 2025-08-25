import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'lib/generated/**',
      'prisma/migrations/**',
    ],
  },
  {
    rules: {
      // Allow any types for now - can be made stricter later
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow unused variables prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Allow unescaped entities in JSX - common in user-facing text
      'react/no-unescaped-entities': 'off',

      // Relax exhaustive deps rule - can cause issues with complex dependencies
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default eslintConfig;
