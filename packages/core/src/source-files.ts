import type { Runtime } from './runtime.js';

/**
 * Every file under `src/`, as project-relative paths, sorted. Paths only — nothing is
 * read, so this is the cheaper of the two passes over `src/` (the component collector
 * already walks the same tree and reads every `.svelte`).
 *
 * Directory-shaped rules derive their directory set from these paths' ancestor prefixes
 * rather than globbing a second time; see `architecture/unit-entry-file`. The list is
 * sorted so anything that picks "the first file under a directory" is deterministic.
 *
 * Two properties of the result the directory-shaped rules depend on: a directory containing no file
 * at any depth does not appear among these paths' ancestor prefixes and so does not exist as far as
 * those rules are concerned, and dot directories never appear at all (see `Runtime.glob`).
 */
export async function collectSourceFiles(rt: Runtime, cwd: string): Promise<string[]> {
  const files = await rt.glob('src/**/*', cwd);
  return files.slice().sort();
}
