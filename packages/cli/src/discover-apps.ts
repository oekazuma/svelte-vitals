import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { glob } from 'tinyglobby';

/**
 * Find SvelteKit apps under `cwd` for the monorepo picker (design doc
 * 2026-07-08-monorepo-app-picker-design.md): directories containing
 * svelte.config.{js,ts} AND src/routes (excludes component libraries, which
 * have a config but nothing to analyze). Returns sorted cwd-relative POSIX
 * paths. Depth-capped and ignore-listed so a huge repo stays fast.
 */
export async function discoverApps(cwd: string): Promise<string[]> {
  const configs = await glob('**/svelte.config.{js,ts}', {
    cwd,
    dot: false,
    deep: 4,
    ignore: ['**/node_modules/**', '**/.svelte-kit/**', '**/build/**', '**/dist/**', '**/.git/**']
  });
  const dirs = [...new Set(configs.map((c) => dirname(c)))].filter(
    (d) => d !== '.' && existsSync(join(cwd, d, 'src', 'routes'))
  );
  return dirs.sort();
}
