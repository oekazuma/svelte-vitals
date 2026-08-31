import { existsSync, type Dirent } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { globFiles } from './glob.js';
import { hasDep, parsePkg } from './pkg-json.js';

const IGNORED_DIRS = new Set(['node_modules', '.svelte-kit', 'build', 'dist', '.git']);
// Directory descent cap: matches stay ≤ 4 path segments deep so a huge repo stays fast.
const MAX_DEPTH = 4;

const pruneFor =
  (cwd: string) =>
  (entry: Dirent): boolean => {
    if (!entry.isDirectory()) return false;
    if (IGNORED_DIRS.has(entry.name)) return true;
    return relative(cwd, join(entry.parentPath, entry.name)).split(sep).length >= MAX_DEPTH;
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
  const prune = pruneFor(cwd);
  const [configs, pkgJsons] = await Promise.all([
    globFiles('**/svelte.config.{js,ts}', cwd, prune),
    globFiles('**/package.json', cwd, prune)
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
