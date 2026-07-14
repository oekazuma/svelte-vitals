import { join } from 'node:path';
import { CONFIG_FILENAMES } from '../config-file.js';

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

/** The config-file candidate that already exists in `cwd` (loader priority order), or undefined. */
export function findExistingConfigFile(
  readFile: (path: string) => string | undefined,
  cwd: string
): string | undefined {
  return CONFIG_FILENAMES.find((rel) => readFile(join(cwd, rel)) !== undefined);
}

/**
 * Whether `svelte-vitals` is declared in the project's own package.json (dependencies or
 * devDependencies). The `.ts` template's `import { defineConfig } from 'svelte-vitals'` is a
 * *runtime* import — it must resolve when `loadConfigFile` import()s the config — so a project
 * that only ever runs the CLI via `npx` (nothing in node_modules) must not get that template:
 * it would break every subsequent run with ERR_MODULE_NOT_FOUND.
 */
export function hasSvelteVitalsDependency(readFile: (path: string) => string | undefined, cwd: string): boolean {
  const raw = readFile(join(cwd, 'package.json'));
  if (raw === undefined) return false;
  try {
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return Boolean(pkg.dependencies?.['svelte-vitals'] ?? pkg.devDependencies?.['svelte-vitals']);
  } catch {
    return false;
  }
}

/**
 * Whether the project's package.json declares `"type": "module"` — decides the module syntax
 * a regenerated `.js` config must use (`export default` vs `module.exports`), since
 * `loadConfigFile`'s import() parses a `.js` file per the package type.
 */
export function isEsmProject(readFile: (path: string) => string | undefined, cwd: string): boolean {
  const raw = readFile(join(cwd, 'package.json'));
  if (raw === undefined) return false;
  try {
    return (JSON.parse(raw) as { type?: string }).type === 'module';
  } catch {
    return false;
  }
}

/**
 * Pick the best extension for a freshly-scaffolded config file: `.ts` when the current
 * Node can load it natively, the project looks TypeScript-oriented (a `tsconfig.json`
 * or a `vite.config.ts` at the project root), *and* `svelte-vitals` is a declared
 * dependency (the `.ts` template's runtime `defineConfig` import must resolve — see
 * `hasSvelteVitalsDependency`); `.mjs` otherwise — the safe, unambiguously-ESM default
 * that works on every Node version svelte-vitals supports, no flag required. Only
 * consulted when no config file exists yet — regenerating an existing one (`--force`)
 * always keeps that file's own extension rather than switching formats underneath the user.
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
  if (!looksTypeScript) return 'mjs';
  return hasSvelteVitalsDependency(opts.readFile, opts.cwd) ? 'ts' : 'mjs';
}
