import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Code checks run by `pnpm lint` (and Vercel's Lint check), issue #25.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React's newer advice against filling state inside an effect. The
      // console screens that do it (load, then fill a form) work correctly;
      // kept as a warning so it's visible without failing the check.
      'react-hooks/set-state-in-effect': 'warn',
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
