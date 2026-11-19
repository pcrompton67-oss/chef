import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Code checks run by `pnpm lint` (and Vercel's Lint check), issue #25.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A leading underscore marks a value that's unused on purpose.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  globalIgnores([
    // Next's default ignores:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // v0's leftover reference copies from the old app (not used).
    'v0_memories/**',
  ]),
])

export default eslintConfig
