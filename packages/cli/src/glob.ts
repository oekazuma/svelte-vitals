import type { Dirent } from 'node:fs';
import { glob } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * `node:fs` glob constrained to the contract callers rely on: files only (fs.glob also matches
 * directories), cwd-relative POSIX-separated paths on every platform (fs.glob returns platform
 * separators), dotfiles excluded (fs.glob's default). `exclude` prunes traversal — returning
 * true for a directory skips its whole subtree.
 */
export async function globFiles(
  pattern: string | string[],
  cwd: string,
  exclude?: (entry: Dirent) => boolean
): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of glob(pattern, { cwd, withFileTypes: true, ...(exclude ? { exclude } : {}) })) {
    if (!entry.isFile()) continue;
    const rel = relative(cwd, join(entry.parentPath, entry.name));
    out.push(sep === '/' ? rel : rel.split(sep).join('/'));
  }
  return out;
}
