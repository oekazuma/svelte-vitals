import { join } from 'node:path';
import { CONFIG_FILENAMES } from '../config-file.js';
import { hasDep, readPkg } from '../pkg-json.js';

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
  return hasDep(readPkg(readFile, cwd), 'svelte-vitals');
}

/**
 * Pick the best extension for a freshly-scaffolded config file: `.ts` when the project
 * looks TypeScript-oriented (a `tsconfig.json` or a `vite.config.ts` at the project root)
 * *and* `svelte-vitals` is a declared dependency (the `.ts` template's runtime
 * `defineConfig` import must resolve — see `hasSvelteVitalsDependency`); `.js` otherwise.
 * Both load natively on every supported Node (engines.node >=24.16.0); `.js` assumes the
 * project is `"type": "module"` — SvelteKit's default. Only consulted when no config file
 * exists yet — regenerating an existing one (`--force`) always keeps that file's own
 * extension rather than switching formats underneath the user.
 */
export function detectBestConfigExtension(opts: {
  readFile: (path: string) => string | undefined;
  cwd: string;
}): 'ts' | 'js' {
  const looksTypeScript =
    opts.readFile(join(opts.cwd, 'tsconfig.json')) !== undefined ||
    opts.readFile(join(opts.cwd, 'vite.config.ts')) !== undefined;
  if (!looksTypeScript) return 'js';
  return hasSvelteVitalsDependency(opts.readFile, opts.cwd) ? 'ts' : 'js';
}
