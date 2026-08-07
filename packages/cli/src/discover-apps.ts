import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { glob } from 'tinyglobby';
import { hasDep, parsePkg } from './pkg-json.js';

const GLOB_OPTS = {
  dot: false,
  deep: 4,
  ignore: ['**/node_modules/**', '**/.svelte-kit/**', '**/build/**', '**/dist/**', '**/.git/**']
};

/** True if `pkgJsonPath` declares `@sveltejs/kit` as a dependency. Missing or malformed package.json — not a candidate. */
async function hasKitDependency(pkgJsonPath: string): Promise<boolean> {
  const raw = await readFile(pkgJsonPath, 'utf8').catch(() => undefined);
  return hasDep(parsePkg(raw), '@sveltejs/kit');
}

/**
 * Find SvelteKit apps under `cwd` for the monorepo picker (design doc
 * 2026-07-08-monorepo-app-picker-design.md): directories containing
 * (svelte.config.{js,ts} OR a package.json with `@sveltejs/kit`) AND
 * src/routes (excludes component libraries, which have neither signal
 * paired with anything to analyze). The package.json signal mirrors
 * `detectProject`'s own SvelteKit-app check (design §17) and matters
 * because current `sv create` output folds SvelteKit config into
 * `vite.config.ts` and emits no separate svelte.config file — a
 * config-only glob would silently fail to discover such an app. Returns
 * sorted cwd-relative POSIX paths. Depth-capped and ignore-listed so a
 * huge repo stays fast.
 */
export async function discoverApps(cwd: string): Promise<string[]> {
  const [configs, pkgJsons] = await Promise.all([
    glob('**/svelte.config.{js,ts}', { cwd, ...GLOB_OPTS }),
    glob('**/package.json', { cwd, ...GLOB_OPTS })
  ]);

  const configDirs = configs.map(dirname);
  const kitDepDirs: string[] = [];
  for (const pkgJson of pkgJsons) {
    const dir = dirname(pkgJson);
    if (dir !== '.' && (await hasKitDependency(join(cwd, pkgJson)))) {
      kitDepDirs.push(dir);
    }
  }

  const dirs = [...new Set([...configDirs, ...kitDepDirs])].filter(
    (d) => d !== '.' && existsSync(join(cwd, d, 'src', 'routes'))
  );
  return dirs.sort();
}
