import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
  includeIgnoreFile(gitignorePath),
  // Test fixtures are intentionally minimal/varied SvelteKit inputs, not source.
  { ignores: ['**/test/fixtures/**'] },
  // Astro-generated type files (listed in docs/.gitignore, not root .gitignore)
  { ignores: ['**/.astro/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  // @svelte-vitals/core is runtime-agnostic by contract (design §8, see packages/core/src/index.ts):
  // no node: imports, no I/O, no runtime-specific globals. Enforce it here so a violation
  // fails `pnpm lint` / CI instead of relying on review. I/O is injected via the Runtime
  // interface. The bare-builtin ban list is generated from node:module's builtinModules
  // (plus a `/*` variant for subpaths like `path/posix`) so it can never go stale.
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', ...builtinModules, ...builtinModules.map((m) => `${m}/*`)],
              message:
                '@svelte-vitals/core is runtime-agnostic (design §8): no Node builtins here — inject I/O through the Runtime interface (src/runtime.ts).'
            }
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'core is runtime-agnostic (design §8): no runtime-specific globals.' },
        { name: '__dirname', message: 'core is runtime-agnostic (design §8): no runtime-specific globals.' },
        { name: '__filename', message: 'core is runtime-agnostic (design §8): no runtime-specific globals.' },
        { name: 'Buffer', message: 'core is runtime-agnostic (design §8): no runtime-specific globals.' }
      ]
    }
  }
);
