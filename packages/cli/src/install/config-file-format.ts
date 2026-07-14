import { join } from 'node:path';

/**
 * Node versions from which native TypeScript type-stripping is unflagged — the same
 * threshold `loadConfigFile` (../config-file.ts) documents for loading a
 * `svelte-vitals.config.ts`: 22.18+ or 23.6+. This repo's own floor is 22.13, so
 * 22.13–22.17 needs `--experimental-strip-types` and can't reliably load `.ts` without it.
 */
export function nodeSupportsNativeTypeScript(version: string): boolean {
  const match = /^v?(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);
}

/** `svelte-vitals.config.*` candidate filenames, in the loader's priority order (../config-file.ts). */
export const CONFIG_FILE_CANDIDATES = [
  'svelte-vitals.config.mjs',
  'svelte-vitals.config.js',
  'svelte-vitals.config.ts'
];

/** The config-file candidate that already exists in `cwd` (loader priority order), or undefined. */
export function findExistingConfigFile(
  readFile: (path: string) => string | undefined,
  cwd: string
): string | undefined {
  return CONFIG_FILE_CANDIDATES.find((rel) => readFile(join(cwd, rel)) !== undefined);
}

/**
 * Pick the best extension for a freshly-scaffolded config file: `.ts` when the current
 * Node can load it natively *and* the project looks TypeScript-oriented (a `tsconfig.json`
 * or a `vite.config.ts` at the project root); `.mjs` otherwise — the safe, unambiguously-ESM
 * default that works on every Node version svelte-vitals supports, no flag required. Only
 * consulted when no config file exists yet — regenerating an existing one (`--force`) always
 * keeps that file's own extension rather than switching formats underneath the user.
 */
export function detectBestConfigExtension(opts: {
  readFile: (path: string) => string | undefined;
  cwd: string;
  nodeVersion: string;
}): 'ts' | 'mjs' {
  if (!nodeSupportsNativeTypeScript(opts.nodeVersion)) return 'mjs';
  const looksTypeScript =
    opts.readFile(join(opts.cwd, 'tsconfig.json')) !== undefined ||
    opts.readFile(join(opts.cwd, 'vite.config.ts')) !== undefined;
  return looksTypeScript ? 'ts' : 'mjs';
}
